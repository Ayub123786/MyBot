import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { inflateRawSync } from "node:zlib";
import Papa from "papaparse";

export interface ExtractedTable {
  name?: string;
  headers: string[];
  rows: string[][];
  rowCount: number;
}

export interface ExtractedDocumentContent {
  text: string;
  wordCount: number;
  tables: ExtractedTable[];
  metadata?: Record<string, unknown>;
}

// Zip reader supporting both Local File Header traversal and Central Directory fallback
function readZipEntries(buffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  let offset = 0;

  // 1. Try Local File Header traversal (PK\x03\x04)
  while (offset < buffer.length - 30) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) {
      break;
    }

    const compression = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraFieldLength = buffer.readUInt16LE(offset + 28);

    const fileNameStart = offset + 30;
    const fileName = buffer.toString("utf8", fileNameStart, fileNameStart + fileNameLength);
    const dataStart = fileNameStart + fileNameLength + extraFieldLength;
    const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);

    let fileData: Buffer;
    if (compression === 0) {
      fileData = compressedData;
    } else if (compression === 8) {
      try {
        fileData = inflateRawSync(compressedData);
      } catch {
        fileData = Buffer.alloc(0);
      }
    } else {
      fileData = Buffer.alloc(0);
    }

    entries.set(fileName, fileData);
    offset = dataStart + compressedSize;
  }

  if (entries.size > 0) {
    return entries;
  }

  // 2. Central Directory fallback for archives with data descriptors or end-of-archive layout
  try {
    let eocdOffset = -1;
    for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
      if (buffer.readUInt32LE(i) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset >= 0) {
      const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
      const cdOffset = buffer.readUInt32LE(eocdOffset + 16);
      let cdPos = cdOffset;
      for (let i = 0; i < totalEntries && cdPos < buffer.length - 46; i++) {
        if (buffer.readUInt32LE(cdPos) !== 0x02014b50) break;
        const compression = buffer.readUInt16LE(cdPos + 10);
        const compSize = buffer.readUInt32LE(cdPos + 20);
        const fnLen = buffer.readUInt16LE(cdPos + 28);
        const extraLen = buffer.readUInt16LE(cdPos + 30);
        const commentLen = buffer.readUInt16LE(cdPos + 32);
        const localHdrOffset = buffer.readUInt32LE(cdPos + 42);
        const fileName = buffer.toString("utf8", cdPos + 46, cdPos + 46 + fnLen);

        if (localHdrOffset < buffer.length - 30 && buffer.readUInt32LE(localHdrOffset) === 0x04034b50) {
          const localFnLen = buffer.readUInt16LE(localHdrOffset + 26);
          const localExtraLen = buffer.readUInt16LE(localHdrOffset + 28);
          const dataStart = localHdrOffset + 30 + localFnLen + localExtraLen;
          const compData = buffer.subarray(dataStart, dataStart + compSize);
          let fileData: Buffer;
          if (compression === 0) {
            fileData = compData;
          } else if (compression === 8) {
            try { fileData = inflateRawSync(compData); } catch { fileData = Buffer.alloc(0); }
          } else {
            fileData = Buffer.alloc(0);
          }
          entries.set(fileName, fileData);
        }
        cdPos += 46 + fnLen + extraLen + commentLen;
      }
    }
  } catch {
    // fallback ignore
  }

  return entries;
}

