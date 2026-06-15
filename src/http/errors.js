export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function errorResponse(error) {
  const status = error instanceof HttpError ? error.status : 500;
  return {
    status,
    body: {
      error: status === 500 ? "Internal server error" : error.message
    }
  };
}
