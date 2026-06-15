import { cleanText, enumValue } from "../services/sanitize.js";
import { createWorkflow } from "../services/workflow.js";

export function createMemoryStore() {
  const db = seedDatabase();

  return {
    listProjects() {
      return db.projects;
    },
    listJobs() {
      return db.jobs;
    },
    findJob(id) {
      return db.jobs.find((item) => item.id === id);
    },
    insertJob(input) {
      const project = db.projects.find((item) => item.id === input.projectId) || db.projects[0];
      const job = {
        id: `job-${Math.floor(2000 + Math.random() * 7000)}`,
        projectId: project.id,
        title: cleanText(input.title, 120, "Untitled render"),
        status: "queued",
        progress: 5,
        priority: enumValue(input.priority, ["Normal", "High", "Rush"], "Normal"),
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
      return job;
    },
    appendLog(job, line) {
      job.logs.push(line);
      job.updatedAt = new Date().toISOString();
    }
  };
}

function seedDatabase() {
  return {
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
}
