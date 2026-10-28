# Architecture & Implementation Decisions (DECISIONS.md)

This log records non-trivial decisions made during the MyBot transformation, rationale, and alternatives considered.

---

### Decision 1: Windows-Only Focus for Initial Phases
- **Decision**: Focus development and testing strictly on Windows. Skip macOS speech helper compilation (`build:speech`), notarization, and macOS code signing.
- **Why**: Windows is the target runtime environment for this deployment. macOS build steps require Swift/Xcode toolchains not present on Windows.
- **Alternatives**: Attempt cross-compilation or mock Darwin tools; rejected as fragile and unnecessary.

---

### Decision 2: Brand Constants Centralization (`shared/brand.ts`)
- **Decision**: Create `shared/brand.ts` exporting:
  - `APP_NAME = "MyBot"`
  - `DATA_DIR_NAME = ".mybot"`
  - `LEGACY_DATA_DIR_NAME = ".openmausbot"`
  - `URL_SCHEME = "mybot"`
  - `ATTRIBUTION = "Based on OpenMausBot by Milind Soni (Apache-2.0)"`
- **Why**: Eliminates hardcoded strings across electron, server, and client; provides single point of control.
- **Alternatives**: Multiple configs across packages; rejected to maintain DRY code.

---

### Decision 3: Deferred Environment Variable and Wire Format Changes
- **Decision**: Keep `OMB_` environment variable prefixes and `openmaus.package` wire format unchanged for now.
- **Why**: Changing internal protocol wire headers and dozens of runtime environment flags immediately increases risk of subtle integration breakage.
- **Alternatives**: Mass find-and-replace to `MYBOT_`; deferred to a later dedicated release phase.

---

### Decision 4: Total Removal of PostHog Telemetry
- **Decision**: Remove PostHog public key and `https://us.i.posthog.com` endpoint. Set default telemetry status to opted-out/disabled (`analyticsEnabled() === false`). Make analytics functions safe no-ops unless a custom self-hosted endpoint is explicitly configured.
- **Why**: Investment and due diligence workflows require strict confidentiality; zero telemetry may leave the machine without user consent.
- **Alternatives**: Leave token but disable flag; rejected because hardcoded keys could be triggered accidentally.

---

### Decision 5: Auto-Update Turned Off
- **Decision**: Make `startUpdater()` in `electron/updater.mjs` a safe no-op that leaves status at `"idle"` without scheduling polling timers. Remove the upstream `milind-soni/OpenMausBot` GitHub publish target from `electron-builder.yml`.
- **Why**: Prevents desktop instances from fetching or prompting updates from the upstream open-source project.
- **Alternatives**: Point to non-existent server; rejected as it generates error logs.

---

### Decision 6: Complete Deletion of `enterprise/` Folder
- **Decision**: Permanently delete the `enterprise/` folder and clean up any imports or tests that exclusively target enterprise licensing or enterprise-hosted relays (`server/hosted-access.test.ts`).
- **Why**: User explicitly requested deletion of enterprise licensing code and strict Apache-2.0 open-source purity.
- **Alternatives**: Stubbing enterprise mocks; rejected per global rule: "Delete tests that only test enterprise or hosted features; do not fake them with mocks."

---

### Decision 7: Data Directory Migration Shim
- **Decision**: Implement a one-time copy migration on startup in `electron/main.mjs` and server initialization: if `~/.mybot` does not exist and `~/.openmausbot` exists, copy contents recursively without deleting the legacy directory.
- **Why**: Ensures backward compatibility for existing users while guaranteeing zero data loss.
- **Alternatives**: Renaming/moving the directory; rejected because moving could break previous installations or rollback scenarios.

---

### Decision 8: Institutional Theme and Token Centralization (Phase 2)
- **Decision**: Centralized design tokens in `src/styles.css` using Tailwind v4 `@theme` and custom properties:
  - Primary deep navy `#0B2447`, accent gold `#E6B800` (8.26:1 contrast ratio against navy), positive emerald `#10B981` (6.1:1 contrast ratio), and neutral slate grays.
  - Reduced border radii to sharper corners (`--radius-lg: 4px; --radius-xl: 6px`) to match the Linear/Bloomberg Terminal density aesthetic.
  - Verified 100% WCAG AA contrast compliance across all 52 pairs in both dark and light modes via `scripts/check-skin-contrast.mjs`.
  - Replaced playful copy in `src/locales/en.json` with professional financial due diligence and deal room terminology.
  - Generated PNG icon assets at 1024x1024, 512x512, 192x192, and 180x180 via `@resvg/resvg-js`.
- **Why**: The product is targeted at private equity, VC, and investment committee workflows where clarity, compact density, and authoritative aesthetics are required.
- **Alternatives**: Keeping pastel/casual themes; rejected as contradictory to institutional user requirements.

