import { queryAuditLogs, exportAuditLogCsv, appendAuditLog, type AuditAction, type AuditApproval, type AuditStatus } from "../audit-log.ts";
import { PASS, type RouteHandler } from "./table.ts";

export function createAuditRoutes(): RouteHandler {
  return async ({ req, res, path, method, json, readBody, url }) => {
    // 1. Export CSV
    if (method === "GET" && path === "/api/audit/export/csv") {
      const botId = url.searchParams.get("botId") || undefined;
      const dealId = url.searchParams.get("dealId") || undefined;
      const action = (url.searchParams.get("action") as AuditAction) || undefined;
      const status = (url.searchParams.get("status") as AuditStatus) || undefined;
      const search = url.searchParams.get("search") || undefined;

      const csv = exportAuditLogCsv({ botId, dealId, action, status, search });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="mybot-audit-log.csv"');
      res.end(csv);
      return;
    }

    // 2. Query Audit Logs (JSON)
    if (method === "GET" && path === "/api/audit") {
      const limit = Number.parseInt(url.searchParams.get("limit") || "50", 10);
      const offset = Number.parseInt(url.searchParams.get("offset") || "0", 10);
      const botId = url.searchParams.get("botId") || undefined;
      const dealId = url.searchParams.get("dealId") || undefined;
      const action = (url.searchParams.get("action") as AuditAction) || undefined;
      const status = (url.searchParams.get("status") as AuditStatus) || undefined;
      const search = url.searchParams.get("search") || undefined;

      const result = queryAuditLogs({ limit, offset, botId, dealId, action, status, search });
      return json(res, 200, result);
    }

    // 3. Log an audit event (POST)
    if (method === "POST" && path === "/api/audit") {
      const body = await readBody(req);
      if (!body || typeof body !== "object") {
        return json(res, 400, { error: "Invalid audit event body" });
      }
      const b = body as Record<string, unknown>;
      const entry = appendAuditLog({
        botId: String(b.botId || "user"),
        botName: String(b.botName || "System / Operator"),
        dealId: b.dealId ? String(b.dealId) : undefined,
        action: (b.action as AuditAction) || "decision",
        target: String(b.target || "operation"),
        userApproval: (b.userApproval as AuditApproval) || "auto",
        status: (b.status as AuditStatus) || "success",
        metadata: b.metadata && typeof b.metadata === "object" ? (b.metadata as Record<string, unknown>) : undefined,
      });
      return json(res, 201, { entry });
    }

    return PASS;
  };
}
