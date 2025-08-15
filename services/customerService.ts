import axios from 'axios';
import * as cheerio from 'cheerio';
import { CheerioAPI } from 'cheerio';
import { customers, lastBoibInfo } from '../modules/global.js';
import type { SectionLink, DocListItem } from '../types/boibInfo.js';

export const searchForCustomers = async (links: string[]): Promise<void> => {
  console.log(`Looking for ${customers} in: \n${links}\n`);
  let localNumMatches = 0;
  for (let link of links) {
    let docObj: DocListItem | undefined;
    (lastBoibInfo.sectionLinks as SectionLink[]).forEach((sectionLink) => {
      (sectionLink.docList as DocListItem[]).forEach((obj) => {
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
              let match = `PDF ${docObj?.id ?? ''} -> Table ${i + 1}, row ${j + 1}, cell ${k + 1}: ${cellText.trim()}`;
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
