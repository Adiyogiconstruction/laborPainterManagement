import { jsPDF } from "jspdf";

const pageWidthMm = 210;
const pageHeightMm = 297;
const marginMm = 8;
const contentWidthMm = pageWidthMm - marginMm * 2;
const sectionGapMm = 1.5;
const headerHeightMm = 23;
const titleHeightMm = 6;
const personalHeightMm = 37;
const workHeightMm = 18;
const ppeHeightMm = 28;
const declarationHeightMm = 26;
const signaturesHeightMm = 14;
const appendixHeightMm = 5;
const documentsHeightMm = 60;
const termsHeightMm = 43;
const footerHeightMm = 4;
const borderColor = [92, 101, 104];
const paleFill = [246, 247, 247];
const hindiFontFamily = "Noto Sans Devanagari";
const hindiCanvasScale = 12;
const unavailable = "NA";

const sectionHeights = Object.freeze([
  ["header", headerHeightMm],
  ["title", titleHeightMm],
  ["personal", personalHeightMm],
  ["work", workHeightMm],
  ["ppe", ppeHeightMm],
  ["declaration", declarationHeightMm],
  ["signatures", signaturesHeightMm],
  ["appendix", appendixHeightMm],
  ["documents", documentsHeightMm],
  ["terms", termsHeightMm],
  ["footer", footerHeightMm],
]);

export function layoutRegistrationPage() {
  let y = marginMm;
  const sections = {};
  sectionHeights.forEach(([name, height], index) => {
    sections[name] = Object.freeze({
      x: marginMm,
      y,
      width: contentWidthMm,
      height,
    });
    y += height;
    if (index < sectionHeights.length - 1) y += sectionGapMm;
  });
  const printableBottom = pageHeightMm - marginMm;
  if (y > printableBottom) {
    throw new Error(
      `Registration PDF sections exceed the printable page by ${(y - printableBottom).toFixed(2)} mm.`,
    );
  }
  return Object.freeze({
    pageWidthMm,
    pageHeightMm,
    marginMm,
    contentWidthMm,
    sectionGapMm,
    sections: Object.freeze(sections),
    contentBottom: y,
    printableBottom,
  });
}

export const registrationPdfLayout = layoutRegistrationPage();

const sectionBody = (section, titleHeight = 5) => ({
  titleY: section.y,
  y: section.y + titleHeight,
  width: section.width,
  height: section.height - titleHeight,
});

const textValue = (value) => {
  if (value === null || value === undefined || value === "") return unavailable;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text || unavailable;
};

const formatDate = (value) => {
  if (!value) return unavailable;
  const dateText =
    value instanceof Date ? value.toISOString() : String(value);
  const match = dateText.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return unavailable;
  return `${String(parsed.getDate()).padStart(2, "0")}/${String(
    parsed.getMonth() + 1,
  ).padStart(2, "0")}/${parsed.getFullYear()}`;
};

const printTimestamp = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("A valid print timestamp is required.");
  }
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = date.getHours();
  const time = `${String(hours % 12 || 12).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
  return `${day}-${month}-${year} ${time}`;
};

export function buildRegistrationPdfData(worker, profile) {
  if (!worker || typeof worker !== "object") {
    throw new Error("Select a labour record before generating the PDF.");
  }
  const terms = Array.isArray(profile?.rules)
    ? profile.rules
        .map((rule) => textValue(rule))
        .filter((rule) => rule !== unavailable)
    : [];
  const profileAddress = profile?.address || "";
  const addressParts = [profileAddress, profile?.pincode, profile?.state].filter(
    (part, index) =>
      part &&
      (index === 0 ||
        !profileAddress
          .toLocaleLowerCase()
          .includes(String(part).toLocaleLowerCase())),
  );
  return {
    company: {
      name: textValue(profile?.companyName),
      address: textValue(addressParts.join(", ")),
      mobile: textValue(profile?.mobile),
      email: textValue(profile?.email),
      gst: textValue(profile?.gstin),
      pan: textValue(profile?.pan),
    },
    worker: {
      fullName: textValue(worker.name),
      mobile: textValue(worker.phone),
      aadhaarId: textValue(worker.aadhaarNumber),
      emergencyContact: unavailable,
      dob: unavailable,
      bloodGroup: unavailable,
      address: textValue(worker.address),
      workCategory: textValue(worker.skill),
      location: textValue(worker.workZone),
      contractor: unavailable,
      joiningDate: formatDate(worker.joiningDate),
      ppeKitIssuedOn: formatDate(worker.ppeKitIssuedOn),
    },
    terms,
  };
}

const setStroke = (doc) => {
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.18);
};

const fitText = (doc, text, width, fontSize, minFontSize = 5) => {
  let size = fontSize;
  while (size > minFontSize && doc.getTextWidth(text) > width) {
    size = Math.max(minFontSize, size - 0.25);
    doc.setFontSize(size);
  }
  if (doc.getTextWidth(text) <= width) return text;
  const ellipsis = "...";
  let clipped = text;
  while (clipped.length && doc.getTextWidth(`${clipped}${ellipsis}`) > width) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}${ellipsis}`;
};

