import { describe, expect, it } from "vitest";
import type { CustomerMatch } from "../../../src/domain/matchers/customerMatcher.js";
import { matchCustomers } from "../../../src/domain/matchers/customerMatcher.js";

describe("matchCustomers", () => {
  it("returns empty array when customers array is empty", () => {
    const html = "<table><tr><td>Alice Corp</td></tr></table>";
    const result = matchCustomers(html, [], "doc-1");
    expect(result).toEqual([]);
  });

  it("returns empty array when HTML is empty", () => {
    const result = matchCustomers("", ["Alice"], "doc-1");
    expect(result).toEqual([]);
  });

  it("returns empty array when HTML has no tables", () => {
    const html = "<div>No tables here</div>";
    const result = matchCustomers(html, ["Alice"], "doc-1");
    expect(result).toEqual([]);
  });

  it("finds a single customer match in a table cell", () => {
    const html = `
      <table>
        <tr>
          <td>Alice Corp</td>
        </tr>
      </table>
    `;
    const result = matchCustomers(html, ["Alice"], "doc-1");
    expect(result).toHaveLength(1);
    const match = result[0] as CustomerMatch;
    expect(match).toMatchObject({
      docId: "doc-1",
      tableIndex: 1,
      rowIndex: 1,
      cellIndex: 1,
      cellText: "Alice Corp",
      customer: "Alice",
    });
  });

  it("matches case-insensitively", () => {
    const html = `
      <table>
        <tr>
          <td>JOHN DOE LLC</td>
        </tr>
      </table>
    `;
    const result = matchCustomers(html, ["John"], "doc-1");
    expect(result).toHaveLength(1);
    const match = result[0] as CustomerMatch;
    expect(match.customer).toBe("John");
    expect(match.cellText).toBe("JOHN DOE LLC");
  });

  it("matches multiple customers in the same cell", () => {
    const html = `
      <table>
        <tr>
          <td>Alice and Bob Corp</td>
        </tr>
      </table>
    `;
    const result = matchCustomers(html, ["Alice", "Bob"], "doc-1");
    expect(result).toHaveLength(2);
    const match0 = result[0] as CustomerMatch;
    const match1 = result[1] as CustomerMatch;
    expect(match0.customer).toBe("Alice");
    expect(match1.customer).toBe("Bob");
    expect(match0.cellText).toBe("Alice and Bob Corp");
    expect(match1.cellText).toBe("Alice and Bob Corp");
  });

  it("matches across multiple table rows", () => {
    const html = `
      <table>
        <tr>
          <td>Alice Corp</td>
        </tr>
        <tr>
          <td>Bob Inc</td>
        </tr>
      </table>
    `;
    const result = matchCustomers(html, ["Alice", "Bob"], "doc-1");
    expect(result).toHaveLength(2);
    const match0 = result[0] as CustomerMatch;
    const match1 = result[1] as CustomerMatch;
    expect(match0).toMatchObject({ rowIndex: 1, customer: "Alice" });
    expect(match1).toMatchObject({ rowIndex: 2, customer: "Bob" });
  });

  it("increments tableIndex across multiple tables", () => {
    const html = `
      <table>
        <tr>
          <td>Alice Corp</td>
        </tr>
      </table>
      <table>
        <tr>
          <td>Bob Inc</td>
        </tr>
      </table>
    `;
    const result = matchCustomers(html, ["Alice", "Bob"], "doc-1");
    expect(result).toHaveLength(2);
    const match0 = result[0] as CustomerMatch;
    const match1 = result[1] as CustomerMatch;
    expect(match0).toMatchObject({ tableIndex: 1, customer: "Alice" });
    expect(match1).toMatchObject({ tableIndex: 2, customer: "Bob" });
  });

  it("returns empty array when no customer matches", () => {
    const html = `
      <table>
        <tr>
          <td>Charlie Corp</td>
        </tr>
      </table>
    `;
    const result = matchCustomers(html, ["Alice", "Bob"], "doc-1");
    expect(result).toEqual([]);
  });

  it("matches partial customer name in cell text", () => {
    const html = `
      <table>
        <tr>
          <td>Alice Smith Corporation</td>
        </tr>
      </table>
    `;
    const result = matchCustomers(html, ["Alice"], "doc-1");
    expect(result).toHaveLength(1);
    const match = result[0] as CustomerMatch;
    expect(match).toMatchObject({
      customer: "Alice",
      cellText: "Alice Smith Corporation",
    });
  });

  it("returns matches from multiple cells in the same row", () => {
    const html = `
      <table>
        <tr>
          <td>Alice Corp</td>
          <td>Bob Inc</td>
        </tr>
      </table>
    `;
    const result = matchCustomers(html, ["Alice", "Bob"], "doc-1");
    expect(result).toHaveLength(2);
    const match0 = result[0] as CustomerMatch;
    const match1 = result[1] as CustomerMatch;
    expect(match0).toMatchObject({ cellIndex: 1, customer: "Alice" });
    expect(match1).toMatchObject({ cellIndex: 2, customer: "Bob" });
  });
});
