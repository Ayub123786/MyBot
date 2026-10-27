# MyBot Institutional Transformation: Final Report

**Branch:** `feat/rebrand-mybot`  
**Target Audience:** Venture Capital (VC), Private Equity (PE), Investment Committees, and Institutional Diligence Teams  
**Base Project:** OpenMausBot (Apache-2.0 by Milind Soni and contributors)  
**Deliverable State:** Complete across Phases 0 through 6  

---

## 1. Executive Summary

MyBot is an autonomous, institutional-grade AI agent desktop application tailored specifically for private equity and venture capital deal teams. The platform replaces fragmented, manual due diligence tasks with a coordinated team of 9 specialized diligence agents operating in isolated data rooms with deterministic confidentiality guarantees, outbound tool safety floors, and immutable audit trails.

The transformation from the upstream base was completed across seven sequential phases without breaking upstream wire compatibility (`openmaus.package` format, `OMB_` environment variables) while strictly preserving Apache-2.0 licensing and author attribution.

---

## 2. Phase-by-Phase Execution Summary

### Phase 0: Baseline & Upstream Mapping
- **Baseline Audit (`BASELINE.md`):** Recorded pre-transformation git commit (`fd4c340`), repository structure, tests, and dependencies.
- **Upstream Services Inventory (`UPSTREAM-SERVICES.md`):** Catalyzed all external endpoints, identified PostHog SaaS analytics and auto-update mechanisms for safe decommissioning.
- **Blockers Log (`BLOCKERS.md`):** Initialized tracking; confirmed Windows-only scope (macOS speech/signing bypass).

### Phase 1: Institutional Rebranding & De-SaaSification
- **Centralized Brand Token (`shared/brand.ts`):** Established `BRAND_NAME = "MyBot"`, `DATA_DIR_NAME = ".mybot"`, and `SUPPORT_URL = "https://github.com/Ayub123786/MyBot"`.
- **Telemetry Stripping:** Completely eradicated PostHog SDK, endpoints, and event capture from `src/` and `server/`.
- **SaaS & Enterprise Removal:** Deleted proprietary enterprise upselling modules (`enterprise/`); locked auto-update mechanisms in `electron-builder.yml` to prevent unwanted upstream binary overwrites.
- **Seamless Local Migration (`shared/data-migration.ts`):** Implemented automatic, non-destructive data migration copying existing user configurations, databases, and memory from `~/.openmausbot` to `~/.mybot` upon first boot.
- **Commit:** `fd52cb4` ("phase 1: rebrand to mybot, purge telemetry, and local-first data migration")

### Phase 2: Institutional Design System & Asset Generation
- **Bloomberg/Linear Aesthetic (`src/styles.css`):**
  - Institutional color palette: Deep Navy (`#0B2447`), Rich Gold accent (`#E6B800`, 8.26:1 contrast ratio against navy), Positive Emerald (`#10B981`, 6.1:1 contrast ratio), and Neutral Slate Grays.
  - Sharpened border radii (`--radius-lg: 4px; --radius-xl: 6px`) to match high-density financial terminals.
- **100% WCAG AA Compliance:** Verified contrast across all 52 light/dark color pairs via `scripts/check-skin-contrast.mjs`.
- **Professional Copy (`src/locales/en.json`):** Replaced playful terminology with authoritative institutional due diligence, deal room, and IC memo phrasing.
- **Icon Generation:** Rendered high-resolution 1024x1024, 512x512, 192x192, and 180x180 PNG and ICO assets using `@resvg/resvg-js`.
- **Commit:** `a9aac4f` ("phase 2: institutional navy-and-gold design system and assets")

### Phase 3: Diligence Bots & Skills Library
- **The Deal Team (`shared/presets/deal-team.json`):** Formatted as an `openmaus.package` v2 package containing 9 specialist agents:
  1. *Deal Lead (Chief of Staff)*: Coordinates workstreams, synthesizes consensus and dissenting views.
  2. *Sourcing Scout*: Evaluates pitch decks against fund mandate and thesis criteria.
  3. *Market & Competitor Analyst*: Bottom-up/top-down TAM/SAM/SOM and competitive moats.
  4. *Financial Analyst*: LTV/CAC, burn multiple, net revenue retention, cap table dilution.
  5. *Legal & Compliance Reviewer*: IP assignments, corporate structure, cap table hygiene, regulatory red flags.
  6. *Founder & Team Checker*: Track record, executive references, credential checks.
  7. *Technical Diligence Analyst*: Architecture, scalability, cloud economics, technical debt.
  8. *Risk Officer (Red Team)*: Pre-mortems, downside scenario modeling, consensus challenge.
  9. *Memo Writer*: Structured synthesis into institutional Investment Committee memos.
