import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  AlertTriangle,
  Briefcase,
  Building2,
  Code,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plus,
  Scale,
  ShieldCheck,
  TrendingUp,
  UploadCloud,
  Users,
  X,
} from "lucide-react";

import { cn } from "@/lib/cn";
import { useStore } from "@/state/store";

export interface DealDocument {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  extractedTextLength: number;
  extractedTablesCount: number;
  extractionStatus: "pending" | "processing" | "extracted" | "failed";
  extractionError?: string;
}

export interface DealFinding {
  id: string;
  dealId: string;
  category: "financial" | "legal" | "technical" | "market" | "people";
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  factOrAssumptionOrOpinion: "fact" | "assumption" | "opinion";
  confidenceLevel: "high" | "medium" | "low";
  sourceCitations?: string[];
  suggestedMitigation?: string;
  identifiedByBotId?: string;
  identifiedAt: string;
}

export interface DealRecord {
  id: string;
  targetCompany: string;
  stage: "Seed" | "Series A" | "Series B" | "Growth" | "Buyout" | "PE";
  sector: string;
  valuationUsd?: number;
  targetCheckSizeUsd?: number;
  leadPartner: string;
  status: "Sourcing" | "Screening" | "Deep Diligence" | "IC Review" | "Closed" | "Passed";
  createdAt: string;
  updatedAt: string;
  thesisSummary: string;
  quickMetrics?: {
    arrUsd?: number;
    growthYoYPercent?: number;
    netRetentionPercent?: number;
    grossMarginPercent?: number;
    burnMultiple?: number;
    cacPaybackMonths?: number;
  };
  assignedTeamBotIds: string[];
  findings?: DealFinding[];
  documents?: DealDocument[];
  memo?: {
    generatedAt: string;
    version: number;
    title: string;
    executiveSummary: string;
    marketAnalysis: string;
    financialAnalysis: string;
    technicalDiligence: string;
    legalAndRegulatory: string;
    risksAndMitigations: string;
    recommendation: string;
  };
}