export function containImageInBox({
  imageWidth,
  imageHeight,
  x,
  y,
  width,
  height,
  padding = 1.5,
}) {
  if (
    ![imageWidth, imageHeight, x, y, width, height, padding].every(
      Number.isFinite,
    ) ||
    imageWidth <= 0 ||
    imageHeight <= 0 ||
    width <= padding * 2 ||
    height <= padding * 2
  ) {
    throw new Error("Image and container dimensions must be positive.");
  }
  const scale = Math.min(
    (width - padding * 2) / imageWidth,
    (height - padding * 2) / imageHeight,
  );
  const renderedWidth = imageWidth * scale;
  const renderedHeight = imageHeight * scale;
  return {
    x: x + (width - renderedWidth) / 2,
    y: y + (height - renderedHeight) / 2,
    width: renderedWidth,
    height: renderedHeight,
  };
}

const drawText = (
  doc,
  value,
  x,
  y,
  width,
  {
    fontSize = 7,
    minFontSize = 5,
    fontStyle = "normal",
    align = "left",
    color = [25, 30, 32],
  } = {},
) => {
  const text = textValue(value);
  doc.setFont("helvetica", fontStyle);
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  const fitted = fitText(doc, text, width, fontSize, minFontSize);
  doc.text(fitted, x, y, { align });
};

const drawSectionTitle = (doc, label, y) => {
  doc.setFillColor(...paleFill);
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.2);
  doc.rect(marginMm, y, contentWidthMm, 5, "FD");
  drawText(doc, label, pageWidthMm / 2, y + 3.45, contentWidthMm - 6, {
    fontSize: 8,
    minFontSize: 7,
    fontStyle: "bold",
    align: "center",
  });
};

const drawLabelCell = (doc, x, y, width, height, label) => {
  setStroke(doc);
  doc.setFillColor(...paleFill);
  doc.rect(x, y, width, height, "FD");
  drawText(doc, label, x + 1.5, y + height / 2 + 1.1, width - 3, {
    fontSize: 6.3,
    minFontSize: 5.2,
    fontStyle: "bold",
  });
};

const drawValueCell = (doc, x, y, width, height, value) => {
  setStroke(doc);
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, width, height, "FD");
  drawText(doc, value, x + 1.5, y + height / 2 + 1.1, width - 3, {
    fontSize: 6.8,
    minFontSize: 5,
  });
};

const drawMultilineValueCell = (doc, x, y, width, height, value) => {
  setStroke(doc);
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, width, height, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.3);
  const wrappedLines = doc.splitTextToSize(textValue(value), width - 3);
  const lines = wrappedLines.slice(0, 2);
  if (lines.length === 2) {
    const lastLine = wrappedLines.length > 2 ? `${lines[1]}...` : lines[1];
    lines[1] = fitText(doc, lastLine, width - 3, 6.3, 5);
  }
  const firstBaseline = lines.length === 1 ? y + height / 2 + 1 : y + 3.7;
  doc.setTextColor(25, 30, 32);
  doc.text(lines, x + 1.5, firstBaseline, { lineHeightFactor: 1.2 });
};

