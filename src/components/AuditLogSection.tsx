import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { api } from "@/state/store";
import { Card } from "./SettingsPrimitives";

export interface AuditLogItem {
  id: string;
  timestamp: string;
  botId: string;
  botName: string;
  dealId?: string;
  action: "tool_call" | "document_access" | "model_prompt" | "decision" | "export" | "redaction";
  target: string;
  userApproval: "auto" | "approved" | "denied";
  status: "success" | "blocked" | "failed";
  metadata?: Record<string, unknown>;
}

export function AuditLogSection() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (search.trim()) params.set("search", search.trim());
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = (await api(`/api/audit?${params.toString()}`)) as {
        entries: AuditLogItem[];
        total: number;
      };
      setLogs(res.entries || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [search, actionFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchLogs();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchLogs]);

  const exportUrl = `/api/audit/export/csv${
    search || actionFilter !== "all" || statusFilter !== "all"
      ? `?search=${encodeURIComponent(search)}&action=${actionFilter !== "all" ? actionFilter : ""}&status=${
          statusFilter !== "all" ? statusFilter : ""
        }`
      : ""
  }`;

  return (
    <Card
      title="Institutional Compliance & Audit Trail"
      subtitle="Immutable, append-only log of all bot actions, tool executions, document access, and outbound approvals."
    >
      <div className="flex flex-col gap-3">
        {/* Controls row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-secondary" />
              <input
                type="text"
                placeholder="Search bot, deal, target..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-52 rounded-md border border-hairline/40 bg-inset pl-8 pr-3 text-[12px] text-ink placeholder:text-ink-secondary focus:border-accent focus:outline-none"
              />
            </div>

            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="h-8 rounded-md border border-hairline/40 bg-inset px-2.5 text-[12px] text-ink focus:border-accent focus:outline-none"
            >
              <option value="all">All Actions</option>
              <option value="tool_call">Tool Calls</option>
              <option value="document_access">Document Access</option>
              <option value="model_prompt">Model Prompts</option>
              <option value="decision">Decisions</option>
              <option value="export">Exports</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-md border border-hairline/40 bg-inset px-2.5 text-[12px] text-ink focus:border-accent focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="blocked">Blocked</option>
              <option value="failed">Failed</option>
            </select>

            <button
              type="button"
              onClick={() => void fetchLogs()}
              disabled={loading}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-hairline/40 bg-inset text-ink-secondary hover:bg-control hover:text-ink disabled:opacity-50"
              title="Refresh Audit Log"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            </button>
          </div>

          <a
            href={exportUrl}
            download="mybot-audit-log.csv"
            className="flex h-8 items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-3 text-[12px] font-medium text-accent hover:bg-accent/20"
          >
            <Download size={13} />
            Export CSV
          </a>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-950/20 p-2.5 text-[12px] text-red-400">
            {error}
          </div>
        )}

        {/* Audit Log Table */}
        <div className="overflow-x-auto rounded-lg border border-hairline/40 bg-surface">
          <table className="w-full border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-hairline/40 bg-inset/60 text-ink-secondary">
                <th className="px-3 py-2 font-medium">Timestamp</th>
                <th className="px-3 py-2 font-medium">Bot / Agent</th>
                <th className="px-3 py-2 font-medium">Deal</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Target / Detail</th>
                <th className="px-3 py-2 font-medium">Approval</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline/20">
              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-ink-secondary">
                    <ShieldCheck size={28} className="mx-auto mb-2 opacity-40" />
                    No audit log records found matching the active criteria.
                  </td>
                </tr>
              )}
              {logs.map((entry) => (
                <tr key={entry.id} className="hover:bg-raised/40">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-ink-secondary">
                    {new Date(entry.timestamp).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-ink">
                    {entry.botName}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-ink-secondary">
                    {entry.dealId ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className="inline-block rounded bg-inset px-1.5 py-0.5 font-mono text-[11px] text-ink">
                      {entry.action}
                    </span>
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2 font-mono text-[11px] text-ink" title={entry.target}>
                    {entry.target}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        entry.userApproval === "approved"
                          ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : entry.userApproval === "denied"
                          ? "border border-red-500/30 bg-red-500/10 text-red-400"
                          : "border border-amber-500/30 bg-amber-500/10 text-amber-300"
                      }`}
                    >
                      {entry.userApproval}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        entry.status === "success"
                          ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : entry.status === "blocked"
                          ? "border border-amber-500/30 bg-amber-500/10 text-amber-300"
                          : "border border-red-500/30 bg-red-500/10 text-red-400"
                      }`}
                    >
                      {entry.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > logs.length && (
          <p className="text-[11px] text-ink-secondary">
            Showing top {logs.length} of {total} audit records. Filter or export CSV for full records.
          </p>
        )}
      </div>
    </Card>
  );
}
