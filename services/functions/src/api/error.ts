import { HTTPException } from "hono/http-exception";

export class RequestValidationError extends HTTPException {
  constructor(message: string) {
    super(400, {
      message,
    });
  }
}