const imageBox = (doc, image, x, y, width, height, placeholder) => {
  setStroke(doc);
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, width, height, "FD");
  if (!image?.data || !image.width || !image.height) {
    drawText(doc, placeholder, x + width / 2, y + height / 2 + 1, width - 4, {
      fontSize: 6.3,
      minFontSize: 5,
      align: "center",
      color: [105, 111, 113],
    });
    return;
  }
  const dimensions = containImageInBox({
    imageWidth: image.width,
    imageHeight: image.height,
    x,
    y,
    width,
    height,
  });
  doc.addImage(
    image.data,
    "PNG",
    dimensions.x,
    dimensions.y,
    dimensions.width,
    dimensions.height,
  );
};

const canvasImageData = (canvas) => canvas.toDataURL("image/png");

async function loadImage(url, label) {
  if (!url) return null;
  const resolvedUrl = new URL(url, window.location.href);
  const credentials =
    resolvedUrl.origin === window.location.origin ? "include" : "omit";
  const response = await fetch(resolvedUrl.href, { credentials });
  if (!response.ok) {
    throw new Error(`Unable to load ${label}. Check access to the saved image.`);
  }
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) {
    throw new Error(`The saved ${label} is not a supported image.`);
  }
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () =>
        reject(new Error(`Unable to decode the saved ${label}.`));
      element.src = objectUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error(`Unable to prepare the ${label} for PDF.`);
    context.drawImage(image, 0, 0);
    return {
      data: canvasImageData(canvas),
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function loadHindiFont() {
  if (document.fonts?.load) {
    await document.fonts.load(`10px "${hindiFontFamily}"`);
  }
}

const splitCanvasLines = (context, text, maxWidth) => {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = "";
  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (currentLine && context.measureText(candidate).width > maxWidth) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  });
  if (currentLine) lines.push(currentLine);
  return lines;
};

const drawHindiText = (doc, text, x, y, width, height, fontSizePt) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * hindiCanvasScale);
  canvas.height = Math.ceil(height * hindiCanvasScale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to render Hindi text in the PDF.");
  const fontSizePx = (fontSizePt * hindiCanvasScale) / (72 / 25.4);
  context.font = `${fontSizePx}px "${hindiFontFamily}"`;
  context.fillStyle = "#191e20";
  context.textBaseline = "alphabetic";
  const lines = splitCanvasLines(context, text, canvas.width - 4);
  const metrics = lines.map((line) => context.measureText(line));
  const ascents = metrics.map(
    ({ actualBoundingBoxAscent }) =>
      actualBoundingBoxAscent || fontSizePx * 0.8,
  );
  const descents = metrics.map(
    ({ actualBoundingBoxDescent }) =>
      actualBoundingBoxDescent || fontSizePx * 0.2,
  );
  const topPadding = Math.max(2, fontSizePx * 0.18);
  const bottomPadding = Math.max(2, fontSizePx * 0.18);
  const maxAscent = Math.max(...ascents);
  const maxDescent = Math.max(...descents);
  const lineHeight = Math.max(fontSizePx * 1.2, maxAscent + maxDescent + 2);
  const requiredHeight =
    topPadding +
    maxAscent +
    maxDescent +
    (lines.length - 1) * lineHeight +
    bottomPadding;
  if (requiredHeight > canvas.height) {
    throw new Error("Hindi text does not fit its fixed PDF area.");
  }
  lines.forEach((line, index) => {
    context.fillText(
      line,
      2,
      topPadding + ascents[index] + index * lineHeight,
      canvas.width - 4,
    );
  });
  doc.addImage(canvasImageData(canvas), "PNG", x, y, width, height);
};

