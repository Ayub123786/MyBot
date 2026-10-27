import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePackageDocument } from "../package-format.ts";

describe("Deal Team Package", () => {
  it("conforms strictly to openmaus.package v2 schema", () => {
    const filePath = join(__dirname, "deal-team.json");
    const content = JSON.parse(readFileSync(filePath, "utf8"));
    const parsed = parsePackageDocument(content, { trust: "file" });

    expect(parsed.format).toBe("openmaus.package");
    expect(parsed.version).toBe(2);
    expect(parsed.package.id).toBe("deal-team");
    expect(parsed.package.name).toBe("Deal Team");
    expect(parsed.package.agents.length).toBe(9);

    const keys = parsed.package.agents.map((a) => a.key);
    expect(keys).toEqual([
      "deal-lead",
      "sourcing-scout",
      "market-analyst",
      "financial-analyst",
      "legal-reviewer",
      "founder-checker",
      "tech-analyst",
      "risk-officer",
      "memo-writer",
    ]);

    expect(parsed.package.team?.leader).toBe("deal-lead");
    expect(parsed.package.skills?.entries.length).toBe(5);

    // Verify all agents have avatars with PNG and approval set to ask
    for (const agent of parsed.package.agents) {
      expect(agent.approval).toBe("ask");
      expect(agent.appearance.avatar).toBeDefined();
      expect(agent.appearance.avatar?.mime).toBe("image/png");
      expect(agent.appearance.avatar?.data.length).toBeGreaterThan(100);
      expect(agent.soul).toContain("MANDATORY DILIGENCE STANDARDS & OPERATING RULES");
      expect(agent.soul).toContain("CITATIONS REQUIRED");
      expect(agent.soul).toContain("Internal Decision Support — Not Investment Advice.");
    }
  });
});
