import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { extractDocumentContent, extractTextAndTables } from "./deal-document-extractor.ts";
import {
  assertDealIsolation,
  assertDealModelAllowed,
  buildDocxArchive,
  createDealStore,
  DealModelNotAllowedError,
  dispatchDealTurn,
  generateDealMemoHtml,
  getDealForThread,
} from "./deals.ts";

describe("Phase 4: Deals, Data Room Isolation, and Diligence Integrations", () => {
  let tempDir: string;
  const fixturesDir = join(process.cwd(), "server", "fixtures");

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mybot-deals-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("Deal Document Extractor", () => {
    it("extracts text and structured tables from CSV files", async () => {
      const csvContent = "Year,ARR,Growth,GrossMargin\n2023,5000000,100%,75%\n2024,12000000,140%,78%\n2025,24000000,100%,81%\n";
      const buffer = Buffer.from(csvContent, "utf8");

      const result = await extractTextAndTables({
        buffer,
        originalName: "financials.csv",
        mimeType: "text/csv",
      });

      expect(result.tables.length).toBe(1);
      expect(result.tables[0].name).toBe("financials.csv");
      expect(result.tables[0].headers).toEqual(["Year", "ARR", "Growth", "GrossMargin"]);
      expect(result.tables[0].rows.length).toBe(3);
      expect(result.wordCount).toBeGreaterThan(10);
      expect(result.text).toContain("ARR");
      expect(result.text).toContain("24000000");
    });

    it("extracts text from plain text files", async () => {
      const textContent = "Investment Thesis: ApexFlow AI represents a category-defining workflow engine.";
      const buffer = Buffer.from(textContent, "utf8");

      const result = await extractTextAndTables({
        buffer,
        originalName: "thesis.txt",
        mimeType: "text/plain",
      });

      expect(result.text).toBe(textContent);
      expect(result.wordCount).toBe(9);
      expect(result.tables.length).toBe(0);
    });

    it("extracts real binary PDF document with text stream", () => {
      const pdfPath = join(fixturesDir, "sample-deal-memo.pdf");
      expect(existsSync(pdfPath)).toBe(true);

      const result = extractDocumentContent(pdfPath, "sample-deal-memo.pdf", "application/pdf");
      expect(result.text).toContain("ApexFlow AI Series A Diligence Memo");
      expect(result.text).toContain("Target Valuation: $35M Pre-Money");
      expect(result.text).toContain("ARR: $3.2M with 142% YoY growth");
      expect(result.wordCount).toBeGreaterThan(10);
      expect(result.tables.length).toBe(0);
    });

    it("reports clear 'no text found, OCR needed' status for real scanned/image-only PDF without crashing or silent empty text", () => {
      const scannedPdfPath = join(fixturesDir, "sample-scanned.pdf");
      expect(existsSync(scannedPdfPath)).toBe(true);

      const result = extractDocumentContent(scannedPdfPath, "sample-scanned.pdf", "application/pdf");
      expect(result.text).toContain("no text found, OCR needed");
      expect(result.text).not.toBe("");
      expect(result.wordCount).toBe(0);
      expect(result.metadata?.ocrNeeded).toBe(true);
      expect(result.metadata?.status).toBe("no text found, OCR needed");
      expect(result.tables.length).toBe(0);
    });

    it("extracts real binary DOCX document with text paragraphs and tables", () => {
      const docxPath = join(fixturesDir, "sample-due-diligence.docx");
      expect(existsSync(docxPath)).toBe(true);

      const result = extractDocumentContent(docxPath, "sample-due-diligence.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      expect(result.text).toContain("ApexFlow AI Commercial Diligence Overview");
      expect(result.text).toContain("Executive summary of key findings and investment thesis.");
      expect(result.wordCount).toBeGreaterThan(10);
      expect(result.tables.length).toBe(1);
      expect(result.tables[0].headers).toEqual(["Metric", "FY2024", "FY2025"]);
      expect(result.tables[0].rows).toContainEqual(["ARR", "$1.32M", "$3.20M"]);
      expect(result.tables[0].rows).toContainEqual(["Gross Margin", "74.2%", "78.4%"]);
    });

    it("extracts real binary XLSX spreadsheet with shared strings and tables", () => {
      const xlsxPath = join(fixturesDir, "sample-financial-model.xlsx");
      expect(existsSync(xlsxPath)).toBe(true);

      const result = extractDocumentContent(xlsxPath, "sample-financial-model.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(result.text).toContain("Sheet 1");
      expect(result.text).toContain("ARR");
      expect(result.text).toContain("3200000");
      expect(result.tables.length).toBe(1);
      expect(result.tables[0].headers).toEqual(["Metric", "FY2024", "FY2025"]);
      expect(result.tables[0].rows).toContainEqual(["ARR", "1320000", "3200000"]);
      expect(result.tables[0].rows).toContainEqual(["Net Burn", "120000", "165000"]);
    });

    it("extracts real binary PPTX presentation slides", () => {
      const pptxPath = join(fixturesDir, "sample-pitch-deck.pptx");
      expect(existsSync(pptxPath)).toBe(true);

      const result = extractDocumentContent(pptxPath, "sample-pitch-deck.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      expect(result.text).toContain("--- Slide 1 ---");
      expect(result.text).toContain("ApexFlow AI Executive Pitch Deck");
      expect(result.text).toContain("Autonomous Workflow Synthesis Platform");
      expect(result.text).toContain("--- Slide 2 ---");
      expect(result.text).toContain("Financial Highlights & Unit Economics");
      expect(result.text).toContain("142% Year-over-Year ARR Expansion to $3.2M");
      expect(result.wordCount).toBeGreaterThan(15);
    });
  });

  describe("Per-Deal Data Room Isolation", () => {
    it("permits access when deal scope matches", () => {
      expect(() => {
        assertDealIsolation("deal-alpha", "deal-alpha");
      }).not.toThrow();
    });

    it("permits access when caller has no explicit isolation scope header (local client)", () => {
      expect(() => {
        assertDealIsolation("deal-alpha", undefined);
      }).not.toThrow();
    });

    it("rejects cross-deal access with 403 DealIsolationError", () => {
      expect(() => {
        assertDealIsolation("deal-alpha", "deal-beta");
      }).toThrowError(/boundary violation/);

      try {
        assertDealIsolation("deal-alpha", "deal-beta");
      } catch (err: any) {
        expect(err.status).toBe(403);
      }
    });

    it("rejects path traversal attacks in deal IDs", () => {
      const store = createDealStore(tempDir);
      expect(() => {
        store.getDeal("../outside-deal");
      }).toThrowError(/Invalid deal identifier/);

      expect(() => {
        store.getDeal("..\\outside-deal");
      }).toThrowError(/Invalid deal identifier/);
    });
  });

  describe("Deal Store Operations", () => {
    it("initializes with demo-apexflow-ai sample deal", () => {
      const store = createDealStore(tempDir);
      const deals = store.listDeals();
      expect(deals.length).toBeGreaterThanOrEqual(1);

      const demo = store.getDeal("demo-apexflow-ai");
      expect(demo).not.toBeNull();
      expect(demo?.targetCompany).toBe("ApexFlow AI, Inc.");
      expect(demo?.stage).toBe("Series A");
      expect(demo?.status).toBe("active");
      expect(demo?.findings?.length).toBeGreaterThan(0);
    });

    it("creates a new deal and enforces persistence", () => {
      const store = createDealStore(tempDir);
      const created = store.createDeal({
        targetCompany: "BioSynthetix Inc",
        stage: "Series B",
        sector: "Healthcare AI",
        valuationUsd: 85000000,
        targetCheckSizeUsd: 15000000,
        leadPartner: "Sarah Chen",
        thesisSummary: "Proprietary protein folding models for oncology discovery.",
      });

      expect(created.id).toContain("biosynthetix-inc");
      expect(created.targetCompany).toBe("BioSynthetix Inc");

      const fetched = store.getDeal(created.id);
      expect(fetched?.targetCompany).toBe("BioSynthetix Inc");
      expect(fetched?.stage).toBe("Series B");
    });

    it("adds findings with confidence levels and source citations", () => {
      const store = createDealStore(tempDir);
      const finding = {
        dealId: "demo-apexflow-ai",
        category: "financials" as const,
        severity: "Medium" as const,
        title: "Customer Concentration Risk",
        detail: "Top 2 customers represent 42% of FY2024 ARR.",
        factOrAssumptionOrOpinion: "fact" as const,
        confidenceLevel: "high" as const,
        sourceCitations: ["FY24_Financial_Model.xlsx"],
        suggestedMitigation: "Require mid-market expansion hiring milestone in series A budget.",
      };

      const added = store.addFinding("demo-apexflow-ai", finding);
      expect(added.id).toBeDefined();
      expect(added.title).toBe(finding.title);

      const deal = store.getDeal("demo-apexflow-ai");
      expect(deal?.findings?.some((f) => f.title === finding.title)).toBe(true);
    });
  });

  describe("IC Memo Generation & Packaging", () => {
    it("generates structured HTML preview for IC Memo", () => {
      const store = createDealStore(tempDir);
      const deal = store.getDeal("demo-apexflow-ai")!;
      const html = generateDealMemoHtml(deal);

      expect(html).toContain("Investment Committee");
      expect(html).toContain(deal.targetCompany);
      expect(html).toContain("Executive Summary");
      expect(html).toContain("Financial Audit");
      expect(html).toContain("Red Team");
    });

    it("packages valid Word .docx OpenXML archive with zip headers", () => {
      const store = createDealStore(tempDir);
      const deal = store.getDeal("demo-apexflow-ai")!;
      const docxBuffer = buildDocxArchive(deal);

      expect(docxBuffer.length).toBeGreaterThan(500);
      // Valid ZIP magic header: PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
      expect(docxBuffer[0]).toBe(0x50);
      expect(docxBuffer[1]).toBe(0x4B);
      expect(docxBuffer[2]).toBe(0x03);
      expect(docxBuffer[3]).toBe(0x04);
    });
  });

  describe("Per-Deal Model Governance & Restriction", () => {
    it("creates a deal with allowedModels whitelist and persists it", () => {
      const store = createDealStore(tempDir);
      const deal = store.createDeal({
        targetCompany: "SecureSovereign Inc",
        stage: "Series A",
        allowedModels: ["claude-3-7-sonnet", "local-ollama"],
      });

      expect(deal.allowedModels).toEqual(["claude-3-7-sonnet", "local-ollama"]);
      const fetched = store.getDeal(deal.id);
      expect(fetched?.allowedModels).toEqual(["claude-3-7-sonnet", "local-ollama"]);
    });

    it("allows execution when queried model is in the deal's allowedModels list", () => {
      const store = createDealStore(tempDir);
      const deal = store.createDeal({
        targetCompany: "PermittedModel Corp",
        allowedModels: ["claude-3-7-sonnet", "local-ollama"],
      });

      expect(() => assertDealModelAllowed(deal, "claude-3-7-sonnet")).not.toThrow();
      expect(() => assertDealModelAllowed(deal, "local-ollama")).not.toThrow();
      expect(() => store.assertModelAllowed(deal.id, "claude-3-7-sonnet")).not.toThrow();
    });

    it("rejects execution with DealModelNotAllowedError when model is outside allowedModels list", () => {
      const store = createDealStore(tempDir);
      const deal = store.createDeal({
        targetCompany: "RestrictedModel Corp",
        allowedModels: ["claude-3-7-sonnet", "local-ollama"],
      });

      expect(() => assertDealModelAllowed(deal, "gpt-4o")).toThrow(DealModelNotAllowedError);
      expect(() => assertDealModelAllowed(deal, "deepseek-r1")).toThrow(DealModelNotAllowedError);
      expect(() => store.assertModelAllowed(deal.id, "gpt-4o")).toThrow(DealModelNotAllowedError);

      try {
        assertDealModelAllowed(deal, "gpt-4o");
      } catch (err) {
        expect(err).toBeInstanceOf(DealModelNotAllowedError);
        const modelErr = err as DealModelNotAllowedError;
        expect(modelErr.status).toBe(400);
        expect(modelErr.code).toBe("model_not_allowed");
        expect(modelErr.message).toContain("gpt-4o");
        expect(modelErr.message).toContain("claude-3-7-sonnet, local-ollama");
      }
    });

    it("permits any model when allowedModels is empty or undefined", () => {
      const store = createDealStore(tempDir);
      const deal = store.createDeal({
        targetCompany: "OpenPolicy Corp",
        allowedModels: [],
      });

      expect(() => assertDealModelAllowed(deal, "gpt-4o")).not.toThrow();
      expect(() => assertDealModelAllowed(deal, "claude-3-7-sonnet")).not.toThrow();
      expect(() => assertDealModelAllowed(deal, "any-model-at-all")).not.toThrow();
    });

    it("updates allowedModels dynamically via setAllowedModels in deal store", () => {
      const store = createDealStore(tempDir);
      const deal = store.createDeal({
        targetCompany: "DynamicPolicy Corp",
        allowedModels: ["claude-3-7-sonnet"],
      });

      expect(() => store.assertModelAllowed(deal.id, "gpt-4o")).toThrow(DealModelNotAllowedError);

      // Expand whitelist to include gpt-4o
      const updated = store.setAllowedModels(deal.id, ["claude-3-7-sonnet", "gpt-4o"]);
      expect(updated.allowedModels).toEqual(["claude-3-7-sonnet", "gpt-4o"]);
      expect(() => store.assertModelAllowed(deal.id, "gpt-4o")).not.toThrow();
    });

    it("dispatches deal turn when model is allowed, enforcing confidentiality mode", () => {
      const store = createDealStore(tempDir);
      const deal = store.createDeal({
        targetCompany: "TurnDispatch Corp",
        allowedModels: ["claude-3-7-sonnet", "local-ollama"],
      });

      const result = store.dispatchTurn({
        dealId: deal.id,
        model: "claude-3-7-sonnet",
        prompt: "Analyze the ARR growth metrics for Series A investment.",
      });

      expect(result.success).toBe(true);
      expect(result.dealId).toBe(deal.id);
      expect(result.model).toBe("claude-3-7-sonnet");
      expect(result.prompt).toContain("ARR growth");

      // Verify direct dispatchDealTurn with deal object
      const direct = dispatchDealTurn({
        deal,
        model: "local-ollama",
        prompt: "Check balance sheet liabilities.",
      });
      expect(direct.success).toBe(true);

      // Verify rejected turn dispatch
      expect(() =>
        store.dispatchTurn({
          dealId: deal.id,
          model: "unauthorized-llm",
          prompt: "Should be blocked before dispatch.",
        })
      ).toThrow(DealModelNotAllowedError);
    });

    it("locates deal by threadId or channel-deal identifier", () => {
      const deal = getDealForThread("channel-deal-demo-apexflow-ai");
      expect(deal).not.toBeNull();
      expect(deal?.id).toBe("demo-apexflow-ai");

      const missing = getDealForThread("unrelated-thread-12345");
      expect(missing).toBeNull();
    });
  });
});
