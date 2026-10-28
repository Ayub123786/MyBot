# MyBot Investor & Deal Team Quickstart Guide

Welcome to **MyBot**, the AI agent desktop platform designed specifically for investment firms, venture capital (VC) funds, and private equity (PE) deal teams.

> **Attribution:** Based on OpenMausBot by Milind Soni (Apache-2.0).  
> Copyright © 2026 Milind Soni and OpenMausBot contributors.

---

## 1. Five-Step First-Run Guide

Get your deal team operational in five simple steps:

### Step 1: Launch the Application
- Launch MyBot via the desktop shortcut or run in development mode:
  ```powershell
  pnpm dev:desktop
  ```
- The local server boots automatically on `http://127.0.0.1:8799` with zero mandatory cloud telemetry.

### Step 2: Configure AI Model Providers
- Open **Settings** (gear icon in the bottom-left sidebar) → **Providers**.
- Connect your preferred LLM provider:
  - **Anthropic**: Claude 3.7 Sonnet / Claude 3.5 Sonnet (recommended for structured diligence and IC memo reasoning).
  - **OpenAI**: GPT-4o / o3-mini (recommended for high-speed document summarization).
  - **Local Ollama**: Run open-weights models (e.g. Llama 3, DeepSeek R1) locally with **zero data leaving your hardware**.

### Step 3: Explore the Pre-Loaded Demo Deal
- Click **Deals & Data Room** (Briefcase icon in the sidebar).
- Inspect **ApexFlow AI, Inc.**, a fully hydrated sample Series A deal workspace containing:
  - Financial model CSVs and metrics.
  - Sourcing pitch deck extractions.
  - Categorized findings across market, financials, legal, and red team risk.
  - A pre-drafted, multi-section Investment Committee (IC) memorandum.

### Step 4: Create Your First Live Deal Workspace
- Click the **New Deal** button in the top-right header.
- Enter target company name, sector, funding stage, check size, target valuation, and initial investment thesis.
- Optionally select a **Permitted Models Policy** (e.g. restrict to local models for healthcare/defense diligence).

### Step 5: Ingest Documents & Dispatch Diligence Bots
- Drag and drop data room documents (PDF, DOCX, XLSX, CSV, PPTX) into the Data Room tab.
- Switch to the **Deal Team Chat** tab to dispatch structured prompts to your 9 specialist agents:
  - *Financial Analyst*: Audit ARR growth, gross margin trajectory, and cohort retention.
  - *Technical Diligence*: Review architecture and cloud infrastructure unit economics.
  - *Risk Officer (Red Team)*: Stress-test assumptions and model downside failure modes.
  - *Memo Writer*: Synthesize findings into an institutional-grade Word (`.docx`) or binary PDF memo.

---

## 2. Creating & Managing Deal Workspaces

### Per-Deal Data Room Isolation
Every deal workspace is strictly partitioned on disk:
```
~/.mybot/deals/<deal-id>/
├── deal.json               # Deal metadata, overview metrics, findings, and IC memo state
├── documents/              # Immutable raw uploaded files
└── extracted/              # Extracted plain text and structured JSON table representations
```

- **Server-Enforced Boundaries:** All API queries require an `x-deal-scope` matching the deal identifier. Bots working on Deal A cannot view, query, or reference documents in Deal B.
- **Path Traversal Protection:** The server checks `assertPathContainedInDeal` on all file access; path traversal attacks (`../../`) are blocked with HTTP 403.

### Model Governance Policies
Deal teams can enforce model restriction rules per deal:
1. Navigate to **Deals & Data Room** → Select your deal → Click **Model Governance**.
2. Select permitted models (e.g. `claude-3-7-sonnet`, `local-ollama`) or add custom model names.
3. Once enabled, any turn dispatched on that deal to a non-whitelisted model is strictly rejected with a HTTP 400 `DealModelNotAllowedError` before any prompt tokens leave the machine.

---

## 3. Connecting Diligence Tools (MCP Servers)

MyBot integrates with Model Context Protocol (MCP) servers to give diligence agents live access to market data:

1. Open **Settings** → **MCP Servers**.
2. Enable pre-configured diligence templates:
   - **Tavily / Exa**: Live web search for competitor tracking and market sizing.
   - **SEC EDGAR**: Public company filings (10-K, 10-Q, 8-K) and capitalization benchmarks.
   - **OpenCorporates**: Entity verification, jurisdiction audits, and officer lookups.
3. Configure your custom API keys. All keys are encrypted locally using OS keychain storage.

---

## 4. Confidentiality Mode & Financial Identifier Redaction

Institutional due diligence involves highly sensitive non-public information (MNPI), cap tables, and founder records.

### Real-Time Detection & Redaction
MyBot features built-in Confidentiality Mode:
- **SSNs & ITINs**: Automatically masked as `«redacted SSN»`.
- **Bank ABA / Wire Routing**: Masked as `«redacted Wire Routing»`.
- **Bank Account Numbers**: Masked as `«redacted Bank Account»`.
- **Credit & Debit Cards**: Masked as `«redacted Credit Card»`.
- **Phone Numbers**: Masked as `«redacted Phone Number»`.

### Zero Cloud Egress Configuration
In `~/.mybot/config.json`:
```json
{
  "confidentialMode": {
    "enabled": true,
    "warnCloudModels": true,
    "redactFinancials": true
  }
}
```
When prompts are sent to external cloud LLMs, confidential numbers are stripped, and privacy advisories are logged in the audit trail. When paired with `local-ollama`, data never leaves your local physical host.

---

## 5. Outbound Approvals & Human-in-the-Loop Floor

MyBot agents are strictly prohibited from autonomous outbound communications:

- **Classified Actions:** Any tool that sends an email, SMS, message, creates an external account, posts to Slack, or executes a wire transfer is classified by `isOutboundTool()`.
- **Universal Safety Floor:** The outbound guard runs **before** all execution mode checks. Even if an agent is set to "Full Access" mode, outbound actions **always** require interactive human confirmation.
- **Interactive Verdict Cards:** When an agent drafts an email to a founder or reference, an interactive approval card is rendered in the chat stream showing the exact destination, payload, and attachments. The action is only dispatched if a human partner clicks **Approve**.

---

## 6. Exporting IC Memos & Audit Logs

### Investment Committee Memo Exports
From the **IC Memo** tab of any deal:
- **Word (.docx) Export:** Generates an authentic Microsoft Word OpenXML document styled with navy headings, metadata tables, executive summary, and compliance disclaimers.
- **Binary PDF Export:** Generates a standards-compliant binary PDF 1.4 document (`.pdf`) with embedded pagination, Type 1 typography, and disclaimer footers.
- **Print View:** Opens a clean, printable HTML preview formatted for A4 printing.

### Activity & Compliance Audit Log
- Navigate to **Settings** → **Activity & Compliance**.
- View immutable, append-only records of every tool call, document access, prompt dispatch, and approval verdict.
- Click **Export CSV** to download a complete RFC 4180 compliant audit report for compliance officers and LP diligence.
