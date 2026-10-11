import assert from "node:assert/strict";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import { buildWorkforceWorkbook } from "./workforceExcel.js";
import { parseWorkerUploadFile } from "./workerUploadFile.js";

test("worker upload parser reads CSV rows and source line numbers", () => {
  const parsed = parseWorkerUploadFile(
    "labour.csv",
    "name,workZone\r\nRavi,Mumbai\r\nMina,Pune",
  );

  assert.deepEqual(parsed.headers, ["name", "workZone"]);
  assert.deepEqual(parsed.rows, [
    { rowNumber: 2, cells: ["Ravi", "Mumbai"] },
    { rowNumber: 3, cells: ["Mina", "Pune"] },
  ]);
});

test("worker upload parser reads generated Excel templates", () => {
  const workbook = buildWorkforceWorkbook(
    [{ name: "Ravi & Mina", workZone: "Mumbai", active: true }],
    [
      ["name", "name"],
      ["workZone", "workZone"],
      ["active", "active"],
    ],
    (record, key) => record[key],
  );

  const parsed = parseWorkerUploadFile("labour.xlsx", workbook);

  assert.deepEqual(parsed.headers, ["name", "workZone", "active"]);
  assert.deepEqual(parsed.rows, [
    { rowNumber: 2, cells: ["Ravi & Mina", "Mumbai", "true"] },
  ]);
});

test("worker upload parser resolves shared strings and Excel date cells", () => {
  const serial = (Date.UTC(2026, 9, 9) - Date.UTC(1899, 11, 30)) / 86400000;
  const workbook = zipSync({
    "xl/workbook.xml": strToU8(
      '<workbook xmlns:r="r"><sheets><sheet name="Workers" r:id="rId1"/></sheets></workbook>',
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    ),
    "xl/sharedStrings.xml": strToU8(
      "<sst><si><t>joiningDate</t></si><si><t>Name</t></si><si><t>Ravi</t></si></sst>",
    ),
    "xl/styles.xml": strToU8(
      '<styleSheet><numFmts><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>',
    ),
    "xl/worksheets/sheet1.xml": strToU8(
      `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" s="1"><v>${serial}</v></c><c r="B2" t="s"><v>2</v></c></row></sheetData></worksheet>`,
    ),
  });

  const parsed = parseWorkerUploadFile("labour.xlsx", workbook);

  assert.deepEqual(parsed.headers, ["joiningDate", "Name"]);
  assert.deepEqual(parsed.rows, [
    { rowNumber: 2, cells: ["2026-10-09", "Ravi"] },
  ]);
});

test("worker upload parser rejects unsupported and empty files", () => {
  assert.throws(
    () => parseWorkerUploadFile("labour.xls", new Uint8Array()),
    /CSV or Excel \(\.xlsx\)/,
  );
  assert.throws(
    () => parseWorkerUploadFile("empty.csv", ""),
    /no labour rows/,
  );
});
