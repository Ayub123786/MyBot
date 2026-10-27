# MyBot

**MyBot** is an AI agent desktop application designed specifically for investment firms, venture capital (VC) funds, and private equity (PE) teams. It provides a coordinated team of AI agents to accelerate deal sourcing, investment memo drafting, financial modeling, competitor analysis, and comprehensive due diligence.

> **Attribution:** Based on OpenMausBot by Milind Soni (Apache-2.0).  
> Copyright 2026 Milind Soni and OpenMausBot contributors.

---

## Key Features

- **Coordinated Deal Team**: Run 9 specialized agents in one chat workspace:
  - **Deal Lead (Chief of Staff)**: Orchestrates due diligence and unifies findings into one IC memo.
  - **Sourcing Scout**: Screens companies against your firm's investment thesis.
  - **Market & Competitor Analyst**: Computes TAM/SAM/SOM, maps competitors, identifies market dynamics.
  - **Financial Analyst**: Evaluates unit economics, cap tables, burn rates, runway, and financial models.
  - **Legal & Compliance Reviewer**: Assesses corporate structures, IP assignments, regulatory hurdles, and KYC/AML red flags.
  - **Founder & Team Checker**: Verifies founder credentials and tracks public records and past exits.
  - **Technical Diligence Analyst**: Evaluates architecture, security posture, scalability, and technical debt.
  - **Risk Officer (Red Team)**: Aggressively red-teams deals and highlights hidden failure modes.
  - **Memo Writer**: Synthesizes facts, analysis, and debate into an institutional-grade Investment Committee (IC) memo.
- **Isolated Deal Rooms**: Data rooms and files uploaded for one company are strictly partitioned and inaccessible to other deal workspaces.
- **Strict Privacy & Confidentiality**: Zero unwanted telemetry. Third-party cloud tracking is completely removed. Outbound integrations require explicit human approval.
- **Local-First & Multi-Model**: Connect your own models (Claude, OpenAI, Gemini, local models) with end-to-end local data retention under `~/.mybot`.

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
