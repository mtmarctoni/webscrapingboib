import axios from 'axios';
import * as cheerio from 'cheerio';
import { CheerioAPI } from 'cheerio';
import sfs from 'fs';
import fs from 'fs/promises';
import download from 'download';
import path from 'path';
import ora from 'ora';
import {
    domainUrl,
    url,
    wordsToSearch,
    customers,
    sendEmailBool,
    emailUser,
    emailRecipients,
    months,
    lastBoibInfoFile,
    transporter,
    lastBoibInfo,
    previousBoibInfo,
    downloadedPdfPaths,
    numMatches
} from './modules/global.js';

// let logStream = sfs.createWriteStream('output.txt', {flags: 'a'});
// let oldLog = console.log;
// console.log = function (message: any) {
//   oldLog.apply(console, arguments);
//   logStream.write(util.format(message) + '\n');
// };

const resetInfo = (): any => {
  const newInfo: any = {
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

const readDataBase = (): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    if (!sfs.existsSync(lastBoibInfoFile)) {
      console.log('Archivo json no existe. Creando uno nuevo...');
      Object.assign(lastBoibInfo, resetInfo());
    //   lastBoibInfo = resetInfo(); // with typescript we cannot do that, is an import
      await fs.writeFile(lastBoibInfoFile, JSON.stringify(lastBoibInfo), 'utf8');
      console.log(`Archivo ${lastBoibInfoFile} creado.`);
    } else {
      const res = await fs.readFile(lastBoibInfoFile, 'utf8');
      if (!res) {
        console.log('Archivo json vacío.');
        Object.assign(lastBoibInfo, resetInfo());
      } else {
          const data = JSON.parse(res);

        Object.assign(previousBoibInfo, data);
        Object.assign(lastBoibInfo, resetInfo());
        console.log('Datos obtenidos de la base de datos');
      }
    }
    resolve();
  });
}

const getLastBoib = async (): Promise<void> => {
  console.log('Cogiendo información del último BOIB');
  const res = await axios.get(url);
  const $ = cheerio.load(res.data) as CheerioAPI;
  const ultimoBoletin = $('div.ultimoBoletin div.caja.whitebg p a').text().replace(/\s+/g, ' ').trim();
  const subLinkUltimoBoletin = $('div.ultimoBoletin div.caja.whitebg p a').attr('href');
  const anoUltimoBoletin = ultimoBoletin.match(/(\d{4})$/)?.[0] || '';
  const idUltimoBoletin = subLinkUltimoBoletin?.split('/')?.reverse()?.[1] || '';
  const wordsLastBoib = ultimoBoletin.split(" ");
  const idAnualBoib = wordsLastBoib[6];
  let monthNumber: string | number = months.indexOf(wordsLastBoib[9]) + 1;
  monthNumber = monthNumber < 10 ? '0' + monthNumber : monthNumber;
  const stringDatelastBoib = wordsLastBoib[11] + '-' + monthNumber + '-' + wordsLastBoib[7];
  const dateLastBoib = new Date(stringDatelastBoib);
  lastBoibInfo.ultimoBoletin = ultimoBoletin;
  lastBoibInfo.idBoib = idUltimoBoletin;
  lastBoibInfo.idAnualBoib = idAnualBoib;
  lastBoibInfo.dateLastBoib = dateLastBoib;
  lastBoibInfo.linkUltimoBoletin = `${url}/${anoUltimoBoletin}/${idUltimoBoletin}`;
}

const getSectionLinks = async (link: string): Promise<void> => {
  try {
    const response = await axios.get(link);
    const html = response.data;
    const $ = cheerio.load(html) as CheerioAPI;
    lastBoibInfo.isExtraordinary = $('a.fijo p').last().text().includes("Extraordinari");
    lastBoibInfo.isExtraordinary ? console.log("BOIB Extraordinari") : console.log("BOIB ordinari");
    const $sectionMenuHtml = cheerio.load($('.primerosHijos').prop('outerHTML')) as CheerioAPI;
    $sectionMenuHtml('li').each((i: number, elem: any) => {
      let link_1 = domainUrl.concat($sectionMenuHtml(elem).find('a').attr('href'));
      let sectionObject: any = {
        id: i,
        titulo: link_1.split('/').reverse()[1].replace(/-/g, ' '),
        link: link_1,
        docList: []
      };
      lastBoibInfo.sectionLinks.push(sectionObject);
    });
  } catch (message_1: any) {
    return console.error(message_1);
  }
}

