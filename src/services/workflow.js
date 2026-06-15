import {
  characterPresets,
  sceneMoodPresets,
  statusLabels,
  statusOrder,
  stylePresets,
  toolCatalog
} from "./catalog.js";
import { clampNumber, cleanText, enumValue, splitList } from "./sanitize.js";

export function createWorkflow(input = {}) {
  const assetProvider = findTool("assetProviders", enumValue(input.assetProvider, ["meshy", "tripo", "manual"], "meshy"));
  const sceneEngine = findTool("sceneEngines", "blender");
  const voiceProvider = findTool("voiceProviders", enumValue(input.voiceProvider, ["elevenlabs", "cartesia"], "elevenlabs"));
  const videoProvider = findTool("videoProviders", enumValue(input.videoProvider, ["runway", "luma", "none"], "runway"));
  const characterVoice = characterPresets[enumValue(input.characterVoice, Object.keys(characterPresets), "narrator")];

  return {
    assetProvider,
    sceneEngine,
    voiceProvider,
    videoProvider,
    assembly: toolCatalog.assembly[0],
    characterVoice,
    brief: cleanText(input.brief, 900, "Create a 9:16 TikTok-ready product video with voiceover."),
    spec: normalizeRunSpec(input),
    storyboard: createStoryboard(input, { assetProvider, sceneEngine, voiceProvider, videoProvider, characterVoice }),
    stages: statusOrder.map((status) => ({
      status,
      label: statusLabels[status],
      tool: workflowToolLabel(status, { assetProvider, sceneEngine, voiceProvider, videoProvider })
    }))
  };
}

export function createStoryboard(input = {}, workflow) {
  const spec = normalizeRunSpec(input);
  const sceneCount = clampNumber(input.sceneCount, 1, 6, 3);
  const secondsPerScene = Math.max(2, Math.round(spec.durationSeconds / sceneCount));
  const title = cleanText(input.title, 120, "Untitled render");
  const primarySubject = cleanText(input.primarySubject, 160, "hero product");
  const backgroundPrompt = cleanText(input.backgroundPrompt, 900, "premium studio background with depth, reflections, and subtle atmosphere");
  const assetPrompt = cleanText(input.assetPrompt, 700, `${primarySubject}, production-ready 3D model, clean topology, realistic materials`);
  const visualStyle = stylePresets[enumValue(input.visualStyle, Object.keys(stylePresets), "cinematic_product")];
  const mood = sceneMoodPresets[enumValue(input.sceneMood, Object.keys(sceneMoodPresets), "premium")];
  const voiceText = cleanText(input.voiceText, 1200, `Introducing ${primarySubject}. Built to stand out in every scene.`);

  return {
    video: {
      title,
      format: enumValue(input.format, ["9:16", "1:1", "16:9"], "9:16"),
      durationSeconds: spec.durationSeconds,
      fps: clampNumber(input.fps, 24, 60, 30),
      resolution: enumValue(input.resolution, ["1080x1920", "1440x2560", "2160x3840"], "1080x1920"),
      visualStyle,
      mood,
      targetPlatform: "TikTok"
    },
    creative: {
      prompt: cleanText(input.prompt, 1200, cleanText(input.brief, 900, "Create a polished short 3D social video.")),
      primarySubject,
      brandWords: splitList(input.brandWords || "premium, clear, memorable", 8),
      colorPalette: splitList(input.colorPalette || "deep green, soft white, graphite, accent blue", 8),
      backgroundPrompt,
      negativePrompt: cleanText(input.negativePrompt, 700, "low quality, warped text, broken geometry, flicker, cluttered scene")
    },
    assets: [
      {
        id: "asset_hero",
        type: workflow.assetProvider.id === "manual" ? "uploaded_3d" : "generated_3d",
        provider: workflow.assetProvider.name,
        prompt: assetPrompt,
        placement: cleanText(input.assetPlacement, 220, "center hero object on reflective platform"),
        scale: cleanText(input.assetScale, 120, "medium hero scale"),
        material: cleanText(input.materialStyle, 220, "brushed premium material with subtle bevels")
      }
    ],
    blender: {
      sceneTemplate: enumValue(
        input.sceneTemplate,
        ["studio_turntable_reveal", "floating_gallery", "kinetic_feature_breakdown", "environmental_lifestyle"],
        "studio_turntable_reveal"
      ),
      environment: backgroundPrompt,
      cameraMove: cleanText(input.cameraMove, 220, "slow dolly-in with orbit reveal"),
      lens: cleanText(input.cameraLens, 120, "50mm cinematic product lens"),
      lighting: {
        setup: cleanText(input.lightingSetup, 260, "large softbox key, rim light, controlled fill, contact shadows"),
        mood,
        atmosphere: cleanText(input.atmosphere, 260, "subtle volumetric haze and glossy floor reflections")
      },
      animation: {
        subjectMotion: cleanText(input.subjectMotion, 260, "slow 360 turntable with gentle scale emphasis on reveal beats"),
        backgroundMotion: cleanText(input.backgroundMotion, 260, "slow parallax panels and light sweep"),
        transitionStyle: cleanText(input.transitionStyle, 260, "match cuts with motion blur and clean light wipes")
      },
      render: {
        engine: enumValue(input.renderEngine, ["Cycles", "Eevee Next"], "Cycles"),
        samples: clampNumber(input.samples, 32, 1024, 128),
        motionBlur: input.motionBlur !== "off",
        depthOfField: input.depthOfField !== "off",
        colorManagement: cleanText(input.colorManagement, 160, "Filmic high contrast look")
      }
    },
    scenes: Array.from({ length: sceneCount }, (_, index) =>
      createScene(index, sceneCount, secondsPerScene, input, workflow, {
        primarySubject,
        backgroundPrompt,
        voiceText
      })
    ),
    voice: {
      provider: workflow.voiceProvider.name,
      character: workflow.characterVoice,
      direction: cleanText(input.voiceDirection, 260, "confident, warm, creator-friendly, natural pacing"),
      script: voiceText
    },
    assembly: {
      captions: input.captions !== "off",
      captionStyle: cleanText(input.captionStyle, 220, "bold lower-third captions with safe margins"),
      music: cleanText(input.musicPrompt, 220, "upbeat minimal electronic bed"),
      sfx: cleanText(input.sfxPrompt, 220, "soft whooshes, camera hits, clean reveal accents"),
      export: "mp4_1080x1920"
    }
  };
}

