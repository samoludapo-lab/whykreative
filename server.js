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
  "scripting",
  "generating_assets",
  "building_scene",
  "generating_voice",
  "generating_video",
  "compositing",
  "stored",
  "awaiting_review",
  "approved",
  "uploading_to_tiktok",
  "draft_created"
];

const statusLabels = {
  queued: "Queued",
  scripting: "Script",
  generating_assets: "3D assets",
  building_scene: "Blender",
  generating_voice: "Voice",
  generating_video: "AI video",
  compositing: "FFmpeg",
  stored: "Stored",
  awaiting_review: "Awaiting review",
  approved: "Approved",
  uploading_to_tiktok: "Uploading",
  draft_created: "Draft created",
  failed: "Failed"
};

const clients = new Set();

const toolCatalog = {
  assetProviders: [
    { id: "meshy", name: "Meshy", detail: "Text/image to 3D assets, rigging, animation, retexture" },
    { id: "tripo", name: "Tripo", detail: "Fast image to 3D and generated props" },
    { id: "manual", name: "Uploaded assets", detail: "Use client-provided GLB, FBX, OBJ, or blend files" }
  ],
  sceneEngines: [
    { id: "blender", name: "Blender Python", detail: "Deterministic 3D scene assembly, lighting, camera, render" }
  ],
  voiceProviders: [
    { id: "elevenlabs", name: "ElevenLabs", detail: "Expressive character voices, dialogue, cloning/design" },
    { id: "cartesia", name: "Cartesia", detail: "Low-latency character voices and realtime voice" }
  ],
  videoProviders: [
    { id: "runway", name: "Runway", detail: "Reference-based cinematic AI video inserts" },
    { id: "luma", name: "Luma Dream Machine", detail: "Natural motion and short generative clips" },
    { id: "none", name: "No AI insert", detail: "Pure Blender render" }
  ],
  assembly: [
    { id: "ffmpeg", name: "FFmpeg", detail: "Captions, music, voice mix, encode, final MP4" }
  ]
};

const characterPresets = {
  narrator: "Warm narrator",
  founder: "Founder / presenter",
  customer: "Customer testimonial",
  duo: "Two-character dialogue"
};

function findTool(group, id) {
  return toolCatalog[group].find((tool) => tool.id === id) || toolCatalog[group][0];
}

function createWorkflow(input = {}) {
  const assetProvider = findTool("assetProviders", input.assetProvider || "meshy");
  const sceneEngine = findTool("sceneEngines", "blender");
  const voiceProvider = findTool("voiceProviders", input.voiceProvider || "elevenlabs");
  const videoProvider = findTool("videoProviders", input.videoProvider || "runway");
  const characterVoice = characterPresets[input.characterVoice] || characterPresets.narrator;

  return {
    assetProvider,
    sceneEngine,
    voiceProvider,
    videoProvider,
    assembly: toolCatalog.assembly[0],
    characterVoice,
    brief: input.brief?.trim() || "Create a 9:16 TikTok-ready product video with voiceover.",
    stages: statusOrder.map((status) => ({
      status,
      label: statusLabels[status],
      tool: workflowToolLabel(status, { assetProvider, sceneEngine, voiceProvider, videoProvider })
    }))
  };
}

function workflowToolLabel(status, workflow) {
  return {
    queued: "API Server + Redis",
    scripting: "Script planner",
    generating_assets: workflow.assetProvider.name,
    building_scene: workflow.sceneEngine.name,
    generating_voice: workflow.voiceProvider.name,
    generating_video: workflow.videoProvider.id === "none" ? "Skipped" : workflow.videoProvider.name,
    compositing: "FFmpeg",
    stored: "S3/R2",
    awaiting_review: "Client dashboard",
    approved: "Approval gate",
    uploading_to_tiktok: "TikTok Upload API",
    draft_created: "TikTok Draft Inbox"
  }[status];
}

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
        "Meshy generated product turntable asset",
        "Blender Python rendered controlled camera move",
        "ElevenLabs generated warm narrator voice",
        "FFmpeg vertical encode complete",
        "Final MP4 stored in R2"
      ],
      workflow: createWorkflow({
        assetProvider: "meshy",
        voiceProvider: "elevenlabs",
        videoProvider: "runway",
        characterVoice: "narrator",
        brief: "Launch video with a bottle spin, upbeat narrator, and cinematic AI background insert."
      })
    },
    {
      id: "job-1028",
      projectId: "proj-cafe",
      title: "Grand opening espresso scene",
      status: "building_scene",
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
      ],
      workflow: createWorkflow({
        assetProvider: "manual",
        voiceProvider: "cartesia",
        videoProvider: "luma",
        characterVoice: "founder",
        brief: "Cafe opening teaser with founder-style voice and warm storefront motion insert."
      })
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
      { name: "Meshy", detail: "3D asset generation and retexture", status: active.length ? "busy" : "idle" },
      { name: "Blender Python", detail: "Scene assembly, lighting, camera, render", status: active.length ? "busy" : "idle" },
      { name: "ElevenLabs / Cartesia", detail: "Character voices and dialogue", status: active.length ? "busy" : "idle" },
      { name: "Runway / Luma", detail: "Optional generative video inserts", status: active.length ? "busy" : "idle" },
      { name: "FFmpeg", detail: "Audio mix, captions, encode, final MP4", status: active.length ? "busy" : "idle" },
      { name: "TikTok Upload API", detail: "Approved MP4 to creator draft inbox", status: "healthy" }
    ],
    pipeline: statusOrder.map((status) => ({ status, label: statusLabels[status] })),
    toolCatalog
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
    ["scripting", 14, "Script planner created shot list and dialogue beats"],
    ["generating_assets", 27, `${job.workflow.assetProvider.name} prepared 3D assets`],
    ["building_scene", 43, "Blender Python assembled scene, lights, camera path, and render settings"],
    ["generating_voice", 58, `${job.workflow.voiceProvider.name} generated ${job.workflow.characterVoice} voice audio`],
    ["generating_video", 70, job.workflow.videoProvider.id === "none" ? "AI video insert skipped for pure Blender render" : `${job.workflow.videoProvider.name} generated cinematic insert`],
    ["compositing", 84, "FFmpeg mixed voice, captions, music, and vertical MP4 encode"],
    ["stored", 94, "Final MP4 stored in R2"],
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
    logs: ["Queued from API server"],
    workflow: createWorkflow(input)
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