- **Visual Identities:** 9 distinct high-resolution SVG geometric badges rendered to base64 PNGs conforming to `avatarSchema`.
- **5 Diligence Skills (`skills/`):** `dd-checklist-by-stage`, `red-flag-scoring-rubric`, `ic-memo-template`, `data-room-review-checklist`, and `company-profile-format`.
- **Institutional Guardrails:** Enforced mandatory prompt rules across all bot souls: strict citations required, confidence ratings [High/Medium/Low], zero guessing ("not found" over hallucination), and explicit fact vs assumption separation.
- **Seeding & Onboarding:** Seeded in `server/presets.ts`, featured in template library, and spotlighted in `WelcomeBring.tsx`.
- **Commit:** `e49a213` ("phase 3: diligence deal team preset, skills library, and onboarding")

### Phase 4: Deals View, Data Room Isolation & Diligence Integrations
- **Per-Deal Disk Isolation (`server/deals.ts`):** Data rooms and deal workspaces partitioned under `~/.mybot/deals/<deal-id>/`. Guarded by `x-deal-scope` validation (403 `DealIsolationError`) and path traversal containment.
- **Multi-Format Data Room Extraction (`server/deal-document-extractor.ts`):** Extracts text and tabular data from PDF, DOCX, XLSX, CSV, PPTX, and TXT files using pure TypeScript OpenXML parsing and Papaparse.
- **Pure TypeScript IC Memo Packaging:** Native Word OpenXML `.docx` generator and printable HTML viewer with institutional styling.
- **Pre-configured Diligence MCP Templates (`shared/mcp-templates.ts`):** Tavily, Exa, SEC EDGAR, OpenCorporates, and enterprise placeholders for Crunchbase and PitchBook (no DocuSign).
- **Interactive Deals UI (`src/components/DealsView.tsx`):** Overview metrics, drag-and-drop data room with real-time extraction status, multi-bot chat dispatcher, categorized findings dashboard, and IC memo viewer.
- **Navigation:** Added "Deals & Data Room" with Briefcase icon to `SidebarFooterNav.tsx` and wired to state store.
- **Commit:** `a0f68b6` ("phase 4: deals view, data room isolation, and diligence integrations")

### Phase 5: Safety Floor, Confidentiality Mode & Audit Logging
- **Outbound Tool Gates (`shared/outbound.ts`):** Expanded `SEND_VERBS` (added `EMAIL`, `MAIL`, `SMS`, `MESSAGE`, `CALL`, `SIGNUP`, `REGISTER`, `WIRE`, `DISBURSE`) and `SENT_NOUNS` (added `ACCOUNT`, `USER`, `INVITATION`, `WIRE`, `TRANSACTION`). All outbound actions are classified by `isOutboundTool()` and trigger `source: "outbound-guard"`, requiring explicit human approval. Internal drafting (`DRAFT`) remains enabled.
- **Confidentiality Mode & Financial Redaction (`shared/financial-redact.ts`):** Regex-driven detection and redaction for SSNs/ITINs (`«redacted SSN»`), wire routing numbers (`«redacted Wire Routing»`), bank accounts (`«redacted Bank Account»`), credit cards (`«redacted Credit Card»`), and phone numbers (`«redacted Phone Number»`). Added `confidentialMode` to `AppConfig` and wired into data room ingestion and diligence prompt filtering.
- **Local Compliance Audit Trail (`server/audit-log.ts`):** Append-only log file at `~/.mybot/audit/audit.jsonl` recording `tool_call`, `document_access`, `model_prompt`, and `decision` events with RFC 4180 CSV export.
- **Audit UI (`src/components/AuditLogSection.tsx`):** Real-time log inspector with search, action/status filters, and CSV export integrated into Settings → Activity.
- **Commit:** `67abcda` ("phase 5: safety floor, confidentiality mode, and audit logging")

