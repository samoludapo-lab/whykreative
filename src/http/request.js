import { HttpError } from "./errors.js";

export async function readRequestJson(req, maxJsonBytes) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > maxJsonBytes) {
      throw new HttpError(413, "Request body is too large");
    }
  }
  if (!body) return {};

  try {
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new HttpError(400, "Request body must be a JSON object");
    }
    return parsed;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Malformed JSON request body");
  }
}
