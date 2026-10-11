import { HttpError } from "./cors.ts";

/**
 * OpenAI Responses API client with json_schema (strict) structured outputs.
 * The fetch implementation is injectable so tests can stub the provider.
 */

export type OpenAIFetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface OpenAIResponsesRequest {
  schemaName: string;
  schema: Record<string, unknown>;
  input: string;
  /** Optional system-level instruction (Responses API `instructions`). */
  instructions?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: OpenAIFetch;
}

export async function callOpenAIResponses(
  request: OpenAIResponsesRequest,
): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new HttpError(500, "OPENAI_API_KEY is not configured");
  }

  const model = request.model || Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
  const fetchImpl = request.fetchImpl ?? (globalThis.fetch as OpenAIFetch);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), request.timeoutMs ?? 60000);

  let response: Response;
  try {
    response = await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: request.input,
        ...(request.instructions ? { instructions: request.instructions } : {}),
        text: {
          format: {
            type: "json_schema",
            name: request.schemaName,
            schema: request.schema,
            strict: true,
          },
        },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    clearTimeout(timer);
    throw new HttpError(500, `OpenAI request failed: ${message}`);
  }
  clearTimeout(timer);

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new HttpError(
      500,
      `OpenAI API error: ${response.status}${detail ? ` - ${detail.slice(0, 500)}` : ""}`,
    );
  }

  const data = await response.json().catch(() => null) as Record<string, unknown> | null;
  const content = extractResponseText(data);
  if (!content) {
    throw new HttpError(500, "OpenAI response contained no content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new HttpError(500, "OpenAI response was not valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new HttpError(500, "OpenAI response was not a JSON object");
  }

  return parsed as Record<string, unknown>;
}

/** Pull the model text out of a Responses API payload. */
function extractResponseText(data: Record<string, unknown> | null): string {
  if (!data) return "";
  const direct = data.output_text;
  if (typeof direct === "string" && direct.length > 0) return direct;

  const output = data.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (!item || typeof item !== "object") continue;
      const content = (item as Record<string, unknown>).content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if (!part || typeof part !== "object") continue;
        const text = (part as Record<string, unknown>).text;
        if (typeof text === "string" && text.length > 0) return text;
      }
    }
  }

  return "";
}