export function normalizeRunSpec(input = {}) {
  return {
    durationSeconds: clampNumber(input.durationSeconds, 6, 120, 24),
    assetCount: clampNumber(input.assetCount, 0, 12, 2),
    voiceMinutes: clampNumber(input.voiceMinutes, 0, 10, 0.5),
    aiVideoSeconds: clampNumber(input.aiVideoSeconds, 0, 60, input.videoProvider === "none" ? 0 : 5),
    blenderMinutes: clampNumber(input.blenderMinutes, 1, 240, 12)
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
    camera: index === 0
      ? cleanText(input.openingCamera, 220, "fast push-in from wide to hero angle")
      : cleanText(input.cameraMove, 220, "slow orbit with controlled parallax"),
    lighting: cleanText(input.lightingSetup, 260, "softbox key, rim light, controlled fill, contact shadows"),
    animation: finalScene
      ? cleanText(input.finalAnimation, 260, "hero lockup, logo-safe pause, subtle glow pulse")
      : cleanText(input.subjectMotion, 260, "turntable reveal with light sweep"),
    voice: {
      character: workflow.characterVoice,
      text: finalScene ? cleanText(input.ctaText, 220, "Ready to make it yours?") : context.voiceText
    },
    captions: input.captions !== "off",
    blenderNotes: [
      `Use ${cleanText(input.materialStyle, 220, "premium reflective material")} on hero asset`,
      `Keep subject framed in ${enumValue(input.format, ["9:16", "1:1", "16:9"], "9:16")} safe area`,
      `Avoid ${cleanText(input.negativePrompt, 700, "clutter, broken geometry, flicker")}`
    ]
  };
}

function findTool(group, id) {
  return toolCatalog[group].find((tool) => tool.id === id) || toolCatalog[group][0];
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