const drawPersonalDetails = (doc, worker, images) => {
  const section = registrationPdfLayout.sections.personal;
  const { y, height } = sectionBody(section);
  drawSectionTitle(doc, "Personal Details", section.y);
  const rowHeight = height / 4;
  const photoWidth = 34;
  const detailsWidth = section.width - photoWidth;
  const labelWidths = [24, 26];
  const valueWidths = [54, detailsWidth - labelWidths[0] - labelWidths[1] - 54];
  const detailsX = section.x;
  const rowData = [
    [
      ["Full Name", worker.fullName],
      ["Mobile Number", worker.mobile],
    ],
    [
      ["Aadhaar / ID", worker.aadhaarId],
      ["Emergency Contact", worker.emergencyContact],
    ],
    [
      ["DOB", worker.dob],
      ["Blood Group", worker.bloodGroup],
    ],
  ];
  let rowY = y;
  rowData.forEach((row) => {
    let x = detailsX;
    row.forEach(([label, value], index) => {
      const labelWidth = labelWidths[index];
      drawLabelCell(doc, x, rowY, labelWidth, rowHeight, label);
      const valueWidth = valueWidths[index];
      drawValueCell(
        doc,
        x + labelWidth,
        rowY,
        valueWidth,
        rowHeight,
        value,
      );
      x += labelWidth + valueWidth;
    });
    rowY += rowHeight;
  });
  const addressLabelWidth = labelWidths[0];
  drawLabelCell(
    doc,
    detailsX,
    rowY,
    addressLabelWidth,
    rowHeight,
    "Address",
  );
  drawMultilineValueCell(
    doc,
    detailsX + addressLabelWidth,
    rowY,
    detailsWidth - addressLabelWidth,
    rowHeight,
    worker.address,
  );
  imageBox(
    doc,
    images.photo,
    section.x + detailsWidth,
    y,
    photoWidth,
    rowHeight * 4,
    "Photo not uploaded",
  );
};

const drawWorkDetails = (doc, worker) => {
  const section = registrationPdfLayout.sections.work;
  const { y, height } = sectionBody(section);
  drawSectionTitle(doc, "Work Details", section.y);
  const rowHeight = height / 2;
  const columnWidths = [28, 67, 30, section.width - 125];
  const rows = [
    [
      ["Work Category", worker.workCategory],
      ["Location", worker.location],
    ],
    [
      ["Contractor", worker.contractor],
      ["Joining Date", worker.joiningDate],
    ],
  ];
  rows.forEach((row, rowIndex) => {
    let x = section.x;
    const rowY = y + rowIndex * rowHeight;
    row.forEach(([label, value], pairIndex) => {
      const labelWidth = columnWidths[pairIndex * 2];
      const valueWidth = columnWidths[pairIndex * 2 + 1];
      setStroke(doc);
      doc.setFillColor(...paleFill);
      doc.rect(x, rowY, labelWidth, rowHeight, "FD");
      drawText(doc, label, x + 1.5, rowY + rowHeight / 2 + 1.1, labelWidth - 3, {
        fontSize: 6.3,
        minFontSize: 5,
        fontStyle: "bold",
      });
      drawValueCell(doc, x + labelWidth, rowY, valueWidth, rowHeight, value);
      x += labelWidth + valueWidth;
    });
  });
};

