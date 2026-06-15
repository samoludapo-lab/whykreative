import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

const statusOrder = [
  "queued",
  "rendering",
  "postprocessing",
  "stored",
  "awaiting_review",
  "approved",
  "uploading_to_tiktok",
  "draft_created"
];

const statusLabels = {
  queued: "Queued",
  rendering: "Rendering",
  postprocessing: "Postprocessing",
  stored: "Stored",
  awaiting_review: "Awaiting review",
  approved: "Approved",
  uploading_to_tiktok: "Uploading",
  draft_created: "Draft created",
  failed: "Failed"
};

const clients = new Set();

const db = {
  projects: [
    {
      id: "proj-luma",
      title: "Luma Bottle Launch",
      owner: "Mira Chen",
      format: "9:16",
      platform: "TikTok",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 7).toISOString()
    },
    {
      id: "proj-cafe",
      title: "Cafe Opening Teaser",
      owner: "Avery Singh",
      format: "9:16",
      platform: "TikTok",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
    }
  ],
  jobs: [
    {
      id: "job-1027",
      projectId: "proj-luma",
      title: "Bottle spin with AI voiceover",
      status: "awaiting_review",
      progress: 82,
      priority: "High",
      worker: "gpu-render-01",
      duration: "00:23",
      storageKey: "r2://renders/job-1027/final.mp4",
      tiktokDraftId: null,
      createdAt: new Date(Date.now() - 1000 * 60 * 48).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
      logs: [
        "Queued from API server",
        "Assets downloaded from R2",
        "Blender render complete",
        "FFmpeg vertical encode complete",
        "Final MP4 stored in R2"
      ]
    },
    {
      id: "job-1028",
      projectId: "proj-cafe",
      title: "Grand opening espresso scene",
      status: "rendering",
      progress: 38,
      priority: "Normal",
      worker: "gpu-render-02",
      duration: null,
      storageKey: null,
      tiktokDraftId: null,
      createdAt: new Date(Date.now() - 1000 * 60 * 16).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 30).toISOString(),
      logs: [
        "Queued from API server",
        "Render worker claimed job",
        "Blender Python scene assembly started"
      ]
    }
  ]
};

const jobTimers = new Map();

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

function notFound(res) {
  sendJson(res, 404, { error: "Not found" });
}

async function readRequestJson(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  if (!body) return {};
  return JSON.parse(body);
}

function emit(event, payload) {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) res.write(message);
}

function enrichJob(job) {
  const project = db.projects.find((item) => item.id === job.projectId);
  return {
    ...job,
    project,
    statusLabel: statusLabels[job.status] || job.status,
    pipelineIndex: Math.max(0, statusOrder.indexOf(job.status))
  };
}

function dashboardPayload() {
  const jobs = db.jobs.map(enrichJob).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const active = jobs.filter((job) => !["awaiting_review", "draft_created", "failed"].includes(job.status));
  return {
    projects: db.projects,
    jobs,
    stats: {
      activeJobs: active.length,
      awaitingReview: jobs.filter((job) => job.status === "awaiting_review").length,
      draftsCreated: jobs.filter((job) => job.status === "draft_created").length,
      gpuWorkers: 2,
      queueDepth: jobs.filter((job) => job.status === "queued").length
    },
    services: [
      { name: "PostgreSQL", detail: "Projects, jobs, users, TikTok auth", status: "healthy" },
      { name: "S3/R2 Storage", detail: "Assets, thumbnails, final MP4", status: "healthy" },
      { name: "Redis Queue", detail: "Render and upload jobs", status: active.length ? "busy" : "healthy" },
      { name: "GPU Worker", detail: "Blender, FFmpeg, AI voice", status: active.length ? "busy" : "idle" }
    ],
    pipeline: statusOrder.map((status) => ({ status, label: statusLabels[status] }))
  };
}

function appendLog(job, line) {
  job.logs.push(line);
  job.updatedAt = new Date().toISOString();
}

function setJobStatus(job, status, progress, line) {
  job.status = status;
  job.progress = progress;
  if (status === "stored") {
    job.storageKey = `r2://renders/${job.id}/final.mp4`;
    job.duration = "00:24";
  }
  appendLog(job, line);
  emit("dashboard", dashboardPayload());
}

function simulateRender(job) {
  if (jobTimers.has(job.id)) clearInterval(jobTimers.get(job.id));
  const steps = [
    ["rendering", 22, "Render worker claimed job"],
    ["rendering", 43, "Blender Python scene render in progress"],
    ["postprocessing", 64, "FFmpeg encode and loudness pass started"],
    ["postprocessing", 78, "AI voice mixed into timeline"],
    ["stored", 92, "Final MP4 stored in R2"],
    ["awaiting_review", 100, "Ready for client review"]
  ];
  let index = 0;
  const timer = setInterval(() => {
    const step = steps[index];
    if (!step) {
      clearInterval(timer);
      jobTimers.delete(job.id);
      return;
    }
    setJobStatus(job, step[0], step[1], step[2]);
    index += 1;
  }, 1800);
  jobTimers.set(job.id, timer);
}

function createJob(input) {
  const project = db.projects.find((item) => item.id === input.projectId) || db.projects[0];
  const job = {
    id: `job-${Math.floor(2000 + Math.random() * 7000)}`,
    projectId: project.id,
    title: input.title?.trim() || "Untitled render",
    status: "queued",
    progress: 5,
    priority: input.priority || "Normal",
    worker: null,
    duration: null,
    storageKey: null,
    tiktokDraftId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    logs: ["Queued from API server"]
  };
  db.jobs.unshift(job);
  emit("dashboard", dashboardPayload());
  setTimeout(() => {
    job.worker = `gpu-render-0${Math.ceil(Math.random() * 2)}`;
    simulateRender(job);
  }, 900);
  return enrichJob(job);
}

function approveJob(job) {
  if (!job || job.status !== "awaiting_review") return null;
  setJobStatus(job, "approved", 100, "Client approved final MP4");
  setTimeout(() => setJobStatus(job, "uploading_to_tiktok", 100, "TikTok Upload API request started"), 700);
  setTimeout(() => {
    job.tiktokDraftId = `draft_${Math.random().toString(16).slice(2, 10)}`;
    setJobStatus(job, "draft_created", 100, "TikTok draft delivered to creator inbox");
  }, 2200);
  return enrichJob(job);
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);
  if (!filePath.startsWith(publicDir)) return notFound(res);

  try {
    const data = await readFile(filePath);
    const type = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".svg": "image/svg+xml"
    }[extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    res.end(data);
  } catch {
    notFound(res);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === "GET" && url.pathname === "/api/dashboard") {
      return sendJson(res, 200, dashboardPayload());
    }

    if (req.method === "GET" && url.pathname === "/api/events") {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive"
      });
      res.write(`event: dashboard\ndata: ${JSON.stringify(dashboardPayload())}\n\n`);
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/jobs") {
      const input = await readRequestJson(req);
      return sendJson(res, 201, { job: createJob(input) });
    }

    const approveMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/approve$/);
    if (req.method === "POST" && approveMatch) {
      const job = db.jobs.find((item) => item.id === approveMatch[1]);
      const approved = approveJob(job);
      if (!approved) return sendJson(res, 409, { error: "Job must be awaiting review before approval" });
      return sendJson(res, 200, { job: approved });
    }

    if (url.pathname.startsWith("/api/")) return notFound(res);
    return serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(port, host, () => {
  console.log(`Render pipeline dashboard running at http://${host}:${port}`);
});
