import { APICallError } from "ai";

/**
 * The AI SDK collapses provider HTTP failures into a generic message (e.g.
 * "Forbidden") that hides the actual reason OpenAI's backend rejected the
 * request. `APICallError` carries the real status + response body — surface
 * that instead so failures are actually diagnosable.
 */
export function describeGenerationError(err: unknown): string {
  if (APICallError.isInstance(err)) {
    const detail = err.responseBody?.trim();
    return detail ? `${err.message} (${err.statusCode}): ${detail}` : `${err.message} (${err.statusCode})`;
  }
  if (err instanceof Error) return err.message;
  return "Generation failed";
}
