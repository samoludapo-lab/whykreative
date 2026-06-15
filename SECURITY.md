# Security Notes

This prototype includes basic hardening for local development:

- JSON request bodies are limited to 64 KB.
- Malformed JSON returns `400` instead of an internal error.
- Oversized JSON returns `413`.
- Static file serving blocks path traversal outside `public/`.
- API/static responses include browser security headers.
- User-authored workflow/storyboard strings are normalized, length-limited, and stripped of HTML delimiter characters before being stored in job/storyboard data.
- Select-style provider, render, format, and scene options use allowlists with safe fallbacks.
- Connector secrets are not returned by the API; the prototype only stores connection status and a masked last-four indicator in memory.
- Frontend rendering escapes dynamic HTML and uses `textContent` for the JSON storyboard preview.

Production still needs:

- Real authentication and authorization.
- CSRF protection if cookie-based sessions are used.
- Encrypted secret storage for provider API keys.
- Persistent database-level validation.
- Rate limiting and audit logs.
- Worker sandboxing before running Blender/FFmpeg jobs from user-authored storyboard data.
- Malware scanning and type validation for uploaded assets.
