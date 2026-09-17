import { z } from "zod";
import { ValidationError } from "./errors.js";

export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new ValidationError("request validation failed", {
      issues: z.flattenError(result.error).fieldErrors,
    });
  }

  return result.data;
}
