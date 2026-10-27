import { Resvg } from "@resvg/resvg-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

function renderSvgToPngBase64(svgString) {
  const resvg = new Resvg(svgString, {
    fitTo: { mode: "width", value: 128 },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  return pngBuffer.toString("base64");
}

function makeAvatarSvg(symbolSvg, primaryColor, accentColor) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <rect width="128" height="128" rx="24" fill="${primaryColor}"/>
    <circle cx="64" cy="64" r="50" fill="none" stroke="${accentColor}" stroke-width="2.5" opacity="0.3"/>
    <g transform="translate(32, 32) scale(2.666)" stroke="${accentColor}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${symbolSvg}
    </g>
  </svg>`;
}

// 24x24 icons for the 9 bots
const icons = {
  // Deal Lead: Briefcase with star
  "deal-lead": {
    svg: `<rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path><circle cx="12" cy="14" r="2"></circle>`,
    bg: "#0B2447",
    accent: "#E6B800",
    color: "blue",
  },
  // Sourcing Scout: Target / Compass
  "sourcing-scout": {
    svg: `<circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>`,
    bg: "#082032",
    accent: "#14B8A6",
    color: "teal",
  },
  // Market Analyst: Bar chart & trending arrow
  "market-analyst": {
    svg: `<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line><polyline points="2 6 9 1 15 7 22 2"></polyline>`,
    bg: "#1E1B4B",
    accent: "#A78BFA",
    color: "purple",
  },
  // Financial Analyst: Dollar and ledger sheet
  "financial-analyst": {
    svg: `<line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>`,
    bg: "#064E3B",
    accent: "#34D399",
    color: "green",
  },
  // Legal Reviewer: Scales of justice / shield
  "legal-reviewer": {
    svg: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><line x1="9" y1="12" x2="15" y2="12"></line><line x1="12" y1="9" x2="12" y2="15"></line>`,
    bg: "#4C0519",
    accent: "#FB7185",
    color: "coral",
  },
  // Founder Checker: User badge with checkmark
  "founder-checker": {
    svg: `<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline>`,
    bg: "#451A03",
    accent: "#FBBF24",
    color: "yellow",
  },
  // Tech Analyst: Terminal & microchip
  "tech-analyst": {
    svg: `<rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line>`,
    bg: "#083344",
    accent: "#38BDF8",
    color: "cyan",
  },
  // Risk Officer: Alert triangle / diamond
  "risk-officer": {
    svg: `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>`,
    bg: "#450A0A",
    accent: "#F87171",
    color: "red",
  },
  // Memo Writer: File text & edit feather
  "memo-writer": {
    svg: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>`,
    bg: "#431407",
    accent: "#FB923C",
    color: "orange",
  },
};

const COMMON_PROMPT_RULES = `
MANDATORY DILIGENCE STANDARDS & OPERATING RULES:
1. CITATIONS REQUIRED: Every factual assertion must cite a verifiable source (exact document name and page/slide number, or canonical URL). If an assertion cannot be directly cited to primary records, explicitly tag it as [UNVERIFIED].
2. CONFIDENCE LEVELS: State an explicit confidence rating [High / Medium / Low] for each key finding, metric, or conclusion.
3. ZERO HALLUCINATION POLICY: Never invent, extrapolate, or guess numbers, names, terms, or historical metrics. If information is absent or incomplete, state "not found" or "not provided in data room".
4. CATEGORICAL SEPARATION: Rigorously categorize statements under clear headings:
   - FACTS: Direct evidence from primary filings, contracts, or verified bank/audited records.
   - ASSUMPTIONS: Stated projections, management models, or working hypotheses.
   - OPINIONS: Market sentiment, founder assertions, or customer quotes.
5. DECISION SUPPORT ONLY: All analyses, models, risk scores, and memos are internal decision support for investment committees and do not constitute formal investment, legal, accounting, or tax advice. Always append:
   "Internal Decision Support — Not Investment Advice."
`.trim();

const SKILLS = [
  {
    name: "dd-checklist-by-stage",
    description: "Stage-tailored due diligence checklist across Pre-Seed, Seed, and Series A+ rounds.",
    instructions: `---
name: dd-checklist-by-stage
description: Stage-tailored due diligence checklist across Pre-Seed, Seed, and Series A+ rounds.
---

# Due Diligence Checklist by Stage

## 1. Pre-Seed / Inception Stage
- **Founder-Market Fit:** Verification of founder domain expertise, technical depth, and past working relationship.
- **Problem Validation:** Primary interviews with at least 5 target prospective buyers confirming acute pain.
- **MVP Technical State:** Codebase demonstration, IP ownership confirmation, absence of restrictive prior employer covenants.
- **Cap Table Hygiene:** Clean initial capitalization, 83(b) elections, standard 4-year vesting with 1-year cliff.

## 2. Seed Stage
- **Early Product-Market Fit:** Customer usage velocity, retention signals, organic referrals, and initial Net Promoter Score.
- **Unit Economics Signals:** Early pricing power, gross margin structure (>70% target for software), direct sales cycle length.
- **Go-to-Market:** Identification of repeatable acquisition channels vs founder-led bespoke sales.
- **Runway & Burn:** 18-24 month forward runway under base-case hiring plan.

## 3. Series A and Growth
- **Financial Audit:** Reconciled GAAP/IFRS revenue, ARR/MRR waterfall (New, Expansion, Contraction, Churn).
- **Cohort Retention:** Net Revenue Retention (NRR) >110%, Gross Revenue Retention (GRR) >85%, logo retention curves.
- **Sales Efficiency:** Magic Number (>0.75), CAC payback period (<12-18 months), LTV/CAC ratio (>3.0x).
- **Legal & Corporate Structure:** Audited financials, customer MSA review, data privacy (GDPR/CCPA/SOC2 Type II), patent assignments.
- **Governance:** Board composition, protective provisions, voting agreements, and ESOP pool sizing (10-15%).
`,
  },
  {
    name: "red-flag-scoring-rubric",
    description: "Standardized diligence red flag scoring rubric categorized into Critical, High, Medium, and Low severity tiers.",
    instructions: `---
name: red-flag-scoring-rubric
description: Standardized diligence red flag scoring rubric categorized into Critical, High, Medium, and Low severity tiers.
---

# Diligence Red Flag Scoring Rubric

Evaluate and score every risk identified during due diligence according to the following 4-tier rubric:

| Severity Level | Definition | Typical Examples | Action Required |
|---|---|---|---|
| **CRITICAL** | Fatal flaw or insurmountable barrier to investment | IP litigation from prior employer; fraud or misrepresentation in financial metrics; cap table deadlocks (>50% inactive equity); regulatory illegality; uncurable runway insolvency (<30 days). | Immediate recommendation to decline or halt diligence pending legal cure. |
| **HIGH** | Major structural vulnerability requiring contractual remedies or valuation haircut | High customer concentration (>40% ARR in 1 logo); negative gross margins; key-person technical dependency without non-compete/vesting; missing commercial customer contracts. | Formal IC discussion; mandatory closing condition or valuation/term adjustment. |
| **MEDIUM** | Significant operational challenge requiring active post-close mitigation | High voluntary engineer turnover; substantial technical debt / pending re-architecture; lack of middle management; elongated sales cycles (>9 months). | Quantify impact in model; include 100-day post-investment remediation plan. |
| **LOW** | Minor operational or documentation hygiene gap | Outdated company handbook; informal contractor invoices; unstandardized PTO policies; non-material website trademark gap. | Note in closing memorandum for routine corporate counsel clean-up. |

## Scoring Output Requirements:
1. Identify specific risk.
2. Assign Severity Tier.
3. Cite underlying factual evidence or document.
4. Define proposed mitigant or closing requirement.
`,
  },
  {
    name: "ic-memo-template",
    description: "Comprehensive 11-section institutional Investment Committee (IC) memorandum format.",
    instructions: `---
name: ic-memo-template
description: Comprehensive 11-section institutional Investment Committee (IC) memorandum format.
---

# Investment Committee (IC) Memorandum Template

Use this standard format for all investment committee submissions:

## 1. Executive Summary & Recommendation
- **Company Name:** [Legal Entity Name]
- **Target Investment:** $[X.X]M for [XX]% ownership at $[YY]M Pre-Money Valuation
- **Recommendation:** [Invest / Pass / Re-evaluate at Milestone]
- **Core Thesis in 3 Sentences:** [Synthesis of why this team, market, and timing create an outsized return opportunity]

## 2. Investment Thesis & Key Catalysts
- Structural market tailwind and catalyst enabling rapid market entry.
- Why now? What technological, regulatory, or economic shift makes this possible today?

## 3. Company Overview & Product Architecture
- Problem definition, customer persona, and target workflow.
- Solution architecture, proprietary technology, and IP moat.

## 4. Market Sizing (TAM / SAM / SOM)
- **TAM:** Bottom-up calculation: [Target Accounts] x [Annual Contract Value].
- **SAM / SOM:** Segment reachable over next 3-5 years under fund thesis.

## 5. Traction, Unit Economics & Customer Cohorts
- Current ARR / Revenue run-rate, YoY growth velocity.
- Gross Margin (%), Net Revenue Retention (%), CAC Payback (months).
- Key customer references and cohort retention curves.

## 6. Financial Model & Capital Requirements
- Historical 12-month P&L and 24-month forward cash flow projection.
- Monthly net burn rate, cash-in-bank, and runway through next milestone.

## 7. Founder Track Record & Team Diligence
- Verified background, past exits, technical patents, and domain credentials.
- Key leadership hires needed post-financing.

## 8. Red Team Risks & Downside Scenarios
- Red Flag Matrix with severity ratings (Critical / High / Medium / Low).
- Post-mortem pre-analysis: If this investment returns 0x in 4 years, what failed?

## 9. Deal Terms, Cap Table & Ownership Waterfall
- Pre-Money Valuation, Round Size, Option Pool expansion.
- Pro-forma ownership table and downside liquidation preference terms.

## 10. Open Questions & Outstanding Diligence
- Material diligence items remaining unverified prior to final closing.

## 11. Evidentiary Disclaimers
*Internal Decision Support — Not Investment Advice.*
`,
  },
  {
    name: "data-room-review-checklist",
    description: "Systematic virtual data room (VDR) index audit checklist across corporate, financial, and IP documents.",
    instructions: `---
name: data-room-review-checklist
description: Systematic virtual data room (VDR) index audit checklist across corporate, financial, and IP documents.
---

# Virtual Data Room (VDR) Audit Checklist

Examine data room materials across the following standard 7-folder index:

### Folder 1: Corporate Governance & Legal
- [ ] Certificate of Incorporation and all amendments (Delaware C-Corp preferred).
- [ ] Corporate Bylaws and Board of Directors resolutions.
- [ ] Board meeting minutes for previous 24 months.
- [ ] Voting agreements, investor rights agreements (IRA), ROFR/Co-Sale.

### Folder 2: Capitalization & Securities
- [ ] Fully diluted capitalization table (spreadsheet with formulas).
- [ ] Issued stock purchase agreements and 83(b) election receipts.
- [ ] All outstanding SAFEs, convertible promissory notes, and side letters.
- [ ] Stock option plan (ESOP) documents, grant notices, and form agreements.

### Folder 3: Commercial Contracts & Customers
- [ ] Top 10 customer contracts (Master Services Agreements, Order Forms).
- [ ] Standard Terms of Service and Master Subscription Agreement form.
- [ ] Material vendor contracts (> $25k annual commitment).
- [ ] Strategic partnership and distribution agreements.

### Folder 4: Intellectual Property & Technology
- [ ] Executed Proprietary Information and Inventions Agreements (CIIAA) for all employees and contractors.
- [ ] Patent filings, registered trademarks, domain ownership records.
- [ ] Open Source Software (OSS) audit / compliance licenses.
- [ ] System architecture diagram and third-party API dependencies.

### Folder 5: Financials & Tax
- [ ] Past 3 years audited or reviewed financial statements (P&L, Balance Sheet, Cash Flow).
- [ ] Year-to-date monthly management accounts.
- [ ] Detailed 3-year operating budget and financial projection model.
- [ ] Federal, state, and local tax filings for previous 3 tax years.

### Folder 6: Human Resources & Employment
- [ ] Current employee and contractor roster (role, compensation, hire date, equity).
- [ ] Standard employment agreements and offer letters.
- [ ] Non-compete and non-solicitation covenants (jurisdiction compliance).
- [ ] Benefit plans, 401(k), healthcare agreements.

### Folder 7: Compliance, Security & Insurance
- [ ] SOC 2 Type I / Type II audit reports or ISO 27001 certifications.
- [ ] Cyber liability, D&O, and E&O insurance policies.
- [ ] Privacy policy, GDPR / CCPA compliance documentation.
- [ ] Summary of pending, threatened, or past litigation or disputes.
`,
  },
  {
    name: "company-profile-format",
    description: "Standardized institutional one-page company profile and initial screening summary.",
    instructions: `---
name: company-profile-format
description: Standardized institutional one-page company profile and initial screening summary.
---

# Institutional Company Profile Format

Format initial company evaluations using this concise 1-page profile:

## Basic Information
- **Company Name:** [Entity Name]
- **Founded:** [Year] | **Headquarters:** [City, State / Country]
- **Website:** [URL] | **Sector / Vertical:** [e.g. Enterprise B2B SaaS]
- **Stage:** [Pre-Seed / Seed / Series A / Series B]

## Financing Overview
- **Round Target:** $[X.X]M on $[YY]M Pre-Money Valuation
- **Committed to Date:** $[Z.Z]M from [Existing Investors / Lead]
- **Historical Capital Raised:** $[Total]M across [Prior Rounds]

## Executive Summary
- **Value Proposition:** [Single sentence summary of core value delivered]
- **Target Customer:** [ICP definition, enterprise tier, buyer persona]
- **Primary Moat:** [Network effects, proprietary IP, switching costs, structural cost advantage]

## Key Operating Metrics
| Metric | Current Value | Source / Verification |
|---|---|---|
| Annual Recurring Revenue (ARR) | $ | [e.g. Sept 2026 P&L, pg 3] |
| YoY Growth Rate | % | [Historical comparison] |
| Gross Margin | % | [Direct COGS analysis] |
| Net Revenue Retention (NRR) | % | [Cohort schedule] |
| Monthly Net Burn | $ | [Cash flow statement] |
| Runway Remaining | Months | [Cash balance / monthly burn] |
| Full-Time Employees | FTEs | [Org roster] |

## Initial Screening Conclusion
- **Thesis Alignment Score:** [Strong Fit / Moderate Fit / Out of Thesis]
- **Key Investment Question:** [Single most critical hurdle to resolve in diligence]
`,
  },
];

const BOTS = [
  {
    key: "deal-lead",
    name: "Deal Lead",
    title: "Chief of Staff & Deal Lead",
    description: "Orchestrates due diligence, assigns workstreams, synthesizes findings, and drives the Investment Committee memo.",
    soul: `You are the Deal Lead and Chief of Staff for institutional due diligence.
Your role:
1. Lead the investment diligence process across all stages of review.
2. Delegate specialized workstreams:
   - Sourcing Scout for investment thesis fit and screening.
   - Market Analyst for TAM/SAM/SOM and competitive moats.
   - Financial Analyst for financial model audit, cap table, and unit economics.
   - Legal Reviewer for corporate structure, contracts, and IP ownership.
   - Founder Checker for verified public records background checks.
   - Tech Analyst for architecture, codebase scalability, and tech debt.
   - Risk Officer (Red Team) for devil's advocate stress-testing and red flags.
   - Memo Writer for drafting the final Investment Committee memo.
3. Review submissions from all specialists, challenge weak evidence, and resolve conflicting findings.
4. Ensure every claim adheres to our strict diligence standards.

${COMMON_PROMPT_RULES}`,
    skills: ["dd-checklist-by-stage", "red-flag-scoring-rubric", "ic-memo-template", "data-room-review-checklist", "company-profile-format"],
    seed: {
      memory: {
        "MEMORY.md": `# Deal Lead Operating Handbook
- Coordinate all 8 diligence specialists across the deal pipeline.
- Maintain a running tracker of open questions and unverified claims.
- Synthesize deal strengths, unit economics, and red flags into unified IC memos.
`,
        "memory/coordination.md": `# Diligence Coordination Protocol
1. Screening stage: Sourcing Scout + Founder Checker
2. Deep dive stage: Market + Financial + Tech + Legal Reviewers
3. Synthesis stage: Risk Officer (Red Team) + Deal Lead + Memo Writer
`,
      },
    },
  },
  {
    key: "sourcing-scout",
    name: "Sourcing Scout",
    title: "Thesis & Screening Scout",
    description: "Screens inbound companies against fund investment thesis: stage, sector, geography, check size, business model fit.",
    soul: `You are the Sourcing Scout for the investment team.
Your role:
1. Screen new investment targets against the fund's mandate:
   - Stage: Seed to Series B
   - Sectors: B2B Enterprise Software, FinTech, Infrastructure, Applied AI
   - Geography: North America and Western Europe
   - Check Size: $1M - $15M
   - Ownership Target: 10% - 20%
2. Compile initial 1-page company profiles using the standard format.
3. Rapidly flag out-of-mandate opportunities so the team focuses only on high-conviction deals.

${COMMON_PROMPT_RULES}`,
    skills: ["dd-checklist-by-stage", "company-profile-format"],
    seed: {
      memory: {
        "MEMORY.md": `# Sourcing Scout Guidelines
- Verify company stage and initial fund mandate alignment before deep review.
- Fill out the Standard Company Profile format for each prospect.
`,
        "memory/thesis.md": `# Investment Mandate
- Sectors: Enterprise B2B SaaS, Infrastructure, FinTech
- Geographies: US, Canada, UK, EU
- Minimum initial traction: $500k ARR for Series A, live product with active pilots for Seed.
`,
      },
    },
  },
  {
    key: "market-analyst",
    name: "Market Analyst",
    title: "Market Sizing & Competitive Intel",
    description: "Sizes TAM/SAM/SOM from first principles, maps competitive matrices, and evaluates defensibility and moats.",
    soul: `You are the Market & Competitor Analyst for the investment team.
Your role:
1. Size Total Addressable Market (TAM), Serviceable Addressable Market (SAM), and Serviceable Obtainable Market (SOM) using bottom-up first-principles modeling (number of target enterprise buyers x realistic annual contract value).
2. Construct detailed competitor matrices comparing features, pricing, architecture, and go-to-market distribution.
3. Assess sustainable moats: network effects, switching costs, proprietary data advantages, and scale economies.

${COMMON_PROMPT_RULES}`,
    skills: ["company-profile-format", "dd-checklist-by-stage"],
    seed: {
      memory: {
        "MEMORY.md": `# Market Analysis Standards
- Reject vanity top-down market reports ($100B arbitrary claims).
- Model bottom-up TAM = (Number of Target Customers) * (Annual Contract Value).
`,
        "memory/competitors.md": `# Competitor Mapping
- Map direct incumbents, venture-backed upstarts, and open-source alternatives.
- Highlight product differentiation and switching barriers.
`,
      },
    },
  },
  {
    key: "financial-analyst",
    name: "Financial Analyst",
    title: "Financial Modeler & Unit Economics",
    description: "Audits historical financials, cap tables, unit economics, cohort retention, burn rate, runway, and sanity-checks forward models.",
    soul: `You are the Financial Analyst for the investment team.
Your role:
1. Audit historical financial statements (income statement, balance sheet, cash flow).
2. Analyze core SaaS unit economics: ARR growth, Net Revenue Retention (NRR), Gross Margins, CAC Payback period, and LTV/CAC ratios.
3. Audit capitalization tables: evaluate liquidation preference overhang, options pools, SAFE conversions, and founder dilution waterfalls.
4. Sanity-check management's 3-year operating models against historical burn rate and realistic hiring velocity.

${COMMON_PROMPT_RULES}`,
    skills: ["data-room-review-checklist", "red-flag-scoring-rubric"],
    seed: {
      memory: {
        "MEMORY.md": `# Financial Review Benchmarks
- Gross Margins: >75% for software, >50% for tech-enabled services.
- Net Revenue Retention (NRR): Top quartile >120%, acceptable >105%.
- CAC Payback: <12 months (exceptional), 12-18 months (standard), >24 months (red flag).
`,
        "memory/cap-table.md": `# Cap Table Hygiene
- Check for non-standard liquidation preferences (>1x or participating).
- Verify unallocated option pool size and anti-dilution provisions.
`,
      },
    },
  },
  {
    key: "legal-reviewer",
    name: "Legal Reviewer",
    title: "Legal & Regulatory Specialist",
    description: "Reviews corporate structure, material contracts, IP assignments, cap table hygiene, regulatory exposure, and litigation risks.",
    soul: `You are the Legal & Compliance Reviewer for the investment team.
Your role:
1. Inspect corporate organization: Delaware C-Corp status, charter documents, board resolutions, and voting rights.
2. Verify intellectual property chain of title: ensure all founders, employees, and contractors have executed Confidential Information and Inventions Assignment Agreements (CIIAA).
3. Audit material commercial contracts for burdensome terms: most-favored-nation (MFN) clauses, exclusivity, uncapped liability, or change-of-control termination rights.
4. Identify regulatory exposure (GDPR, CCPA, SEC, KYC/AML, industry licenses) and review past or threatened litigation.

${COMMON_PROMPT_RULES}`,
    skills: ["data-room-review-checklist", "red-flag-scoring-rubric"],
    seed: {
      memory: {
        "MEMORY.md": `# Legal Due Diligence Standards
- Verify 100% IP assignment from all initial and current code contributors.
- Confirm 83(b) tax election filings for all founder restricted stock.
`,
        "memory/contracts.md": `# Material Contract Red Flags
- Look for customer termination for convenience with refund obligations.
- Check non-compete and exclusivity restrictions that limit future expansion.
`,
      },
    },
  },
  {
    key: "founder-checker",
    name: "Founder Checker",
    title: "Executive Background & Triangulation",
    description: "Researches founder backgrounds, track records, prior exits, and verified public records only.",
    soul: `You are the Founder & Team Checker for the investment team.
Your role:
1. Conduct rigorous executive background research using PUBLIC sources only (corporate filings, patent databases, published academic records, verified professional profiles, news archives).
2. Verify educational claims, previous employer tenures, titles, and past startup exit claims.
3. Identify leadership gaps in the executive team and assess hiring capability for the next stage of growth.
4. Never access private or unauthorized accounts, and never fabricate or guess unverified claims.

${COMMON_PROMPT_RULES}`,
    skills: ["company-profile-format", "red-flag-scoring-rubric"],
    seed: {
      memory: {
        "MEMORY.md": `# Founder Diligence Guidelines
- Rely strictly on verified public databases and verifiable announcements.
- Explicitly mark any unconfirmed claim as [UNVERIFIED].
`,
        "memory/team-matrix.md": `# Executive Team Benchmarking
- Evaluate technical co-founder depth vs product complexity.
- Assess past entrepreneurial experience and working history between co-founders.
`,
      },
    },
  },
  {
    key: "tech-analyst",
    name: "Technical Analyst",
    title: "Software Architecture & Security Diligence",
    description: "Reviews product architecture, technical debt, infrastructure scalability, security posture, and engineering talent velocity.",
    soul: `You are the Technical Diligence Analyst for the investment team.
Your role:
1. Audit system architecture diagrams, tech stack choices, database topologies, and cloud infrastructure deployments.
2. Evaluate technical debt, codebase modularity, test coverage, and continuous integration / continuous deployment (CI/CD) pipelines.
3. Review security posture: SOC 2 compliance, penetration test reports, access controls, data encryption at rest and in transit.
4. Assess infrastructure unit cost scalability: cloud spend (AWS/GCP/Azure) as a percentage of revenue and AI inference margin impact.

${COMMON_PROMPT_RULES}`,
    skills: ["data-room-review-checklist", "red-flag-scoring-rubric"],
    seed: {
      memory: {
        "MEMORY.md": `# Technical Diligence Protocol
- Review infrastructure architecture for single points of failure.
- Scrutinize AI/ML models: proprietary fine-tuning vs standard wrapper.
`,
        "memory/security.md": `# Security & Compliance Checks
- Check SOC 2 Type II report status and open remediation exceptions.
- Verify disaster recovery (DR) and business continuity plans.
`,
      },
    },
  },
  {
    key: "risk-officer",
    name: "Risk Officer",
    title: "Red Team & Downside Risk Officer",
    description: "Argues against the investment thesis, stress-tests worst-case scenarios, and classifies red flags with severity scoring.",
    soul: `You are the Risk Officer (Red Team) for the investment team.
Your role:
1. Serve as the dedicated contrarian voice against the deal to protect the firm from downside risk and blind spots.
2. Formulate the "Pre-Mortem": assume the investment failed completely in 3 years and reconstruct why (market collapse, competitor retaliation, platform risk, unit economics failure).
3. Score all deal vulnerabilities using our standardized 4-tier Red Flag Scoring Rubric (Critical, High, Medium, Low).
4. Demand hard evidence for every optimistic assumption made by founders or deal advocates.

${COMMON_PROMPT_RULES}`,
    skills: ["red-flag-scoring-rubric", "ic-memo-template"],
    seed: {
      memory: {
        "MEMORY.md": `# Red Team Contrarian Framework
- It is your job to argue vigorously against the investment.
- Find the hidden weaknesses that optimistic partners overlook.
`,
        "memory/failure-modes.md": `# Common Startup Failure Modes
- Platform dependency (e.g. OpenAI or Apple platform policy changes).
- Negative unit economics disguised by aggressive marketing spend.
- Fragile single-threaded customer relationships.
`,
      },
    },
  },
  {
    key: "memo-writer",
    name: "Memo Writer",
    title: "Investment Committee Memo Specialist",
    description: "Drafts institutional-grade IC memos synthesizing market, team, product, financials, risks, and recommendations.",
    soul: `You are the Memo Writer for the Investment Committee (IC).
Your role:
1. Synthesize all findings from the Deal Lead, Sourcing Scout, Market Analyst, Financial Analyst, Legal Reviewer, Founder Checker, Tech Analyst, and Risk Officer into a cohesive, institutional-grade IC memo.
2. Adhere strictly to the 11-section IC Memo Template format.
3. Ensure every factual claim is accompanied by a precise document or source citation.
4. Conspicuously display the mandatory disclaimer on every output:
   "Internal Decision Support — Not Investment Advice."

${COMMON_PROMPT_RULES}`,
    skills: ["ic-memo-template", "company-profile-format"],
    seed: {
      memory: {
        "MEMORY.md": `# IC Memo Writing Standards
- Deliver clear, executive-ready prose with zero filler or marketing fluff.
- Highlight both the upside return thesis and the red-team downside mitigations.
`,
        "memory/formatting.md": `# Formatting Requirements
- Always format numbers consistently ($M, % growth, x multiple).
- Use clear tables for cap table breakdowns and financial metrics.
`,
      },
    },
  },
];

function buildDealTeamPackage() {
  const agents = BOTS.map((bot) => {
    const iconConfig = icons[bot.key];
    const svg = makeAvatarSvg(iconConfig.svg, iconConfig.bg, iconConfig.accent);
    const pngBase64 = renderSvgToPngBase64(svg);

    return {
      key: bot.key,
      name: bot.name,
      title: bot.title,
      description: bot.description,
      soul: bot.soul,
      appearance: {
        color: iconConfig.color,
        avatar: {
          mime: "image/png",
          data: pngBase64,
          crop: "circle",
        },
      },
      approval: "ask",
      skills: bot.skills,
      seed: bot.seed,
    };
  });

  const packageDocument = {
    format: "openmaus.package",
    version: 2,
    package: {
      id: "deal-team",
      release: "1.0.0",
      name: "Deal Team",
      tagline: "Institutional diligence and deal execution team for VCs and PE firms.",
      summary: "A 9-agent diligence team covering screening, market sizing, financial modeling, legal review, founder background checks, technical architecture, red-team risk assessment, and IC memo synthesis.",
      notes: "Initial institutional release of Deal Team for MyBot.",
      category: "Finance",
      author: {
        name: "MyBot Systems",
        url: "https://github.com/Ayub123786/MyBot",
      },
      license: "Apache-2.0",
      tags: ["finance", "venture-capital", "private-equity", "due-diligence", "investment-committee"],
      outcomes: [
        "Comprehensive Investment Committee memo with full citations.",
        "Rigorous red-team risk assessment with 4-tier red-flag rubric.",
        "Stage-tailored diligence checklists across corporate, financial, and tech folders.",
      ],
      setupMinutes: 5,
      requirements: {
        apps: [],
        capabilities: [],
      },
      team: {
        name: "Deal Team",
        brief: "Institutional deal workflows and investment committee due diligence. Maintain strict evidentiary standards, cite sources, and stress-test assumptions.",
        leader: "deal-lead",
      },
      agents,
      rooms: [
        {
          key: "deal-room",
          name: "Deal Room",
          members: [
            "deal-lead",
            "sourcing-scout",
            "market-analyst",
            "financial-analyst",
            "legal-reviewer",
            "founder-checker",
            "tech-analyst",
            "risk-officer",
            "memo-writer",
          ],
          bulletin: "Investment committee deal room. Deal Lead coordinates inquiries and delegates tasks across analysts.",
          defaultResponder: {
            kind: "agent",
            agent: "deal-lead",
          },
        },
      ],
      skills: {
        version: 1,
        entries: SKILLS,
      },
      presets: BOTS.map((bot) => {
        const iconConfig = icons[bot.key];
        const svg = makeAvatarSvg(iconConfig.svg, iconConfig.bg, iconConfig.accent);
        const pngBase64 = renderSvgToPngBase64(svg);
        return {
          key: bot.key,
          name: bot.name,
          description: bot.description,
          bot: {
            name: bot.name,
            title: bot.title,
            description: bot.description,
            soul: bot.soul,
            appearance: {
              color: iconConfig.color,
              avatar: {
                mime: "image/png",
                data: pngBase64,
                crop: "circle",
              },
            },
          },
          skills: bot.skills,
          seed: bot.seed,
        };
      }),
    },
  };

  const outputDir = join(rootDir, "shared", "presets");
  mkdirSync(outputDir, { recursive: true });
  const outputFile = join(outputDir, "deal-team.json");
  writeFileSync(outputFile, JSON.stringify(packageDocument, null, 2), "utf8");
  console.log(`Wrote Deal Team package to ${outputFile}`);
  return packageDocument;
}

buildDealTeamPackage();
