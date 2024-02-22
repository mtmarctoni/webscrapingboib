
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
//require("dotenv").config();
const download = require('download');
const path = require("path");
const ora = require('ora');

//import global variables
const {
    domainUrl,
    url,
    wordsToSearch,
    customers,
    emailUser,
    emailBody,
    months
} = require('./modules/global')

let {
    transporter,
    lastBoibInfo,
    previousBoibLink,
    downloadedPdfPaths
} = require('./modules/global')

const resetInfo = () => {
    lastBoibInfo = {
        ultimoBoletin: "",
        isExtraordinary: false,
        idBoib: 0,
        idAnualBoib: 0,
        dateLastBoib: "",
        linkUltimoBoletin: "",
        customersMatched: [],
        sectionLinks: []
    } 
}


const readDataBase = () => {

    return new Promise(async (resolve, reject) => {
        const res = await fs.readFile('lastBoibInfo.json', 'utf8');
        if (!res) {
            console.log('Archivo json vacío.');
            resetInfo();

        } else {
            const data = JSON.parse(res)
            lastBoibInfo = data;
            console.log('Datos obtenidos de la base de datos');
            previousBoibLink = lastBoibInfo.linkUltimoBoletin;

        }

        resolve()
        //process.exit()
    })
}

const getLastBoib = async () => {
    console.log('Cogiendo información del último BOIB');
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);
    // Now use the cheerio selectors to find the data you want in the HTML
    // For example, if the data is in a div with the class 'myClass', you could do:
    const ultimoBoletin = $('div.ultimoBoletin div.caja.whitebg p a').text().replace(/\s+/g, ' ').trim();
    const subLinkUltimoBoletin = $('div.ultimoBoletin div.caja.whitebg p a').attr('href');
    const anoUltimoBoletin = ultimoBoletin.match(/(\d{4})$/)[0];
    const idUltimoBoletin = subLinkUltimoBoletin.split('/').reverse()[1];
    const wordsLastBoib = ultimoBoletin.split(" ");
    const idAnualBoib = wordsLastBoib[6];

    //get the last boib date 
    let monthNumber = months.indexOf(wordsLastBoib[9]) + 1;
    (monthNumber < 10) ? monthNumber = '0' + monthNumber : monthNumber;
    const stringDatelastBoib = wordsLastBoib[11] + '-' + monthNumber + '-' + wordsLastBoib[7];
    const dateLastBoib = new Date(stringDatelastBoib);

    //fill 'lastBoibInfo' object
    lastBoibInfo.ultimoBoletin = ultimoBoletin;
    lastBoibInfo.idBoib = idUltimoBoletin;
    lastBoibInfo.idAnualBoib = idAnualBoib;
    lastBoibInfo.dateLastBoib = dateLastBoib;
    lastBoibInfo.linkUltimoBoletin = `${url}/${anoUltimoBoletin}/${idUltimoBoletin}`;     

}

const getSectionLinks = (link) => {  
    
    return axios.get(link)
    .then(response => {
        const html = response.data;
        const $ = cheerio.load(html);
        //first know if Boib extraordinari and id anual number
        lastBoibInfo.isExtraordinary = $('a.fijo p').last().text().includes("Extraordinari");
        lastBoibInfo.isExtraordinary ? console.log("BOIB Extraordinari") : console.log("BOIB ordinari");
        
    
        const $sectionMenuHtml = cheerio.load($('.primerosHijos').prop('outerHTML'));
        
        $sectionMenuHtml('li').each((i, elem) => {
            let link = domainUrl.concat($sectionMenuHtml(elem).find('a').attr('href'));
            let sectionObject = {
                id: i,
                titulo: link.split('/').reverse()[1].replace(/-/g,' '),
                link: link,
                docList: []
            }
            lastBoibInfo.sectionLinks.push(sectionObject);
        })
        //console.log(lastBoibInfo.sectionLinks); 
        
    })
    .catch(console.error);

}

const getDocLists = (sectionLink) => {
    let sectionObject = lastBoibInfo.sectionLinks.filter(obj => obj.link === sectionLink)[0];

    if (!sectionObject) {
        console.error('No se encontro la sección');
        return;
    }

    //console.log(sectionObject.id);

    return axios.get(sectionLink)
    .then(response => {
        const html = response.data;
        const $ = cheerio.load(html);    
        const $docList = cheerio.load($('.llistat').prop('outerHTML'));
        //let counter = 0;
        
        
        $docList('ul.resolucions').each((j, elems) => {
            let docListObject = {
                id: j,
                htmlLink: "",
                description: "",
                downloadPdfLink: ""
            }

            $docList(elems).find('a').each((i, elem) => {
            let link = $docList(elem).attr('href');
            //console.log(fatherElement);            
            //console.log(link);            
            
            if (link.startsWith('/eboibfront/pdf/')) {
                let description = $docList(elem).parents('ul.resolucions').first().find('p').first().text();
                docListObject.downloadPdfLink = domainUrl + link;
                docListObject.description = description;
            } else if (link.includes('intranet.caib.es') && !(link.endsWith('rdf'))) {
                docListObject.htmlLink = link;

            } else {
                //console.log(docListObject);
                lastBoibInfo.sectionLinks[sectionObject.id].docList.push(docListObject);
                
            }
            
            })
        
        })
       
    })
    .catch(console.error);

}

