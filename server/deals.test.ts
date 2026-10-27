import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { extractTextAndTables } from "./deal-document-extractor.ts";
import {
  assertDealIsolation,
  buildDocxArchive,
  createDealStore,
  generateDealMemoHtml,
} from "./deals.ts";

describe("Phase 4: Deals, Data Room Isolation, and Diligence Integrations", () => {
  let tempDir: string;

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
});
