import { strFromU8, unzipSync } from "fflate";
import { parseCsv } from "./paymentLedger.js";

const decodeXml = (value) =>
  value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, code) => {
    if (code[0] === "#") {
      const number = code[1].toLowerCase() === "x"
        ? Number.parseInt(code.slice(2), 16)
        : Number.parseInt(code.slice(1), 10);
      return String.fromCodePoint(number);
    }
    return {
      amp: "&",
      lt: "<",
      gt: ">",
      quot: '"',
      apos: "'",
    }[code.toLowerCase()];
  });

const columnIndex = (reference) => {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase();
  if (!letters) return -1;
  return [...letters].reduce(
    (index, letter) => index * 26 + letter.charCodeAt(0) - 64,
    0,
  ) - 1;
};

const xmlText = (xml) =>
  [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map((match) => decodeXml(match[1]))
    .join("");

const normalizePackagePath = (path) => {
  const parts = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
};

const getFirstSheetPath = (files) => {
  const workbook = files["xl/workbook.xml"];
  const relationships = files["xl/_rels/workbook.xml.rels"];
  if (!workbook || !relationships) {
    throw new Error("The Excel workbook is missing its sheet information.");
  }
  const firstSheet = strFromU8(workbook).match(/<sheet\b[^>]*\br:id="([^"]+)"/);
  if (!firstSheet) throw new Error("The Excel workbook has no worksheets.");
  const relationship = strFromU8(relationships).match(
    new RegExp(`<Relationship\\b(?=[^>]*\\bId="${firstSheet[1]}")[^>]*\\bTarget="([^"]+)"[^>]*/?>`),
  );
  if (!relationship) {
    throw new Error("The first Excel worksheet could not be found.");
  }
  const target = relationship[1].replace(/^\/+/, "");
  const path = normalizePackagePath(
    target.startsWith("xl/") ? target : `xl/${target}`,
  );
  if (!path.startsWith("xl/worksheets/") || !files[path]) {
    throw new Error("The first Excel worksheet could not be read.");
  }
  return path;
};

const getSharedStrings = (files) => {
  if (!files["xl/sharedStrings.xml"]) return [];
  return [
    ...strFromU8(files["xl/sharedStrings.xml"]).matchAll(
      /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g,
    ),
  ].map((match) => xmlText(match[1]));
};

const getDateStyles = (files) => {
  if (!files["xl/styles.xml"]) return new Set();
  const styles = strFromU8(files["xl/styles.xml"]);
  const formats = new Map(
    [...styles.matchAll(/<numFmt\b([^>]*)\/?>/g)].map((match) => [
      Number(match[1].match(/\bnumFmtId="(\d+)"/)?.[1]),
      match[1].match(/\bformatCode="([^"]*)"/)?.[1] || "",
    ]),
  );
  const cellFormats = styles.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1];
  if (!cellFormats) return new Set();
  return new Set(
    [...cellFormats.matchAll(/<xf\b([^>]*)\/?>/g)]
      .map((match, index) => {
        const formatId = Number(match[1].match(/\bnumFmtId="(\d+)"/)?.[1] || 0);
        const customFormat = formats.get(formatId) || "";
        const isBuiltInDate = (formatId >= 14 && formatId <= 22) ||
          (formatId >= 27 && formatId <= 36) ||
          (formatId >= 45 && formatId <= 47) ||
          (formatId >= 50 && formatId <= 58);
        const hasDatePart = /[dy]/i.test(
          customFormat
            .replace(/"[^"]*"/g, "")
            .replace(/\\./g, "")
            .replace(/\[[^\]]*\]/g, ""),
        );
        return isBuiltInDate || hasDatePart ? index : -1;
      })
      .filter((index) => index >= 0),
  );
};

const excelDate = (serial) => {
  const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

export function parseWorkerUploadFile(fileName, content) {
  const extension = fileName.toLowerCase().split(".").pop();
  let sheetRows;
  if (extension === "csv") {
    sheetRows = parseCsv(content).map((cells, index) => ({
      rowNumber: index + 1,
      cells,
    }));
  } else if (extension === "xlsx") {
    const files = unzipSync(content);
    const sheetPath = getFirstSheetPath(files);
    const sharedStrings = getSharedStrings(files);
    const dateStyles = getDateStyles(files);
    const worksheet = strFromU8(files[sheetPath]);
    sheetRows = [...worksheet.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)]
      .map((row, rowIndex) => {
        const rowNumber = Number(row[1].match(/\br="(\d+)"/)?.[1] || rowIndex + 1);
        const cells = [];
        for (const cell of row[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
          const reference = cell[1].match(/\br="([^"]+)"/)?.[1];
          const index = columnIndex(reference || "");
          if (index < 0) continue;
          const type = cell[1].match(/\bt="([^"]+)"/)?.[1];
          const style = Number(cell[1].match(/\bs="(\d+)"/)?.[1] || 0);
          const value = cell[2] || "";
          const rawValue = value.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1] || "";
          if (type === "inlineStr") {
            cells[index] = xmlText(value);
          } else if (type === "s") {
            cells[index] = sharedStrings[Number(rawValue)] ?? "";
          } else if (type === "b") {
            cells[index] = rawValue === "1" ? "true" : "false";
          } else if (rawValue !== "") {
            cells[index] = dateStyles.has(style) ? excelDate(Number(rawValue)) : rawValue;
          } else {
            cells[index] = "";
          }
        }
        return { rowNumber, cells };
      })
      .filter((row) => row.cells.some((cell) => cell !== undefined && cell !== ""));
  } else {
    throw new Error("Choose a CSV or Excel (.xlsx) file, or download a template.");
  }

  if (!sheetRows.length) throw new Error("The file has no labour rows.");
  const [headers, ...rows] = sheetRows;
  if (!headers.cells.some((header) => String(header || "").trim())) {
    throw new Error("The first row must contain the labour column headings.");
  }
  if (!rows.length) throw new Error("The file has no labour rows.");
  return { headers: headers.cells, rows };
}
