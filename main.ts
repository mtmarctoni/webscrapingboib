import { wait, writeDataBase } from './services/utils.js';
import { sendEmailWithAttachments } from './services/emailService.js'; 
import { searchForCustomers } from './services/customerService.js';
import { downloadPdfs } from './services/pdfService.js';
import {
    getDocLists,
    getLastBoib,
    getSectionLinks,
    getSpecificBoib,
    readDataBase
} from './services/boibService.js';
import {
    wordsToSearch,
    sendEmailBool,
    lastBoibInfoFile,
    lastBoibInfo,
    previousBoibInfo,
} from './modules/global.js';

const main = async (): Promise<void> => {
  console.log('----------');
  console.log(new Date(Date.now()));
  await readDataBase(lastBoibInfoFile);
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
