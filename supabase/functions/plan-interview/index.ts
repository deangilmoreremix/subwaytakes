import { buildCorsHeaders, handleOptions, HttpError, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { callOpenAIResponses } from "../_shared/openai.ts";

/**
 * plan-interview — generate the 7-beat documentary subway interview script.
 *
 * POST /functions/v1/plan-interview
 * Body: {
 *   topic (required, <= 2000 chars),
 *   hostDescription?, guestDescription?, environment?, interviewStyle?,
 *   language?, handle?
 * }
 * 200: { plan: InterviewPlan }
 * 400: validation errors, 500: OPENAI_API_KEY missing or upstream failure
 * (the upstream message is surfaced — there is no fallback script).
 */

const BEAT_IDS = [
  "opening_hook",
  "interviewer_intro",
  "guest_responds",
  "interviewer_challenges",
  "guest_expands",
  "reaction_moment",
  "closing_statement",
] as const;

const SHOT_TYPES = ["host", "guest", "two_shot", "reaction", "environment"] as const;
const SPEAKERS = ["host", "guest", "none"] as const;

type BeatId = typeof BEAT_IDS[number];
type ShotType = typeof SHOT_TYPES[number];
type Speaker = typeof SPEAKERS[number];

interface PlanRequest {
  topic: string;
  hostDescription?: string;
  guestDescription?: string;
  environment?: string;
  interviewStyle?: string;
  language?: string;
  handle?: string;
}

interface InterviewBeat {
  beatId: BeatId;
  shotType: ShotType;
  speaker: Speaker;
  dialogue: string;
  cameraDirection: string;
  videoPrompt: string;
}

interface InterviewPlan {
  title: string;
  hookQuestion: string;
  handle: string;
  beats: InterviewBeat[];
}

const PLAN_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["title", "hookQuestion", "handle", "beats"],
  properties: {
    title: { type: "string" },
    hookQuestion: { type: "string" },
    handle: { type: "string" },
    beats: {
      type: "array",
      minItems: BEAT_IDS.length,
      maxItems: BEAT_IDS.length,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["beatId", "shotType", "speaker", "dialogue", "cameraDirection", "videoPrompt"],
        properties: {
          beatId: { type: "string", enum: [...BEAT_IDS] },
          shotType: { type: "string", enum: [...SHOT_TYPES] },
          speaker: { type: "string", enum: [...SPEAKERS] },
          dialogue: { type: "string" },
          cameraDirection: { type: "string" },
          videoPrompt: { type: "string" },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = `You are the head writer of a viral documentary subway interview show shot for vertical 9:16 short-form video (TikTok, YouTube Shorts, Instagram Reels).

Write a documentary subway interview script about the given topic. Rules:
- The script is exactly 7 beats, ALWAYS in this exact order: opening_hook, interviewer_intro, guest_responds, interviewer_challenges, guest_expands, reaction_moment, closing_statement.
- Dialogue must sound like natural spoken language — what people actually say on the subway, never written prose. Each beat's dialogue is 1 to 3 sentences.
- Each beat needs a concise camera direction (shot size, movement, framing) appropriate for documentary handheld work.
- Each beat needs a text-to-video prompt for a vertical 9:16 video model. Prompts must describe: the on-camera person(s) using the host and guest descriptions provided, the subway environment described below, and MUST include the exact phrase "documentary, natural lighting, no AI artifacts". Prompts must not ask for on-screen text or captions.
- Shot types are limited to: host, guest, two_shot, reaction, environment. Speakers are limited to: host, guest, none.
- Keep the whole script tight and watchable: the hook must stop the scroll.`;

function buildUserPrompt(body: PlanRequest): string {
  const parts: string[] = [`TOPIC: ${body.topic}`];

  if (body.hostDescription) parts.push(`HOST (the interviewer): ${body.hostDescription}`);
  if (body.guestDescription) parts.push(`GUEST (the interviewee): ${body.guestDescription}`);
  parts.push(`SUBWAY ENVIRONMENT: ${body.environment ?? "a moving NYC subway car, fluorescent lighting, graffiti-covered doors, other passengers in the background"}`);
  if (body.interviewStyle) parts.push(`INTERVIEW STYLE: ${body.interviewStyle}`);
  if (body.language) parts.push(`SCRIPT LANGUAGE: ${body.language} (write the dialogue in this language)`);
  if (body.handle) parts.push(`BRAND HANDLE: ${body.handle}`);

  parts.push(
    "Return the 7-beat interview plan. The beats array must contain exactly the 7 beatIds in the exact order listed above.",
  );

  return parts.join("\n");
}

function parseBeats(rawBeats: unknown): InterviewBeat[] {
  if (!Array.isArray(rawBeats)) {
    throw new HttpError(500, "Interview plan validation failed: beats is not an array");
  }
  if (rawBeats.length !== BEAT_IDS.length) {
    throw new HttpError(
      500,
      `Interview plan validation failed: expected ${BEAT_IDS.length} beats, got ${rawBeats.length}`,
    );
  }

  const beats: InterviewBeat[] = [];
  for (let i = 0; i < BEAT_IDS.length; i++) {
    const raw = rawBeats[i];
    if (!raw || typeof raw !== "object") {
      throw new HttpError(500, `Interview plan validation failed: beat ${i} is not an object`);
    }
    const beat = raw as Record<string, unknown>;
    const beatId = beat.beatId;
    if (beatId !== BEAT_IDS[i]) {
      throw new HttpError(
        500,
        `Interview plan validation failed: beat ${i} must be "${BEAT_IDS[i]}", got "${String(beatId)}"`,
      );
    }
    const shotType = SHOT_TYPES.includes(beat.shotType as ShotType) ? (beat.shotType as ShotType) : null;
    const speaker = SPEAKERS.includes(beat.speaker as Speaker) ? (beat.speaker as Speaker) : null;
    if (!shotType || !speaker) {
      throw new HttpError(500, `Interview plan validation failed: beat ${i} has an invalid shotType or speaker`);
    }
    const dialogue = typeof beat.dialogue === "string" ? beat.dialogue.trim() : "";
    const cameraDirection = typeof beat.cameraDirection === "string" ? beat.cameraDirection.trim() : "";
    const videoPrompt = typeof beat.videoPrompt === "string" ? beat.videoPrompt.trim() : "";
    if (!dialogue || !cameraDirection || !videoPrompt) {
      throw new HttpError(500, `Interview plan validation failed: beat ${i} is missing dialogue, cameraDirection, or videoPrompt`);
    }
    beats.push({ beatId: BEAT_IDS[i], shotType, speaker, dialogue, cameraDirection, videoPrompt });
  }

  return beats;
}

function parsePlan(raw: Record<string, unknown>): InterviewPlan {
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const hookQuestion = typeof raw.hookQuestion === "string" ? raw.hookQuestion.trim() : "";
  if (!title || !hookQuestion) {
    throw new HttpError(500, "Interview plan validation failed: title and hookQuestion are required");
  }

  return {
    title,
    hookQuestion,
    handle: typeof raw.handle === "string" ? raw.handle : "",
    beats: parseBeats(raw.beats),
  };
}

Deno.serve(async (req: Request) => {
  const cors = buildCorsHeaders(req.headers.get("Origin"));

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  try {
    await requireUser(req);

    let body: PlanRequest;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400, cors);
    }

    if (!body.topic || typeof body.topic !== "string" || body.topic.trim().length === 0) {
      return jsonResponse({ error: "topic is required" }, 400, cors);
    }
    if (body.topic.length > 2000) {
      return jsonResponse({ error: "topic exceeds maximum length of 2000 characters" }, 400, cors);
    }

    const rawPlan = await callOpenAIResponses({
      schemaName: "interview_plan",
      schema: PLAN_SCHEMA,
      input: buildUserPrompt(body),
      instructions: SYSTEM_PROMPT,
    });

    const plan = parsePlan(rawPlan);

    return jsonResponse({ plan }, 200, cors);
  } catch (error) {
    console.error("Plan interview error:", error);
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message }, error.status, cors);
    }
    const message = error instanceof Error && error.message ? error.message : "Interview planning failed";
    return jsonResponse({ error: message }, 500, cors);
  }
});