const getDocLists = async (sectionLink: string): Promise<void> => {
  let sectionObject = lastBoibInfo.sectionLinks.filter((obj: any) => obj.link === sectionLink)[0];
  if (!sectionObject) {
    console.error('No se encontro la sección');
    return;
  }
  const response = await axios.get(sectionLink);
  const html = response.data;
  const $ = cheerio.load(html) as CheerioAPI;
  const llistatElement = $('.llistat');
  if (llistatElement.length) {
    const $docList = cheerio.load(llistatElement.prop('outerHTML')) as CheerioAPI;
    $docList('ul.resolucions').each((j: number, elems: any) => {
      let docListObject: any = {
        id: "",
        htmlLink: "",
        description: "",
        downloadPdfLink: ""
      };
      $docList(elems).find('a').each((i: number, elem: any) => {
        let link = $docList(elem).attr('href');
        if (link.startsWith('/eboibfront/pdf/')) {
          let description = $docList(elem).parents('ul.resolucions').first().find('p').first().text();
          let idText = $docList(elem).parents('ul.resolucions').first().find('p.registre').first().text().trim();
          let id = idText.split('-')[0].split(' ').reverse()[1];
          docListObject.downloadPdfLink = domainUrl + link;
          docListObject.description = description;
          docListObject.id = id;
        } else if (!(link.endsWith('xml')) && !(link.endsWith('rdf'))) {
          docListObject.htmlLink = link;
        } else {
          lastBoibInfo.sectionLinks[sectionObject.id].docList.push(docListObject);
        }
      });
    });
  } else {
    console.log("No se ha encontrado el elemento con la clase 'llistat'. en " + sectionLink);
  }
}

const getSpecificBoib = (wordsToSearch: string[]): any[] => {
  console.log(`\nBuscando documentos que contengan:\n${wordsToSearch}\n`);
  let filteredList = lastBoibInfo.sectionLinks.flatMap((section: any) => {
    return section.docList.filter((doc: any) => {
      return wordsToSearch.some((word: string) => doc.description.includes(word));
    });
  });
  if (filteredList.length == 0) {
    console.log("No hay documentos con estos criterios de búsqueda\n");
    return [];
  } else {
    console.log(`${filteredList.length} BOIBs encontrados`);
    return filteredList;
  }
}

const downloadPdfs = async (links: string[]): Promise<void> => {
  let date = lastBoibInfo.dateLastBoib;
  const folderName = `${lastBoibInfo.idAnualBoib}_${date.getDate()}-${date.getMonth()+1}-${date.getFullYear()}`;
  const folderPath = path.resolve(process.cwd(), 'BOIBpdfs', folderName) + "/";
  const spinner = ora(`Los pdfs se descargan en:\n${folderPath}`).start();
  for (let link of links) {
    await download(link, folderPath);
    spinner.text = `Descargado ${link}`;
  }
  spinner.succeed(`Descarga completada`);
    const downloadedPdfNames = await fs.readdir(folderPath);
    downloadedPdfNames.forEach((file: string) => {
      if (file.endsWith('.pdf')) {
        downloadedPdfPaths.push(`${folderPath}${file}`);
      }
    });
    
//   downloadedPdfPaths = downloadedPdfNames.map((file: string) => `${folderPath}${file}`);
}

