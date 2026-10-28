import { describe, expect, it, beforeEach } from "vitest";
import {
  findFinancialIdentifiers,
  redactFinancialIdentifiers,
  containsFinancialIdentifiers,
  confidentialModePromptFilter,
  REDACTION_LABELS,
} from "../shared/financial-redact.ts";
import { isOutboundTool } from "../shared/outbound.ts";
import { autoVerdict } from "./auto-approve.ts";
import {
  appendAuditLog,
  readAllAuditLogs,
  queryAuditLogs,
  exportAuditLogCsv,
  AUDIT_FILE,
} from "./audit-log.ts";
import { existsSync, unlinkSync } from "node:fs";

describe("Phase 5: Financial Identifier Redaction", () => {
  it("detects and redacts US Social Security Numbers", () => {
    const text = "Founder SSN is 123-45-6789 and cofounder has 987-65-4321 on file.";
    expect(containsFinancialIdentifiers(text)).toBe(true);
    const matches = findFinancialIdentifiers(text);
    expect(matches.length).toBe(2);
    expect(matches[0].type).toBe("ssn");

    const redacted = redactFinancialIdentifiers(text);
    expect(redacted).not.toContain("123-45-6789");
    expect(redacted).not.toContain("987-65-4321");
    expect(redacted).toContain(REDACTION_LABELS.ssn);
  });

  it("detects and redacts wire routing numbers and bank accounts", () => {
    const text = "Wire routing number: 021000021 and account # 123456789012.";
    expect(containsFinancialIdentifiers(text)).toBe(true);

    const redacted = redactFinancialIdentifiers(text);
    expect(redacted).toContain(REDACTION_LABELS.routing);
    expect(redacted).toContain(REDACTION_LABELS.account);
    expect(redacted).not.toContain("021000021");
    expect(redacted).not.toContain("123456789012");
  });

  it("detects and redacts formatted credit card numbers", () => {
    const text = "Payment made using Visa 4111-2222-3333-4444 on file.";
    expect(containsFinancialIdentifiers(text)).toBe(true);

    const redacted = redactFinancialIdentifiers(text);
    expect(redacted).toContain(REDACTION_LABELS.credit_card);
    expect(redacted).not.toContain("4111-2222-3333-4444");
  });

  it("detects and redacts personal phone numbers", () => {
    const text = "Contact founder directly at +1 (555) 234-5678 or 555-876-5432.";
    expect(containsFinancialIdentifiers(text)).toBe(true);

    const redacted = redactFinancialIdentifiers(text);
    expect(redacted).toContain(REDACTION_LABELS.phone);
    expect(redacted).not.toContain("555-234-5678");
  });

  it("filters prompts and provides privacy warnings under confidential mode", () => {
    const prompt = "Please evaluate borrower with SSN 123-45-6789 and routing: 123456789.";
    const active = confidentialModePromptFilter(prompt, true);
    expect(active.redacted).toBe(true);
    expect(active.warnings.length).toBeGreaterThan(0);
    expect(active.prompt).toContain(REDACTION_LABELS.ssn);
    expect(active.prompt).not.toContain("123-45-6789");

    const disabled = confidentialModePromptFilter(prompt, false);
    expect(disabled.redacted).toBe(false);
    expect(disabled.warnings.length).toBe(0);
    expect(disabled.prompt).toBe(prompt);
  });
});