const drawPpeDetails = (doc, worker) => {
  const section = registrationPdfLayout.sections.ppe;
  const { y: top, height } = sectionBody(section);
  drawSectionTitle(doc, "Safety & PPE Details", section.y);
  const columnCount = 3;
  const columnWidth = section.width / columnCount;
  const headingHeight = 5.5;
  const issuedHeight = 5.5;
  const dateHeight = height - headingHeight - issuedHeight - 5.5;
  const items = ["Helmet", "Safety Shoes", "Reflective Jacket"];
  const issued = worker.ppeKitIssuedOn !== unavailable;
  items.forEach((item, index) => {
    const x = section.x + index * columnWidth;
    setStroke(doc);
    doc.setFillColor(...paleFill);
    doc.rect(x, top, columnWidth, headingHeight, "FD");
    drawText(doc, item, x + columnWidth / 2, top + headingHeight / 2 + 1.1, columnWidth - 4, {
      fontSize: 7,
      minFontSize: 6,
      fontStyle: "bold",
      align: "center",
    });
    doc.setFillColor(255, 255, 255);
    const issuedY = top + headingHeight;
    doc.rect(x, issuedY, columnWidth, issuedHeight, "FD");
    doc.setDrawColor(...borderColor);
    const label = `Issued: ${issued ? "Yes" : unavailable}`;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    const labelWidth = doc.getTextWidth(label);
    const groupWidth = 3 + 1.5 + labelWidth;
    const checkboxX = x + (columnWidth - groupWidth) / 2;
    const checkboxY = issuedY + (issuedHeight - 3) / 2;
    doc.rect(checkboxX, checkboxY, 3, 3);
    if (issued) {
      doc.setLineWidth(0.5);
      doc.line(checkboxX + 0.5, checkboxY + 1.5, checkboxX + 1.2, checkboxY + 2.3);
      doc.line(checkboxX + 1.2, checkboxY + 2.3, checkboxX + 2.6, checkboxY + 0.5);
      setStroke(doc);
    }
    doc.setFontSize(6.8);
    doc.setTextColor(25, 30, 32);
    doc.text(label, checkboxX + 4.5, issuedY + issuedHeight / 2 + 1.1);

    const dateY = issuedY + issuedHeight;
    doc.setFillColor(255, 255, 255);
    doc.rect(x, dateY, columnWidth, dateHeight, "FD");
    const dateLabel = "Issue date:";
    const dateValue = issued ? worker.ppeKitIssuedOn : unavailable;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    const dateLines = [dateLabel, dateValue];
    const firstBaseline = dateY + 2.4;
    doc.setTextColor(25, 30, 32);
    doc.text(dateLines, x + columnWidth / 2, firstBaseline, {
      align: "center",
      lineHeightFactor: 1.05,
    });
  });
  const recordRowY = top + headingHeight + issuedHeight + dateHeight;
  setStroke(doc);
  doc.setFillColor(255, 255, 255);
  doc.rect(section.x, recordRowY, section.width, 5.5, "FD");
  drawText(
    doc,
    `PPE kit issue date (recorded): ${worker.ppeKitIssuedOn}`,
    section.x + 1.5,
    recordRowY + 3.7,
    section.width - 3,
    { fontSize: 6.8, minFontSize: 5.8 },
  );
};

const declarationEnglish =
  "I hereby declare that the details provided above are true. I confirm receipt of the mentioned safety equipment (PPE) and agree to use them at the workplace.";
const declarationHindi =
  "मैं एतद्द्वारा घोषणा करता हूँ कि ऊपर दिए गए विवरण सत्य हैं। मैं उल्लिखित सुरक्षा उपकरण (पीपीई) की प्राप्ति की पुष्टि करता हूँ और कार्यस्थल पर उनका उपयोग करने के लिए सहमत हूँ।";

const drawDeclaration = (doc) => {
  const section = registrationPdfLayout.sections.declaration;
  const { y, height } = sectionBody(section);
  const titleY = section.y;
  drawSectionTitle(doc, "Declaration", titleY);
  setStroke(doc);
  doc.rect(section.x, y, section.width, height);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  const englishLines = doc.splitTextToSize(
    declarationEnglish,
    section.width - 5,
  );
  if (englishLines.length > 2) {
    throw new Error("English declaration does not fit its fixed PDF area.");
  }
  doc.text(englishLines, section.x + 2.5, y + 4.5, { lineHeightFactor: 1.2 });
  const hindiY = y + (englishLines.length === 1 ? 7 : 9);
  drawHindiText(
    doc,
    declarationHindi,
    section.x + 2.5,
    hindiY,
    section.width - 5,
    height - (hindiY - y) - 1.2,
    7,
  );
};

const drawSignatures = (doc) => {
  const section = registrationPdfLayout.sections.signatures;
  const boxHeight = 9.5;
  const labelHeight = section.height - boxHeight;
  const boxWidth = section.width / 3;
  const labels = [
    "Labour Signature / Thumb",
    "Contractor Signature",
    "Supervisor Signature & Company Stamp",
  ];
  labels.forEach((label, index) => {
    const x = section.x + index * boxWidth;
    setStroke(doc);
    doc.setFillColor(255, 255, 255);
    doc.rect(x, section.y, boxWidth, boxHeight);
    drawText(
      doc,
      label,
      x + boxWidth / 2,
      section.y + boxHeight + labelHeight / 2 + 1,
      boxWidth - 2,
      {
        fontSize: 6.1,
        minFontSize: 5.5,
        align: "center",
      },
    );
  });
};

