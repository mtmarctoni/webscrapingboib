
import axios from 'axios';
import { load } from 'cheerio';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import download from 'download';
import { resolve as _resolve } from "path";
import ora from 'ora';

//import global variables
import {
    domainUrl,
    url,
    wordsToSearch,
    customers,
    sendEmailBool,
    emailUser,
    emailRecipients,
    months,
    lastBoibInfoFile
} from './modules/global.js';

import {
    lastBoibInfo,
    transporter,
    previousBoibInfo,
    downloadedPdfPaths,
    numMatches
} from './modules/global.js';

const resetInfo = () => {
    const newInfo = {
        ultimoBoletin: "",
        isExtraordinary: false,
        idBoib: 0,
        idAnualBoib: 0,
        dateLastBoib: "",
        linkUltimoBoletin: "",
        customersMatched: [],
        sectionLinks: []
    };

    return newInfo;
}


const readDataBase = () => {

    return new Promise(async (resolve, reject) => {
 
        if (!existsSync(lastBoibInfoFile)) {
            console.log('Archivo json no existe. Creando uno nuevo...');
            lastBoibInfo = resetInfo();
            await fs.writeFile(lastBoibInfoFile, JSON.stringify(lastBoibInfo), 'utf8');
            console.log(`Archivo ${lastBoibInfoFile} creado.`);
        } else {
            const res = await fs.readFile(lastBoibInfoFile, 'utf8');
            if (!res) {
                console.log('Archivo json vacío.');
                lastBoibInfo = resetInfo();
    
            } else {
                const data = JSON.parse(res)
                previousBoibInfo = data;
                lastBoibInfo = resetInfo();
                console.log('Datos obtenidos de la base de datos');
    
            }
            
        }

        resolve()
        //process.exit()
    })
}

const getLastBoib = async () => {
    console.log('Cogiendo información del último BOIB');
    const res = await axios.get(url);
    const $ = load(res.data);
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
        const $ = load(html);
        //first know if Boib extraordinari and id anual number
        lastBoibInfo.isExtraordinary = $('a.fijo p').last().text().includes("Extraordinari");
        lastBoibInfo.isExtraordinary ? console.log("BOIB Extraordinari") : console.log("BOIB ordinari");
        
    
        const $sectionMenuHtml = load($('.primerosHijos').prop('outerHTML'));
        
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
        const $ = load(html);
        const llistatElement = $('.llistat');

        if (llistatElement.length) {
            const $docList = load(llistatElement.prop('outerHTML'));
            // Continúa con tu código aquí...
            $docList('ul.resolucions').each((j, elems) => {
                let docListObject = {
                    id: "",
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
                    let idText = $docList(elem).parents('ul.resolucions').first().find('p.registre').first().text().trim();
                    let id = idText.split('-')[0].split(' ').reverse()[1]
                    docListObject.downloadPdfLink = domainUrl + link;
                    docListObject.description = description;
                    docListObject.id = id;
                } else if (!(link.endsWith('xml')) && !(link.endsWith('rdf'))) {
                    docListObject.htmlLink = link;
    
                } else {
                    //console.log(docListObject);
                    lastBoibInfo.sectionLinks[sectionObject.id].docList.push(docListObject);
                    
                }
                
                })
            
            })
            
            
            
        } else {
            console.log("No se ha encontrado el elemento con la clase 'llistat'. en " + sectionLink);
        }      
        
       
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
    const folderPath = _resolve(__dirname, 'BOIBpdfs', folderName) + "/";
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
    numMatches = 0;
    
    for (let link of links) {
        //first we get the doc id
        let docObj;
        lastBoibInfo.sectionLinks.forEach(sectionLink => {
            sectionLink.docList.forEach(obj => {
                if (obj.htmlLink === link) {
                    docObj = obj;
                }
            })
        })
        //console.log('ID: ' + id);
        const res = await axios.get(link)
        const $ = load(res.data);
        const tables = $('table')
        //let section = $('#boibDetall').text()
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
                            let match = `PDF ${docObj.id} -> Table ${i + 1}, row ${j + 1}, cell ${k + 1}: ${cellText.trim()}`;
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
        await fs.writeFile(lastBoibInfoFile, JSON.stringify(lastBoibInfo, null, 0));
        console.log('Datos guardados');
        resolve();
    });
    
}

const sendEmailWithAttachments = () => {
    //console.log(downloadedPdfPaths);
    //compose body email
    let emailBody = `
    Hola, este es un correo automático.
    `;
    if (downloadedPdfPaths.length === 0) {
        emailBody = emailBody.concat(`

        No se han encontrado BOIBs según los criterios de búsqueda siguientes:

        - ${wordsToSearch}

        `)
    } else {
        emailBody = emailBody.concat(`
        Adjunto están los ${downloadedPdfPaths.length} BOIBs que se han encontrado según los siguientes criterios de búsqueda siguientes:   
            
        - ${wordsToSearch}

        `)
        if (numMatches === 0) {
            emailBody = emailBody.concat(`
            De estos BOIBs no se ha podido encontrar ninguna coincidencia con los nombres de los clientes proporcionados:

            - ${customers}

            `); 
        } else {
            emailBody = emailBody.concat(`
            ¡¡¡OJO!!! Se han encontrado ${numMatches} coincidencias con los nombres de los clientes proporcionados:
            
            - ${customers}
            
            `);
        }
    }
    emailBody = emailBody.concat(`
    Que tengas un buend día.

    Marc de DocsEE
    Documentación Eficiente y Eficaz
    `)
    let attachments = downloadedPdfPaths.map(path => {
        return {
                filename: path.split('/').pop(),
                path: path // Cambia esto por la ruta al archivo que quieres adjuntar
            }
        
    })
    //console.log(attachments);
    let mailOptions = {
        from: emailUser,
        to: emailRecipients.join(', '),
        subject: `[NUEVO BOIB] ${lastBoibInfo.ultimoBoletin}`,
        text: emailBody,
        attachments: attachments
    };
    console.log(`Enviando email a ${emailRecipients.join(', ')}`);
    return transporter.sendMail(mailOptions);
}   

const wait = async (time) =>{
    return new Promise((res, rej)=>{
        setTimeout(()=> res(),time)
    })
}

const main = async () => {
    console.log('----------');
    console.log(new Date(Date.now()));
    await readDataBase();
    await getLastBoib();
    if (lastBoibInfo.linkUltimoBoletin === previousBoibInfo.linkUltimoBoletin) {
        console.log("No hay nuevo BOIB");
        console.log(`${lastBoibInfo.ultimoBoletin}\n`);
        console.log('Saliendo...');
        console.log('----------');
        //wait x seconds before exitting
        await wait(1000);
        process.exit()
    
    } else {
        console.log("Hay nuevo BOIB!!!!");
        console.log(lastBoibInfo.ultimoBoletin);
    }

    await getSectionLinks(lastBoibInfo.linkUltimoBoletin);
    //console.log(lastBoibInfo.sectionLinks);

    for (let i = 0; i < lastBoibInfo.sectionLinks.length; i++) {
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
    
    if (sendEmailBool) {
        await sendEmailWithAttachments();
        //here we could add an EAUTH error management
    }
    console.log('----------');
    
}


main();