---

### Decision 9: Deal Team Preset and Institutional Diligence Skills (Phase 3)
- **Decision**: Implemented the "Deal Team" preset team as an importable `openmaus.package` v2 package at `shared/presets/deal-team.json`:
  - 9 specialist agents: Deal Lead (Chief of Staff, leader), Sourcing Scout, Market & Competitor Analyst, Financial Analyst, Legal & Compliance Reviewer, Founder & Team Checker, Technical Diligence Analyst, Risk Officer (Red Team), and Memo Writer.
  - Distinct generated SVG geometric avatars rendered into 128x128 PNG base64 images complying strictly with `avatarSchema` in `shared/package-format.ts`.
  - 5 core institutional due diligence skills: `dd-checklist-by-stage`, `red-flag-scoring-rubric`, `ic-memo-template`, `data-room-review-checklist`, and `company-profile-format`.
  - Injected mandatory prompt rules across every bot's soul: citations required, explicit confidence levels [High/Med/Low], zero inventions ("not found" instead of guesses), separation of facts vs assumptions vs opinions, and internal decision support disclaimers.
  - Wired into `server/team-library.ts` as the top featured preset in Templates with offline fallback, into `server/presets.ts` for automatic preset registration on initial start, and into first-run onboarding (`WelcomeBring.tsx`).
  - Set approvals to default to "ask", routines paused, and imported connections off.
- **Why**: Provides out-of-the-box institutional diligence readiness for VC and PE teams without requiring custom server protocol changes.
- **Alternatives**: Hardcoding bots as non-exportable database records; rejected because using the existing openmaus.package format allows clean export, sharing, and standard team import workflows.

---

### Decision 10: Deals View, Data Room Isolation, and Diligence Integrations (Phase 4)
- **Decision**:
  - Implemented per-deal isolation in `server/deals.ts`: Deal workspaces are housed under `~/.mybot/deals/<deal-id>/`. The server inspects the `x-deal-scope` header and strictly forbids cross-deal access (throws 403 `DealIsolationError`). In addition, all resolved file paths are asserted against the root deal directory to prevent path traversal attacks.
  - Implemented multi-format text & structured table extractor (`server/deal-document-extractor.ts`) supporting PDF, DOCX, XLSX, CSV, PPTX, and TXT with pure TypeScript ZIP parsing and Papaparse.
  - Implemented pure TypeScript Word (.docx) OpenXML packaging using `node:zlib` `deflateRawSync` and printable HTML memo export with institutional styling.
  - Seeded initial realistic sample deal: `demo-apexflow-ai` (ApexFlow AI Series A diligence data, metrics, pitch deck, cap table, financial model, findings, and IC memo).
  - Built comprehensive `DealsView.tsx` with Overview metrics, drag-and-drop Data Room with live extraction status, Deal Team chat dispatcher, card-based Findings dashboard (severity, confidence, facts/assumptions/opinions tags), and IC Memo viewer with one-click Word/PDF export.
  - Pre-configured disabled diligence MCP servers in `shared/mcp-templates.ts` and `server/config.ts` (Tavily search, Exa neural search, SEC EDGAR, OpenCorporates, and enterprise placeholders for Crunchbase and PitchBook; no DocuSign).
- **Why**: Investment teams handle highly confidential deal rooms across multiple competing portfolio companies or acquisition targets. Absolute per-deal isolation and instant structured parsing are mandatory.
---

### Decision 11: Outbound Tool Safety Floor, Confidentiality Mode, and Institutional Audit Log (Phase 5)
- **Decision**:
  - Expanded outbound tool gates in `shared/outbound.ts`: added `"EMAIL"`, `"MAIL"`, `"SMS"`, `"MESSAGE"`, `"CALL"`, `"SIGNUP"`, `"REGISTER"`, `"WIRE"`, `"DISBURSE"` to `SEND_VERBS`, and `"ACCOUNT"`, `"USER"`, `"INVITATION"`, `"WIRE"`, `"TRANSACTION"` to `SENT_NOUNS`. Any tool call that sends external messages, creates accounts, or moves money is intercepted by `isOutboundTool()` and triggers `approve: null, source: "outbound-guard"`.
  - Implemented financial identifier redaction in `shared/financial-redact.ts`: regex patterns detecting and replacing SSNs (`«redacted SSN»`), ABA wire routing numbers (`«redacted Wire Routing»`), bank account numbers (`«redacted Bank Account»`), credit cards (`«redacted Credit Card»`), and phone numbers (`«redacted Phone Number»`).
  - Added `confidentialMode` to `AppConfig` (`server/config.ts`) and wired automatic redaction and cloud privacy warnings into `addDealDocument` and `prepareDealPrompt` in `server/deals.ts`.
  - Implemented append-only local audit log in `server/audit-log.ts` recording events to `~/.mybot/audit/audit.jsonl`, with query API (`GET /api/audit`), RFC 4180 CSV export (`GET /api/audit/export/csv`), and UI `AuditLogSection.tsx` in Settings -> Activity.
