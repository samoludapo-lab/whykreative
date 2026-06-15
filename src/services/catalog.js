export const statusOrder = [
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

export const statusLabels = {
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

export const toolCatalog = {
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

export const characterPresets = {
  narrator: "Warm narrator",
  founder: "Founder / presenter",
  customer: "Customer testimonial",
  duo: "Two-character dialogue"
};

export const stylePresets = {
  cinematic_product: "Cinematic product reveal",
  futuristic_studio: "Futuristic studio",
  luxury_minimal: "Luxury minimal",
  playful_social: "Playful social ad",
  warm_lifestyle: "Warm lifestyle scene"
};

export const sceneMoodPresets = {
  premium: "Premium and polished",
  energetic: "Energetic and fast",
  calm: "Calm and elegant",
  dramatic: "Dramatic reveal",
  playful: "Playful and bright"
};

export const connectorDefinitions = [
  { id: "meshy", name: "Meshy", env: "MESHY_API_KEY", category: "3D assets", docs: "https://docs.meshy.ai/en/" },
  { id: "tripo", name: "Tripo", env: "TRIPO_API_KEY", category: "3D assets", docs: "https://www.tripo3d.ai/" },
  { id: "elevenlabs", name: "ElevenLabs", env: "ELEVENLABS_API_KEY", category: "Character voice", docs: "https://elevenlabs.io/docs" },
  { id: "cartesia", name: "Cartesia", env: "CARTESIA_API_KEY", category: "Character voice", docs: "https://docs.cartesia.ai/" },
  { id: "runway", name: "Runway", env: "RUNWAY_API_KEY", category: "AI video", docs: "https://runwayml.com/" },
  { id: "luma", name: "Luma", env: "LUMA_API_KEY", category: "AI video", docs: "https://lumalabs.ai/api" },
  { id: "r2", name: "S3/R2 Storage", env: "S3_OR_R2_ACCESS_KEY", category: "Storage", docs: "https://developers.cloudflare.com/r2/" },
  { id: "tiktok", name: "TikTok Upload API", env: "TIKTOK_CLIENT_ID", category: "Distribution", docs: "https://developers.tiktok.com/" }
];
