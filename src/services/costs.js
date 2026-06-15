export const costAssumptions = {
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

export function estimateCost(workflow) {
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
