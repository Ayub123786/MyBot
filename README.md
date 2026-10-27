# MyBot

**MyBot** is an AI agent desktop application designed specifically for investment firms, venture capital (VC) funds, and private equity (PE) teams. It provides a coordinated team of AI agents to accelerate deal sourcing, investment memo drafting, financial modeling, competitor analysis, and comprehensive due diligence.

> **Attribution:** Based on OpenMausBot by Milind Soni (Apache-2.0).  
> Copyright 2026 Milind Soni and OpenMausBot contributors.

---

## Key Features

- **Coordinated Deal Team**: Run 9 specialized agents in one chat workspace:
  - **Deal Lead (Chief of Staff)**: Orchestrates due diligence, resolves conflicts, and unifies findings into one IC memo.
  - **Sourcing Scout**: Screens companies against your firm's investment thesis and mandate.
  - **Market & Competitor Analyst**: Computes TAM/SAM/SOM, maps competitors, identifies market dynamics.
  - **Financial Analyst**: Evaluates unit economics, cap tables, burn rates, runway, and financial models.
  - **Legal & Compliance Reviewer**: Assesses corporate structures, IP assignments, regulatory hurdles, and red flags.
  - **Founder & Team Checker**: Verifies founder credentials, exits, and reference backgrounds.
  - **Technical Diligence Analyst**: Evaluates architecture, security posture, scalability, and technical debt.
  - **Risk Officer (Red Team)**: Aggressively red-teams deals and highlights hidden failure modes.
  - **Memo Writer**: Synthesizes facts, analysis, and debate into an institutional-grade Investment Committee (IC) memo.
- **Isolated Deal Rooms**: Data rooms and files uploaded for one company are strictly partitioned on disk (`~/.mybot/deals/<deal-id>/`), guarded by `x-deal-scope` validation and directory traversal prevention.
- **Multi-Format Document Extraction**: Automatic text and structured table parsing for PDF, Word (`.docx`), Excel (`.xlsx`), CSV, PowerPoint (`.pptx`), and plain text.
- **Confidentiality Mode & Financial Redaction**: Real-time regex detection and redaction for SSNs, wire routing numbers, bank accounts, credit cards, and phone numbers before model delivery.
- **Outbound Tool Gates & Approval Floor**: Outbound actions (emails, SMS, phone calls, external account signups, wire transfers) require explicit human approval via interactive cards.
- **Immutable Audit Trail & CSV Export**: Append-only local audit log (`~/.mybot/audit/audit.jsonl`) recording all tool calls, document accesses, prompt dispatches, and decisions, with full RFC 4180 CSV export.
- **Investment Committee Memo Export**: Generate native Microsoft Word (`.docx`) OpenXML documents and printable PDF-ready HTML memos directly inside the application.
- **Zero Cloud Telemetry**: PostHog and third-party analytics stripped. All operational data retained locally under `~/.mybot`.

For detailed architecture and workflow guides, see [docs/institutional-diligence.md](docs/institutional-diligence.md).

---

## Installation & Running

### Requirements
- **Node.js**: v24 or later
- **pnpm**: v10 or later
- **OS**: Windows (x64)

### Quick Start
```bash
# Clone the repository
git clone https://github.com/Ayub123786/MyBot.git
cd MyBot

# Install dependencies
pnpm install

# Run the desktop app in development
pnpm dev:desktop
```

### Building for Windows
```bash
pnpm build
pnpm package:win
```
The installer will be generated in `release/MyBot-<version>-setup.exe`.

---

## Architecture

| Layer | Technology | Primary Location |
|---|---|---|
| **Desktop Shell** | Electron (`.mjs`) | `electron/` |
| **User Interface** | React 19 + TypeScript + Tailwind CSS | `src/` |
| **Agent Server** | Node.js + TypeScript (native ESM) | `server/` |
| **Local Storage** | SQLite / DuckDB / Local filesystem | `~/.mybot` |

---

## License & Attribution

MyBot is licensed under the **Apache License, Version 2.0**.

Based on **OpenMausBot** by Milind Soni.  
Original copyright &copy; 2026 Milind Soni and OpenMausBot contributors.

See [LICENSE](LICENSE), [NOTICE](NOTICE), and [LICENSING.md](LICENSING.md) for full terms.
