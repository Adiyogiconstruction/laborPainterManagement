import assert from "node:assert/strict";
import test from "node:test";
import { strFromU8, unzipSync } from "fflate";
import { buildWorkforceWorkbook } from "./workforceExcel.js";

const columns = [
  ["Name", "name"],
  ["Daily rate", "rate"],
  ["Status", "active"],
];
const valueFor = (record, key) =>
  key === "active" ? (record.active ? "Active" : "Inactive") : record[key];

test("workforce export creates a styled, filterable Excel workbook", () => {
  const workbook = buildWorkforceWorkbook(
    [
      { name: 'Ravi & <"Team">', rate: 550, active: true },
      { name: "Mina", rate: 450, active: false },
    ],
    columns,
    valueFor,
  );
  const files = unzipSync(workbook);
  const workbookXml = strFromU8(files["xl/workbook.xml"]);
  const worksheet = strFromU8(files["xl/worksheets/sheet1.xml"]);

  assert.match(workbookXml, /<sheet name="Labour workforce"/);
  assert.match(worksheet, /<autoFilter ref="A1:C3"/);
  assert.match(worksheet, /<pane ySplit="1" topLeftCell="A2"/);
  assert.match(worksheet, /Ravi &amp; &lt;&quot;Team&quot;&gt;/);
  assert.match(worksheet, /<c r="B2"><v>550<\/v><\/c>/);
  assert.match(worksheet, /<c r="C3" t="inlineStr"/);
  assert.match(strFromU8(files["xl/styles.xml"]), /FF0F766E/);
});

test("workforce export rejects invalid input instead of creating an empty workbook", () => {
  assert.throws(
    () => buildWorkforceWorkbook(null, columns, valueFor),
    /records and export columns are required/,
  );
  assert.throws(
    () => buildWorkforceWorkbook([], columns, null),
    /value formatter is required/,
  );
});

test("workforce export places account details above the filterable ledger", () => {
  const workbook = buildWorkforceWorkbook(
    [{ name: "Advance", rate: 200, active: true }],
    columns,
    valueFor,
    [["LABOUR PAYMENT KHATA"], ["Labour", "Aman"], []],
  );
  const worksheet = strFromU8(unzipSync(workbook)["xl/worksheets/sheet1.xml"]);

  assert.match(worksheet, /LABOUR PAYMENT KHATA/);
  assert.match(worksheet, /<c r="B2" t="inlineStr"/);
  assert.match(worksheet, /<autoFilter ref="A4:C5"/);
  assert.match(worksheet, /<pane ySplit="4" topLeftCell="A5"/);
  assert.match(worksheet, /<c r="A4" t="inlineStr" s="1"/);
});
