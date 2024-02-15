const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// The URL of the BOIB website or the specific page you want to scrape
const domainUrl = 'https://www.caib.es'
const url = domainUrl.concat('/eboibfront/ca');
let lastBoibInfo = {};
let previousBoibLink = "";

fs.readFile('lastBoibInfo.json', (err, data) => {
    if (err) throw err;
    lastBoibInfo = JSON.parse(data);
    previousBoibLink = lastBoibInfo.linkUltimoBoletin;
    console.log('Datos obtenidos de lastBoibInfo.json');
})

const getLastBoib = () => {

   return axios.get(url)
    .then(response => {
        const html = response.data;
        const $ = cheerio.load(html);
        // Now use the cheerio selectors to find the data you want in the HTML
        // For example, if the data is in a div with the class 'myClass', you could do:
        const ultimoBoletin = $('div.ultimoBoletin div.caja.whitebg p a').text().replace(/\s+/g, ' ').trim();
        const subLinkUltimoBoletin = $('div.ultimoBoletin div.caja.whitebg p a').attr('href');
        const anoUltimoBoletin = ultimoBoletin.match(/(\d{4})$/)[0];
        const idUltimoBoletin = subLinkUltimoBoletin.split('/').reverse()[1]
        lastBoibInfo.linkUltimoBoletin = `${url}/${anoUltimoBoletin}/${idUltimoBoletin}`
        //console.log(ultimoBoletin);
        //console.log(idUltimoBoletin);
        //console.log(lastBoibInfo.linkUltimoBoletin);

    })
    .catch(console.error);
    
}

const getSectionLinks = (link) => {
    
    return axios.get(link)
    .then(response => {
        const html = response.data;
        const $ = cheerio.load(html);
    
        const $sectionMenuHtml = cheerio.load($('.primerosHijos').prop('outerHTML'));
        
        $sectionMenuHtml('li').each((i, elem) => {
            lastBoibInfo.sectionLinks[i] = domainUrl.concat($sectionMenuHtml(elem).find('a').attr('href'));
            console.log(lastBoibInfo.sectionLinks[i]); 
        })
        
    })
    .catch(console.error);

}

const getDocLists = (sectionLink) => {
    console.log(sectionLink);
    sectionName = sectionLink.split('/').reverse()[1].replace(/-/g,' ');
    console.log(sectionName);

    return axios.get(sectionLink)
    .then(response => {
        const html = response.data;
        const $ = cheerio.load(html);
    
        const $docList = cheerio.load($('.llistat').prop('outerHTML'));
        
        $docList('li').find('a').each((i, elem) => {
            let link = $docList(elem).attr('href');
            if (link.includes('intranet.caib.es') && !(link.endsWith('rdf'))) {
                console.log(link);
                lastBoibInfo.docLists[i] = link
            }

        })
    })
    .catch(console.error);

}

const main = async () => {

    await getLastBoib();
    if (lastBoibInfo.linkUltimoBoletin === previousBoibLink) {
        console.log("No hay nuevo boletín de información");
        console.log(`Último BOIB: ${lastBoibInfo.linkUltimoBoletin}`);
        process.exit();
    } else {
        console.log("Hay nuevo BOIB!!!!");
    }

    await getSectionLinks(lastBoibInfo.linkUltimoBoletin);
    console.log(lastBoibInfo.sectionLinks);


    for (let i = 1; i < lastBoibInfo.sectionLinks.length; i++) {
        console.log(`Link ${i} ${lastBoibInfo.sectionLinks[i]}`);
        await getDocLists(lastBoibInfo.sectionLinks[i]);
        


    };
    
    lastBoibInfo.docLists = lastBoibInfo.docLists.filter(item => item !== null);

    //añadir a cada enlace de documento el texto de descripción y el enlace de descrga de pdf
    //con la descripción buscaremos lo que nos interesa
    //con el enlace de pdf  podemos hacer click para bajar el fichero o mostrarlo en pantalla

    //primero almacenar los datos y luego los manejamos como queramos

    fs.writeFile('lastBoibInfo.json', JSON.stringify(lastBoibInfo, null, 0), (err) => {
        if (err) throw err;
        console.log('Datos guardados en lastBoibInfo.json');
    });

}

main();

    
