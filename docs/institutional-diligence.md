# MyBot Institutional Diligence & Deal Workspace Guide

**MyBot** is an institutional AI agent desktop application purpose-built for venture capital (VC) funds, private equity (PE) firms, and investment committees. It replaces fragmented diligence workflows with a coordinated, autonomous deal team operating in strictly isolated, confidential data rooms.

> **Attribution:** Based on OpenMausBot by Milind Soni (Apache-2.0).  
> Original copyright © 2026 Milind Soni and OpenMausBot contributors.

---

## 1. The Diligence Deal Team

MyBot seeds an institutional deal team consisting of 9 specialized AI agents pre-packaged in `shared/presets/deal-team.json`:

1. **Deal Lead (Chief of Staff)**
   - *Role:* Team orchestrator and primary committee liaison.
   - *Duties:* Decomposes diligence into parallel workstreams, coordinates specialists, resolves conflicting assessments, and synthesizes findings into the final Investment Committee (IC) memo.
2. **Sourcing Scout**
   - *Role:* Inbound/outbound company screening.
   - *Duties:* Evaluates pitch decks and inbound opportunities against the fund's investment thesis, stage criteria, check size, and mandate.
3. **Market & Competitor Analyst**
   - *Role:* Market size and competitive landscape mapping.
   - *Duties:* Computes TAM, SAM, and SOM using bottom-up and top-down methodologies, maps direct/indirect competitors, and evaluates defensibility.
4. **Financial Analyst**
   - *Role:* Quantitative diligence and financial model verification.
   - *Duties:* Analyzes historical financials, unit economics (LTV/CAC, payback period, net revenue retention), burn rate, runway, cap table dilution, and pro-forma projections.
5. **Legal & Compliance Reviewer**
   - *Role:* Corporate and regulatory due diligence.
   - *Duties:* Audits corporate capitalization, corporate jurisdiction, founder IP assignments, customer contracts, regulatory constraints, and compliance risks.
6. **Founder & Team Checker**
   - *Role:* Background and executive assessment.
   - *Duties:* Analyzes founder backgrounds, past exits, technical credentials, reference feedback, and vesting/retention dynamics.
7. **Technical Diligence Analyst**
   - *Role:* Software architecture and engineering review.
   - *Duties:* Reviews codebase architecture, cloud infrastructure costs, API scalability, data privacy posture, technical debt, and proprietary IP claims.
8. **Risk Officer (Red Team)**
   - *Role:* Pre-mortem and contrarian analysis.
   - *Duties:* Aggressively probes deal assumptions, models downside scenarios, highlights fatal risks, and challenges consensus bias before IC presentation.
9. **Memo Writer**
   - *Role:* IC documentation specialist.
   - *Duties:* Converts unstructured findings, quantitative models, and debate transcripts into an institutional-grade, multi-section Investment Committee memo.

---

## 2. Institutional Diligence Skills

The agents leverage five core institutional due diligence skills stored in `skills/`:

- **`dd-checklist-by-stage`**: Tailored due diligence checklist matrices adapted for Pre-Seed, Seed, Series A, Series B, and Growth/Buyout stages.
- **`red-flag-scoring-rubric`**: Standardized risk scoring framework across 5 dimensions: Market, Financial, Legal/Compliance, Team, and Technical.
- **`ic-memo-template`**: Structured 10-section Investment Committee memo standard used by premier institutional investment partnerships.
- **`data-room-review-checklist`**: Systematic audit protocol for virtual data room files (corporate docs, financials, cap table, IP, commercial agreements).
- **`company-profile-format`**: Unified format for company tear sheets, key metrics, thesis alignment, and executive summaries.

---

## 3. Deal Isolation & Data Room Architecture

### Per-Deal Isolation Boundary
Every deal workspace is strictly isolated on local disk under:
```
~/.mybot/deals/<deal-id>/
├── deal.json               # Deal metadata, overview metrics, findings, and IC memo state
├── documents/              # Immutable raw uploaded files
└── extracted/              # Extracted plain text and structured JSON table representations
```

### Path Containment & Header Validation
- **`x-deal-scope` Header:** Every request reaching `/api/deals/:id` must provide an `x-deal-scope` header matching the deal ID. Cross-deal access attempts result in an immediate `403 DealIsolationError`.
- **Directory Traversal Prevention:** The server verifies that every resolved path is strictly contained within the deal's root directory (`assertPathContainedInDeal`). Any attempt to traverse out (e.g. `../../`) is immediately blocked.