### Phase 6: Documentation, Packaging Configuration & Delivery
- **Institutional Documentation (`docs/institutional-diligence.md`):** Complete architectural manual covering the Deal Team, diligence skills, data room isolation, confidentiality mode, safety floor, and IC memo workflow.
- **Updated `README.md`:** Comprehensive feature descriptions, architectural table, quickstart, and packaging instructions.
- **Windows NSIS Packaging (`electron-builder.yml`):** Fully configured for Windows x64 NSIS one-click installer, icon resources, extra runtime resources, and offline operation.
- **Production Bundle Verification:** Validated `vite build` (frontend bundling into `dist/`) and `bundle-server.mjs` (server bundling into `dist-server/index.js` in 6.7s).
- **Licensing Compliance:** Preserved full Apache-2.0 license and copyright attribution in `NOTICE`, `LICENSE`, `LICENSING.md`, and all docs.
- **Commit:** `phase 6: docs, windows packaging, and final report`

---

## 3. Verification & Quality Matrix

| Verification Suite | Target | Status | Notes |
|---|---|---|---|
| **Outbound Tool Classification** | `shared/outbound.test.ts` | **10 / 10 PASS** | Verifies emails, SMS, calls, signups, wires, transfers |
| **Deal Workspace & Isolation** | `server/deals.test.ts` | **11 / 11 PASS** | Tests per-deal isolation, 403 scope check, Word export |
| **Safety & Compliance** | `server/safety-compliance.test.ts` | **10 / 10 PASS** | Tests SSN/wire/card redaction, outbound guards, audit log CSV |
| **Deal Team Package** | `shared/presets/deal-team.test.ts` | **1 / 1 PASS** | Validates `openmaus.package` v2 schema & 9 bots |
| **Theme & Contrast** | `scripts/check-skin-contrast.mjs` | **52 / 52 PASS** | 100% WCAG AA compliance across light & dark modes |
| **Type Integrity** | `pnpm typecheck` | **0 ERRORS** | Validated across client (`tsc -b`) and server (`tsconfig.server.json`) |
| **Frontend Production Build** | `vite build` | **SUCCESS** | Production bundle generated in `dist/` |
| **Server Production Bundle** | `scripts/bundle-server.mjs` | **SUCCESS** | Standalone bundle created in `dist-server/` in 6.7s |

---

## 4. Architectural Summary

```
MyBot Desktop (Windows x64)
├── User Interface (React 19 + Tailwind CSS)
│   ├── DealsView: Data Room drag-and-drop, Findings board, IC Memo viewer
│   ├── Deal Team Chat: Multi-agent diligence dispatch & collaboration
│   └── Settings & Audit: Real-time compliance audit trail & CSV export
│
├── Agent Server (Node.js TypeScript Engine)
│   ├── Deal Isolation Boundary: ~/.mybot/deals/<deal-id>/ (x-deal-scope validation)
│   ├── Document Extractor: PDF, DOCX, XLSX, CSV, PPTX text & table parsing
│   ├── Confidentiality Gate: SSN, wire routing, account, credit card, phone redaction
│   ├── Outbound Safety Floor: Software gate intercepting emails, messages, wires
│   └── Audit Logger: Append-only ~/.mybot/audit/audit.jsonl & RFC 4180 CSV export
│
└── Diligence Assets & Packages
    ├── Deal Team Preset: 9 specialist agents with SVG avatars (openmaus.package v2)
    ├── Diligence Skills: 5 institutional diligence & IC memo workflows
    └── Diligence MCPs: Pre-configured Tavily, Exa, SEC EDGAR, OpenCorporates
```

---

## 5. Licensing & Legal Compliance

MyBot is licensed under the **Apache License, Version 2.0**.

- **Attribution:** Based on **OpenMausBot** by Milind Soni.  
  Copyright © 2026 Milind Soni and OpenMausBot contributors.
- **Notices:** `NOTICE`, `LICENSE`, and `LICENSING.md` remain intact and are packaged as extra resources in desktop distributions.
- **Third-Party Open Source:** All bundled third-party licenses (`cloudflared`, `hpke-js`, `models-dev`, `opencode`, `t3-code`, `onepassword-sdk`) remain credited and preserved.
