import { readFile } from "node:fs/promises";
import { extname, normalize, resolve, sep } from "node:path";
import { applySecurityHeaders, notFound } from "../http/response.js";

export async function serveStatic(req, res, publicDir) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const safePath = normalize(pathname).replace(/^([/\\])+/, "").replace(/^(\.\.[/\\])+/, "");
  const filePath = resolve(publicDir, safePath);
  if (filePath !== publicDir && !filePath.startsWith(`${publicDir}${sep}`)) return notFound(res);

  try {
    const data = await readFile(filePath);
    const type = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".svg": "image/svg+xml"
    }[extname(filePath)] || "application/octet-stream";
    applySecurityHeaders(res);
    res.writeHead(200, { "content-type": type });
    res.end(data);
  } catch {
    notFound(res);
  }
}