- **Why**: Institutional investment firms and compliance officers require hard software guards against unauthorized external actions, data room confidentiality protection, and immutable audit trails for LP reporting.
- **Alternatives**: Relying solely on system prompts; rejected because prompt adherence cannot guarantee safety or compliance floors.

---

### Decision 12: Documentation, Packaging Configuration, and Delivery (Phase 6)
- **Decision**:
  - Authored comprehensive institutional guide in `docs/institutional-diligence.md` detailing the 9 Deal Team bots, 5 diligence skills, per-deal isolation architecture, multi-format data room extractor, confidentiality mode, outbound tool safety floor, and IC memo generation.
  - Updated `README.md` to reflect the complete institutional product capabilities, architecture table, and installation/packaging steps.
  - Verified `electron-builder.yml` Windows NSIS configuration (targets `nsis` x64, one-click installer, icon assets, extra resources, zero auto-update).
  - Validated frontend production compilation (`vite build` passing, bundling cleanly into `dist/`) and server bundling (`scripts/bundle-server.mjs` creating `dist-server/index.js` in 6.7s).
  - Maintained full Apache-2.0 licensing and copyright attribution in `NOTICE`, `LICENSE`, `LICENSING.md`, and all documentation.
- **Why**: Completes institutional deliverables and provides production packaging readiness for Windows-targeted investment teams.
- **Alternatives**: None needed.

---

### Decision 13: Consistent .ts Extension for Shared Sibling Imports
- **Decision**: In `shared/registry-save-failure.ts`, import sibling modules using `.ts` extension (`import { APP_NAME } from "./brand.ts"`), matching the convention used in `failed-turn.ts` and `place-view.ts`.
- **Why**: Node.js 24 running under `--experimental-strip-types` cannot resolve `.js` specifiers when only `.ts` source files exist in the repository without precompiled outputs.
- **Alternatives**: Running a pre-compile step before dev server launch; rejected because direct TypeScript execution is the repository's established dev workflow.

---

### Decision 15: Removal of Upstream Defaults and PostHog Mock Decoupling
- **Decision**:
  - Removed all default upstream hostnames, relay endpoints, and cloud origins across `server/highlevel/relay.ts`, `electron/cloud-account.mjs`, `electron/companion-account-service.mjs`, `src/components/OrganizationSettings.tsx`, `src/lib/onboarding.ts`, and `src/components/RemoteComputerSection.tsx`. All defaults now evaluate to empty string `""` or `null`.
  - Hidden or defaulted to advanced custom forms any UI requiring external upstream endpoints when defaults are empty.
  - Replaced legacy upstream product brand occurrences ("OpenMausBot", "MausBot Cloud") with current brand ("MyBot", "MyBot Cloud") across all 12 locale translation files and regenerated checksum hashes with `generate-locale.mjs <locale> --accept`.
  - Updated `electron/chat-link.mjs` protocol handler to accept `mybot://thread/` and `mybot://bot/`.
  - Decoupled product analytics tests from `posthog-js` mocks by introducing internal event listening hooks via `setAnalyticsListenerForTest()` in `src/lib/analytics.ts`.
- **Why**: Eliminates implicit dependencies or data leakage to legacy upstream services, ensuring self-hosted privacy and brand consistency throughout runtime and tests.
- **Alternatives**: Retaining upstream fallbacks as opt-in defaults; rejected because enterprise and institutional diligence mandates clean air-gapping by default.

---

### Decision 16: Decouple Workflows from Upstream Repos and Disable Publishing
- **Decision**:
  - Removed all upstream repository references (`milind-soni/openmausbot-releases`) and upstream owner constraints from `.github/workflows/package-win.yml`, `.github/workflows/release.yml`, and `.github/workflows/sync-published-release.yml`.
  - In `release.yml`, removed legacy mirror synchronization steps and disabled the automated publish step (`if: false`).
  - In `sync-published-release.yml`, completely disabled mirror sync jobs (`if: false`).
  - Windows packaging workflow remains artifact-only with `--publish never`.
- **Why**: Prevents accidental push attempts to upstream author repositories, isolates releases to the self-contained repository, and prevents unreviewed automatic release publishing.
- **Alternatives**: Maintaining an active mirror to an external fork; rejected because downstream institutional builds must remain self-contained.
