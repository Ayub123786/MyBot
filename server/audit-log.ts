import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./config.ts";

export type AuditAction =
  | "tool_call"
  | "document_access"
  | "model_prompt"
  | "decision"
  | "export"
  | "redaction";

export type AuditApproval = "auto" | "approved" | "denied";
export type AuditStatus = "success" | "blocked" | "failed";

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  botId: string;
  botName: string;
  dealId?: string;
  action: AuditAction;
  target: string;
  userApproval: AuditApproval;
  status: AuditStatus;
  metadata?: Record<string, unknown>;
}

export interface AuditFilter {
  botId?: string;
  dealId?: string;
  action?: AuditAction;
  status?: AuditStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export const AUDIT_DIR = join(DATA_DIR, "audit");
export const AUDIT_FILE = join(AUDIT_DIR, "audit.jsonl");

export function ensureAuditDir(): void {
  if (!existsSync(AUDIT_DIR)) {
    mkdirSync(AUDIT_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Append an entry to the append-only audit log file at ~/.mybot/audit/audit.jsonl.
 */
export function appendAuditLog(
  input: Omit<AuditLogEntry, "id" | "timestamp"> & Partial<Pick<AuditLogEntry, "id" | "timestamp">>,
): AuditLogEntry {
  ensureAuditDir();
  const entry: AuditLogEntry = {
    id: input.id ?? `audit-${randomUUID().slice(0, 12)}`,
    timestamp: input.timestamp ?? new Date().toISOString(),
    botId: input.botId,
    botName: input.botName,
    dealId: input.dealId,
    action: input.action,
    target: input.target,
    userApproval: input.userApproval,
    status: input.status,
    metadata: input.metadata,
  };

  const line = JSON.stringify(entry) + "\n";
  appendFileSync(AUDIT_FILE, line, "utf8");
  return entry;
}

/**
 * Read all audit entries from the append-only log.
 */
export function readAllAuditLogs(): AuditLogEntry[] {
  ensureAuditDir();
  if (!existsSync(AUDIT_FILE)) return [];
  try {
    const content = readFileSync(AUDIT_FILE, "utf8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    const entries: AuditLogEntry[] = [];
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line) as AuditLogEntry);
      } catch {
        // Skip corrupted line
      }
    }
    return entries;
  } catch {
    return [];
  }
}

/**
 * Query audit log with filtering and pagination.
 */
export function queryAuditLogs(filter?: AuditFilter): { entries: AuditLogEntry[]; total: number } {
  let list = readAllAuditLogs();

  // Reverse chronological
  list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  if (filter?.botId) {
    list = list.filter((e) => e.botId === filter.botId);
  }
  if (filter?.dealId) {
    list = list.filter((e) => e.dealId === filter.dealId);
  }
  if (filter?.action) {
    list = list.filter((e) => e.action === filter.action);
  }
  if (filter?.status) {
    list = list.filter((e) => e.status === filter.status);
  }
  if (filter?.search) {
    const q = filter.search.toLowerCase();
    list = list.filter(
      (e) =>
        e.target.toLowerCase().includes(q) ||
        e.botName.toLowerCase().includes(q) ||
        (e.dealId && e.dealId.toLowerCase().includes(q)) ||
        (e.metadata && JSON.stringify(e.metadata).toLowerCase().includes(q)),
    );
  }

  const total = list.length;
  const offset = filter?.offset ?? 0;
  const limit = filter?.limit ?? 50;
  const paged = list.slice(offset, offset + limit);

  return { entries: paged, total };
}

function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Export audit logs as an RFC 4180 compliant CSV string.
 */
export function exportAuditLogCsv(filter?: AuditFilter): string {
  const { entries } = queryAuditLogs({ ...filter, limit: 10_000, offset: 0 });
  const headers = [
    "Timestamp",
    "Audit ID",
    "Bot ID",
    "Bot Name",
    "Deal ID",
    "Action",
    "Target",
    "User Approval",
    "Status",
    "Metadata",
  ];

  const rows: string[] = [headers.map(toCsvCell).join(",")];

  for (const entry of entries) {
    rows.push(
      [
        entry.timestamp,
        entry.id,
        entry.botId,
        entry.botName,
        entry.dealId ?? "",
        entry.action,
        entry.target,
        entry.userApproval,
        entry.status,
        entry.metadata ? JSON.stringify(entry.metadata) : "",
      ]
        .map(toCsvCell)
        .join(","),
    );
  }

  return rows.join("\r\n");
}