const drawDocuments = (doc, images) => {
  const section = registrationPdfLayout.sections.documents;
  const { y, height } = sectionBody(section);
  const gap = 2;
  const boxWidth = (section.width - gap) / 2;
  [
    ["Aadhaar Card (Front)", images.aadhaarFront],
    ["Aadhaar Card (Back)", images.aadhaarBack],
  ].forEach(([label, image], index) => {
    const x = section.x + gap / 2 + index * (boxWidth + gap);
    setStroke(doc);
    doc.setFillColor(...paleFill);
    doc.rect(x, y, boxWidth, 5, "FD");
    drawText(doc, label, x + boxWidth / 2, y + 3.4, boxWidth - 4, {
      fontSize: 6.5,
      minFontSize: 5.5,
      fontStyle: "bold",
      align: "center",
    });
    imageBox(
      doc,
      image,
      x,
      y + 5,
      boxWidth,
      height - 5,
      "Document not uploaded",
    );
  });
};

const drawTerms = (doc, terms) => {
  const section = registrationPdfLayout.sections.terms;
  const { y: termsY, height } = sectionBody(section);
  const titleY = section.y;
  const displayTerms = terms.length ? terms : ["No terms configured."];
  const rowHeight = height / displayTerms.length;
  drawSectionTitle(doc, "Terms & Conditions", titleY);
  displayTerms.forEach((english, index) => {
    const y = termsY + index * rowHeight;
    const textX = section.x + 1.5;
    const textY = y + rowHeight / 2 + 1;
    if (index % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(
        section.x,
        y,
        contentWidthMm,
        rowHeight,
        "F",
      );
    }
    if (/[\u0900-\u097f]/.test(english)) {
      const textHeight = Math.max(1, rowHeight - 1);
      drawHindiText(
        doc,
        `${index + 1}. ${english}`,
        textX,
        y + (rowHeight - textHeight) / 2,
        contentWidthMm - 3,
        textHeight,
        6.5,
      );
    } else if (english.includes("₹")) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      const [beforeCurrency, afterCurrency] = english.split("₹");
      const prefix = `${index + 1}. ${beforeCurrency}`;
      doc.setTextColor(25, 30, 32);
      doc.text(prefix, textX, textY);
      const currencyX = textX + doc.getTextWidth(prefix) + 0.3;
      drawHindiText(doc, "₹", currencyX, y + 0.5, 2.6, 2.7, 7.2);
      drawText(
        doc,
        afterCurrency,
        currencyX + 2.7,
        textY,
        contentWidthMm - (currencyX - textX) - 2.7,
        { fontSize: 7.2, minFontSize: 6.5 },
      );
    } else {
      drawText(
        doc,
        `${index + 1}. ${english}`,
        textX,
        textY,
        contentWidthMm - 3,
        { fontSize: 7.2, minFontSize: 6.5 },
      );
    }
    setStroke(doc);
    doc.line(
      section.x,
      y + rowHeight,
      section.x + section.width,
      y + rowHeight,
    );
  });
  setStroke(doc);
  doc.rect(section.x, termsY, section.width, height);
};

export async function prepareRegistrationImages(worker, logoUrl) {
  const [logo, photo, aadhaarFront, aadhaarBack] = await Promise.all([
    loadImage(logoUrl, "company logo"),
    loadImage(worker.photoUrl || worker.photoPath, "worker photo"),
    loadImage(
      worker.aadhaarFrontPath || worker.aadhaarFrontUrl,
      "Aadhaar front image",
    ),
    loadImage(
      worker.aadhaarBackPath || worker.aadhaarBackUrl,
      "Aadhaar back image",
    ),
  ]);
  return { logo, photo, aadhaarFront, aadhaarBack };
}

