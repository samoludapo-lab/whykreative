import http from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./config/env.js";
import { errorResponse } from "./http/errors.js";
import { sendJson } from "./http/response.js";
import { createMemoryStore } from "./repositories/memoryStore.js";
import { handleApi } from "./routes/api.js";
import { serveStatic } from "./routes/static.js";
import { createAppService } from "./services/appService.js";
import { createConnectorService } from "./services/connectors.js";

const __dirname = fileURLToPath(new URL("..", import.meta.url));
const publicDir = join(__dirname, "public");

export function createServer(config = loadEnv()) {
  const clients = new Set();
  const store = createMemoryStore();
  const connectors = createConnectorService(config);

  const app = createAppService({
    store,
    connectors,
    emit(event, payload) {
      const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
      for (const res of clients) res.write(message);
    }
  });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    try {
      const apiResult = await handleApi({ req, res, url, app, config });
      if (apiResult === "events") {
        res.write(`event: dashboard\ndata: ${JSON.stringify(app.dashboardPayload())}\n\n`);
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return;
      }
      if (apiResult !== false) return;
      return serveStatic(req, res, publicDir);
    } catch (error) {
      const response = errorResponse(error);
      sendJson(res, response.status, response.body);
    }
  });

  return { server, config };
}

export function startServer() {
  const { server, config } = createServer();
  server.listen(config.port, config.host, () => {
    console.log(`Render pipeline dashboard running at http://${config.host}:${config.port}`);
  });
  return server;
}
