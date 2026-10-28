import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { deflateRawSync } from "node:zlib";
import { DATA_DIR, loadConfig } from "./config.ts";
import { extractDocumentContent, type ExtractedTable } from "./deal-document-extractor.ts";
import { findFinancialIdentifiers, redactFinancialIdentifiers, confidentialModePromptFilter } from "./redact.ts";
import { appendAuditLog } from "./audit-log.ts";

export const DEALS_DIR = join(DATA_DIR, "deals");

export class DealIsolationError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "DealIsolationError";
    this.status = status;
  }
}

export class DealModelNotAllowedError extends Error {
  readonly status: number = 400;
  readonly code: string = "model_not_allowed";
  constructor(model: string, dealId: string, allowedModels: string[]) {
    super(`Model '${model}' is not permitted for deal '${dealId}'. Permitted models: ${allowedModels.join(", ")}`);
    this.name = "DealModelNotAllowedError";
  }
}

export interface DealDocument {
  id: string;
  name: string;
  fileName: string;
  mime: string;
  bytes: number;
  uploadedAt: string;
  extractionStatus: "pending" | "completed" | "failed";
  wordCount: number;
  tablesCount: number;
  extractedText: string;
  tables?: ExtractedTable[];
  hasFinancialIdentifiers?: boolean;
  confidentialWarnings?: string[];
  isRedacted?: boolean;
}

export interface DealFinding {
  id: string;
  botKey: string;
  botName: string;
  title: string;
  content: string;
  category: "screening" | "market" | "financials" | "legal" | "founder" | "tech" | "risk" | "memo";
  confidence: "High" | "Medium" | "Low";
  severity?: "Low" | "Medium" | "High" | "Critical";
  facts: string[];
  assumptions: string[];
  opinions: string[];
  citations: string[];
  createdAt: string;
}

export interface Deal {
  id: string;
  name: string;
  company: string;
  stage: string;
  sector: string;
  targetCheck: string;
  valuation: string;
  status: "active" | "passed" | "invested";
  thesisAlignment: string;
  channelId?: string;
  allowedModels?: string[];
  createdAt: string;
  updatedAt: string;
  documents: DealDocument[];
  botFindings: DealFinding[];
  memo: string;
}

export function ensureDealsDir(): void {
  mkdirSync(DEALS_DIR, { recursive: true, mode: 0o700 });
}

export function dealDir(dealId: string): string {
  const normalized = dealId.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(normalized)) {
    throw new DealIsolationError(400, "Invalid deal identifier.");
  }
  return join(DEALS_DIR, normalized);
}

/**
 * Server-Enforced Per-Deal Isolation:
 * Bots or sessions scoped to deal A are strictly prohibited from reading or querying Deal B's documents.
 */
export function assertDealIsolation(requestedDealId: string, authorizedDealId: string | null | undefined): void {
  if (!authorizedDealId) return; // General admin / client scope
  const req = requestedDealId.trim().toLowerCase();
  const auth = authorizedDealId.trim().toLowerCase();
  if (req !== auth) {
    throw new DealIsolationError(
      403,
      `Per-deal boundary violation: Context scoped to deal '${auth}' cannot access documents or data from deal '${req}'.`,
    );
  }
}

/**
 * Verify that a resolved document path is strictly contained within its deal directory.
 */
export function assertPathContainedInDeal(dealId: string, targetPath: string): void {
  const root = resolve(dealDir(dealId));
  const full = resolve(targetPath);
  if (!full.startsWith(root)) {
    throw new DealIsolationError(403, "Access denied: Path escapes deal isolation boundary.");
  }
}

