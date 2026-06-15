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

const stylePresets = {
  cinematic_product: "Cinematic product reveal",
  futuristic_studio: "Futuristic studio",
  luxury_minimal: "Luxury minimal",
  playful_social: "Playful social ad",
  warm_lifestyle: "Warm lifestyle scene"
};

const sceneMoodPresets = {
  premium: "Premium and polished",
  energetic: "Energetic and fast",
  calm: "Calm and elegant",
  dramatic: "Dramatic reveal",
  playful: "Playful and bright"
};

const connectorDefinitions = [
  { id: "meshy", name: "Meshy", env: "MESHY_API_KEY", category: "3D assets", docs: "https://docs.meshy.ai/en/" },
  { id: "tripo", name: "Tripo", env: "TRIPO_API_KEY", category: "3D assets", docs: "https://www.tripo3d.ai/" },
  { id: "elevenlabs", name: "ElevenLabs", env: "ELEVENLABS_API_KEY", category: "Character voice", docs: "https://elevenlabs.io/docs" },
  { id: "cartesia", name: "Cartesia", env: "CARTESIA_API_KEY", category: "Character voice", docs: "https://docs.cartesia.ai/" },
  { id: "runway", name: "Runway", env: "RUNWAY_API_KEY", category: "AI video", docs: "https://runwayml.com/" },
  { id: "luma", name: "Luma", env: "LUMA_API_KEY", category: "AI video", docs: "https://lumalabs.ai/api" },
  { id: "r2", name: "S3/R2 Storage", env: "S3_OR_R2_ACCESS_KEY", category: "Storage", docs: "https://developers.cloudflare.com/r2/" },
  { id: "tiktok", name: "TikTok Upload API", env: "TIKTOK_CLIENT_ID", category: "Distribution", docs: "https://developers.tiktok.com/" }
];

const connectorState = Object.fromEntries(
  connectorDefinitions.map((connector) => [
    connector.id,
    {
      connected: Boolean(process.env[connector.env]),
      source: process.env[connector.env] ? "env" : null,
      last4: process.env[connector.env] ? "env" : null,
      updatedAt: null
    }
  ])
);

const costAssumptions = {
  meshyCreditUsd: 0.02,
  meshyCreditsPerAsset: 30,
  tripoUsdPerAsset: 0.6,
  blenderGpuUsdPerMinute: 0.08,
  elevenLabsUsdPerMinute: 0.18,
  cartesiaUsdPerMinute: 0.03,
  runwayUsdPerSecond: 0.048,
  lumaCreditUsd: 0.01,
  lumaCreditsPerSecond720p: 20,
  ffmpegUsdPerRun: 0.02,
  storageUsdPerRun: 0.01
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
    spec: normalizeRunSpec(input),
    storyboard: createStoryboard(input, { assetProvider, sceneEngine, voiceProvider, videoProvider, characterVoice }),
    stages: statusOrder.map((status) => ({
      status,
      label: statusLabels[status],
      tool: workflowToolLabel(status, { assetProvider, sceneEngine, voiceProvider, videoProvider })
    }))
  };
}

