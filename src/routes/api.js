import { HttpError } from "../http/errors.js";
import { applySecurityHeaders, notFound, sendJson } from "../http/response.js";
import { readRequestJson } from "../http/request.js";

export async function handleApi({ req, res, url, app, config }) {
  if (req.method === "GET" && url.pathname === "/healthz") {
    return sendJson(res, 200, app.health());
  }

  if (req.method === "GET" && url.pathname === "/readyz") {
    return sendJson(res, 200, app.readiness());
  }

  if (req.method === "GET" && url.pathname === "/api/dashboard") {
    return sendJson(res, 200, app.dashboardPayload());
  }

  if (req.method === "GET" && url.pathname === "/api/events") {
    applySecurityHeaders(res);
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive"
    });
    return "events";
  }

  if (req.method === "POST" && url.pathname === "/api/jobs") {
    const input = await readRequestJson(req, config.maxJsonBytes);
    return sendJson(res, 201, { job: app.createJob(input) });
  }

  if (req.method === "POST" && url.pathname === "/api/estimate") {
    const input = await readRequestJson(req, config.maxJsonBytes);
    return sendJson(res, 200, { estimate: app.estimate(input) });
  }

  if (req.method === "POST" && url.pathname === "/api/storyboard") {
    const input = await readRequestJson(req, config.maxJsonBytes);
    return sendJson(res, 200, { storyboard: app.storyboard(input) });
  }

  const connectorMatch = url.pathname.match(/^\/api\/connectors\/([^/]+)$/);
  if (connectorMatch && req.method === "POST") {
    const input = await readRequestJson(req, config.maxJsonBytes);
    const connector = app.connect(connectorMatch[1], input.secret);
    if (!connector) return notFound(res);
    return sendJson(res, 200, { connector });
  }

  if (connectorMatch && req.method === "DELETE") {
    const connector = app.disconnect(connectorMatch[1]);
    if (!connector) return notFound(res);
    return sendJson(res, 200, { connector });
  }

  const approveMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/approve$/);
  if (req.method === "POST" && approveMatch) {
    const job = app.approveJob(approveMatch[1]);
    if (!job) throw new HttpError(409, "Job must be awaiting review before approval");
    return sendJson(res, 200, { job });
  }

  if (url.pathname.startsWith("/api/")) return notFound(res);
  return false;
}
