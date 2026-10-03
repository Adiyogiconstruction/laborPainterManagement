import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildRegistrationPdfData,
  containImageInBox,
  createRegistrationPdf,
  layoutRegistrationPage,
  registrationPdfLayout,
} from "./registrationPdf.js";

const validWorker = {
  _id: "labour-1",
  name: "Anand Ram",
  phone: "6205678443",
  aadhaarNumber: "123443215678",
  address: "Faridabad India",
  skill: "Helper",
  workZone: "Chennai",
  joiningDate: "2026-09-19T00:00:00.000Z",
  ppeKitIssuedOn: "2026-09-19T00:00:00.000Z",
};

const profile = {
  companyName: "ADIYOGI CONSTRUCTIONS",
  address: "A-1001, Sai Hanuman Tower",
  pincode: "401101",
  state: "Maharashtra",
  mobile: "8879621052 / 6201027048",
  email: "adiyogiconstruction1@gmail.com",
  gstin: "27ACAFA7740F1ZL",
  pan: "ACAFA7740F",
  rules: [
    "Wear protective equipment at the worksite.",
    "Do not consume alcohol or tobacco at the worksite.",
    "Follow supervisor safety instructions.",
    "Report workplace injuries immediately.",
    "Keep the worksite clean.",
    "साइट पर सभी सुरक्षा निर्देशों का पालन करें।",
  ],
};

test("registration data uses existing labour fields and marks unavailable fields NA", () => {
  const data = buildRegistrationPdfData(validWorker, profile);

  assert.equal(data.worker.fullName, "Anand Ram");
  assert.equal(data.worker.mobile, "6205678443");
  assert.equal(data.worker.aadhaarId, "123443215678");
  assert.equal(data.worker.emergencyContact, "NA");
  assert.equal(data.worker.dob, "NA");
  assert.equal(data.worker.bloodGroup, "NA");
  assert.equal(data.worker.contractor, "NA");
  assert.equal(data.worker.location, "Chennai");
  assert.equal(data.worker.workCategory, "Helper");
  assert.equal(data.worker.joiningDate, "19/09/2026");
  assert.equal(data.worker.ppeKitIssuedOn, "19/09/2026");
  assert.equal(data.company.address, "A-1001, Sai Hanuman Tower, 401101, Maharashtra");
  assert.deepEqual(data.terms, profile.rules);
  assert.throws(
    () => buildRegistrationPdfData(null, profile),
    /Select a labour record/,
  );
});

test("registration template remains within a single A4 portrait page", () => {
  const originalDocument = globalThis.document;
  const renderedHindiLines = [];
  const logoData = `data:image/png;base64,${readFileSync(
    new URL("../assets/image.png", import.meta.url),
  ).toString("base64")}`;
  globalThis.document = {
    createElement: () => ({
      getContext: () => ({
        measureText: (text) => ({
          width: text.length * 7,
          actualBoundingBoxAscent: 10,
          actualBoundingBoxDescent: 3,
        }),
        fillText: (text, _x, baseline) =>
          renderedHindiLines.push({ text, baseline }),
      }),
      toDataURL: () => logoData,
    }),
  };

  try {
    const doc = createRegistrationPdf({
      worker: validWorker,
      profile,
      images: {
        logo: { data: logoData, width: 600, height: 400 },
        photo: null,
        aadhaarFront: null,
        aadhaarBack: null,
      },
      generatedAt: new Date(2026, 9, 3, 14, 5),
    });

    assert.equal(doc.internal.getNumberOfPages(), 1);
    assert.ok(Math.abs(doc.internal.pageSize.getWidth() - 210) < 0.01);
    assert.ok(Math.abs(doc.internal.pageSize.getHeight() - 297) < 0.01);
    assert.ok(registrationPdfLayout.marginMm >= 8);
    assert.ok(
      registrationPdfLayout.contentBottom <=
        registrationPdfLayout.printableBottom,
    );
    const sections = Object.values(registrationPdfLayout.sections);
    sections.forEach((section) => {
      assert.ok(section.x >= registrationPdfLayout.marginMm);
      assert.ok(
        section.x + section.width <=
          registrationPdfLayout.pageWidthMm -
            registrationPdfLayout.marginMm,
      );
      assert.ok(section.y >= registrationPdfLayout.marginMm);
      assert.ok(section.y + section.height <=
        registrationPdfLayout.printableBottom);
    });
    for (let index = 1; index < sections.length; index += 1) {
      assert.ok(
        sections[index].y >=
          sections[index - 1].y + sections[index - 1].height,
      );
    }
    assert.ok(
      (registrationPdfLayout.sections.header.width * 0.28) /
        registrationPdfLayout.sections.header.width >=
        0.25,
    );
    const pageContent = doc.internal.pages[1].join("");
    assert.match(pageContent, /LABOUR ONBOARDING/);
    assert.match(pageContent, /Anand Ram/);
    assert.match(pageContent, /6205678443/);
    assert.match(pageContent, /123443215678/);
    assert.match(pageContent, /Issued: Yes/);
    assert.match(pageContent, /19\/09\/2026/);
    assert.match(pageContent, /PPE kit issue date/);
    assert.match(pageContent, /Wear protective equipment at the worksite/);
    assert.doesNotMatch(pageContent, /A penalty of/);
    const hindiRule = renderedHindiLines.find(({ text }) =>
      text.includes("साइट"),
    );
    assert.ok(hindiRule);
    assert.ok(hindiRule.baseline - 10 >= 2);
    assert.match(pageContent, /Aadhaar Card/);
    assert.match(pageContent, /Document not uploaded/);
    assert.match(pageContent, /Photo not uploaded/);
    assert.match(pageContent, /Printed on: 03-10-2026 02:05 PM/);
    assert.ok(doc.output("arraybuffer").byteLength > 0);
  } finally {
    globalThis.document = originalDocument;
  }
});