function createStoryboard(input = {}, workflow) {
  const spec = normalizeRunSpec(input);
  const sceneCount = clampNumber(input.sceneCount, 1, 6, 3);
  const secondsPerScene = Math.max(2, Math.round(spec.durationSeconds / sceneCount));
  const title = input.title?.trim() || "Untitled render";
  const primarySubject = input.primarySubject?.trim() || "hero product";
  const backgroundPrompt = input.backgroundPrompt?.trim() || "premium studio background with depth, reflections, and subtle atmosphere";
  const assetPrompt = input.assetPrompt?.trim() || `${primarySubject}, production-ready 3D model, clean topology, realistic materials`;
  const visualStyle = stylePresets[input.visualStyle] || stylePresets.cinematic_product;
  const mood = sceneMoodPresets[input.sceneMood] || sceneMoodPresets.premium;
  const voiceText = input.voiceText?.trim() || `Introducing ${primarySubject}. Built to stand out in every scene.`;

  return {
    video: {
      title,
      format: input.format || "9:16",
      durationSeconds: spec.durationSeconds,
      fps: clampNumber(input.fps, 24, 60, 30),
      resolution: input.resolution || "1080x1920",
      visualStyle,
      mood,
      targetPlatform: "TikTok"
    },
    creative: {
      prompt: input.prompt?.trim() || input.brief?.trim() || "Create a polished short 3D social video.",
      primarySubject,
      brandWords: splitList(input.brandWords || "premium, clear, memorable"),
      colorPalette: splitList(input.colorPalette || "deep green, soft white, graphite, accent blue"),
      backgroundPrompt,
      negativePrompt: input.negativePrompt?.trim() || "low quality, warped text, broken geometry, flicker, cluttered scene"
    },
    assets: [
      {
        id: "asset_hero",
        type: workflow.assetProvider.id === "manual" ? "uploaded_3d" : "generated_3d",
        provider: workflow.assetProvider.name,
        prompt: assetPrompt,
        placement: input.assetPlacement || "center hero object on reflective platform",
        scale: input.assetScale || "medium hero scale",
        material: input.materialStyle || "brushed premium material with subtle bevels"
      }
    ],
    blender: {
      sceneTemplate: input.sceneTemplate || "studio_turntable_reveal",
      environment: backgroundPrompt,
      cameraMove: input.cameraMove || "slow dolly-in with orbit reveal",
      lens: input.cameraLens || "50mm cinematic product lens",
      lighting: {
        setup: input.lightingSetup || "large softbox key, rim light, controlled fill, contact shadows",
        mood,
        atmosphere: input.atmosphere || "subtle volumetric haze and glossy floor reflections"
      },
      animation: {
        subjectMotion: input.subjectMotion || "slow 360 turntable with gentle scale emphasis on reveal beats",
        backgroundMotion: input.backgroundMotion || "slow parallax panels and light sweep",
        transitionStyle: input.transitionStyle || "match cuts with motion blur and clean light wipes"
      },
      render: {
        engine: input.renderEngine || "Cycles",
        samples: clampNumber(input.samples, 32, 1024, 128),
        motionBlur: input.motionBlur !== "off",
        depthOfField: input.depthOfField !== "off",
        colorManagement: input.colorManagement || "Filmic high contrast look"
      }
    },
    scenes: Array.from({ length: sceneCount }, (_, index) => createScene(index, sceneCount, secondsPerScene, input, workflow, {
      primarySubject,
      assetPrompt,
      backgroundPrompt,
      voiceText
    })),
    voice: {
      provider: workflow.voiceProvider.name,
      character: workflow.characterVoice,
      direction: input.voiceDirection || "confident, warm, creator-friendly, natural pacing",
      script: voiceText
    },
    assembly: {
      captions: input.captions !== "off",
      captionStyle: input.captionStyle || "bold lower-third captions with safe margins",
      music: input.musicPrompt || "upbeat minimal electronic bed",
      sfx: input.sfxPrompt || "soft whooshes, camera hits, clean reveal accents",
      export: "mp4_1080x1920"
    }
  };
}