const searchForCustomers = async (links: string[]): Promise<void> => {
  console.log(`Looking for ${customers} in: \n${links}\n`);
  let localNumMatches = 0;
  for (let link of links) {
    let docObj: any;
    lastBoibInfo.sectionLinks.forEach((sectionLink: any) => {
      sectionLink.docList.forEach((obj: any) => {
        if (obj.htmlLink === link) {
          docObj = obj;
        }
      });
    });
    const res = await axios.get(link);
    const $ = cheerio.load(res.data) as CheerioAPI;
    const tables = $('table');
    tables.each((i: number, table: any) => {
      const rows = $(table).find('tr');
      rows.each((j: number, row: any) => {
        const cells = $(row).find('td');
        cells.each((k: number, cell: any) => {
          const cellText = $(cell).text();
          customers.forEach((customer: string) => {
            if (cellText.toLowerCase().includes(customer.toLowerCase())) {
              localNumMatches++;
              let match = `PDF ${docObj.id} -> Table ${i + 1}, row ${j + 1}, cell ${k + 1}: ${cellText.trim()}`;
              lastBoibInfo.customersMatched.push(match);
              console.log(`Match found in ${match}`);
            }
          });
        });
      });
    });
  }
  lastBoibInfo.numMatches = localNumMatches;
  console.log(`Se han encontrado ${localNumMatches} coincidencias`);
}

const writeDataBase = async (): Promise<void> => {
  console.log('Escribiendo datos obtenidos en la base de datos');
  await fs.writeFile(lastBoibInfoFile, JSON.stringify(lastBoibInfo, null, 0));
  console.log('Datos guardados');
}

const sendEmailWithAttachments = async (): Promise<any> => {
  let emailBody = `\n    Hola, este es un correo automático.\n    `;
  if (downloadedPdfPaths.length === 0) {
    emailBody = emailBody.concat(`\n\n        No se han encontrado BOIBs según los criterios de búsqueda siguientes:\n\n        - ${wordsToSearch}\n\n        `);
  } else {
    emailBody = emailBody.concat(`\n        Adjunto están los ${downloadedPdfPaths.length} BOIBs que se han encontrado según los siguientes criterios de búsqueda siguientes:   \n            \n        - ${wordsToSearch}\n\n        `);
    if (numMatches === 0) {
      emailBody = emailBody.concat(`\n            De estos BOIBs no se ha podido encontrar ninguna coincidencia con los nombres de los clientes proporcionados:\n\n            - ${customers}\n\n            `);
    } else {
      emailBody = emailBody.concat(`\n            ¡¡¡OJO!!! Se han encontrado ${numMatches} coincidencias con los nombres de los clientes proporcionados:\n            \n            - ${customers}\n            \n            `);
    }
  }
  emailBody = emailBody.concat(`\n    Que tengas un buend día.\n\n    Marc de DocsEE\n    Documentación Eficiente y Eficaz\n    `);
  let attachments = downloadedPdfPaths.map((path: string) => {
    return {
      filename: path.split('/').pop(),
      path: path
    };
  });
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

const wait = async (time: number): Promise<void> => {
  return new Promise((res) => {
    setTimeout(() => res(), time);
  });
}

const main = async (): Promise<void> => {
  console.log('----------');
  console.log(new Date(Date.now()));
  await readDataBase();
  await getLastBoib();
  if (lastBoibInfo.linkUltimoBoletin === previousBoibInfo.linkUltimoBoletin) {
    console.log("No hay nuevo BOIB");
    console.log(`${lastBoibInfo.ultimoBoletin}\n`);
    console.log('Saliendo...');
    console.log('----------');
    await wait(1000);
    process.exit();
  } else {
    console.log("Hay nuevo BOIB!!!!");
    console.log(lastBoibInfo.ultimoBoletin);
  }
  await getSectionLinks(lastBoibInfo.linkUltimoBoletin);
  for (let i = 0; i < lastBoibInfo.sectionLinks.length; i++) {
    await getDocLists(lastBoibInfo.sectionLinks[i].link);
  }
  const filteredList = getSpecificBoib(wordsToSearch);
  if (filteredList.length !== 0) {
    let pdfLinks = filteredList.map((x: any) => x.downloadPdfLink);
    let htmlLinks = filteredList.map((x: any) => x.htmlLink);
    await downloadPdfs(pdfLinks);
    await searchForCustomers(htmlLinks);
  }
  await writeDataBase();
  if (sendEmailBool) {
    await sendEmailWithAttachments();
  }
  console.log('----------');
}

main();