export function DealsView() {
  const { state, dispatch } = useStore();
  const [deals, setDeals] = useState<DealRecord[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string>("demo-apexflow-ai");
  const [activeTab, setActiveTab] = useState<"overview" | "dataroom" | "channel" | "findings" | "memo">("overview");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DealDocument | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isNewDealOpen, setIsNewDealOpen] = useState(false);
  const [newDealForm, setNewDealForm] = useState({
    targetCompany: "",
    sector: "Enterprise Software & AI",
    stage: "Series A" as DealRecord["stage"],
    leadPartner: "Investment Lead",
    valuationUsd: 40000000,
    targetCheckSizeUsd: 8000000,
    thesisSummary: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load all deals on mount
  const loadDeals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/deals");
      if (res.ok) {
        const data = await res.json();
        setDeals(data.deals || []);
        if (data.deals?.length > 0 && !selectedDealId) {
          setSelectedDealId(data.deals[0].id);
        }
      }
    } catch {
      // offline or server starting
    } finally {
      setLoading(false);
    }
  }, [selectedDealId]);

  useEffect(() => {
    void loadDeals();
  }, [loadDeals]);

  const currentDeal = deals.find((d) => d.id === selectedDealId) || deals[0];

  // Document upload handler
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentDeal) return;

    setUploading(true);
    setUploadMessage("Uploading & extracting text & tables...");

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`/api/deals/${encodeURIComponent(currentDeal.id)}/data-room`, {
          method: "POST",
          headers: {
            "x-deal-scope": currentDeal.id,
          },
          body: formData,
        });

        if (!res.ok) {
          throw new Error(`Upload failed for ${file.name}`);
        }
      }
      setUploadMessage("Extracted successfully!");
      setTimeout(() => setUploadMessage(null), 3000);
      await loadDeals();
    } catch (err) {
      setUploadMessage(err instanceof Error ? err.message : "Upload error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Preview extracted text
  const handlePreviewDoc = async (doc: DealDocument) => {
    setPreviewDoc(doc);
    setPreviewText("Loading extracted content...");
    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(currentDeal.id)}/data-room/${encodeURIComponent(doc.id)}/raw`, {
        headers: { "x-deal-scope": currentDeal.id },
      });
      if (res.ok) {
        const text = await res.text();
        setPreviewText(text.slice(0, 5000) + (text.length > 5000 ? "\n\n[... truncated preview ...]" : ""));
      } else {
        setPreviewText("Raw extraction preview not available for binary preview.");
      }
    } catch {
      setPreviewText("Failed to load document text.");
    }
  };

  // Create new deal
  const handleCreateDeal = async () => {
    if (!newDealForm.targetCompany.trim()) return;
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(newDealForm),
      });
      if (res.ok) {
        const data = await res.json();
        setIsNewDealOpen(false);
        await loadDeals();
        setSelectedDealId(data.deal.id);
      }
    } catch {
      // ignore
    }
  };

  const filteredFindings = (currentDeal?.findings || []).filter((f) => {
    if (categoryFilter === "all") return true;
    return f.category === categoryFilter;
  });

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-app text-ink">
      {/* Top Header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-edge/60 bg-surface px-6 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <Briefcase size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-ink text-lg">
                {currentDeal ? currentDeal.targetCompany : "Deal Workspace"}
              </h1>
              {currentDeal && (
                <span className="rounded bg-accent/10 px-2 py-0.5 font-medium text-accent text-xs">
                  {currentDeal.stage}
                </span>
              )}
              {currentDeal && (
                <span className="rounded bg-raised px-2 py-0.5 text-ink-secondary text-xs">
                  {currentDeal.sector}
                </span>
              )}
            </div>
            <p className="text-ink-secondary text-xs">
              Lead: {currentDeal?.leadPartner || "Deal Team"} · Status: {currentDeal?.status || "Active"} · Isolated Data Room
            </p>
          </div>
        </div>

        {/* Deal Selector & New Deal Button */}
        <div className="flex items-center gap-2.5">
          {deals.length > 0 && (
            <select
              value={selectedDealId}
              onChange={(e) => setSelectedDealId(e.target.value)}
              className="rounded-lg border border-edge bg-raised px-3 py-1.5 font-medium text-ink text-xs focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.targetCompany} ({d.stage})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setIsNewDealOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 font-medium text-black text-xs transition-opacity hover:opacity-90"
          >
            <Plus size={14} />
            <span>New Deal</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex shrink-0 items-center gap-1 border-b border-edge/60 bg-surface/50 px-6">
        {[
          { id: "overview", label: "Overview & Metrics", icon: Building2 },
          { id: "dataroom", label: "Data Room", icon: UploadCloud, count: currentDeal?.documents?.length },
          { id: "findings", label: "Findings & Red Flags", icon: AlertTriangle, count: currentDeal?.findings?.length },
          { id: "memo", label: "IC Memo", icon: FileText },
          { id: "channel", label: "Deal Team Chat", icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-3.5 py-2.5 font-medium text-xs transition-colors",
                isActive
                  ? "border-accent text-accent"
                  : "border-transparent text-ink-secondary hover:border-edge hover:text-ink"
              )}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span className="rounded-full bg-raised px-1.5 py-0.2 text-[10px] text-ink-muted">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center gap-2 text-ink-secondary">
            <Loader2 size={20} className="animate-spin text-accent" />
            <span>Loading deals and data room...</span>
          </div>
        ) : !currentDeal ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-ink-secondary">
            <Briefcase size={36} className="text-ink-muted" />
            <p>No investment deals created yet.</p>
            <button
              type="button"
              onClick={() => setIsNewDealOpen(true)}
              className="rounded bg-accent px-4 py-2 font-medium text-black text-xs"
            >
              Create First Deal
            </button>
          </div>
        ) : activeTab === "overview" ? (
          /* ================= OVERVIEW TAB ================= */
          <div className="space-y-6 max-w-5xl">
            {/* Thesis Banner */}
            <div className="rounded-xl border border-edge/80 bg-surface p-5">
              <h2 className="mb-1 font-semibold text-ink text-sm">Investment Thesis Alignment</h2>
              <p className="text-ink-secondary text-xs leading-relaxed">{currentDeal.thesisSummary}</p>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Valuation", val: currentDeal.valuationUsd ? `$${(currentDeal.valuationUsd / 1e6).toFixed(1)}M` : "TBD" },
                { label: "Target Check", val: currentDeal.targetCheckSizeUsd ? `$${(currentDeal.targetCheckSizeUsd / 1e6).toFixed(1)}M` : "TBD" },
                { label: "ARR Run-Rate", val: currentDeal.quickMetrics?.arrUsd ? `$${(currentDeal.quickMetrics.arrUsd / 1e6).toFixed(1)}M` : "N/A" },
                { label: "YoY Growth", val: currentDeal.quickMetrics?.growthYoYPercent ? `${currentDeal.quickMetrics.growthYoYPercent}%` : "N/A" },
                { label: "Net Retention (NDR)", val: currentDeal.quickMetrics?.netRetentionPercent ? `${currentDeal.quickMetrics.netRetentionPercent}%` : "N/A" },
                { label: "Gross Margin", val: currentDeal.quickMetrics?.grossMarginPercent ? `${currentDeal.quickMetrics.grossMarginPercent}%` : "N/A" },
              ].map((m, idx) => (
                <div key={idx} className="rounded-lg border border-edge/60 bg-surface p-3.5">
                  <div className="text-[11px] text-ink-muted uppercase tracking-wider">{m.label}</div>
                  <div className="mt-1 font-semibold text-accent text-lg">{m.val}</div>
                </div>
              ))}
            </div>

            {/* Deal Team Roster */}
            <div className="rounded-xl border border-edge/80 bg-surface p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-ink text-sm">Assigned Diligence Bots</h3>
                <span className="text-[11px] text-ink-muted">Strict Citations & Zero Hallucination Active</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                {[
                  { title: "Deal Lead", desc: "Coordinates process, orchestrates workstreams", icon: Briefcase },
                  { title: "Financial Analyst", desc: "P&L, cohort retention, unit economics", icon: TrendingUp },
                  { title: "Legal Reviewer", desc: "Cap table, commercial terms, compliance", icon: Scale },
                  { title: "Technical DD", desc: "Architecture, IP, scalability, security", icon: Code },
                  { title: "Risk Officer (Red Team)", desc: "Adversarial review, downside scenarios", icon: ShieldCheck },
                  { title: "IC Memo Writer", desc: "Synthesizes data room findings into memo", icon: FileText },
                ].map((bot, i) => {
                  const Icon = bot.icon;
                  return (
                    <div key={i} className="flex items-start gap-3 rounded-lg border border-edge/40 bg-raised/40 p-3">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded bg-accent/10 text-accent">
                        <Icon size={16} />
                      </div>
                      <div>
                        <div className="font-medium text-ink text-xs">{bot.title}</div>
                        <div className="text-[11px] text-ink-secondary">{bot.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : activeTab === "dataroom" ? (
          /* ================= DATA ROOM TAB ================= */
          <div className="space-y-6 max-w-5xl">
            {/* Isolation Guarantee Banner */}
            <div className="flex items-center gap-3 rounded-lg border border-accent/20 bg-accent/5 p-4">
              <ShieldCheck size={20} className="shrink-0 text-accent" />
              <div className="text-xs">
                <span className="font-medium text-accent">Per-Deal Data Room Isolation Enforced: </span>
                <span className="text-ink-secondary">
                  Files uploaded here are isolated strictly to <strong>{currentDeal.targetCompany}</strong>. Bots and agents working on other deals cannot access, search, or reference this data room.
                </span>
              </div>
            </div>

            {/* Drag & Drop Upload Card */}
            <div className="rounded-xl border-2 border-dashed border-edge/80 bg-surface/50 p-8 text-center transition-colors hover:border-accent/50">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.xlsx,.csv,.pptx,.txt"
                onChange={handleFileUpload}
                className="hidden"
                id="deal-file-upload"
              />
              <label htmlFor="deal-file-upload" className="flex cursor-pointer flex-col items-center gap-2">
                <div className="flex size-12 items-center justify-center rounded-full bg-raised text-accent">
                  <UploadCloud size={24} />
                </div>
                <div className="font-medium text-ink text-sm">
                  {uploading ? "Extracting Text & Structured Tables..." : "Drop diligence files here or click to upload"}
                </div>
                <p className="text-ink-muted text-xs">
                  Supports Financial Models (.xlsx, .csv), Pitch Decks (.pdf, .pptx), Contracts & Memos (.docx, .txt)
                </p>
                {uploadMessage && (
                  <div className="mt-2 flex items-center gap-1.5 font-medium text-accent text-xs">
                    {uploading && <Loader2 size={14} className="animate-spin" />}
                    <span>{uploadMessage}</span>
                  </div>
                )}
              </label>
            </div>

            {/* Extracted Documents List */}
            <div className="rounded-xl border border-edge/80 bg-surface overflow-hidden">
              <div className="flex items-center justify-between border-b border-edge/60 px-5 py-3.5">
                <h3 className="font-semibold text-ink text-sm">Extracted Data Room Files</h3>
                <span className="text-[11px] text-ink-muted">
                  {currentDeal.documents?.length || 0} document{currentDeal.documents?.length === 1 ? "" : "s"}
                </span>
              </div>

              {!currentDeal.documents || currentDeal.documents.length === 0 ? (
                <div className="p-8 text-center text-ink-secondary text-xs">
                  No documents in data room yet. Upload financial models, pitch deck, or contracts above.
                </div>
              ) : (
                <div className="divide-y divide-edge/40">
                  {currentDeal.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 transition-colors hover:bg-raised/30">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded bg-raised text-ink-secondary">
                          {doc.filename.endsWith(".csv") || doc.filename.endsWith(".xlsx") ? (
                            <FileSpreadsheet size={16} className="text-emerald-400" />
                          ) : (
                            <FileText size={16} className="text-sky-400" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-ink text-xs">{doc.originalName || doc.filename}</div>
                          <div className="flex items-center gap-2 text-[11px] text-ink-muted">
                            <span>{(doc.sizeBytes / 1024).toFixed(1)} KB</span>
                            <span>•</span>
                            <span className="text-emerald-400">
                              {doc.extractedTextLength.toLocaleString()} words
                            </span>
                            <span>•</span>
                            <span>{doc.extractedTablesCount} tables</span>
                            <span>•</span>
                            <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handlePreviewDoc(doc)}
                          className="flex items-center gap-1 rounded bg-raised px-2.5 py-1 text-ink-secondary text-xs hover:text-ink"
                        >
                          <Eye size={12} />
                          <span>Preview</span>
                        </button>
                        <a
                          href={`/api/deals/${encodeURIComponent(currentDeal.id)}/data-room/${encodeURIComponent(doc.id)}/raw`}
                          download={doc.originalName || doc.filename}
                          className="flex items-center gap-1 rounded bg-raised px-2.5 py-1 text-ink-secondary text-xs hover:text-ink"
                        >
                          <Download size={12} />
                          <span>Download</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Document Preview Drawer */}
            {previewDoc && (
              <div className="rounded-xl border border-edge/80 bg-surface p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-semibold text-ink text-xs">
                    Preview: {previewDoc.originalName} ({previewDoc.extractedTextLength} words)
                  </h4>
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(null)}
                    className="text-ink-muted hover:text-ink"
                  >
                    <X size={14} />
                  </button>
                </div>
                <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded bg-black/40 p-3 font-mono text-[11px] text-ink-secondary">
                  {previewText}
                </pre>
              </div>
            )}
          </div>
        ) : activeTab === "findings" ? (
          /* ================= FINDINGS & RED FLAGS TAB ================= */
          <div className="space-y-6 max-w-5xl">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5">
              {[
                { id: "all", label: "All Findings" },
                { id: "financial", label: "Financial" },
                { id: "legal", label: "Legal & Cap Table" },
                { id: "technical", label: "Technical" },
                { id: "market", label: "Market & Competitor" },
                { id: "people", label: "People & Org" },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryFilter(c.id)}
                  className={cn(
                    "rounded-full px-3 py-1 font-medium text-xs transition-colors",
                    categoryFilter === c.id
                      ? "bg-accent text-black"
                      : "bg-surface text-ink-secondary hover:text-ink"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Findings Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredFindings.length === 0 ? (
                <div className="col-span-2 rounded-xl border border-edge/60 bg-surface p-8 text-center text-ink-secondary text-xs">
                  No findings in this category yet. Run diligence bots in the Deal Team Chat.
                </div>
              ) : (
                filteredFindings.map((f) => (
                  <div
                    key={f.id}
                    className="flex flex-col justify-between rounded-xl border border-edge/80 bg-surface p-4.5 transition-colors hover:border-edge"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "rounded px-2 py-0.5 font-semibold text-[10px] uppercase tracking-wider",
                            f.severity === "high"
                              ? "bg-rose-500/20 text-rose-300"
                              : f.severity === "medium"
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-sky-500/20 text-sky-300"
                          )}
                        >
                          {f.severity} severity
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-raised px-1.5 py-0.5 text-[10px] text-ink-muted uppercase">
                            {f.factOrAssumptionOrOpinion}
                          </span>
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px]",
                              f.confidenceLevel === "high"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-amber-500/15 text-amber-300"
                            )}
                          >
                            {f.confidenceLevel === "high" ? "Verified" : "[UNVERIFIED]"}
                          </span>
                        </div>
                      </div>

                      <h4 className="mt-2.5 font-semibold text-ink text-sm">{f.title}</h4>
                      <p className="mt-1 text-ink-secondary text-xs leading-relaxed">{f.detail}</p>

                      {f.suggestedMitigation && (
                        <div className="mt-3 rounded bg-raised/50 p-2 text-[11px] text-ink-muted">
                          <span className="font-semibold text-accent">Mitigant / Next Step: </span>
                          <span>{f.suggestedMitigation}</span>
                        </div>
                      )}
                    </div>

                    {f.sourceCitations && f.sourceCitations.length > 0 && (
                      <div className="mt-3 border-t border-edge/40 pt-2 text-[10px] text-ink-muted">
                        Sources: {f.sourceCitations.join(", ")}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : activeTab === "memo" ? (
          /* ================= IC MEMO TAB ================= */
          <div className="space-y-6 max-w-4xl">
            {/* Memo Toolbar */}
            <div className="flex items-center justify-between rounded-xl border border-edge/80 bg-surface p-4">
              <div>
                <h3 className="font-semibold text-ink text-sm">
                  Investment Committee Memorandum (v{currentDeal.memo?.version || 1}.0)
                </h3>
                <p className="text-[11px] text-ink-muted">
                  Auto-assembled from isolated data room extractions and deal team findings.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`/api/deals/${encodeURIComponent(currentDeal.id)}/export/docx`}
                  download={`${currentDeal.targetCompany}-IC-Memo.docx`}
                  className="flex items-center gap-1.5 rounded-lg border border-edge bg-raised px-3 py-1.5 font-medium text-ink text-xs hover:bg-raised/80"
                >
                  <Download size={14} />
                  <span>Export Word (.docx)</span>
                </a>
                <a
                  href={`/api/deals/${encodeURIComponent(currentDeal.id)}/export/pdf`}
                  download={`${currentDeal.targetCompany}-IC-Memo.html`}
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 font-medium text-black text-xs transition-opacity hover:opacity-90"
                >
                  <Download size={14} />
                  <span>Export Memo (PDF/HTML)</span>
                </a>
              </div>
            </div>

            {/* Rendered Memo Document */}
            <div className="rounded-xl border border-edge/80 bg-surface p-8 shadow-sm space-y-6 text-ink">
              <div className="border-b border-edge/60 pb-4">
                <div className="text-[11px] font-semibold tracking-wider text-accent uppercase">
                  CONFIDENTIAL · INVESTMENT COMMITTEE MEMORANDUM
                </div>
                <h1 className="mt-1 font-bold text-2xl text-ink">
                  Project {currentDeal.targetCompany} — Series {currentDeal.stage}
                </h1>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-muted">
                  <span>Lead Partner: {currentDeal.leadPartner}</span>
                  <span>Target Valuation: ${(currentDeal.valuationUsd || 0) / 1e6}M</span>
                  <span>Proposed Investment: ${(currentDeal.targetCheckSizeUsd || 0) / 1e6}M</span>
                  <span>Date: {new Date().toLocaleDateString()}</span>
                </div>
              </div>

              {/* Memo Sections */}
              {[
                { title: "1. Executive Summary & Thesis", content: currentDeal.memo?.executiveSummary },
                { title: "2. Market Opportunity & Competitive Moats", content: currentDeal.memo?.marketAnalysis },
                { title: "3. Financial Diligence & Unit Economics", content: currentDeal.memo?.financialAnalysis },
                { title: "4. Technical Diligence & IP Architecture", content: currentDeal.memo?.technicalDiligence },
                { title: "5. Legal, Regulatory & Cap Table", content: currentDeal.memo?.legalAndRegulatory },
                { title: "6. Key Risks & Mitigations (Red Team Analysis)", content: currentDeal.memo?.risksAndMitigations },
                { title: "7. Recommendation & Proposed Terms", content: currentDeal.memo?.recommendation },
              ].map((sec, i) => (
                <div key={i} className="space-y-2">
                  <h3 className="font-semibold text-accent text-sm">{sec.title}</h3>
                  <p className="text-xs leading-relaxed text-ink-secondary whitespace-pre-wrap">
                    {sec.content || "Diligence in progress for this section."}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ================= CHANNEL TAB ================= */
          <div className="space-y-6 max-w-4xl">
            <div className="rounded-xl border border-edge/80 bg-surface p-5">
              <h3 className="mb-2 font-semibold text-ink text-sm">Deal Discussion & Prompt Dispatch</h3>
              <p className="text-ink-secondary text-xs">
                Dispatch structured diligence prompts to the Deal Team bots. Responses will be scoped to this deal's isolated data room.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {[
                  {
                    target: "Financial Analyst",
                    prompt: `Analyze the gross margin trajectory and customer retention for ${currentDeal.targetCompany}. Highlight verified vs unverified metrics.`,
                  },
                  {
                    target: "Technical DD",
                    prompt: `Audit the core IP and technical architecture scalability for ${currentDeal.targetCompany} based on the data room specs.`,
                  },
                  {
                    target: "Legal Reviewer",
                    prompt: `Review the cap table and commercial contract terms for ${currentDeal.targetCompany}. Check for change-of-control penalties.`,
                  },
                  {
                    target: "Risk Officer (Red Team)",
                    prompt: `Identify the top 3 downside vulnerabilities for ${currentDeal.targetCompany} and propose specific mitigants.`,
                  },
                ].map((item, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      const bot = state.bots.find((b) => b.name?.includes(item.target.split(" ")[0]));
                      if (bot) {
                        dispatch({ type: "select", id: bot.id });
                        dispatch({ type: "showChat" });
                      }
                    }}
                    className="flex flex-col items-start rounded-lg border border-edge/60 bg-raised/40 p-3 text-left transition-colors hover:border-accent hover:bg-raised/70"
                  >
                    <span className="font-medium text-accent text-xs">Ask {item.target}:</span>
                    <span className="mt-1 line-clamp-2 text-ink-secondary text-xs">{item.prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Deal Modal */}
      {isNewDealOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-edge bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-edge/60 pb-3">
              <h3 className="font-semibold text-ink text-base">New Investment Deal</h3>
              <button
                type="button"
                onClick={() => setIsNewDealOpen(false)}
                className="text-ink-muted hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-ink">Target Company Name</label>
                <input
                  type="text"
                  placeholder="e.g. ApexFlow AI"
                  value={newDealForm.targetCompany}
                  onChange={(e) => setNewDealForm({ ...newDealForm, targetCompany: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-edge bg-raised px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink">Stage</label>
                  <select
                    value={newDealForm.stage}
                    onChange={(e) => setNewDealForm({ ...newDealForm, stage: e.target.value as DealRecord["stage"] })}
                    className="mt-1 w-full rounded-lg border border-edge bg-raised px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="Seed">Seed</option>
                    <option value="Series A">Series A</option>
                    <option value="Series B">Series B</option>
                    <option value="Growth">Growth</option>
                    <option value="Buyout">Buyout</option>
                    <option value="PE">Private Equity</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-ink">Sector</label>
                  <input
                    type="text"
                    value={newDealForm.sector}
                    onChange={(e) => setNewDealForm({ ...newDealForm, sector: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-edge bg-raised px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink">Target Valuation (USD)</label>
                  <input
                    type="number"
                    value={newDealForm.valuationUsd}
                    onChange={(e) => setNewDealForm({ ...newDealForm, valuationUsd: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-edge bg-raised px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="block font-medium text-ink">Check Size (USD)</label>
                  <input
                    type="number"
                    value={newDealForm.targetCheckSizeUsd}
                    onChange={(e) => setNewDealForm({ ...newDealForm, targetCheckSizeUsd: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-edge bg-raised px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-ink">Thesis & Summary</label>
                <textarea
                  rows={3}
                  placeholder="Outline the core investment thesis..."
                  value={newDealForm.thesisSummary}
                  onChange={(e) => setNewDealForm({ ...newDealForm, thesisSummary: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-edge bg-raised px-3 py-2 text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewDealOpen(false)}
                className="rounded-lg border border-edge px-3.5 py-1.5 font-medium text-ink-secondary text-xs hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateDeal}
                className="rounded-lg bg-accent px-4 py-1.5 font-medium text-black text-xs hover:opacity-90"
              >
                Create Deal Workspace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
