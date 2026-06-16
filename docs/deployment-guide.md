# Cloud Deployment Guide

This app is a containerized Node web/API service with separate production dependencies for PostgreSQL, Redis, object storage, provider APIs, and a GPU render worker.

## Recommended First Deployment

Use Render, Railway, Fly.io, or Google Cloud Run for the web/API container. Use a GPU provider such as RunPod, Lambda Labs, AWS/GCP GPU VMs, or another GPU worker platform for Blender rendering.

The web/API service should run separately from the GPU render worker:

```text
Browser
  -> Web/API container
  -> PostgreSQL
  -> Redis queue
  -> R2/S3 storage
  -> GPU worker endpoint
  -> R2/S3 final MP4
```

## Required Before Production

1. Push the repo to GitHub.
2. Create managed PostgreSQL.
3. Create managed Redis or Valkey.
4. Create Cloudflare R2 or AWS S3 bucket.
5. Add production secrets from `.env.example`.
6. Deploy the web/API container.
7. Deploy the GPU render worker separately.
8. Wire the adapter implementations in `src/adapters`.

## Environment Variables

Set these on the cloud service, not in git:

```text
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
APP_BASE_URL=https://your-domain.com
DATABASE_URL=postgres://...
REDIS_URL=redis://...
SESSION_SECRET=generate-a-strong-32-character-secret
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_BUCKET=your-bucket
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_BASE_URL=https://media.your-domain.com
MESHY_API_KEY=...
ELEVENLABS_API_KEY=...
TIKTOK_CLIENT_ID=...
TIKTOK_CLIENT_SECRET=...
```

## Render Deployment

Render is the simplest first production host for this app.

1. Fix GitHub access and push the repo.
2. In Render, create a new Web Service from the GitHub repo.
3. Choose Docker as the runtime.
4. Set the health check path to `/healthz`.
5. Add a managed Postgres database.
6. Add Redis/Valkey.
7. Add the environment variables above.
8. Deploy.

After deploy, check:

```text
https://your-render-url/healthz
https://your-render-url/readyz
```

## Railway Deployment

Railway is also a good fit for an early build.

1. Create a new Railway project from GitHub.
2. Add the app service from this repo.
3. Add PostgreSQL.
4. Add Redis.
5. Add the same environment variables.
6. Deploy from the Dockerfile.

## Google Cloud Run Deployment

Use this if you want a more standard cloud setup.

```bash
gcloud run deploy whykreative-api --source .
```

Then configure:

```text
Cloud SQL for PostgreSQL
Memorystore or external Redis
Cloud Storage or Cloudflare R2
Secret Manager
```

Cloud Run is best for the web/API container. Long Blender renders should run as Cloud Run Jobs with GPU support, a GPU VM, or an external GPU worker.

## GPU Worker Deployment

The worker should be a separate Docker image that includes:

```text
Blender
Python render scripts
FFmpeg
Provider clients
Queue consumer
Storage upload client
```

It should:

1. Pull jobs from Redis.
2. Download/generated Meshy assets.
3. Build the Blender scene from storyboard JSON.
4. Render frames/video.
5. Generate ElevenLabs character voice.
6. Assemble final MP4 with FFmpeg.
7. Upload the final MP4 and reusable assets to R2/S3.
8. Update the job status in PostgreSQL.

## Production Notes

The current app still uses in-memory storage and simulated rendering. The deploy will run, but real production behavior needs the Postgres repository, Redis queue, storage adapter, provider adapters, auth, billing/rate limits, and TikTok OAuth implementation.

