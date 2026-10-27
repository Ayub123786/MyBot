/**
 * Pre-configured MCP servers for institutional due diligence and investment workflows.
 * All entries are disabled by default.
 * No DocuSign.
 */
export interface DiligenceMcpTemplate {
  name: string;
  label: string;
  category: "search" | "regulatory" | "corporate" | "market-intelligence";
  description: string;
  config: {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    type?: "http" | "sse";
    url?: string;
    headers?: Record<string, string>;
    enabled: boolean;
  };
}

export const DILIGENCE_MCP_TEMPLATES: DiligenceMcpTemplate[] = [
  {
    name: "web-search-tavily",
    label: "Tavily Web Search",
    category: "search",
    description: "Deep web search optimized for AI agents and market diligence.",
    config: {
      command: "npx",
      args: ["-y", "tavily-mcp@latest"],
      env: { TAVILY_API_KEY: "" },
      enabled: false,
    },
  },
  {
    name: "web-search-exa",
    label: "Exa Neural Search",
    category: "search",
    description: "Semantic search across tech blogs, research papers, and company updates.",
    config: {
      command: "npx",
      args: ["-y", "exa-mcp-server@latest"],
      env: { EXA_API_KEY: "" },
      enabled: false,
    },
  },
  {
    name: "sec-edgar",
    label: "SEC EDGAR Filings",
    category: "regulatory",
    description: "Search and retrieve 10-K, 10-Q, 8-K, Form D, and S-1 filings directly from the SEC.",
    config: {
      command: "npx",
      args: ["-y", "sec-edgar-mcp@latest"],
      env: { SEC_EDGAR_USER_AGENT: "" },
      enabled: false,
    },
  },
  {
    name: "opencorporates",
    label: "OpenCorporates Global Registry",
    category: "corporate",
    description: "Global corporate registry data, legal entity identification, and officer verification.",
    config: {
      command: "npx",
      args: ["-y", "opencorporates-mcp@latest"],
      env: { OPENCORPORATES_API_KEY: "" },
      enabled: false,
    },
  },
  {
    name: "crunchbase-placeholder",
    label: "Crunchbase (Enterprise Placeholder)",
    category: "market-intelligence",
    description: "Funding rounds, investor syndicates, and acquisition data (requires Enterprise API key).",
    config: {
      type: "http",
      url: "https://api.crunchbase.com/v4/mcp",
      headers: { "X-Cb-User-Key": "" },
      enabled: false,
    },
  },
  {
    name: "pitchbook-placeholder",
    label: "PitchBook (Enterprise Placeholder)",
    category: "market-intelligence",
    description: "Private capital markets, pre/post-money valuations, and deal multiples (requires Direct Data API key).",
    config: {
      type: "http",
      url: "https://api.pitchbook.com/v1/mcp",
      headers: { Authorization: "" },
      enabled: false,
    },
  },
];

export const DEFAULT_DILIGENCE_MCP_SERVERS = Object.fromEntries(
  DILIGENCE_MCP_TEMPLATES.map((t) => [t.name, t.config])
);