function createScene(index, sceneCount, secondsPerScene, input, workflow, context) {
  const finalScene = index === sceneCount - 1;
  const sceneLabels = ["Hook", "Build", "Proof", "Feature", "Close"];
  return {
    id: `scene_${String(index + 1).padStart(2, "0")}`,
    label: sceneLabels[index] || `Beat ${index + 1}`,
    durationSeconds: finalScene
      ? Math.max(2, clampNumber(input.durationSeconds, 6, 120, 24) - secondsPerScene * (sceneCount - 1))
      : secondsPerScene,
    description: finalScene
      ? `Final branded reveal of ${context.primarySubject} with clear call-to-action framing`
      : `${sceneLabels[index] || "Scene"} beat for ${context.primarySubject} in ${context.backgroundPrompt}`,
    assets: ["asset_hero"],
    camera: index === 0 ? input.openingCamera || "fast push-in from wide to hero angle" : input.cameraMove || "slow orbit with controlled parallax",
    lighting: input.lightingSetup || "softbox key, rim light, controlled fill, contact shadows",
    animation: finalScene ? input.finalAnimation || "hero lockup, logo-safe pause, subtle glow pulse" : input.subjectMotion || "turntable reveal with light sweep",
    voice: {
      character: workflow.characterVoice,
      text: finalScene ? input.ctaText || "Ready to make it yours?" : context.voiceText
    },
    captions: input.captions !== "off",
    blenderNotes: [
      `Use ${input.materialStyle || "premium reflective material"} on hero asset`,
      `Keep subject framed in ${input.format || "9:16"} safe area`,
      `Avoid ${input.negativePrompt || "clutter, broken geometry, flicker"}`
    ]
  };
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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

function normalizeRunSpec(input = {}) {
  return {
    durationSeconds: clampNumber(input.durationSeconds, 6, 120, 24),
    assetCount: clampNumber(input.assetCount, 0, 12, 2),
    voiceMinutes: clampNumber(input.voiceMinutes, 0, 10, 0.5),
    aiVideoSeconds: clampNumber(input.aiVideoSeconds, 0, 60, input.videoProvider === "none" ? 0 : 5),
    blenderMinutes: clampNumber(input.blenderMinutes, 1, 240, 12)
  };
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function estimateCost(workflow) {
  const spec = workflow.spec;
  const lineItems = [];

  if (workflow.assetProvider.id === "meshy") {
    lineItems.push({
      label: "Meshy 3D assets",
      detail: `${spec.assetCount} assets x ${costAssumptions.meshyCreditsPerAsset} credits`,
      usd: spec.assetCount * costAssumptions.meshyCreditsPerAsset * costAssumptions.meshyCreditUsd
    });
  } else if (workflow.assetProvider.id === "tripo") {
    lineItems.push({
      label: "Tripo 3D assets",
      detail: `${spec.assetCount} generated assets`,
      usd: spec.assetCount * costAssumptions.tripoUsdPerAsset
    });
  } else {
    lineItems.push({ label: "Uploaded assets", detail: "Client-provided models", usd: 0 });
  }

  lineItems.push({
    label: "Blender GPU render",
    detail: `${spec.blenderMinutes} GPU minutes`,
    usd: spec.blenderMinutes * costAssumptions.blenderGpuUsdPerMinute
  });

  lineItems.push({
    label: `${workflow.voiceProvider.name} voice`,
    detail: `${spec.voiceMinutes} generated audio minutes`,
    usd: spec.voiceMinutes * (workflow.voiceProvider.id === "cartesia" ? costAssumptions.cartesiaUsdPerMinute : costAssumptions.elevenLabsUsdPerMinute)
  });

  if (workflow.videoProvider.id === "runway") {
    lineItems.push({
      label: "Runway AI video insert",
      detail: `${spec.aiVideoSeconds} generated seconds`,
      usd: spec.aiVideoSeconds * costAssumptions.runwayUsdPerSecond
    });
  } else if (workflow.videoProvider.id === "luma") {
    lineItems.push({
      label: "Luma AI video insert",
      detail: `${spec.aiVideoSeconds} seconds x ${costAssumptions.lumaCreditsPerSecond720p} credits`,
      usd: spec.aiVideoSeconds * costAssumptions.lumaCreditsPerSecond720p * costAssumptions.lumaCreditUsd
    });
  } else {
    lineItems.push({ label: "AI video insert", detail: "Skipped", usd: 0 });
  }

  lineItems.push({ label: "FFmpeg assembly", detail: "Mix, captions, encode", usd: costAssumptions.ffmpegUsdPerRun });
  lineItems.push({ label: "S3/R2 storage", detail: "Assets and final MP4", usd: costAssumptions.storageUsdPerRun });

  const subtotal = lineItems.reduce((sum, item) => sum + item.usd, 0);
  return {
    currency: "USD",
    subtotal: roundMoney(subtotal),
    rangeLow: roundMoney(subtotal * 0.75),
    rangeHigh: roundMoney(subtotal * 1.35),
    lineItems: lineItems.map((item) => ({ ...item, usd: roundMoney(item.usd) })),
    assumptions: {
      ...costAssumptions,
      note: "Prototype estimate. Actual pricing depends on your provider plan, model, resolution, retries, and negotiated API terms."
    }
  };
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function connectorPayload() {
  return connectorDefinitions.map((connector) => ({
    ...connector,
    ...connectorState[connector.id]
  }));
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
    pipelineIndex: Math.max(0, statusOrder.indexOf(job.status)),
    costEstimate: estimateCost(job.workflow)
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
    toolCatalog,
    connectors: connectorPayload(),
    costAssumptions
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
    ["building_scene", 43, `Blender Python assembled ${job.workflow.storyboard.scenes.length} scenes with ${job.workflow.storyboard.blender.cameraMove}`],
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

    if (req.method === "POST" && url.pathname === "/api/estimate") {
      const input = await readRequestJson(req);
      return sendJson(res, 200, { estimate: estimateCost(createWorkflow(input)) });
    }

    if (req.method === "POST" && url.pathname === "/api/storyboard") {
      const input = await readRequestJson(req);
      return sendJson(res, 200, { storyboard: createWorkflow(input).storyboard });
    }

    const connectorMatch = url.pathname.match(/^\/api\/connectors\/([^/]+)$/);
    if (connectorMatch && req.method === "POST") {
      const connector = connectorDefinitions.find((item) => item.id === connectorMatch[1]);
      if (!connector) return notFound(res);
      const input = await readRequestJson(req);
      const secret = String(input.secret || "").trim();
      connectorState[connector.id] = {
        connected: Boolean(secret),
        source: secret ? "dashboard" : null,
        last4: secret ? secret.slice(-4) : null,
        updatedAt: new Date().toISOString()
      };
      emit("dashboard", dashboardPayload());
      return sendJson(res, 200, { connector: { ...connector, ...connectorState[connector.id] } });
    }

    if (connectorMatch && req.method === "DELETE") {
      const connector = connectorDefinitions.find((item) => item.id === connectorMatch[1]);
      if (!connector) return notFound(res);
      connectorState[connector.id] = { connected: false, source: null, last4: null, updatedAt: new Date().toISOString() };
      emit("dashboard", dashboardPayload());
      return sendJson(res, 200, { connector: { ...connector, ...connectorState[connector.id] } });
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
