import { describe, expect, it } from "vitest";
import { normalizeDeal } from "./DealsView.tsx";

describe("DealsView normalizeDeal", () => {
  it("normalizes backend deal format into frontend DealRecord safely", () => {
    const rawBackendDeal = {
      id: "demo-apexflow-ai",
      name: "ApexFlow AI, Inc. [DEMO DEAL]",
      company: "ApexFlow AI, Inc.",
      stage: "Series A",
      sector: "Enterprise Software / Workflow Intelligence",
      targetCheck: "$8.0M",
      valuation: "$35.0M Pre-Money",
      status: "active",
      thesisAlignment: "High conviction candidate.",
      documents: [
        {
          id: "doc-1",
          name: "ApexFlow_Series_A_Pitch_Deck.txt",
          fileName: "ApexFlow_Series_A_Pitch_Deck.txt",
          mime: "text/plain",
          bytes: 844,
          uploadedAt: "2026-10-28T07:48:49.345Z",
          extractionStatus: "completed",
          wordCount: 126,
          tablesCount: 0,
          extractedText: "Pitch deck text",
        },
        {
          id: "doc-2",
          name: "ApexFlow_Financial_Model.csv",
          fileName: "ApexFlow_Financial_Model.csv",
          mime: "text/csv",
          bytes: 233,
          uploadedAt: "2026-10-28T07:48:49.345Z",
          extractionStatus: "completed",
          wordCount: 45,
          tablesCount: 1,
          extractedText: "ARR,1.32",
        },
      ],
      botFindings: [
        {
          id: "finding-1",
          botKey: "sourcing-scout",
          botName: "Sourcing Scout",
          title: "Investment Mandate",
          content: "Fits mandate.",
          category: "screening",
          confidence: "High",
          facts: ["Current ARR is $3.2M"],
        },
      ],
      memo: "# Investment Committee Memo\n\nFull text here.",
    };

    const normalized = normalizeDeal(rawBackendDeal);

    expect(normalized.id).toBe("demo-apexflow-ai");
    expect(normalized.targetCompany).toBe("ApexFlow AI, Inc.");
    expect(normalized.valuationUsd).toBe(35000000);
    expect(normalized.targetCheckSizeUsd).toBe(8000000);

    // Verify documents are normalized
    expect(normalized.documents).toHaveLength(2);
    expect(normalized.documents![0].filename).toBe("ApexFlow_Series_A_Pitch_Deck.txt");
    expect(normalized.documents![0].filename.endsWith(".txt")).toBe(true);
    expect(normalized.documents![0].sizeBytes).toBe(844);
    expect(normalized.documents![0].extractedTextLength).toBe(126);
    expect(normalized.documents![0].extractedTablesCount).toBe(0);

    expect(normalized.documents![1].filename).toBe("ApexFlow_Financial_Model.csv");
    expect(normalized.documents![1].filename.endsWith(".csv")).toBe(true);

    // Verify findings are normalized
    expect(normalized.findings).toHaveLength(1);
    expect(normalized.findings![0].title).toBe("Investment Mandate");
    expect(normalized.findings![0].detail).toBe("Fits mandate.");
    expect(normalized.findings![0].factOrAssumptionOrOpinion).toBe("fact");

    // Verify memo
    expect(normalized.memo?.rawMarkdown).toBe("# Investment Committee Memo\n\nFull text here.");
  });

  it("handles null or undefined raw deal safely without throwing", () => {
    const fallback = normalizeDeal(null);
    expect(fallback.id).toBe("unknown");
    expect(fallback.targetCompany).toBe("Untitled Deal");
    expect(fallback.documents).toEqual([]);
    expect(fallback.findings).toEqual([]);
  });
});
