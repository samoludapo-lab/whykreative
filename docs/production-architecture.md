# Production Architecture

## Services

```text
Web/API app
  -> PostgreSQL for durable app data
  -> Redis for render/upload queues
  -> S3/R2 for assets, previews, final MP4s, worker artifacts
  -> Provider APIs for Meshy, ElevenLabs, optional video insert tools

Render worker
  -> reads Redis queue
  -> calls Meshy/Tripo and downloads assets
  -> runs Blender Python
  -> calls ElevenLabs/Cartesia for voices
  -> runs FFmpeg
  -> uploads final MP4 to S3/R2
  -> reports status back to API/Postgres
```

## Production Cut Lines

The current app is production-shaped but still uses an in-memory repository and simulated worker. Replace these pieces in order:

1. `src/repositories/memoryStore.js` with a PostgreSQL repository.
2. `src/services/appService.js` render simulation with Redis queue enqueueing.
3. Provider connector cards with encrypted secret storage.
4. Worker adapter implementations under `src/adapters`.
5. S3/R2 upload/download service.
6. TikTok OAuth and upload flow.

## Required Production Controls

- User authentication and workspace authorization.
- Encrypted provider secrets.
- Database migrations and backups.
- Redis retry/dead-letter queues.
- Worker sandboxing for Blender/FFmpeg.
- Upload file validation and malware scanning.
- Rate limiting and audit logs.
- Observability: logs, traces, metrics, job artifacts.
