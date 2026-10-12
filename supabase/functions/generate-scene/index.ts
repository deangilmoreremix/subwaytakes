import { buildCorsHeaders, handleOptions, HttpError, jsonResponse } from "../_shared/cors.ts";
import { requireUser, serviceClient } from "../_shared/auth.ts";
import { assertProjectOwnership } from "../_shared/ownership.ts";
import {
  isRetryableMuapiError,
  MuapiError,
  muapiSubmit,
  muapiVideoRequest,
  type MuapiVideoModel,
} from "../_shared/muapi.ts";

/**
 * generate-scene — submit a MuAPI text-to-video job for one interview beat.
 *
 * POST /functions/v1/generate-scene
 * Body: { project_id, beat_id, prompt, model?: "veo3"|"seedance"|"kling", shot_type? }
 * 200: { request_id, beat_id }   (the client polls scene-status)
 * 400: validation errors, 404: project not found / not owned by caller,
 * 500: MuAPI submission failed after retries (upstream message surfaced)
 */

export const BEAT_IDS = [
  "opening_hook",
  "interviewer_intro",
  "guest_responds",
  "interviewer_challenges",
  "guest_expands",
  "reaction_moment",
  "closing_statement",
] as const;

const SHOT_TYPES = ["host", "guest", "two_shot", "reaction", "environment"] as const;
export const MUAPI_MODELS: MuapiVideoModel[] = ["veo3", "seedance", "kling"];

export const SUBMIT_ATTEMPTS = 4;
export const SUBMIT_BACKOFF_MS = [1000, 2000, 4000];

export interface GenerateSceneRequest {
  project_id: string;
  beat_id: string;
  prompt: string;
  model?: MuapiVideoModel;
  shot_type?: string;
}

export type ParseResult =
  | {
      ok: true;
      value: {
        projectId: string;
        beatId: typeof BEAT_IDS[number];
        prompt: string;
        model: MuapiVideoModel;
        shotType?: string;
      };
    }
  | { ok: false; error: string };

export function parseGenerateSceneRequest(body: GenerateSceneRequest): ParseResult {
  const { project_id: projectId, beat_id: beatId, prompt, model, shot_type: shotType } = body;

  if (!projectId || typeof projectId !== "string") {
    return { ok: false, error: "project_id is required" };
  }
  if (!beatId || typeof beatId !== "string" || !BEAT_IDS.includes(beatId as typeof BEAT_IDS[number])) {
    return { ok: false, error: `beat_id is required and must be one of: ${BEAT_IDS.join(", ")}` };
  }
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return { ok: false, error: "prompt is required" };
  }
  if (prompt.length > 10000) {
    return { ok: false, error: "prompt exceeds maximum length of 10000 characters" };
  }
  if (model !== undefined && !MUAPI_MODELS.includes(model)) {
    return { ok: false, error: `Invalid model. Must be one of: ${MUAPI_MODELS.join(", ")}` };
  }
  if (shotType !== undefined && !SHOT_TYPES.includes(shotType as typeof SHOT_TYPES[number])) {
    return { ok: false, error: `Invalid shot_type. Must be one of: ${SHOT_TYPES.join(", ")}` };
  }

  return {
    ok: true,
    value: {
      projectId,
      beatId: beatId as typeof BEAT_IDS[number],
      prompt: prompt.trim(),
      model: model ?? "veo3",
      ...(shotType ? { shotType } : {}),
    },
  };
}

/** MuAPI text-to-video request for one beat: vertical 9:16, 5s default. */
export function buildSceneMuapiRequest(
  model: MuapiVideoModel,
  prompt: string,
): { endpoint: string; payload: Record<string, unknown> } {
  return muapiVideoRequest(model, prompt, { aspectRatio: "9:16", durationSec: 5 });
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface SubmitRetryOptions {
  submit?: (endpoint: string, payload: Record<string, unknown>) => Promise<string>;
  sleep?: (ms: number) => Promise<void>;
}

/** Submit with up to 3 retries (1s/2s/4s backoff) on network errors and 5xx. */
export async function submitWithRetries(
  endpoint: string,
  payload: Record<string, unknown>,
  options: SubmitRetryOptions = {},
): Promise<string> {
  const submit = options.submit ?? muapiSubmit;
  const sleep = options.sleep ?? defaultSleep;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < SUBMIT_ATTEMPTS; attempt++) {
    try {
      return await submit(endpoint, payload);
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === SUBMIT_ATTEMPTS - 1;
      if (isLastAttempt || !isRetryableMuapiError(error)) {
        throw error;
      }
      console.error(
        `MuAPI submit failed (attempt ${attempt + 1}/${SUBMIT_ATTEMPTS}), retrying:`,
        error instanceof Error ? error.message : error,
      );
      await sleep(SUBMIT_BACKOFF_MS[attempt]);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new MuapiError("MuAPI submission failed");
}

export async function handleGenerateSceneRequest(req: Request): Promise<Response> {
  const cors = buildCorsHeaders(req.headers.get("Origin"));

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  try {
    const { userId } = await requireUser(req);

    let body: GenerateSceneRequest;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400, cors);
    }

    const parsed = parseGenerateSceneRequest(body);
    if (!parsed.ok) {
      return jsonResponse({ error: parsed.error }, 400, cors);
    }
    const { projectId, beatId, prompt, model } = parsed.value;

    const supabase = serviceClient();
    await assertProjectOwnership(supabase, projectId, userId);

    const { endpoint, payload } = buildSceneMuapiRequest(model, prompt);

    const requestId = await submitWithRetries(endpoint, payload);

    return jsonResponse({ request_id: requestId, beat_id: beatId }, 200, cors);
  } catch (error) {
    console.error("Generate scene error:", error);
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message }, error.status, cors);
    }
    const message = error instanceof Error && error.message ? error.message : "Scene generation failed";
    return jsonResponse({ error: message }, 500, cors);
  }
}

Deno.serve(handleGenerateSceneRequest);