test("long worker names and addresses do not alter the fixed registration layout", () => {
  const longWorker = {
    ...validWorker,
    name: "RAJENDRA KUMAR SINGH",
    address:
      "A-1001, Sai Hanuman Tower, Bhayander West, Thane Maharashtra 401101",
  };
  const normalData = buildRegistrationPdfData(validWorker, profile);
  const longData = buildRegistrationPdfData(longWorker, profile);
  const originalDocument = globalThis.document;
  const logoData = `data:image/png;base64,${readFileSync(
    new URL("../assets/image.png", import.meta.url),
  ).toString("base64")}`;
  globalThis.document = {
    createElement: () => ({
      getContext: () => ({
        measureText: (text) => ({ width: text.length * 7 }),
        fillText() {},
      }),
      toDataURL: () => logoData,
    }),
  };

  try {
    const images = {
      logo: { data: logoData, width: 600, height: 400 },
      photo: null,
      aadhaarFront: null,
      aadhaarBack: null,
    };
    const normalPdf = createRegistrationPdf({
      worker: validWorker,
      profile,
      images,
    });
    const longPdf = createRegistrationPdf({
      worker: longWorker,
      profile,
      images,
    });

    assert.notEqual(normalData.worker.fullName, longData.worker.fullName);
    assert.notEqual(normalData.worker.address, longData.worker.address);
    assert.equal(normalPdf.internal.getNumberOfPages(), 1);
    assert.equal(longPdf.internal.getNumberOfPages(), 1);
    assert.equal(
      normalPdf.internal.pageSize.getHeight(),
      longPdf.internal.pageSize.getHeight(),
    );
    assert.deepEqual(
      registrationPdfLayout.sections.documents.height,
      60,
    );
    assert.equal(
      registrationPdfLayout.sections.terms.y +
        registrationPdfLayout.sections.terms.height,
      registrationPdfLayout.sections.footer.y -
        registrationPdfLayout.sectionGapMm,
    );
  } finally {
    globalThis.document = originalDocument;
  }
});

test("page layout flows fixed sections with consistent gaps inside print margins", () => {
  const layout = layoutRegistrationPage();
  const entries = Object.entries(layout.sections);

  assert.equal(layout.sectionGapMm, 1.5);
  for (let index = 1; index < entries.length; index += 1) {
    const [, current] = entries[index];
    const [, previous] = entries[index - 1];
    assert.equal(
      current.y - (previous.y + previous.height),
      layout.sectionGapMm,
    );
  }
  assert.ok(layout.contentBottom <= layout.printableBottom);
});

test("photo and document fitting preserves source aspect ratio without cropping", () => {
  const image = containImageInBox({
    imageWidth: 1200,
    imageHeight: 800,
    x: 10,
    y: 20,
    width: 90,
    height: 30,
  });

  assert.ok(Math.abs(image.width / image.height - 1.5) < 0.000001);
  assert.ok(image.x >= 10);
  assert.ok(image.y >= 20);
  assert.ok(image.x + image.width <= 100);
  assert.ok(image.y + image.height <= 50);
  assert.throws(
    () =>
      containImageInBox({
        imageWidth: 0,
        imageHeight: 1,
        x: 0,
        y: 0,
        width: 10,
        height: 10,
      }),
    /dimensions must be positive/,
  );
});