function stripXmlTags(xml: string): string {
  return xml
    .replace(/<w:tab[^>]*\/>/gi, "\t")
    .replace(/<w:br[^>]*\/>/gi, "\n")
    .replace(/<\/w:p>/gi, "\n")
    .replace(/<\/w:tr>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractFromCsvOrTsv(content: string): ExtractedDocumentContent {
  const parsed = Papa.parse<string[]>(content, {
    skipEmptyLines: true,
  });

  const rawRows = parsed.data;
  if (!rawRows.length) {
    return { text: content, wordCount: content.split(/\s+/).filter(Boolean).length, tables: [] };
  }

  const headers = rawRows[0] ?? [];
  const dataRows = rawRows.slice(1);
  const table: ExtractedTable = {
    headers,
    rows: dataRows,
    rowCount: dataRows.length,
  };

  // Build markdown representation
  const markdownTable = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...dataRows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");

  const fullText = `${content}\n\n### Tabular Data:\n${markdownTable}`;
  return {
    text: fullText,
    wordCount: fullText.split(/\s+/).filter(Boolean).length,
    tables: [table],
  };
}

export function extractFromDocx(buffer: Buffer): ExtractedDocumentContent {
  try {
    const entries = readZipEntries(buffer);
    const docXml = entries.get("word/document.xml");
    if (!docXml) {
      return { text: "[DOCX: Could not locate word/document.xml]", wordCount: 0, tables: [] };
    }

    const xmlString = docXml.toString("utf8");
    const text = stripXmlTags(xmlString);
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    // Detect tables from <w:tbl> tags
    const tables: ExtractedTable[] = [];
    const tableMatches = xmlString.match(/<w:tbl[\s\S]*?<\/w:tbl>/gi) || [];
    for (const tblXml of tableMatches) {
      const rowMatches = tblXml.match(/<w:tr[\s\S]*?<\/w:tr>/gi) || [];
      const parsedRows: string[][] = [];
      for (const rowXml of rowMatches) {
        const cellMatches = rowXml.match(/<w:tc[\s\S]*?<\/w:tc>/gi) || [];
        const rowCells = cellMatches.map((cellXml) => stripXmlTags(cellXml));
        if (rowCells.some((c) => c.length > 0)) {
          parsedRows.push(rowCells);
        }
      }
      if (parsedRows.length > 1) {
        tables.push({
          headers: parsedRows[0]!,
          rows: parsedRows.slice(1),
          rowCount: parsedRows.length - 1,
        });
      }
    }

    return { text, wordCount, tables };
  } catch (error) {
    return {
      text: `[DOCX extraction error: ${error instanceof Error ? error.message : String(error)}]`,
      wordCount: 0,
      tables: [],
    };
  }
}

export function extractFromPptx(buffer: Buffer): ExtractedDocumentContent {
  try {
    const entries = readZipEntries(buffer);
    const slides: string[] = [];

    // Find all slide XML files
    const slideKeys = Array.from(entries.keys())
      .filter((k) => /^ppt\/slides\/slide\d+\.xml$/i.test(k))
      .sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
        const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
        return numA - numB;
      });

    slideKeys.forEach((key, index) => {
      const slideXml = entries.get(key);
      if (slideXml) {
        const slideText = stripXmlTags(slideXml.toString("utf8"));
        if (slideText) {
          slides.push(`--- Slide ${index + 1} ---\n${slideText}`);
        }
      }
    });

    const fullText = slides.join("\n\n");
    return {
      text: fullText || "[PPTX: No text extracted from slides]",
      wordCount: fullText.split(/\s+/).filter(Boolean).length,
      tables: [],
    };
  } catch (error) {
    return {
      text: `[PPTX extraction error: ${error instanceof Error ? error.message : String(error)}]`,
      wordCount: 0,
      tables: [],
    };
  }
}

export function extractFromXlsx(buffer: Buffer): ExtractedDocumentContent {
  try {
    const entries = readZipEntries(buffer);
    const sharedStringsXml = entries.get("xl/sharedStrings.xml");
    const sharedStrings: string[] = [];

    if (sharedStringsXml) {
      const ssString = sharedStringsXml.toString("utf8");
      const stringMatches = ssString.match(/<t[^>]*>([\s\S]*?)<\/t>/gi) || [];
      for (const sm of stringMatches) {
        sharedStrings.push(stripXmlTags(sm));
      }
    }

    const sheets: string[] = [];
    const tables: ExtractedTable[] = [];

    const sheetKeys = Array.from(entries.keys())
      .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k))
      .sort();

    sheetKeys.forEach((key, sheetIndex) => {
      const sheetXml = entries.get(key);
      if (!sheetXml) return;

      const xmlText = sheetXml.toString("utf8");
      const rowMatches = xmlText.match(/<row[^>]*>([\s\S]*?)<\/row>/gi) || [];
      const rows: string[][] = [];

      for (const rowXml of rowMatches) {
        const cellMatches = rowXml.match(/<c[^>]*>([\s\S]*?)<\/c>/gi) || [];
        const cells: string[] = [];

        for (const cellXml of cellMatches) {
          const isString = /t="s"/i.test(cellXml);
          const valMatch = cellXml.match(/<v>([\s\S]*?)<\/v>/i);
          if (valMatch && valMatch[1]) {
            if (isString) {
              const strIndex = parseInt(valMatch[1], 10);
              cells.push(sharedStrings[strIndex] || "");
            } else {
              cells.push(valMatch[1]);
            }
          }
        }
        if (cells.length) rows.push(cells);
      }

      if (rows.length) {
        const headers = rows[0]!;
        const dataRows = rows.slice(1);
        tables.push({
          headers,
          rows: dataRows,
          rowCount: dataRows.length,
        });

        const sheetLines = [
          `# Sheet ${sheetIndex + 1}`,
          ...rows.map((r) => r.join("\t")),
        ].join("\n");
        sheets.push(sheetLines);
      }
    });

    const fullText = sheets.join("\n\n");
    return {
      text: fullText || "[XLSX: No sheet text found]",
      wordCount: fullText.split(/\s+/).filter(Boolean).length,
      tables,
    };
  } catch (error) {
    return {
      text: `[XLSX extraction error: ${error instanceof Error ? error.message : String(error)}]`,
      wordCount: 0,
      tables: [],
    };
  }
}

