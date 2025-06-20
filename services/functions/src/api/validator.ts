import { z } from "zod";
import { RequestValidationError } from "./error";

export const validateRequestData = async <T extends z.ZodType>(
  schema: T,
  data: unknown
): Promise<z.infer<T>> => {
  const result = await schema.safeParseAsync(data);

  if (!result.success) {
    throw new RequestValidationError(result.error.message);
  }

  return result.data;
};