const getSpecificBoib = (wordsToSearch) => {

    console.log(`\nBuscando documentos que contengan:\n${wordsToSearch}\n`);
    //flatMap does the same as map but 'flatting' the output in one  single array instead of an array of arrays
    let filteredList = lastBoibInfo.sectionLinks.flatMap(section => {
        return section.docList.filter(doc => {
            return wordsToSearch.some(word => doc.description.includes(word))
        })
    })

    if (filteredList.length == 0){
        console.log("No hay documentos con estos criterios de búsqueda\n");
        return [];
    }else{
        console.log(`${filteredList.length} BOIBs encontrados`);
        return filteredList;
    }

    //con los elementos de 'filteredList' ya hacemos lo que queremos
    //1 nos bajamos el pdf
    //2 entramos en el link html para buscar nombres de cliente
}

const downloadPdfs = async (links) => {
    //console.log(links);
    let date = lastBoibInfo.dateLastBoib;
    const folderName = `${lastBoibInfo.idAnualBoib}_${date.getDate()}-${date.getMonth()+1}-${date.getFullYear()}`;
    const folderPath = path.resolve(__dirname, 'BOIBpdfs', folderName) + "/";
    const spinner = ora(`Los pdfs se descargan en:\n${folderPath}`).start()
    for (let link of links) {
        await download(link, folderPath);  
        spinner.text = `Descargado ${link}`;
    }
    spinner.succeed(`Descarga completada`)
    const downloadedPdfNames = await fs.readdir(folderPath);
    downloadedPdfPaths = downloadedPdfNames.map(file => file = `${folderPath}${file}`);

}

const searchForCustomers = async (links) => {
    console.log(`Looking for ${customers} in: \n${links}\n`);
    let numMatches = 0;
    
    for (let link of links) {

        const res = await axios.get(link)
        const $ = cheerio.load(res.data);
        const tables = $('table')

        tables.each((i, table) => {
            const rows = $(table).find('tr'); // select all rows in the current table
        
            rows.each((j, row) => {
                const cells = $(row).find('td'); // select all cells in the current row
        
                cells.each((k, cell) => {
                    const cellText = $(cell).text();
                    //console.log(cellText);                    
                    customers.forEach(customer => {
                        if (cellText.toLowerCase().includes(customer.toLowerCase())) {
                            numMatches++
                            let match = `Table ${i + 1}, row ${j + 1}, cell ${k + 1}: ${cellText.trim()}`;
                            lastBoibInfo.customersMatched.push(match)
                            console.log(`Match found in ${match}`);
                        }
                    });
                });
            });
        });
    
    }

console.log(`Se han encontrado ${numMatches} coincidencias`);

}

const writeDataBase = () => {
    console.log('Escribiendo datos obtenidos en la base de datos');

    return new Promise(async (resolve, reject) => {
        await fs.writeFile('lastBoibInfo.json', JSON.stringify(lastBoibInfo, null, 0));
        console.log('Datos guardados');
        resolve();
        });
    
}

const sendEmailWithAttachments = () => {
    //console.log(downloadedPdfPaths);
    let attachments = downloadedPdfPaths.map(path => {
        return {
                filename: path.split('/').pop(),
                path: path // Cambia esto por la ruta al archivo que quieres adjuntar
            }
        
    })
    //console.log(attachments);
    let mailOptions = {
        from: emailUser,
        to: emailUser,
        subject: `[NUEVO BOIB] ${lastBoibInfo.ultimoBoletin}`,
        text: emailBody,
        attachments: attachments
    };
    console.log(`Enviando email a ${emailUser}`);
    return transporter.sendMail(mailOptions);
}

const main = async () => {

    await readDataBase();
    await getLastBoib();
    if (lastBoibInfo.linkUltimoBoletin === previousBoibLink) {
        console.log("No hay nuevo BOIB");
        console.log(`${lastBoibInfo.ultimoBoletin}\n`);
        console.log('Saliendo...');
        process.exit();
    } else {
        console.log("Hay nuevo BOIB!!!!");
        console.log(lastBoibInfo.ultimoBoletin);
    }

    await getSectionLinks(lastBoibInfo.linkUltimoBoletin);
    //console.log(lastBoibInfo.sectionLinks);

    for (let i = 1; i < lastBoibInfo.sectionLinks.length; i++) {
        //console.log(`Link ${i} ${lastBoibInfo.sectionLinks[i].titulo}`);
        await getDocLists(lastBoibInfo.sectionLinks[i].link);

    };

    //función para buscar si alguna de las palabras en 'wordsToSearh' se encuentra en alguna de las descripciones y obtener el objeto
    const filteredList = getSpecificBoib(wordsToSearch);
    if (filteredList.length !== 0) {
        let pdfLinks = filteredList.map(x => x.downloadPdfLink);
        let htmlLinks = filteredList.map(x => x.htmlLink);

        await downloadPdfs(pdfLinks);

        if (true) {
            await searchForCustomers(htmlLinks);
            
        }
    }
    
    await writeDataBase();
    
    await sendEmailWithAttachments();
    //here we could add an EAUTH error management
    
    //coger los html links
    //ir a cada página y  buscar el nombre de los clientes
    //avisar de qué documento es que hay algún cliente que aparece
    //descargar esos documentos
}

main();    