export function extractFromPdf(buffer: Buffer): ExtractedDocumentContent {
  try {
    const rawString = buffer.toString("binary");
    const textPieces: string[] = [];

    // Extract text strings between BT (Begin Text) and ET (End Text) or Tj/TJ operators
    const textBlockRegex = /BT[\s\S]*?ET/g;
    let match: RegExpExecArray | null;

    while ((match = textBlockRegex.exec(rawString)) !== null) {
      const block = match[0];
      // Match parenthesized text: (Hello World) Tj or [(Hello) 10 (World)] TJ
      const stringRegex = /\(([^)]*)\)/g;
      let stringMatch: RegExpExecArray | null;
      const linePieces: string[] = [];
      while ((stringMatch = stringRegex.exec(block)) !== null) {
        const decoded = stringMatch[1]
          ?.replace(/\\([0-7]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
          ?.replace(/\\r/g, "\r")
          ?.replace(/\\n/g, "\n")
          ?.replace(/\\t/g, "\t")
          ?.replace(/\\([()\\])/g, "$1");
        if (decoded && decoded.trim()) linePieces.push(decoded.trim());
      }
      if (linePieces.length) {
        textPieces.push(linePieces.join(" "));
      }
    }

    const extractedText = textPieces.join("\n").trim();
    if (!extractedText) {
      return {
        text: "[PDF text extraction: no text found, OCR needed]",
        wordCount: 0,
        tables: [],
        metadata: { ocrNeeded: true, status: "no text found, OCR needed" },
      };
    }

    return {
      text: extractedText,
      wordCount: extractedText.split(/\s+/).filter(Boolean).length,
      tables: [],
    };
  } catch (error) {
    return {
      text: `[PDF extraction error: ${error instanceof Error ? error.message : String(error)}]`,
      wordCount: 0,
      tables: [],
    };
  }
}

export function extractTextAndTables(options: {
  buffer: Buffer;
  originalName: string;
  mimeType?: string;
}): ExtractedDocumentContent {
  const ext = extname(options.originalName).toLowerCase();
  const mime = options.mimeType;
  const buffer = options.buffer;

  if (ext === ".csv" || ext === ".tsv" || mime === "text/csv" || mime === "text/tab-separated-values") {
    const res = extractFromCsvOrTsv(buffer.toString("utf8"));
    for (const t of res.tables) t.name = options.originalName;
    return res;
  }
  if (ext === ".txt" || ext === ".md" || ext === ".json" || mime?.startsWith("text/")) {
    const text = buffer.toString("utf8");
    return {
      text,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      tables: [],
    };
  }
  if (ext === ".docx" || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const res = extractFromDocx(buffer);
    for (const t of res.tables) t.name = options.originalName;
    return res;
  }
  if (ext === ".pptx" || mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
    return extractFromPptx(buffer);
  }
  if (ext === ".xlsx" || mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    const res = extractFromXlsx(buffer);
    for (const t of res.tables) t.name = options.originalName;
    return res;
  }
  if (ext === ".pdf" || mime === "application/pdf") {
    return extractFromPdf(buffer);
  }

  const raw = buffer.toString("utf8");
  return {
    text: raw,
    wordCount: raw.split(/\s+/).filter(Boolean).length,
    tables: [],
  };
}

export function extractDocumentContent(filePath: string, originalName: string, mime?: string): ExtractedDocumentContent {
  const buffer = readFileSync(filePath);
  return extractTextAndTables({ buffer, originalName, mimeType: mime });
}