export function createRegistrationPdf({
  worker,
  profile,
  images,
  generatedAt = new Date(),
}) {
  const data = buildRegistrationPdfData(worker, profile);
  if (!images?.logo?.data) {
    throw new Error("The company logo is unavailable for the registration PDF.");
  }
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  if (
    Math.abs(doc.internal.pageSize.getWidth() - pageWidthMm) > 0.1 ||
    Math.abs(doc.internal.pageSize.getHeight() - pageHeightMm) > 0.1
  ) {
    throw new Error("Unable to create an A4 portrait registration PDF.");
  }

  const sections = registrationPdfLayout.sections;
  const header = sections.header;
  const headerTop = header.y;
  const headerHeight = header.height;
  const logoWidth = header.width * 0.28;
  setStroke(doc);
  doc.rect(header.x, headerTop, header.width, headerHeight);
  const dividerX = header.x + logoWidth;
  doc.line(dividerX, headerTop, dividerX, headerTop + headerHeight);
  imageBox(
    doc,
    images.logo,
    header.x + 2,
    headerTop + 2,
    logoWidth - 4,
    headerHeight - 4,
    "Logo unavailable",
  );
  const headerX = dividerX + 2;
  const headerWidth = header.x + header.width - headerX - 2;
  drawText(
    doc,
    data.company.name,
    headerX + headerWidth / 2,
    headerTop + 5,
    headerWidth,
    {
      fontSize: 11,
      minFontSize: 9,
      fontStyle: "bold",
      align: "center",
    },
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  const addressLines = doc.splitTextToSize(
    data.company.address,
    headerWidth - 5,
  );
  if (addressLines.length > 2) {
    throw new Error("Company address exceeds the fixed header area.");
  }
  doc.setTextColor(25, 30, 32);
  doc.text(addressLines, headerX + headerWidth / 2, headerTop + 8.2, {
    align: "center",
    lineHeightFactor: 1.1,
  });
  const addressLastBaseline = headerTop + 8.2 + (addressLines.length - 1) * 2.4;
  const contactY = Math.max(headerTop + 15.5, addressLastBaseline + 3);
  drawText(
    doc,
    `Mob: ${data.company.mobile}  |  Email: ${data.company.email}`,
    headerX + headerWidth / 2,
    contactY,
    headerWidth - 4,
    { fontSize: 5.8, minFontSize: 5.2, align: "center" },
  );
  drawText(
    doc,
    `GST No: ${data.company.gst}  |  PAN: ${data.company.pan}`,
    headerX + headerWidth / 2,
    contactY + 3.5,
    headerWidth - 4,
    { fontSize: 5.8, minFontSize: 5.2, align: "center" },
  );
  drawText(
    doc,
    "LABOUR ONBOARDING & PPE DECLARATION FORM",
    pageWidthMm / 2,
    sections.title.y + 4.4,
    sections.title.width,
    { fontSize: 10, minFontSize: 8, fontStyle: "bold", align: "center" },
  );
  drawPersonalDetails(doc, data.worker, images);
  drawWorkDetails(doc, data.worker);
  drawPpeDetails(doc, data.worker);
  drawDeclaration(doc);
  drawSignatures(doc);
  drawSectionTitle(doc, "APPENDIX - DOCUMENTS & TERMS", sections.appendix.y);
  drawDocuments(doc, images);
  drawTerms(doc, data.terms);

  const footerText = `Printed on: ${printTimestamp(generatedAt)}`;
  const footer = sections.footer;
  drawText(
    doc,
    footerText,
    footer.x + footer.width,
    footer.y + footer.height - 1,
    100,
    {
      fontSize: 5.7,
      minFontSize: 5,
      align: "right",
      color: [75, 80, 82],
    },
  );
  if (doc.internal.getNumberOfPages() !== 1) {
    throw new Error("The registration PDF must fit on exactly one A4 page.");
  }
  return doc;
}

export async function downloadRegistrationPdf({
  worker,
  profile,
  logoUrl,
  generatedAt = new Date(),
}) {
  await loadHindiFont();
  const images = await prepareRegistrationImages(worker, logoUrl);
  const doc = createRegistrationPdf({ worker, profile, images, generatedAt });
  const safeName = textValue(worker.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  doc.save(`labour-registration-${safeName || "worker"}.pdf`);
}
