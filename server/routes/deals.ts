import { existsSync, createReadStream } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  addDealFinding,
  assertDealIsolation,
  createDeal,
  dealDir,
  deleteDeal,
  exportMemoDocx,
  exportMemoPdfHtml,
  getDeal,
  listDeals,
  updateDeal,
  DealIsolationError,
} from "../deals.ts";
import { saveDealAttachment } from "../attachments.ts";
import { PASS, type RouteHandler } from "./table.ts";

export interface DealRouteDeps {
  broadcast?: (payload: Record<string, unknown>) => void;
}

export function createDealRoutes(deps: DealRouteDeps = {}): RouteHandler {
  return async ({ req, res, path, method, json, readBody, url }) => {
    // 1. List all deals
    if (method === "GET" && path === "/api/deals") {
      try {
        const deals = listDeals();
        return json(res, 200, { deals });
      } catch (error) {
        return json(res, 500, { error: error instanceof Error ? error.message : "Failed to list deals" });
      }
    }

    // 2. Create a new deal
    if (method === "POST" && path === "/api/deals") {
      const body = await readBody(req);
      const schema = z.object({
        name: z.string().trim().min(1),
        company: z.string().trim().min(1),
        stage: z.string().optional(),
        sector: z.string().optional(),
        targetCheck: z.string().optional(),
        valuation: z.string().optional(),
        thesisAlignment: z.string().optional(),
      });
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return json(res, 400, { error: "Company name and deal name are required." });
      }

      try {
        const deal = createDeal(parsed.data);
        deps.broadcast?.({ type: "deals_updated", dealId: deal.id });
        return json(res, 201, { deal });
      } catch (error) {
        return json(res, 500, { error: error instanceof Error ? error.message : "Failed to create deal" });
      }
    }

    // Match /api/deals/:id...
    const dealMatch = /^\/api\/deals\/([a-z0-9][a-z0-9-]*)(?:\/(.*))?$/.exec(path);
    if (!dealMatch) return PASS;

    const dealId = dealMatch[1]!;
    const subPath = dealMatch[2] ?? "";
    const callerDealId = req.headers["x-deal-scope"] as string | undefined;

    // 3. Export to PDF / printable HTML
    if (method === "GET" && subPath === "export/pdf") {
      try {
        assertDealIsolation(dealId, callerDealId);
        const html = exportMemoPdfHtml(dealId);
        res.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "content-disposition": `inline; filename="IC_Memo_${dealId}.html"`,
        });
        res.end(html);
        return;
      } catch (error) {
        const status = error instanceof DealIsolationError ? error.status : 500;
        return json(res, status, { error: error instanceof Error ? error.message : "Export failed" });
      }
    }

    // 4. Export to DOCX
    if (method === "GET" && subPath === "export/docx") {
      try {
        assertDealIsolation(dealId, callerDealId);
        const docxBuffer = exportMemoDocx(dealId);
        res.writeHead(200, {
          "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "content-disposition": `attachment; filename="IC_Memo_${dealId}.docx"`,
          "content-length": String(docxBuffer.length),
        });
        res.end(docxBuffer);
        return;
      } catch (error) {
        const status = error instanceof DealIsolationError ? error.status : 500;
        return json(res, status, { error: error instanceof Error ? error.message : "Export failed" });
      }
    }

    // 5. Upload document to Data Room
    if (method === "POST" && subPath === "documents") {
      try {
        assertDealIsolation(dealId, callerDealId);
        const fileName = (url.searchParams.get("name") || "document.bin").trim();
        const rawType = Array.isArray(req.headers["content-type"])
          ? req.headers["content-type"][0]
          : req.headers["content-type"];
        const mime = rawType?.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";

        const doc = await saveDealAttachment(dealId, req, fileName, mime, {
          authorizedDealId: callerDealId,
        });

        deps.broadcast?.({ type: "deal_documents_updated", dealId, docId: doc.id });
        return json(res, 201, { document: doc });
      } catch (error) {
        const status = error instanceof DealIsolationError ? error.status : 500;
        return json(res, status, { error: error instanceof Error ? error.message : "Upload failed" });
      }
    }

    // 6. Download raw data room document
    const fileMatch = /^documents\/([a-z0-9_-]+)\/file$/.exec(subPath);
    if (method === "GET" && fileMatch) {
      const docId = fileMatch[1]!;
      try {
        assertDealIsolation(dealId, callerDealId);
        const deal = getDeal(dealId, callerDealId);
        const doc = deal.documents.find((d) => d.id === docId);
        if (!doc) return json(res, 404, { error: "Document not found in this deal's data room." });

        const docFile = join(dealDir(dealId), "documents", `${doc.id}_${doc.fileName}`);
        if (!existsSync(docFile)) {
          return json(res, 404, { error: "Document file not found on disk." });
        }

        res.writeHead(200, {
          "content-type": doc.mime || "application/octet-stream",
          "content-disposition": `attachment; filename="${doc.fileName}"`,
          "content-length": String(doc.bytes),
        });
        createReadStream(docFile).pipe(res);
        return;
      } catch (error) {
        const status = error instanceof DealIsolationError ? error.status : 500;
        return json(res, status, { error: error instanceof Error ? error.message : "Document access failed" });
      }
    }

    // 7. Add bot finding
    if (method === "POST" && subPath === "findings") {
      try {
        assertDealIsolation(dealId, callerDealId);
        const body = await readBody(req);
        const finding = addDealFinding(dealId, body);
        deps.broadcast?.({ type: "deal_findings_updated", dealId, findingId: finding.id });
        return json(res, 201, { finding });
      } catch (error) {
        const status = error instanceof DealIsolationError ? error.status : 500;
        return json(res, status, { error: error instanceof Error ? error.message : "Failed to record finding" });
      }
    }

    // 8. Get deal details
    if (method === "GET" && subPath === "") {
      try {
        const deal = getDeal(dealId, callerDealId);
        return json(res, 200, { deal });
      } catch (error) {
        const status = error instanceof DealIsolationError ? error.status : 404;
        return json(res, status, { error: error instanceof Error ? error.message : "Deal not found" });
      }
    }

    // 9. Update deal metadata / memo
    if (method === "PATCH" && subPath === "") {
      try {
        assertDealIsolation(dealId, callerDealId);
        const body = await readBody(req);
        const updated = updateDeal(dealId, body);
        deps.broadcast?.({ type: "deal_updated", dealId });
        return json(res, 200, { deal: updated });
      } catch (error) {
        const status = error instanceof DealIsolationError ? error.status : 500;
        return json(res, status, { error: error instanceof Error ? error.message : "Update failed" });
      }
    }

    // 10. Delete deal
    if (method === "DELETE" && subPath === "") {
      try {
        assertDealIsolation(dealId, callerDealId);
        deleteDeal(dealId);
        deps.broadcast?.({ type: "deal_deleted", dealId });
        return json(res, 200, { ok: true });
      } catch (error) {
        const status = error instanceof DealIsolationError ? error.status : 500;
        return json(res, status, { error: error instanceof Error ? error.message : "Delete failed" });
      }
    }

    return PASS;
  };
}
