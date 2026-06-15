import { statusLabels, statusOrder, toolCatalog } from "./catalog.js";
import { costAssumptions, estimateCost } from "./costs.js";
import { createWorkflow } from "./workflow.js";

export function createAppService({ store, connectors, emit }) {
  const jobTimers = new Map();

  function enrichJob(job) {
    const project = store.listProjects().find((item) => item.id === job.projectId);
    return {
      ...job,
      project,
      statusLabel: statusLabels[job.status] || job.status,
      pipelineIndex: Math.max(0, statusOrder.indexOf(job.status)),
      costEstimate: estimateCost(job.workflow)
    };
  }

  function dashboardPayload() {
    const jobs = store
      .listJobs()
      .map(enrichJob)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const active = jobs.filter((job) => !["awaiting_review", "draft_created", "failed"].includes(job.status));

    return {
      projects: store.listProjects(),
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
      connectors: connectors.list(),
      costAssumptions
    };
  }

  function createJob(input) {
    const job = store.insertJob(input);
    emit("dashboard", dashboardPayload());
    setTimeout(() => {
      job.worker = `gpu-render-0${Math.ceil(Math.random() * 2)}`;
      simulateRender(job);
    }, 900);
    return enrichJob(job);
  }

  function approveJob(jobId) {
    const job = store.findJob(jobId);
    if (!job || job.status !== "awaiting_review") return null;
    setJobStatus(job, "approved", 100, "Client approved final MP4");
    setTimeout(() => setJobStatus(job, "uploading_to_tiktok", 100, "TikTok Upload API request started"), 700);
    setTimeout(() => {
      job.tiktokDraftId = `draft_${Math.random().toString(16).slice(2, 10)}`;
      setJobStatus(job, "draft_created", 100, "TikTok draft delivered to creator inbox");
    }, 2200);
    return enrichJob(job);
  }

  function setJobStatus(job, status, progress, line) {
    job.status = status;
    job.progress = progress;
    if (status === "stored") {
      job.storageKey = `r2://renders/${job.id}/final.mp4`;
      job.duration = "00:24";
    }
    store.appendLog(job, line);
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

  return {
    dashboardPayload,
    createJob,
    approveJob,
    estimate(input) {
      return estimateCost(createWorkflow(input));
    },
    storyboard(input) {
      return createWorkflow(input).storyboard;
    },
    connect(id, secret) {
      const connector = connectors.upsert(id, secret);
      if (connector) emit("dashboard", dashboardPayload());
      return connector;
    },
    disconnect(id) {
      const connector = connectors.remove(id);
      if (connector) emit("dashboard", dashboardPayload());
      return connector;
    },
    health() {
      return {
        ok: true,
        service: "render-pipeline-dashboard",
        time: new Date().toISOString()
      };
    },
    readiness() {
      return {
        ok: true,
        mode: "memory",
        checks: {
          database: "memory",
          queue: "memory",
          storage: "simulated"
        }
      };
    }
  };
}
