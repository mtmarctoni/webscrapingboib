import * as cheerio from "cheerio";

/**
 * Represents a customer name found within an HTML table cell.
 */
export interface CustomerMatch {
  docId: string;
  tableIndex: number;
  rowIndex: number;
  cellIndex: number;
  cellText: string;
  customer: string;
}

/**
 * Searches HTML table cells for customer names. Matching is case-insensitive.
 * @param htmlText - Raw HTML content to search within
 * @param customers - Customer names to look for
 * @param docId - Document identifier to attach to each match
 * @returns Array of matches with table, row, and cell positions
 */
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
