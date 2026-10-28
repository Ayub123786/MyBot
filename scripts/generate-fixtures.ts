import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createZipArchive } from "../server/deals.ts";

const FIXTURES_DIR = join(process.cwd(), "server", "fixtures");
mkdirSync(FIXTURES_DIR, { recursive: true });

// 1. Text-based PDF (sample-deal-memo.pdf)
function generateTextPdf(): Buffer {
  const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 135 >>
stream
BT
/F1 14 Tf
72 700 Td
(ApexFlow AI Series A Diligence Memo) Tj
/F1 10 Tf
0 -24 Td
(Target Valuation: $35M Pre-Money. ARR: $3.2M with 142% YoY growth.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000227 00000 n 
0000000414 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
488
%%EOF
`;
  return Buffer.from(content, "binary");
}

// 2. Scanned / image-only PDF (sample-scanned.pdf)
function generateScannedPdf(): Buffer {
  const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 45 >>
stream
q
612 0 0 792 0 0 cm
/Im1 Do
Q
endstream
endobj
5 0 obj
<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length 3 >>
stream
\xFF\xFF\xFF
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000227 00000 n 
0000000322 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
462
%%EOF
`;
  return Buffer.from(content, "binary");
}

// 3. Word DOCX (sample-due-diligence.docx)
function generateDocx(): Buffer {
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>ApexFlow AI Commercial Diligence Overview</w:t></w:r></w:p>
    <w:p><w:r><w:t>Executive summary of key findings and investment thesis.</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Metric</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>FY2024</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>FY2025</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>ARR</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>$1.32M</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>$3.20M</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Gross Margin</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>74.2%</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>78.4%</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`;

  return createZipArchive({
    "[Content_Types].xml": contentTypesXml,
    "_rels/.rels": relsXml,
    "word/document.xml": documentXml,
  });
}

// 4. Excel XLSX (sample-financial-model.xlsx)
function generateXlsx(): Buffer {
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Summary" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="5" uniqueCount="5">
  <si><t>Metric</t></si>
  <si><t>FY2024</t></si>
  <si><t>FY2025</t></si>
  <si><t>ARR</t></si>
  <si><t>Net Burn</t></si>
</sst>`;

  const sheet1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
      <c r="C1" t="s"><v>2</v></c>
    </row>
    <row r="2">
      <c r="A2" t="s"><v>3</v></c>
      <c r="B2"><v>1320000</v></c>
      <c r="C2"><v>3200000</v></c>
    </row>
    <row r="3">
      <c r="A3" t="s"><v>4</v></c>
      <c r="B3"><v>120000</v></c>
      <c r="C3"><v>165000</v></c>
    </row>
  </sheetData>
</worksheet>`;

  return createZipArchive({
    "[Content_Types].xml": contentTypesXml,
    "_rels/.rels": relsXml,
    "xl/_rels/workbook.xml.rels": workbookRelsXml,
    "xl/workbook.xml": workbookXml,
    "xl/sharedStrings.xml": sharedStringsXml,
    "xl/worksheets/sheet1.xml": sheet1Xml,
  });
}

// 5. PowerPoint PPTX (sample-pitch-deck.pptx)
function generatePptx(): Buffer {
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;

  const presentationXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
    <p:sldId id="257" r:id="rId2" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
  </p:sldIdLst>
</p:presentation>`;

  const slide1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p><a:r><a:t>ApexFlow AI Executive Pitch Deck</a:t></a:r></a:p>
          <a:p><a:r><a:t>Autonomous Workflow Synthesis Platform</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

  const slide2Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p><a:r><a:t>Financial Highlights &amp; Unit Economics</a:t></a:r></a:p>
          <a:p><a:r><a:t>142% Year-over-Year ARR Expansion to $3.2M</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

  return createZipArchive({
    "[Content_Types].xml": contentTypesXml,
    "_rels/.rels": relsXml,
    "ppt/presentation.xml": presentationXml,
    "ppt/slides/slide1.xml": slide1Xml,
    "ppt/slides/slide2.xml": slide2Xml,
  });
}

writeFileSync(join(FIXTURES_DIR, "sample-deal-memo.pdf"), generateTextPdf());
writeFileSync(join(FIXTURES_DIR, "sample-scanned.pdf"), generateScannedPdf());
writeFileSync(join(FIXTURES_DIR, "sample-due-diligence.docx"), generateDocx());
writeFileSync(join(FIXTURES_DIR, "sample-financial-model.xlsx"), generateXlsx());
writeFileSync(join(FIXTURES_DIR, "sample-pitch-deck.pptx"), generatePptx());

console.log("Successfully generated real binary fixtures in server/fixtures/!");