describe("Phase 5: Outbound Tool Gates & Safety Floor", () => {
  it("classifies external messaging, emails, signups, and money movement as outbound", () => {
    const outboundTools = [
      "SENDGRID_EMAIL",
      "POSTMARK_MAIL",
      "TWILIO_SMS",
      "TWILIO_CALL",
      "AUTH0_SIGNUP_USER",
      "OKTA_REGISTER_ACCOUNT",
      "MERCURY_WIRE_FUNDS",
      "STRIPE_DISBURSE_FUNDS",
      "mcp__ledger__create_transaction",
      "mcp__banking__create_account",
      "mcp__auth__create_user",
      "mcp__zoom__create_invitation",
    ];

    for (const tool of outboundTools) {
      expect(isOutboundTool(tool), `Expected ${tool} to be classified as outbound`).toBe(true);
    }
  });

  it("requires human approval for outbound tools across EVERY mode: full, auto, and ask", () => {
    const outboundSamples = [
      { name: "email", tool: "GMAIL_SEND_EMAIL" },
      { name: "Slack post", tool: "SLACK_POST_MESSAGE" },
      { name: "CRM write", tool: "HUBSPOT_ADD_CONTACT" },
      { name: "external share", tool: "GOOGLE_DRIVE_SHARE_FILE" },
    ];

    for (const { name, tool } of outboundSamples) {
      expect(isOutboundTool(tool), `${name} (${tool}) must be recognized as outbound`).toBe(true);

      // 1. Full mode must NOT bypass the outbound guard
      const full = autoVerdict("full", tool);
      expect(full.approve, `Full mode must require approval for ${name}`).toBeNull();
      expect(full.source).toBe("outbound-guard");

      // 2. Auto mode must require approval
      const auto = autoVerdict("auto", tool);
      expect(auto.approve, `Auto mode must require approval for ${name}`).toBeNull();
      expect(auto.source).toBe("outbound-guard");

      // 3. Ask mode must require approval
      const ask = autoVerdict("ask", tool);
      expect(ask.approve, `Ask mode must require approval for ${name}`).toBeNull();
      expect(ask.source).toBe("outbound-guard");
    }
  });

  it("handles non-outbound tools appropriately across full, auto, and ask modes", () => {
    const nonOutboundTool = "GMAIL_CREATE_EMAIL_DRAFT";
    expect(isOutboundTool(nonOutboundTool)).toBe(false);

    // Full access approves non-outbound tools automatically
    const full = autoVerdict("full", nonOutboundTool);
    expect(full.approve).toBe(`approved ${nonOutboundTool} (full access)`);
    expect(full.source).toBe("full-access");

    // Auto mode without explicit allowlist gates native approval
    const auto = autoVerdict("auto", nonOutboundTool);
    expect(auto.approve).toBeNull();
    expect(auto.source).toBe("native-approval");

    // Ask mode requires human prompt
    const ask = autoVerdict("ask", nonOutboundTool);
    expect(ask.approve).toBeNull();
    expect(ask.source).toBe("no-grant");
  });

  it("allows internal drafting and read operations without triggering outbound guard", () => {
    expect(isOutboundTool("GMAIL_CREATE_EMAIL_DRAFT")).toBe(false);
    expect(isOutboundTool("GITHUB_CREATE_AN_ISSUE")).toBe(false);
    expect(isOutboundTool("LINEAR_CREATE_ISSUE")).toBe(false);
  });
});

describe("Phase 5: Institutional Audit Log", () => {
  beforeEach(() => {
    if (existsSync(AUDIT_FILE)) {
      try {
        unlinkSync(AUDIT_FILE);
      } catch {
        // ignore
      }
    }
  });

  it("appends and queries audit events accurately", () => {
    appendAuditLog({
      botId: "financial-analyst",
      botName: "Financial Analyst",
      dealId: "deal-apexflow",
      action: "document_access",
      target: "Financial_Model_FY24_27.xlsx",
      userApproval: "auto",
      status: "success",
      metadata: { cells: 1500 },
    });

    appendAuditLog({
      botId: "risk-officer",
      botName: "Risk Officer",
      dealId: "deal-apexflow",
      action: "decision",
      target: "flag_critical_debt_covenant",
      userApproval: "approved",
      status: "success",
    });

    const logs = readAllAuditLogs();
    expect(logs.length).toBe(2);

    const query1 = queryAuditLogs({ dealId: "deal-apexflow" });
    expect(query1.total).toBe(2);

    const query2 = queryAuditLogs({ botId: "financial-analyst" });
    expect(query2.total).toBe(1);
    expect(query2.entries[0].botName).toBe("Financial Analyst");
  });

  it("exports valid RFC 4180 CSV with headers and escaped fields", () => {
    appendAuditLog({
      botId: "legal-reviewer",
      botName: "Legal Reviewer",
      dealId: "deal-apexflow",
      action: "tool_call",
      target: "sec_edgar_search",
      userApproval: "auto",
      status: "success",
      metadata: { query: 'CIK: "000123456"' },
    });

    const csv = exportAuditLogCsv({ dealId: "deal-apexflow" });
    expect(csv).toContain("Audit ID");
    expect(csv).toContain('"Legal Reviewer"');
    expect(csv).toContain('"sec_edgar_search"');
    expect(csv).toContain('"deal-apexflow"');
  });
});