export function listDeals(): Deal[] {
  ensureDealsDir();
  ensureSampleDeal();
  const deals: Deal[] = [];
  for (const entry of readdirSync(DEALS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const metaPath = join(DEALS_DIR, entry.name, "deal.json");
    if (!existsSync(metaPath)) continue;
    try {
      const deal = JSON.parse(readFileSync(metaPath, "utf8")) as Deal;
      deals.push(deal);
    } catch {
      // Ignore corrupted deal records
    }
  }
  return deals.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getDeal(dealId: string, authorizedDealId?: string | null): Deal {
  assertDealIsolation(dealId, authorizedDealId);
  const dir = dealDir(dealId);
  const metaPath = join(dir, "deal.json");
  if (!existsSync(metaPath)) {
    throw new DealIsolationError(404, `Deal '${dealId}' was not found.`);
  }
  return JSON.parse(readFileSync(metaPath, "utf8")) as Deal;
}

export function saveDeal(deal: Deal): void {
  const dir = dealDir(deal.id);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  mkdirSync(join(dir, "documents"), { recursive: true, mode: 0o700 });
  mkdirSync(join(dir, "extracted"), { recursive: true, mode: 0o700 });
  const metaPath = join(dir, "deal.json");
  writeFileSync(metaPath, JSON.stringify(deal, null, 2), "utf8");
}

/**
 * Server-Enforced Model Restriction for Deals:
 * If a deal specifies allowedModels, queries to models outside that whitelist are strictly rejected.
 */
export function assertDealModelAllowed(dealIdOrDeal: string | Deal, model: string): void {
  const deal = typeof dealIdOrDeal === "string" ? getDeal(dealIdOrDeal) : dealIdOrDeal;
  if (!deal.allowedModels || deal.allowedModels.length === 0) {
    return; // No restrictions
  }
  const normalizedModel = (model || "").trim().toLowerCase();
  const isAllowed = deal.allowedModels.some((allowed) => {
    const norm = allowed.trim().toLowerCase();
    return norm === normalizedModel || normalizedModel.includes(norm) || norm.includes(normalizedModel);
  });
  if (!isAllowed) {
    throw new DealModelNotAllowedError(model, deal.id, deal.allowedModels);
  }
}

/**
 * Look up a deal associated with an active task or chat thread.
 */
export function getDealForThread(threadId: string): Deal | null {
  if (!threadId) return null;
  const match = /^channel-deal-([a-z0-9-]+)$/.exec(threadId) || /^deal-([a-z0-9-]+)$/.exec(threadId);
  if (match) {
    try {
      return getDeal(match[1]!);
    } catch {
      // not found
    }
  }
  try {
    const deals = listDeals();
    for (const d of deals) {
      if (d.channelId === threadId || d.id === threadId || threadId.startsWith(`channel-deal-${d.id}`)) {
        return d;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function createDeal(input: {
  name: string;
  company: string;
  stage?: string;
  sector?: string;
  targetCheck?: string;
  valuation?: string;
  thesisAlignment?: string;
  allowedModels?: string[];
}): Deal {
  ensureDealsDir();
  const slug = input.company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || `deal-${randomUUID().slice(0, 8)}`;
  let id = slug;
  let counter = 2;
  while (existsSync(dealDir(id))) {
    id = `${slug}-${counter}`;
    counter += 1;
  }

  const now = new Date().toISOString();
  const deal: Deal = {
    id,
    name: input.name.trim() || input.company.trim(),
    company: input.company.trim(),
    stage: input.stage?.trim() || "Series A",
    sector: input.sector?.trim() || "Enterprise Software",
    targetCheck: input.targetCheck?.trim() || "$5.0M",
    valuation: input.valuation?.trim() || "$25.0M Pre-Money",
    status: "active",
    thesisAlignment: input.thesisAlignment?.trim() || "High priority candidate",
    channelId: `channel-deal-${id}`,
    allowedModels: input.allowedModels && input.allowedModels.length > 0 ? input.allowedModels : undefined,
    createdAt: now,
    updatedAt: now,
    documents: [],
    botFindings: [],
    memo: `# Investment Committee Memorandum: ${input.company}\n\n*Internal Decision Support — Not Investment Advice.*\n\n## 1. Executive Summary & Recommendation\nPending analysis by Deal Team specialists.\n`,
  };

  saveDeal(deal);
  return deal;
}

export function updateDeal(dealId: string, patch: Partial<Omit<Deal, "id" | "createdAt">>): Deal {
  const deal = getDeal(dealId);
  const updated: Deal = {
    ...deal,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  saveDeal(updated);
  return updated;
}

export function deleteDeal(dealId: string): void {
  const dir = dealDir(dealId);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Add a document to the Deal's data room, extract its text and tables, and persist both raw and extracted formats.
 */
export function addDealDocument(
  dealId: string,
  fileName: string,
  fileBytes: Buffer,
  mime: string,
  authorizedDealId?: string | null,
): DealDocument {
  assertDealIsolation(dealId, authorizedDealId);
  const deal = getDeal(dealId);
  const dir = dealDir(dealId);
  const docId = `doc-${randomUUID().slice(0, 8)}`;
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedPath = join(dir, "documents", `${docId}_${sanitizedName}`);
  assertPathContainedInDeal(dealId, storedPath);

  writeFileSync(storedPath, fileBytes);

  let extractionStatus: DealDocument["extractionStatus"] = "completed";
  let extractedText = "";
  let wordCount = 0;
  let tables: ExtractedTable[] = [];

  let hasFinancialIdentifiers = false;
  let isRedacted = false;
  const confidentialWarnings: string[] = [];

  try {
    const extracted = extractDocumentContent(storedPath, sanitizedName, mime);
    extractedText = extracted.text;
    wordCount = extracted.wordCount;
    tables = extracted.tables;

    const matches = findFinancialIdentifiers(extractedText);
    if (matches.length > 0) {
      hasFinancialIdentifiers = true;
      const types = [...new Set(matches.map((m) => m.type))].join(", ");
      confidentialWarnings.push(
        `Document contains ${matches.length} financial identifier(s) (${types}).`,
      );

      const cfg = loadConfig();
      const isConfidential = cfg.confidentialMode?.enabled ?? true;
      const shouldRedact = cfg.confidentialMode?.redactFinancials ?? true;

      if (isConfidential && shouldRedact) {
        extractedText = redactFinancialIdentifiers(extractedText);
        isRedacted = true;
        confidentialWarnings.push("Confidentiality mode: Financial identifiers were automatically redacted.");
      }
    }

    // Store extracted text into separate extracted/ directory for quick retrieval
    const extractedPath = join(dir, "extracted", `${docId}.txt`);
    writeFileSync(extractedPath, extractedText, "utf8");
    if (tables.length) {
      writeFileSync(join(dir, "extracted", `${docId}.tables.json`), JSON.stringify(tables, null, 2), "utf8");
    }
  } catch (error) {
    extractionStatus = "failed";
    extractedText = `[Extraction failed: ${error instanceof Error ? error.message : String(error)}]`;
  }

  const doc: DealDocument = {
    id: docId,
    name: sanitizedName,
    fileName: sanitizedName,
    mime,
    bytes: fileBytes.length,
    uploadedAt: new Date().toISOString(),
    extractionStatus,
    wordCount,
    tablesCount: tables.length,
    extractedText,
    tables,
    hasFinancialIdentifiers,
    confidentialWarnings: confidentialWarnings.length ? confidentialWarnings : undefined,
    isRedacted,
  };

  deal.documents.push(doc);
  deal.updatedAt = new Date().toISOString();
  saveDeal(deal);

  appendAuditLog({
    botId: "data-room",
    botName: "Data Room Ingestion",
    dealId,
    action: "document_access",
    target: sanitizedName,
    userApproval: "auto",
    status: extractionStatus === "failed" ? "failed" : "success",
    metadata: {
      docId,
      bytes: fileBytes.length,
      mime,
      hasFinancialIdentifiers,
      isRedacted,
    },
  });

  return doc;
}

/**
 * Filter and prepare prompts for diligence bots under Confidentiality Mode.
 */
export function prepareDealPrompt(
  dealOrId: string | Deal,
  prompt: string,
  options?: { isCloudModel?: boolean; botId?: string; botName?: string; model?: string },
): { prompt: string; redacted: boolean; warnings: string[] } {
  const dealId = typeof dealOrId === "string" ? dealOrId : dealOrId.id;
  if (options?.model) {
    assertDealModelAllowed(dealOrId, options.model);
  }
  const cfg = loadConfig();
  const isConfidential = cfg.confidentialMode?.enabled ?? true;
  const result = confidentialModePromptFilter(prompt, isConfidential);

  if (options?.isCloudModel && (cfg.confidentialMode?.warnCloudModels ?? true)) {
    result.warnings.push("Privacy Advisory: Delivering prompt to external cloud LLM under Confidentiality Mode.");
  }

  appendAuditLog({
    botId: options?.botId ?? "diligence-engine",
    botName: options?.botName ?? "Diligence Dispatcher",
    dealId,
    action: "model_prompt",
    target: options?.isCloudModel ? "external_cloud_model" : "local_model",
    userApproval: "auto",
    status: "success",
    metadata: {
      redacted: result.redacted,
      warningsCount: result.warnings.length,
      model: options?.model,
    },
  });

  return result;
}

/**
 * Dispatch turn on a deal with server-enforced model governance.
 */
export function dispatchDealTurn(options: {
  dealId?: string;
  deal?: Deal;
  botKey?: string;
  model: string;
  prompt: string;
}): { success: boolean; dealId: string; model: string; prompt: string; redacted: boolean; warnings: string[] } {
  const deal = options.deal || (options.dealId ? getDeal(options.dealId) : null);
  if (!deal) {
    throw new DealIsolationError(404, `Deal '${options.dealId}' was not found.`);
  }
  assertDealModelAllowed(deal, options.model);
  const isCloud = !options.model.toLowerCase().includes("local") && !options.model.toLowerCase().includes("ollama");
  const prepared = prepareDealPrompt(deal, options.prompt, {
    botId: options.botKey,
    botName: options.botKey,
    isCloudModel: isCloud,
    model: options.model,
  });
  return {
    success: true,
    dealId: deal.id,
    model: options.model,
    prompt: prepared.prompt,
    redacted: prepared.redacted,
    warnings: prepared.warnings,
  };
}

/**
 * Add or update a finding from a diligence bot.
 */
export function addDealFinding(dealId: string, finding: Omit<DealFinding, "id" | "createdAt">): DealFinding {
  const deal = getDeal(dealId);
  const newFinding: DealFinding = {
    id: `finding-${randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    ...finding,
  };

  deal.botFindings.push(newFinding);
  deal.updatedAt = new Date().toISOString();
  saveDeal(deal);
  return newFinding;
}

/**
 * Pure TypeScript ZIP builder for generating .docx openxml packages without external libraries.
 */
export function createZipArchive(files: Record<string, string | Buffer>): Buffer {
  const entries: Array<{ name: string; compressed: Buffer; originalSize: number; crc: number; offset: number }> = [];
  const parts: Buffer[] = [];
  let currentOffset = 0;

  // CRC32 calculation table
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[i] = c >>> 0;
  }

  function crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]!) & 0xff]!;
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  for (const [name, content] of Object.entries(files)) {
    const rawBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    const compressed = deflateRawSync(rawBuffer);
    const crc = crc32(rawBuffer);
    const nameBuffer = Buffer.from(name, "utf8");

    const header = Buffer.alloc(30 + nameBuffer.length);
    header.writeUInt32LE(0x04034b50, 0); // signature
    header.writeUInt16LE(20, 4); // min version
    header.writeUInt16LE(0, 6); // general flags
    header.writeUInt16LE(8, 8); // compression method (deflate)
    header.writeUInt16LE(0, 10); // file time
    header.writeUInt16LE(0, 12); // file date
    header.writeUInt32LE(crc, 14); // crc32
    header.writeUInt32LE(compressed.length, 18); // compressed size
    header.writeUInt32LE(rawBuffer.length, 22); // uncompressed size
    header.writeUInt16LE(nameBuffer.length, 26); // file name length
    header.writeUInt16LE(0, 28); // extra field length
    nameBuffer.copy(header, 30);

    entries.push({
      name,
      compressed,
      originalSize: rawBuffer.length,
      crc,
      offset: currentOffset,
    });

    parts.push(header);
    parts.push(compressed);
    currentOffset += header.length + compressed.length;
  }

  // Central directory
  const centralDirStart = currentOffset;
  let centralDirSize = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, "utf8");
    const cdHeader = Buffer.alloc(46 + nameBuffer.length);
    cdHeader.writeUInt32LE(0x02014b50, 0); // central dir signature
    cdHeader.writeUInt16LE(20, 4); // version made by
    cdHeader.writeUInt16LE(20, 6); // version needed
    cdHeader.writeUInt16LE(0, 8); // flags
    cdHeader.writeUInt16LE(8, 10); // compression
    cdHeader.writeUInt16LE(0, 12); // time
    cdHeader.writeUInt16LE(0, 14); // date
    cdHeader.writeUInt32LE(entry.crc, 16);
    cdHeader.writeUInt32LE(entry.compressed.length, 20);
    cdHeader.writeUInt32LE(entry.originalSize, 24);
    cdHeader.writeUInt16LE(nameBuffer.length, 28);
    cdHeader.writeUInt16LE(0, 30); // extra length
    cdHeader.writeUInt16LE(0, 32); // comment length
    cdHeader.writeUInt16LE(0, 34); // disk start
    cdHeader.writeUInt16LE(0, 36); // internal attr
    cdHeader.writeUInt32LE(0, 38); // external attr
    cdHeader.writeUInt32LE(entry.offset, 42); // local header offset
    nameBuffer.copy(cdHeader, 46);

    parts.push(cdHeader);
    centralDirSize += cdHeader.length;
  }

  // End of central directory record
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // start disk
  eocd.writeUInt16LE(entries.length, 8); // entries on disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(centralDirSize, 12); // central directory size
  eocd.writeUInt32LE(centralDirStart, 16); // central directory offset
  eocd.writeUInt16LE(0, 20); // comment length
  parts.push(eocd);

  return Buffer.concat(parts);
}

/**
 * Export the Investment Committee memo as a valid DOCX file.
 */
export function exportMemoDocx(dealOrId: string | Deal): Buffer {
  const deal = typeof dealOrId === "string" ? getDeal(dealOrId) : dealOrId;
  const escapeXml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const paragraphs: string[] = [];
  const lines = (deal.memo || "").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      paragraphs.push('<w:p><w:r><w:t></w:t></w:r></w:p>');
    } else if (trimmed.startsWith("# ")) {
      paragraphs.push(
        `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="0B2447"/></w:rPr><w:t>${escapeXml(
          trimmed.slice(2),
        )}</w:t></w:r></w:p>`,
      );
    } else if (trimmed.startsWith("## ")) {
      paragraphs.push(
        `<w:p><w:pPr><w:pStyle w:val="Heading2"/><w:spacing w:before="240" w:after="120"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="0B2447"/></w:rPr><w:t>${escapeXml(
          trimmed.slice(3),
        )}</w:t></w:r></w:p>`,
      );
    } else if (trimmed.startsWith("### ")) {
      paragraphs.push(
        `<w:p><w:pPr><w:pStyle w:val="Heading3"/><w:spacing w:before="160" w:after="80"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="1E293B"/></w:rPr><w:t>${escapeXml(
          trimmed.slice(4),
        )}</w:t></w:r></w:p>`,
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      paragraphs.push(
        `<w:p><w:pPr><w:ind w:left="360"/></w:pPr><w:r><w:t>• ${escapeXml(trimmed.slice(2))}</w:t></w:r></w:p>`,
      );
    } else {
      paragraphs.push(`<w:p><w:r><w:t>${escapeXml(trimmed)}</w:t></w:r></w:p>`);
    }
  }

  // Add mandatory footer disclaimer
  paragraphs.push(
    '<w:p><w:pPr><w:spacing w:before="400"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr><w:t>Internal Decision Support — Not Investment Advice.</w:t></w:r></w:p>',
  );

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.join("\n    ")}
  </w:body>
</w:document>`;

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

  return createZipArchive({
    "[Content_Types].xml": contentTypesXml,
    "_rels/.rels": relsXml,
    "word/document.xml": documentXml,
  });
}

/**
 * Pure TypeScript PDF Builder:
 * Generates valid binary PDF 1.4 documents containing metadata, IC memo,
 * key findings, and mandatory compliance disclaimers without external dependencies.
 */
export function exportMemoPdf(dealOrId: string | Deal): Buffer {
  const deal = typeof dealOrId === "string" ? getDeal(dealOrId) : dealOrId;

  function escapePdf(str: string): string {
    return (str || "")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/[^\x20-\x7E]/g, " ");
  }

  function wrapText(text: string, maxLen = 85): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      if (!w) continue;
      if (cur.length + w.length + 1 > maxLen) {
        if (cur) lines.push(cur);
        cur = w;
      } else {
        cur = cur ? `${cur} ${w}` : w;
      }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  }

  type PageStream = string[];
  const pages: PageStream[] = [];
  let curStream: string[] = [];
  let y = 790;

  function newPage() {
    if (curStream.length > 0) {
      // Add mandatory disclaimer footer
      curStream.push(
        "BT",
        "/F3 8 Tf",
        "50 35 Td",
        "(Internal Decision Support - Not Investment Advice. Generated by MyBot Diligence Systems.) Tj",
        "ET",
      );
      pages.push(curStream);
    }
    curStream = [];
    y = 790;
  }

  function ensureSpace(needed: number) {
    if (y - needed < 50) {
      newPage();
    }
  }

  // Header Bar
  curStream.push(
    "BT",
    "/F1 16 Tf",
    "50 780 Td",
    `(${escapePdf("MYBOT | Investment Committee Memorandum")}) Tj`,
    "ET",
  );
  curStream.push(
    "BT",
    "/F1 9 Tf",
    "440 780 Td",
    "(CONFIDENTIAL MEMO) Tj",
    "ET",
  );
  // Divider
  curStream.push(
    "0.7 0.7 0.7 RG",
    "1 w",
    "50 770 m",
    "545 770 l",
    "S",
  );

  // Deal Meta Grid
  curStream.push(
    "BT",
    "/F1 11 Tf",
    "50 745 Td",
    `(${escapePdf(`Target: ${deal.company || deal.name}`)}   ${escapePdf(`Stage: ${deal.stage}`)}   ${escapePdf(`Sector: ${deal.sector}`)}) Tj`,
    "ET",
  );
  curStream.push(
    "BT",
    "/F1 11 Tf",
    "50 730 Td",
    `(${escapePdf(`Target Check: ${deal.targetCheck}`)}   ${escapePdf(`Valuation: ${deal.valuation}`)}   ${escapePdf(`Status: ${deal.status}`)}) Tj`,
    "ET",
  );

  y = 705;

  // Render Deal Memo lines
  const memoLines = (deal.memo || "").split(/\r?\n/);
  for (const rawLine of memoLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      y -= 10;
      continue;
    }

    if (trimmed.startsWith("# ")) {
      ensureSpace(40);
      curStream.push(
        "BT",
        "/F1 14 Tf",
        `50 ${y} Td`,
        `(${escapePdf(trimmed.slice(2))}) Tj`,
        "ET",
      );
      y -= 22;
    } else if (trimmed.startsWith("## ")) {
      ensureSpace(32);
      curStream.push(
        "BT",
        "/F1 12 Tf",
        `50 ${y} Td`,
        `(${escapePdf(trimmed.slice(3))}) Tj`,
        "ET",
      );
      y -= 18;
    } else if (trimmed.startsWith("### ")) {
      ensureSpace(26);
      curStream.push(
        "BT",
        "/F1 10.5 Tf",
        `50 ${y} Td`,
        `(${escapePdf(trimmed.slice(4))}) Tj`,
        "ET",
      );
      y -= 16;
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const wrapped = wrapText(trimmed.slice(2), 80);
      for (let i = 0; i < wrapped.length; i++) {
        ensureSpace(14);
        const prefix = i === 0 ? "\\2022  " : "   ";
        curStream.push(
          "BT",
          "/F2 9.5 Tf",
          `60 ${y} Td`,
          `(${prefix}${escapePdf(wrapped[i]!)}) Tj`,
          "ET",
        );
        y -= 13;
      }
    } else {
      const wrapped = wrapText(trimmed, 85);
      for (const line of wrapped) {
        ensureSpace(14);
        curStream.push(
          "BT",
          "/F2 9.5 Tf",
          `50 ${y} Td`,
          `(${escapePdf(line)}) Tj`,
          "ET",
        );
        y -= 13;
      }
    }
  }

  // Findings summary if present
  if (deal.botFindings && deal.botFindings.length > 0) {
    ensureSpace(40);
    curStream.push(
      "BT",
      "/F1 12 Tf",
      `50 ${y} Td`,
      "(Key Diligence Findings & Citations) Tj",
      "ET",
    );
    y -= 18;
    for (const f of deal.botFindings) {
      ensureSpace(30);
      curStream.push(
        "BT",
        "/F1 10 Tf",
        `50 ${y} Td`,
        `(${escapePdf(`[${f.category.toUpperCase()}] ${f.title} (${f.confidence} Confidence)`)}) Tj`,
        "ET",
      );
      y -= 14;
      const wrappedContent = wrapText(f.content, 82);
      for (const cl of wrappedContent) {
        ensureSpace(14);
        curStream.push(
          "BT",
          "/F2 9 Tf",
          `60 ${y} Td`,
          `(${escapePdf(cl)}) Tj`,
          "ET",
        );
        y -= 12;
      }
      y -= 4;
    }
  }

  newPage();

  // Assemble PDF Object Model
  const objects: Array<{ id: number; data: string | Buffer }> = [];
  const numPages = pages.length;

  const fontF1Id = 3 + numPages * 2;
  const fontF2Id = fontF1Id + 1;
  const fontF3Id = fontF1Id + 2;

  const kidsRef = pages.map((_, i) => `${3 + i * 2} 0 R`).join(" ");

  // Obj 1: Catalog
  objects.push({
    id: 1,
    data: "<< /Type /Catalog /Pages 2 0 R >>",
  });

  // Obj 2: Pages
  objects.push({
    id: 2,
    data: `<< /Type /Pages /Kids [${kidsRef}] /Count ${numPages} >>`,
  });

  // Pages and streams
  for (let i = 0; i < numPages; i++) {
    const pageObjId = 3 + i * 2;
    const streamObjId = pageObjId + 1;
    const streamContent = pages[i]!.join("\n");
    const streamBytes = Buffer.from(streamContent, "binary");

    // Page Object
    objects.push({
      id: pageObjId,
      data: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents ${streamObjId} 0 R /Resources << /Font << /F1 ${fontF1Id} 0 R /F2 ${fontF2Id} 0 R /F3 ${fontF3Id} 0 R >> >> >>`,
    });

    // Stream Object
    const streamHeader = `<< /Length ${streamBytes.length} >>\nstream\n`;
    const streamFooter = `\nendstream`;
    objects.push({
      id: streamObjId,
      data: Buffer.concat([Buffer.from(streamHeader, "ascii"), streamBytes, Buffer.from(streamFooter, "ascii")]),
    });
  }

  // Font Objects
  objects.push({
    id: fontF1Id,
    data: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  });
  objects.push({
    id: fontF2Id,
    data: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  });
  objects.push({
    id: fontF3Id,
    data: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>",
  });

  // Binary serialization
  const chunks: Buffer[] = [];
  function writeAscii(str: string) {
    chunks.push(Buffer.from(str, "ascii"));
  }

  // Standard %PDF-1.4 header followed by 4 binary bytes (%âãÏÓ)
  chunks.push(Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  const offsets: number[] = [0];

  for (const obj of objects) {
    const currentOffset = chunks.reduce((acc, c) => acc + c.length, 0);
    offsets[obj.id] = currentOffset;

    writeAscii(`${obj.id} 0 obj\n`);
    if (Buffer.isBuffer(obj.data)) {
      chunks.push(obj.data);
    } else {
      writeAscii(obj.data);
    }
    writeAscii("\nendobj\n");
  }

  const xrefOffset = chunks.reduce((acc, c) => acc + c.length, 0);
  const totalObjs = objects.length + 1;

  writeAscii(`xref\n0 ${totalObjs}\n`);
  writeAscii("0000000000 65535 f \n");
  for (let i = 1; i < totalObjs; i++) {
    const off = offsets[i] || 0;
    const padded = off.toString().padStart(10, "0");
    writeAscii(`${padded} 00000 n \n`);
  }

  writeAscii(`trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return Buffer.concat(chunks);
}

/**
 * Export the Investment Committee memo as a PDF-ready, printable HTML document.
 */
export function exportMemoPdfHtml(dealOrId: string | Deal): string {
  const deal = typeof dealOrId === "string" ? getDeal(dealOrId) : dealOrId;
  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const formattedMemo = (deal.memo || "")
    .replace(/^# (.*$)/gim, '<h1 class="memo-title">$1</h1>')
    .replace(/^## (.*$)/gim, '<h2 class="memo-section">$1</h2>')
    .replace(/^### (.*$)/gim, '<h3 class="memo-subsection">$1</h3>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/\n\n/gim, '<p></p>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>IC Memo — ${escapeHtml(deal.company)}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0F172A;
      line-height: 1.5;
      padding: 30px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header-bar {
      border-bottom: 3px solid #0B2447;
      padding-bottom: 12px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .fund-logo { font-size: 20px; font-weight: 800; color: #0B2447; letter-spacing: -0.5px; }
    .memo-badge { font-size: 11px; font-weight: 700; color: #E6B800; background: #0B2447; padding: 4px 8px; border-radius: 4px; text-transform: uppercase; }
    .memo-title { font-size: 26px; color: #0B2447; margin: 0 0 12px 0; }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 24px;
    }
    .meta-item { font-size: 12px; }
    .meta-label { font-weight: 600; color: #64748B; text-transform: uppercase; font-size: 10px; }
    .meta-val { font-weight: 700; color: #0B2447; font-size: 13px; margin-top: 2px; }
    .memo-section { font-size: 16px; color: #0B2447; border-bottom: 1px solid #CBD5E1; padding-bottom: 4px; margin-top: 24px; }
    .memo-subsection { font-size: 14px; color: #334155; margin-top: 16px; }
    ul { margin: 8px 0; padding-left: 20px; }
    li { margin-bottom: 4px; font-size: 13.5px; }
    p { font-size: 13.5px; margin: 6px 0; }
    .disclaimer {
      margin-top: 40px;
      padding-top: 12px;
      border-top: 1px dashed #CBD5E1;
      font-size: 11px;
      color: #64748B;
      text-align: center;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="header-bar">
    <div class="fund-logo">MYBOT <span style="font-weight:400; color:#64748B;">| Investment Committee</span></div>
    <div class="memo-badge">Confidential Memo</div>
  </div>
  <div class="meta-grid">
    <div class="meta-item"><div class="meta-label">Target Company</div><div class="meta-val">${escapeHtml(deal.company)}</div></div>
    <div class="meta-item"><div class="meta-label">Stage & Sector</div><div class="meta-val">${escapeHtml(deal.stage)} · ${escapeHtml(deal.sector)}</div></div>
    <div class="meta-item"><div class="meta-label">Check Size</div><div class="meta-val">${escapeHtml(deal.targetCheck)}</div></div>
    <div class="meta-item"><div class="meta-label">Valuation</div><div class="meta-val">${escapeHtml(deal.valuation)}</div></div>
  </div>
  <div class="memo-content">
    ${formattedMemo}
  </div>
  <div class="disclaimer">
    Internal Decision Support — Not Investment Advice. Generated by MyBot Diligence Systems.
  </div>
</body>
</html>`;
}

/**
 * Seed the realistic Sample Deal if no deals exist.
 */
export function ensureSampleDeal(): void {
  const sampleDir = dealDir("demo-apexflow-ai");
  if (existsSync(sampleDir)) return;

  mkdirSync(sampleDir, { recursive: true, mode: 0o700 });
  mkdirSync(join(sampleDir, "documents"), { recursive: true, mode: 0o700 });
  mkdirSync(join(sampleDir, "extracted"), { recursive: true, mode: 0o700 });

  const now = new Date().toISOString();

  // 1. Sample Pitch Deck Text
  const pitchDeckContent = `# ApexFlow AI, Inc. — Series A Pitch Deck (Fictional Demo Data)

## Problem
Modern enterprises lose 30% of engineering and analyst productivity due to fragmented, brittle data workflows across disparate APIs, legacy ERPs, and internal SQL databases.

## Solution
ApexFlow provides autonomous workflow synthesis: enterprise data agents that ingest schema definitions, verify policy boundaries, and orchestrate complex ETL and analysis pipelines with local LLMs.

## Market Size
- TAM: $4.2B global enterprise data automation software (70,000 target enterprises x $60k ACV).
- SAM: $850M mid-to-large enterprise data engineering teams.

## Traction & Highlights
- ARR: $3.2M (up from $1.3M 12 months prior; 142% YoY growth).
- 42 Enterprise Customers, including 3 Fortune 500 pilots.
- Net Revenue Retention (NRR): 118%.
- Gross Margin: 78.4%.
`;

  // 2. Sample Financial Model CSV
  const financialCsv = `Metric,FY2024,FY2025,FY2026P
ARR ($M),1.32,3.20,7.80
YoY Growth (%),210%,142%,144%
Gross Margin (%),74.2%,78.4%,81.0%
Net Burn / Month ($k),120,165,190
CAC Payback (Months),14,11,9
Headcount,14,26,48
Cash in Bank ($M),2.10,1.45,8.20
`;

  // 3. Sample Cap Table CSV
  const capTableCsv = `Shareholder,Share Class,Shares,% Ownership,Vesting Status
Dr. Elena Vance (CEO),Common,3800000,38.0%,36/48 mo vested (83b filed)
Marcus Brody (CTO),Common,3400000,34.0%,36/48 mo vested (83b filed)
Seed Capital Partners,Series Seed Preferred,1500000,15.0%,Fully vested (1x non-participating)
Unallocated ESOP Pool,Options,1300000,13.0%,Authorized
Total Fully Diluted,,10000000,100.0%,
`;

  writeFileSync(join(sampleDir, "documents", "doc-1_ApexFlow_Series_A_Pitch_Deck.txt"), pitchDeckContent, "utf8");
  writeFileSync(join(sampleDir, "documents", "doc-2_ApexFlow_Financial_Model.csv"), financialCsv, "utf8");
  writeFileSync(join(sampleDir, "documents", "doc-3_ApexFlow_Cap_Table.csv"), capTableCsv, "utf8");

  const sampleDeal: Deal = {
    id: "demo-apexflow-ai",
    name: "ApexFlow AI, Inc. [DEMO DEAL]",
    company: "ApexFlow AI, Inc.",
    stage: "Series A",
    sector: "Enterprise Software / Workflow Intelligence",
    targetCheck: "$8.0M",
    valuation: "$35.0M Pre-Money",
    status: "active",
    thesisAlignment: "High conviction candidate. Exceptional team and strong gross margin expansion.",
    channelId: "channel-deal-demo-apexflow-ai",
    allowedModels: ["claude-3-7-sonnet", "claude-3-5-sonnet", "local-ollama"],
    createdAt: now,
    updatedAt: now,
    documents: [
      {
        id: "doc-1",
        name: "ApexFlow_Series_A_Pitch_Deck.txt",
        fileName: "ApexFlow_Series_A_Pitch_Deck.txt",
        mime: "text/plain",
        bytes: Buffer.byteLength(pitchDeckContent),
        uploadedAt: now,
        extractionStatus: "completed",
        wordCount: pitchDeckContent.split(/\s+/).length,
        tablesCount: 0,
        extractedText: pitchDeckContent,
      },
      {
        id: "doc-2",
        name: "ApexFlow_Financial_Model.csv",
        fileName: "ApexFlow_Financial_Model.csv",
        mime: "text/csv",
        bytes: Buffer.byteLength(financialCsv),
        uploadedAt: now,
        extractionStatus: "completed",
        wordCount: 45,
        tablesCount: 1,
        extractedText: financialCsv,
      },
      {
        id: "doc-3",
        name: "ApexFlow_Cap_Table.csv",
        fileName: "ApexFlow_Cap_Table.csv",
        mime: "text/csv",
        bytes: Buffer.byteLength(capTableCsv),
        uploadedAt: now,
        extractionStatus: "completed",
        wordCount: 38,
        tablesCount: 1,
        extractedText: capTableCsv,
      },
    ],
    botFindings: [
      {
        id: "finding-1",
        botKey: "sourcing-scout",
        botName: "Sourcing Scout",
        title: "Investment Mandate & Stage Screen",
        content: "ApexFlow fits our Series A Enterprise Software thesis. Check size of $8.0M on $35M Pre-Money yields a 18.6% post-money stake, meeting our 15-20% ownership target.",
        category: "screening",
        confidence: "High",
        facts: ["$8.0M check on $35M Pre-Money yields 18.6% ownership.", "Current ARR is $3.2M (> $2M Series A threshold)."],
        assumptions: ["Fund reserves additional $4.0M for Series B pro-rata follow-on."],
        opinions: ["Favorable entry valuation relative to median 12x ARR enterprise software comps."],
        citations: ["ApexFlow_Financial_Model.csv, line 2"],
        createdAt: now,
      },
      {
        id: "finding-2",
        botKey: "market-analyst",
        botName: "Market Analyst",
        title: "Bottom-Up TAM & Defensibility Moat",
        content: "TAM calculated at $4.2B across 70,000 mid-market enterprises at $60k ACV. Moat derived from customer-specific workflow graphs that yield high switching barriers after 90 days of operationalization.",
        category: "market",
        confidence: "Medium",
        facts: ["70,000 target companies in NA/EU with >100 employees.", "Average initial contract value is $52k."],
        assumptions: ["ACV can expand to $85k with multi-department deployments."],
        opinions: ["Incumbents (e.g. Alteryx) struggle with LLM-native workflow synthesis."],
        citations: ["ApexFlow_Series_A_Pitch_Deck.txt, Section Market Size"],
        createdAt: now,
      },
      {
        id: "finding-3",
        botKey: "financial-analyst",
        botName: "Financial Analyst",
        title: "Unit Economics Audit & Cash Runway",
        content: "Gross margin improved from 74.2% to 78.4% over 12 months. Monthly burn is $165k with $1.45M cash remaining (8.7 months runway). Round proceeds of $8.0M will extend runway to 36 months.",
        category: "financials",
        confidence: "High",
        facts: ["Cash balance: $1.45M as of last quarter.", "Gross Margin: 78.4% verified from COGS schedule."],
        assumptions: ["Hiring 18 additional engineers in FY2026 increases monthly net burn to $280k."],
        opinions: ["11-month CAC payback is top decile for Series A enterprise software."],
        citations: ["ApexFlow_Financial_Model.csv, rows 4-8"],
        createdAt: now,
      },
      {
        id: "finding-4",
        botKey: "legal-reviewer",
        botName: "Legal Reviewer",
        title: "Corporate Structure & IP Assignment Cleanliness",
        content: "Delaware C-Corp in good standing. Founders hold 72% combined equity under standard 4-year reverse vesting with 83(b) election receipts verified. 100% of past and present engineers have executed standard CIIAA IP assignment agreements.",
        category: "legal",
        confidence: "High",
        facts: ["Delaware C-Corp Certificate of Incorporation dated 2023-04-12.", "All 14 current employees have signed CIIAA agreements."],
        assumptions: ["No undisclosed litigation based on management representations."],
        opinions: ["Clean capitalization structure with zero complex participating liquidation preferences."],
        citations: ["ApexFlow_Cap_Table.csv, lines 2-5"],
        createdAt: now,
      },
      {
        id: "finding-5",
        botKey: "risk-officer",
        botName: "Risk Officer",
        title: "Red Team Critique & Downside Exposure",
        content: "Identified two primary vulnerabilities: (1) Customer Concentration (Medium Severity): Largest customer accounts for 22% of ARR. (2) Platform Dependency (High Severity): Architecture relies on OpenAI and Anthropic inference APIs, leaving gross margins exposed to token price changes.",
        category: "risk",
        confidence: "High",
        severity: "Medium",
        facts: ["Customer A represents $704k of $3.2M total ARR (22%).", "Cloud inference cost accounts for 14% of overall COGS."],
        assumptions: ["Customer concentration will dilute to <10% with 25 new customer additions in FY26."],
        opinions: ["Team should mandate open-weight local model fallbacks to cap third-party API exposure."],
        citations: ["ApexFlow_Financial_Model.csv", "Customer concentration schedule"],
        createdAt: now,
      },
    ],
    memo: `# Investment Committee (IC) Memorandum: ApexFlow AI, Inc.

*Internal Decision Support — Not Investment Advice.*

## 1. Executive Summary & Recommendation
- **Company Name:** ApexFlow AI, Inc. (Delaware C-Corp)
- **Target Investment:** $8.0M for 18.6% post-money equity at $35.0M Pre-Money Valuation.
- **Recommendation:** **INVEST** — Leading the Series A financing with a $8.0M commitment.
- **Core Thesis:** Enterprise data workflows remain heavily bottlenecked by manual ETL engineering. ApexFlow's autonomous workflow synthesis platform delivers 4x faster integration at 78% software gross margins, with proven 142% YoY ARR growth ($3.2M current ARR) and top-decile 11-month CAC payback.

## 2. Investment Thesis & Key Catalysts
- **Why Now:** Advances in structured LLM reasoning enable reliable schema translation that was impossible with brittle deterministic scripts.
- **Defensibility:** Customer workflows create proprietary graph memory that makes rip-and-replace costly after 90 days.

## 3. Product & Technology Diligence
- Autonomous data workflow orchestrator with strict zero-data-retention policy for customer records.
- SOC 2 Type II certified with zero material findings.

## 4. Financial Audit & Unit Economics
- **ARR:** $3.20M (142% YoY growth from $1.32M).
- **Gross Margin:** 78.4% (up from 74.2%).
- **Net Revenue Retention (NRR):** 118%.
- **CAC Payback:** 11 Months.
- **Runway:** Post-close runway of 36 months at planned expansion burn of $260k/month.

## 5. Capitalization & Deal Structure
- **Pre-Money Valuation:** $35.0M.
- **New Capital:** $8.0M Series A Preferred (1x non-participating liquidation preference, standard broad-based weighted average anti-dilution).
- **Pro-Forma Ownership:** MyBot Fund (18.6%), Founders (58.6%), Seed Investors (12.2%), ESOP Pool (10.6%).

## 6. Red Team Risks & Mitigations
- **Customer Concentration (Medium Severity):** Top logo represents 22% of ARR. *Mitigant: Contract signed on 2-year non-cancelable term; pipeline has 14 enterprise deals in late-stage pilots.*
- **API Model Margin Risk (High Severity):** Inference costs currently represent 14% of COGS. *Mitigant: ApexFlow is currently deploying fine-tuned open-source local models, cutting inference costs by 65%.*

## 7. Diligence Conclusion
Recommended for immediate partner approval. Closing subject to formal review of final Series A purchase documents and board observer agreement.

*Internal Decision Support — Not Investment Advice.*
`,
  };

  saveDeal(sampleDeal);
}

export type DealRecord = Deal & {
  targetCompany?: string;
  findings?: DealFinding[];
};

export const generateDocx = exportMemoDocx;
export const buildDocxArchive = exportMemoDocx;
export const generateDealMemoHtml = exportMemoPdfHtml;
export const generateDealMemoPdf = exportMemoPdf;
export const buildPdfDocument = exportMemoPdf;

export function createDealStore(baseDir?: string) {
  const root = baseDir ? resolve(baseDir) : DEALS_DIR;
  mkdirSync(root, { recursive: true, mode: 0o700 });

  function localDealDir(dealId: string): string {
    const normalized = dealId.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]*$/.test(normalized) || normalized.includes("..") || normalized.includes("/") || normalized.includes("\\")) {
      throw new DealIsolationError(400, "Invalid deal identifier.");
    }
    return join(root, normalized);
  }

  function ensureSample() {
    const sDir = join(root, "demo-apexflow-ai");
    if (!existsSync(sDir)) {
      ensureSampleDeal();
      if (root !== DEALS_DIR && existsSync(dealDir("demo-apexflow-ai"))) {
        const sampleMeta = readFileSync(join(dealDir("demo-apexflow-ai"), "deal.json"), "utf8");
        mkdirSync(sDir, { recursive: true });
        writeFileSync(join(sDir, "deal.json"), sampleMeta, "utf8");
      }
    }
  }

  return {
    listDeals(): DealRecord[] {
      ensureSample();
      const deals: DealRecord[] = [];
      for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const metaPath = join(root, entry.name, "deal.json");
        if (!existsSync(metaPath)) continue;
        try {
          const d = JSON.parse(readFileSync(metaPath, "utf8")) as DealRecord;
          d.targetCompany = d.company || d.name;
          d.findings = d.botFindings;
          deals.push(d);
        } catch {}
      }
      return deals.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    getDeal(dealId: string, authorizedDealId?: string | null): DealRecord | null {
      assertDealIsolation(dealId, authorizedDealId);
      const dir = localDealDir(dealId);
      const metaPath = join(dir, "deal.json");
      if (!existsSync(metaPath)) {
        if (dealId === "demo-apexflow-ai") {
          ensureSample();
          if (existsSync(metaPath)) {
            const d = JSON.parse(readFileSync(metaPath, "utf8")) as DealRecord;
            d.targetCompany = d.company || d.name;
            d.findings = d.botFindings;
            return d;
          }
        }
        return null;
      }
      const d = JSON.parse(readFileSync(metaPath, "utf8")) as DealRecord;
      d.targetCompany = d.company || d.name;
      d.findings = d.botFindings;
      return d;
    },

    createDeal(input: {
      name?: string;
      company?: string;
      targetCompany?: string;
      stage?: string;
      sector?: string;
      targetCheck?: string;
      targetCheckSizeUsd?: number;
      valuation?: string;
      valuationUsd?: number;
      thesisSummary?: string;
      thesisAlignment?: string;
      leadPartner?: string;
      allowedModels?: string[];
    }): DealRecord {
      const company = input.targetCompany || input.company || input.name || "Untitled Deal";
      const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `deal-${randomUUID().slice(0, 8)}`;
      let id = slug;
      let counter = 2;
      while (existsSync(join(root, id))) {
        id = `${slug}-${counter++}`;
      }
      const dir = join(root, id);
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      mkdirSync(join(dir, "documents"), { recursive: true, mode: 0o700 });
      mkdirSync(join(dir, "extracted"), { recursive: true, mode: 0o700 });

      const now = new Date().toISOString();
      const deal: DealRecord = {
        id,
        name: company,
        company,
        targetCompany: company,
        stage: input.stage || "Series A",
        sector: input.sector || "Enterprise Software",
        targetCheck: input.targetCheck || (input.targetCheckSizeUsd ? `$${(input.targetCheckSizeUsd / 1e6).toFixed(1)}M` : "$5.0M"),
        valuation: input.valuation || (input.valuationUsd ? `$${(input.valuationUsd / 1e6).toFixed(1)}M` : "$25.0M"),
        status: "active",
        thesisAlignment: input.thesisSummary || input.thesisAlignment || "Under initial review.",
        allowedModels: input.allowedModels,
        createdAt: now,
        updatedAt: now,
        documents: [],
        botFindings: [],
        findings: [],
        memo: `# Investment Committee Memo: ${company}\n\n*Internal Decision Support — Not Investment Advice.*\n\n## 1. Executive Summary\nPreliminary analysis pending data room ingestion.`,
      };

      writeFileSync(join(dir, "deal.json"), JSON.stringify(deal, null, 2), "utf8");
      return deal;
    },

    assertModelAllowed(dealId: string, model: string): void {
      const deal = this.getDeal(dealId);
      if (!deal) throw new DealIsolationError(404, `Deal '${dealId}' not found`);
      assertDealModelAllowed(deal, model);
    },

    setAllowedModels(dealId: string, models: string[]): DealRecord {
      const deal = this.getDeal(dealId);
      if (!deal) throw new DealIsolationError(404, `Deal '${dealId}' not found`);
      deal.allowedModels = models;
      deal.updatedAt = new Date().toISOString();
      writeFileSync(join(localDealDir(dealId), "deal.json"), JSON.stringify(deal, null, 2), "utf8");
      return deal;
    },

    dispatchTurn(options: { dealId: string; botKey?: string; model: string; prompt: string }) {
      const deal = this.getDeal(options.dealId);
      if (!deal) throw new DealIsolationError(404, `Deal '${options.dealId}' not found`);
      return dispatchDealTurn({ deal, model: options.model, prompt: options.prompt, botKey: options.botKey });
    },

    exportMemoPdf(dealId: string): Buffer {
      const deal = this.getDeal(dealId);
      if (!deal) throw new DealIsolationError(404, `Deal '${dealId}' not found`);
      return exportMemoPdf(deal);
    },

    addFinding(dealId: string, finding: any): any {
      const deal = this.getDeal(dealId);
      if (!deal) throw new Error(`Deal ${dealId} not found`);
      const id = `finding-${randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString();
      const enriched: DealFinding = {
        id,
        botKey: finding.identifiedByBotId || finding.botKey || "deal-team",
        botName: finding.identifiedByBotId || finding.botName || "Deal Team",
        title: finding.title,
        content: finding.detail || finding.content || "",
        category: finding.category || "financials",
        confidence: finding.confidenceLevel || finding.confidence || "High",
        severity: finding.severity || "Medium",
        facts: finding.facts || [finding.detail],
        assumptions: finding.assumptions || [],
        opinions: finding.opinions || [],
        citations: finding.sourceCitations || finding.citations || [],
        createdAt: now,
      };
      deal.botFindings = [...(deal.botFindings || []), enriched];
      deal.findings = deal.botFindings;
      deal.updatedAt = now;
      writeFileSync(join(localDealDir(dealId), "deal.json"), JSON.stringify(deal, null, 2), "utf8");
      return { ...finding, id, identifiedAt: now };
    },
  };
}