### Multi-Format Document Ingestion
The Data Room engine (`server/deal-document-extractor.ts`) extracts text and structured table data from:
- **PDF Documents** (`application/pdf`)
- **Word Documents** (`.docx`, OpenXML)
- **Excel Spreadsheets** (`.xlsx`, OpenXML sheet & shared string extraction)
- **CSV Spreadsheets** (`.csv`, RFC 4180 parsing via Papaparse)
- **PowerPoint Decks** (`.pptx`, OpenXML slide text extraction)
- **Plain Text / Markdown** (`.txt`, `.md`)

---

## 4. Confidentiality Mode & Financial Identifier Redaction

To safeguard portfolio company and limited partner privacy:

- **Automatic Identifier Detection & Redaction:**
  - Social Security Numbers (SSNs) and ITINs: `«redacted SSN»`
  - Bank ABA / Wire Routing numbers: `«redacted Wire Routing»`
  - Bank Account & DDA numbers: `«redacted Bank Account»`
  - Credit & Debit Cards: `«redacted Credit Card»`
  - Personal Phone Numbers: `«redacted Phone Number»`
- **Configuration:** Managed in `~/.mybot/config.json`:
  ```json
  {
    "confidentialMode": {
      "enabled": true,
      "warnCloudModels": true,
      "redactFinancials": true
    }
  }
  ```
- **Prompt Filtering:** When prompts are dispatched to models, `prepareDealPrompt` filters out financial identifiers and injects privacy warnings if the destination is a cloud model.

---

## 5. Outbound Tool Safety Floor & Human-in-the-Loop Gating

To prevent autonomous AI agents from inadvertently sending emails, messages, creating external accounts, or transferring capital:

- **Classified Outbound Verbs:** `SEND`, `EMAIL`, `MAIL`, `SMS`, `MESSAGE`, `CALL`, `SIGNUP`, `REGISTER`, `WIRE`, `DISBURSE`, `PAY`, `TRANSFER`, `REFUND`.
- **Classified Outbound Nouns:** `ACCOUNT`, `USER`, `INVITATION`, `WIRE`, `TRANSACTION`, `MESSAGE`, `COMMENT`, `POST`, `EMAIL`, `INVOICE`, `PAYMENT`.
- **Policy:** In all operational modes, any tool flagged as an outbound action by `isOutboundTool()` is intercepted before execution:
  - Produces verdict `{ approve: null, source: "outbound-guard" }`.
  - Requires explicit interactive approval card by an investment team member.
  - Internal drafting (`DRAFT`) without explicit `SEND` remains enabled for local note preparation.

---

## 6. Immutable Compliance Audit Trail

Compliance and LP reporting require an immutable, verifiable record of all agent activity:

- **Local Storage:** Append-only NDJSON log file at `~/.mybot/audit/audit.jsonl`.
- **Logged Events:**
  - `tool_call`: Tool invocations, arguments, and execution statuses.
  - `document_access`: Data room document ingestion, views, and downloads.
  - `model_prompt`: Dispatched prompts, redaction outcomes, and privacy warnings.
  - `decision`: Automated vs human approval verdicts.
- **REST Endpoints:**
  - `GET /api/audit`: Query audit logs with search, action filtering, status filtering, and pagination.
  - `GET /api/audit/export/csv`: Export full RFC 4180 compliant CSV audit reports.
- **UI Interface:** Accessible directly in **Settings → Activity & Compliance**, featuring real-time log inspection, status badges, and one-click CSV export.

---

## 7. Investment Committee (IC) Memo Generation & Export

The Memo Writer and Deal Lead synthesize diligence findings into a standardized IC memo:

- **Live In-App Viewer:** View categorized findings, executive summary, thesis alignment, valuation, risks, and recommendations.
- **One-Click Word Export (`.docx`):** Built-in pure TypeScript OpenXML package generator creates native Microsoft Word documents formatted with institutional typography, structured tables, and bold headers without third-party cloud conversion.
- **Printable PDF Export (`.html`):** Clean, print-styled HTML document with `@page` formatting and print-media CSS for browser print-to-PDF export.

---

## 8. Windows Packaging & Deployment

MyBot is distributed as a standalone Windows x64 executable:

```powershell
# Build application frontend and server bundles
pnpm build
pnpm build:server
pnpm build:companion
pnpm build:updater

# Package into Windows NSIS installer
pnpm package:win
```

The resulting installer is generated at:
```
release/MyBot-<version>-setup.exe
```
This installer deploys MyBot into user-level AppData, creates start menu and desktop shortcuts, and operates completely offline with zero mandatory cloud telemetry.
