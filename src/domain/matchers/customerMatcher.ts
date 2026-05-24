import * as cheerio from "cheerio";

export interface CustomerMatch {
  docId: string;
  tableIndex: number;
  rowIndex: number;
  cellIndex: number;
  cellText: string;
  customer: string;
}

export function matchCustomers(
  htmlText: string,
  customers: string[],
  docId: string,
): CustomerMatch[] {
  if (customers.length === 0) {
    return [];
  }

  const matches: CustomerMatch[] = [];
  const $ = cheerio.load(htmlText);
  const tables = $("table");

  tables.each((tableIdx, table) => {
    const rows = $(table).find("tr");
    rows.each((rowIdx, row) => {
      const cells = $(row).find("td");
      cells.each((cellIdx, cell) => {
        const cellText = $(cell).text();
        for (const customer of customers) {
          if (cellText.toLowerCase().includes(customer.toLowerCase())) {
            matches.push({
              docId,
              tableIndex: tableIdx + 1,
              rowIndex: rowIdx + 1,
              cellIndex: cellIdx + 1,
              cellText: cellText.trim(),
              customer,
            });
          }
        }
      });
    });
  });

  return matches;
}
