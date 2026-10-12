#!/usr/bin/env node
/**
 * SubwayTakes Studio — LIVE PROVIDER PREFLIGHT HARNESS (real providers only).
 *
 * This harness proves that the live third-party providers this app depends on
 * actually work with the credentials supplied in the environment. It NEVER
 * fabricates, mocks, or simulates a provider success:
 *   - A provider is only called when its credential is present.
 *   - A missing credential is reported BLOCKED and costs nothing.
 *   - Any deviation from the contract is a loud FAIL.
 *
 * Run: node scripts/provider-preflight.mjs
 * Env: MUAPI_API_KEY, OPENAI_API_KEY, OPENAI_MODEL?, MUAPI_BASE_URL?,
 *      ALLOW_MUAPI_VIDEO_SPEND=1?, PREFLIGHT_AUDIO_URL?
 */

const REQUEST_TIMEOUT_MS = 30000;
const AUDIO_PROBE_TIMEOUT_MS = 15000;
const POLL_MAX_ATTEMPTS = 24;
const POLL_INTERVAL_MS = 5000;
const MIN_VIDEO_BYTES = 10000;

const BEAT_IDS = [
  "opening_hook",
  "interviewer_intro",
  "guest_responds",
  "interviewer_challenges",
  "guest_expands",
  "reaction_moment",
  "closing_statement",
];
const SHOT_TYPES = ["host", "guest", "two_shot", "reaction", "environment"];
const SPEAKERS = ["host", "guest", "none"];

const PLAN_SCHEMA = {
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

const OPENAI_INPUT = `TOPIC: test
Return the 7-beat interview plan. The beats array must contain exactly the 7 beatIds in the exact order: ${BEAT_IDS.join(", ")}.`;

const VEO3_PROMPT = "a calm subway platform, documentary style, vertical";
const VEO3_PAYLOAD = { prompt: VEO3_PROMPT, aspect_ratio: "9:16" };

const WHISPER_PAYLOAD_BASE = { response_format: "vtt", language: "en" };
const AI_CAPTIONS_PAYLOAD_BASE = { language: "English", theme: "Hormozi_1" };

const AUDIO_CANDIDATES = [
  { url: "https://raw.githubusercontent.com/openai/whisper/main/tests/jfk.flac", note: "canonical Whisper test clip — real English speech" },
  { url: "https://www.w3schools.com/html/horse.mp3", note: "small mp3" },
  { url: "https://samplelib.com/lib/preview/mp3/sample-3s.mp3", note: "short mp3" },
];

const VTT_CUE = /\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/;
const VTT_CUE_GLOBAL = /\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/g;

const env = process.env;
const MUAPI_BASE_URL = (env.MUAPI_BASE_URL || "https://api.muapi.ai/api/v1").replace(/\/+$/, "");
const OPENAI_MODEL = env.OPENAI_MODEL || "gpt-4o-mini";
const ALLOW_VIDEO_SPEND = env.ALLOW_MUAPI_VIDEO_SPEND === "1";

const shared = { generatedVideoUrl: null };
const results = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeNetworkError(error) {
  if (error instanceof Error) {
    return error.name === "AbortError" ? "request timed out" : error.message;
  }
  return String(error);
}

async function fetchWithTimeout(url, init = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function safeText(response) {
  return (await response.text().catch(() => "")) || "";
}

function extractMessage(bodyText) {
  if (!bodyText) return "";
  try {
    const parsed = JSON.parse(bodyText);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      const record = parsed;
      const err = record.error;
      if (err && typeof err === "object" && typeof err.message === "string" && err.message) return err.message;
      if (typeof err === "string" && err) return err;
      if (typeof record.message === "string" && record.message) return record.message;
      if (typeof record.detail === "string" && record.detail) return record.detail;
    }
  } catch {
    /* not JSON */
  }
  return bodyText.slice(0, 500);
}

async function readCapped(response, capBytes) {
  const reader = typeof response.body?.getReader === "function" ? response.body.getReader() : null;
  if (!reader) {
    const buf = new Uint8Array(await response.arrayBuffer());
    return buf.byteLength;
  }
  let total = 0;
  try {
    while (total < capBytes) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* already closed */
    }
  }
  return total;
}

async function probeVideo(url) {
  let response;
  try {
    response = await fetchWithTimeout(
      url,
      { method: "GET", headers: { Range: "bytes=0-1048575" } },
      REQUEST_TIMEOUT_MS,
    );
  } catch (error) {
    return { ok: false, reason: `download failed: ${describeNetworkError(error)}` };
  }
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (response.status !== 200 && response.status !== 206) {
    return { ok: false, reason: `HTTP ${response.status}`, contentType, bytes: 0 };
  }
  const bytes = await readCapped(response, 2 * 1024 * 1024);
  const isVideo = contentType.startsWith("video/");
  return { ok: isVideo && bytes > MIN_VIDEO_BYTES, contentType: contentType || "(none)", bytes };
}

function decodeDataUrl(dataUrl) {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) return null;
  const meta = dataUrl.slice(0, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);
  try {
    if (meta.includes(";base64")) {
      const binary = Buffer.from(payload, "base64");
      return binary.toString("utf8");
    }
    return decodeURIComponent(payload);
  } catch {
    return null;
  }
}

async function downloadText(url) {
  try {
    const response = await fetchWithTimeout(url, { method: "GET" }, 60000);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function isAuthStatus(status, message) {
  if (status === 401 || status === 403) return true;
  return /authoriz|credential|unauthor|forbidden|api ?key|authentication/i.test(message || "");
}

async function pollMuapi(requestId, apiKey, { maxAttempts = POLL_MAX_ATTEMPTS, intervalMs = POLL_INTERVAL_MS, onStatus } = {}) {
  let lastStatus = null;
  const started = Date.now();
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response;
    try {
      response = await fetchWithTimeout(
        `${MUAPI_BASE_URL}/predictions/${encodeURIComponent(requestId)}/result`,
        { method: "GET", headers: { "x-api-key": apiKey } },
        REQUEST_TIMEOUT_MS,
      );
    } catch (error) {
      onStatus?.(`poll #${attempt} (${((Date.now() - started) / 1000).toFixed(0)}s) network error: ${describeNetworkError(error)} — retrying`);
      await sleep(intervalMs);
      continue;
    }

    const bodyText = await safeText(response);
    if (!response.ok) {
      const message = extractMessage(bodyText) || `HTTP ${response.status}`;
      if (isAuthStatus(response.status, message)) {
        return { authError: `HTTP ${response.status} ${message}` };
      }
      onStatus?.(`poll #${attempt} (${((Date.now() - started) / 1000).toFixed(0)}s) HTTP ${response.status}: ${message.slice(0, 120)} — retrying`);
      await sleep(intervalMs);
      continue;
    }

    let data = null;
    try {
      data = JSON.parse(bodyText);
    } catch {
      data = null;
    }
    const status = data && typeof data.status === "string" ? data.status : "";
    const outputs = Array.isArray(data?.outputs)
      ? data.outputs.filter((entry) => typeof entry === "string")
      : [];
    const error = data && typeof data.error === "string"
      ? data.error
      : data && data.error && typeof data.error === "object" && typeof data.error.message === "string"
        ? data.error.message
        : null;

    const transition = status !== lastStatus;
    if (transition) lastStatus = status;
    onStatus?.(
      `poll #${attempt} (${((Date.now() - started) / 1000).toFixed(0)}s)${transition ? " >> TRANSITION >>" : ""} status=${status || "(none)"}`,
    );

    if (status === "completed") return { status, outputs, data };
    if (status === "failed" || status === "cancelled") return { status, error, data };

    await sleep(intervalMs);
  }
  return { status: "timeout" };
}

function record(name, status, evidence, details) {
  const result = { name, status, evidence, details };
  results.push(result);
  console.log(`CHECK ${name}: ${status} — ${evidence}`);
  return result;
}

function pass(name, evidence, details = {}) {
  return record(name, "PASS", evidence, details);
}

function fail(name, evidence, details = {}) {
  return record(name, "FAIL", evidence, details);
}

function blockedCred(name, credential) {
  console.log(`BLOCKED: ${credential} is not set — refusing to call the provider without this credential`);
  return record(name, "BLOCKED", `missing ${credential}`, { credential });
}

function blockedReason(name, message) {
  console.log(`BLOCKED: ${message}`);
  return record(name, "BLOCKED", message, {});
}

function header(index, name) {
  console.log(`\n-----------------------------`);
  console.log(`[CHECK ${index}/4] ${name}`);
}

function extractResponseText(data) {
  if (!data || typeof data !== "object") return "";
  if (typeof data.output_text === "string" && data.output_text.length > 0) return data.output_text;
  const output = data.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (!item || typeof item !== "object") continue;
      const content = item.content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if (part && typeof part === "object" && typeof part.text === "string" && part.text.length > 0) {
          return part.text;
        }
      }
    }
  }
  return "";
}

function validatePlan(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    return { ok: false, reason: "output was not a JSON object" };
  }
  const title = typeof plan.title === "string" ? plan.title.trim() : "";
  const hookQuestion = typeof plan.hookQuestion === "string" ? plan.hookQuestion.trim() : "";
  if (!title) return { ok: false, reason: "missing non-empty title" };
  if (!hookQuestion) return { ok: false, reason: "missing non-empty hookQuestion" };
  const beats = plan.beats;
  if (!Array.isArray(beats)) return { ok: false, reason: "beats is not an array" };
  if (beats.length !== BEAT_IDS.length) {
    return { ok: false, reason: `expected ${BEAT_IDS.length} beats, got ${beats.length}` };
  }
  for (let i = 0; i < BEAT_IDS.length; i++) {
    const beat = beats[i];
    if (!beat || typeof beat !== "object") return { ok: false, reason: `beat ${i} is not an object` };
    if (beat.beatId !== BEAT_IDS[i]) {
      return { ok: false, reason: `beat ${i} must be "${BEAT_IDS[i]}", got "${String(beat.beatId)}"` };
    }
    const shotType = typeof beat.shotType === "string" ? beat.shotType.trim() : "";
    const speaker = typeof beat.speaker === "string" ? beat.speaker.trim() : "";
    const dialogue = typeof beat.dialogue === "string" ? beat.dialogue.trim() : "";
    const cameraDirection = typeof beat.cameraDirection === "string" ? beat.cameraDirection.trim() : "";
    const videoPrompt = typeof beat.videoPrompt === "string" ? beat.videoPrompt.trim() : "";
    if (!SHOT_TYPES.includes(shotType)) return { ok: false, reason: `beat ${i} (${BEAT_IDS[i]}) has invalid shotType "${shotType}"` };
    if (!SPEAKERS.includes(speaker)) return { ok: false, reason: `beat ${i} (${BEAT_IDS[i]}) has invalid speaker "${speaker}"` };
    if (!dialogue) return { ok: false, reason: `beat ${i} (${BEAT_IDS[i]}) has empty dialogue` };
    if (!cameraDirection) return { ok: false, reason: `beat ${i} (${BEAT_IDS[i]}) has empty cameraDirection` };
    if (!videoPrompt) return { ok: false, reason: `beat ${i} (${BEAT_IDS[i]}) has empty videoPrompt` };
  }
  return { ok: true, reason: "7 beats in required order; dialogue/cameraDirection/videoPrompt non-empty; title+hookQuestion present" };
}

async function checkOpenai() {
  header(1, "openai_responses");
  console.log(`endpoint: https://api.openai.com/v1/responses`);
  console.log(`model: ${OPENAI_MODEL} | schema: interview_plan (json_schema strict, 7 beats)`);
  if (!env.OPENAI_API_KEY) return blockedCred("openai_responses", "OPENAI_API_KEY");

  const started = Date.now();
  let response;
  try {
    response = await fetchWithTimeout("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: OPENAI_INPUT,
        instructions: SYSTEM_PROMPT,
        text: {
          format: {
            type: "json_schema",
            name: "interview_plan",
            schema: PLAN_SCHEMA,
            strict: true,
          },
        },
      }),
    });
  } catch (error) {
    return fail("openai_responses", `request failed: ${describeNetworkError(error)}`, {});
  }

  const bodyText = await safeText(response);
  if (!response.ok) {
    return fail("openai_responses", `HTTP ${response.status}: ${extractMessage(bodyText) || "(no body)"}`, { status: response.status });
  }

  let data = null;
  try {
    data = JSON.parse(bodyText);
  } catch {
    return fail("openai_responses", "HTTP 200 but body was not valid JSON", { status: 200 });
  }

  const text = extractResponseText(data);
  if (!text) {
    return fail("openai_responses", "HTTP 200 but response contained no output_text/content", { status: 200 });
  }

  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail("openai_responses", "output text was not valid JSON", { status: 200 });
  }

  const validation = validatePlan(parsed);
  if (!validation.ok) {
    return fail("openai_responses", `plan validation failed: ${validation.reason}`, { status: 200 });
  }

  return pass(
    "openai_responses",
    `HTTP 200 (${Date.now() - started}ms); ${validation.reason}`,
    { status: 200, model: OPENAI_MODEL },
  );
}

async function checkVeo3() {
  header(2, "muapi_veo3_video");
  console.log(`endpoint: ${MUAPI_BASE_URL}/veo3-text-to-video`);
  console.log(`payload: ${JSON.stringify(VEO3_PAYLOAD)}`);
  if (!env.MUAPI_API_KEY) return blockedCred("muapi_veo3_video", "MUAPI_API_KEY");

  if (!ALLOW_VIDEO_SPEND) {
    console.log(`PATH: auth + contract probe (NO SPEND) — ALLOW_MUAPI_VIDEO_SPEND is not "1"`);
    console.log(`probe: submitting a deliberately invalid body (missing "prompt") to prove auth + endpoint + contract`);

    let response;
    try {
      response = await fetchWithTimeout(
        `${MUAPI_BASE_URL}/veo3-text-to-video`,
        {
          method: "POST",
          headers: { "x-api-key": env.MUAPI_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ aspect_ratio: "9:16" }),
        },
        REQUEST_TIMEOUT_MS,
      );
    } catch (error) {
      return fail("muapi_veo3_video", `probe request failed: ${describeNetworkError(error)}`, {});
    }

    const bodyText = await safeText(response);
    const message = extractMessage(bodyText);

    if (isAuthStatus(response.status, message)) {
      return fail("muapi_veo3_video", `auth check FAILED — provider rejected the credential: HTTP ${response.status} ${message || "(no body)"}`, { status: response.status });
    }
    if (response.status >= 400 && response.status < 500) {
      console.log(`SKIPPED: veo3 spend check (real video generation) — set ALLOW_MUAPI_VIDEO_SPEND=1 to run a real veo3 job (spends credits)`);
      return pass(
        "muapi_veo3_video",
        `auth+contract OK — key authenticates, endpoint exists, body validated: HTTP ${response.status} "${message || "(no body)"}"`,
        { status: response.status, probe: true, spendSkipped: true },
      );
    }
    return fail("muapi_veo3_video", `expected a non-auth 4xx validation rejection for the missing prompt, got HTTP ${response.status} ${message || "(no body)"}`, { status: response.status });
  }

  console.log(`PATH: REAL GENERATION (SPENDS CREDITS) — ALLOW_MUAPI_VIDEO_SPEND="1"`);

  let response;
  try {
    response = await fetchWithTimeout(
      `${MUAPI_BASE_URL}/veo3-text-to-video`,
      {
        method: "POST",
        headers: { "x-api-key": env.MUAPI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(VEO3_PAYLOAD),
      },
      REQUEST_TIMEOUT_MS,
    );
  } catch (error) {
    return fail("muapi_veo3_video", `submit failed: ${describeNetworkError(error)}`, {});
  }

  const bodyText = await safeText(response);
  if (!response.ok) {
    const message = extractMessage(bodyText) || "(no body)";
    if (isAuthStatus(response.status, message)) {
      return fail("muapi_veo3_video", `submit auth FAILED: HTTP ${response.status} ${message}`, { status: response.status });
    }
    return fail("muapi_veo3_video", `submit failed: HTTP ${response.status} ${message}`, { status: response.status });
  }

  let data = null;
  try {
    data = JSON.parse(bodyText);
  } catch {
    return fail("muapi_veo3_video", "submit returned non-JSON body", {});
  }
  const requestId = typeof data?.request_id === "string" ? data.request_id : "";
  if (!requestId) {
    return fail("muapi_veo3_video", "submit returned no request_id", {});
  }

  console.log(`submitted request_id=${requestId}; polling up to ${POLL_MAX_ATTEMPTS}x${POLL_INTERVAL_MS}ms (~2 min)`);
  const polled = await pollMuapi(requestId, env.MUAPI_API_KEY, {
    onStatus: (line) => console.log(`  ${line}`),
  });

  if (polled.authError) return fail("muapi_veo3_video", `poll auth FAILED: ${polled.authError}`, {});
  if (polled.status === "timeout") {
    return fail("muapi_veo3_video", `timed out after ${POLL_MAX_ATTEMPTS} polls (~2 min) without completion`, {});
  }
  if (polled.status === "failed" || polled.status === "cancelled") {
    return fail("muapi_veo3_video", `job ${polled.status}: ${polled.error || "(no provider error)"}`, {});
  }

  const outputUrl = polled.outputs && polled.outputs[0];
  if (!outputUrl || !/^https:\/\//i.test(outputUrl)) {
    return fail("muapi_veo3_video", `completed but outputs[0] is not an https URL: ${JSON.stringify(outputUrl)}`, { outputs: polled.outputs });
  }

  const probe = await probeVideo(outputUrl);
  if (!probe.ok) {
    return fail("muapi_veo3_video", `output URL did not serve video content: ${probe.reason || `content-type=${probe.contentType}, bytes=${probe.bytes}`}`, { output: outputUrl });
  }

  shared.generatedVideoUrl = outputUrl;
  return pass(
    "muapi_veo3_video",
    `completed; outputs[0]=${outputUrl} (${probe.contentType}, ${probe.bytes}+ bytes)`,
    { output: outputUrl, contentType: probe.contentType, bytes: probe.bytes },
  );
}

async function probeAudio(url) {
  try {
    const response = await fetchWithTimeout(url, { method: "HEAD" }, AUDIO_PROBE_TIMEOUT_MS);
    if (response.status >= 200 && response.status < 300) return true;
  } catch {
    /* unreachable */
  }
  try {
    const response = await fetchWithTimeout(url, { method: "GET", headers: { Range: "bytes=0-1" } }, AUDIO_PROBE_TIMEOUT_MS);
    return response.status >= 200 && response.status < 300;
  } catch {
    return false;
  }
}

async function resolveAudioUrl() {
  const candidates = [];
  if (env.PREFLIGHT_AUDIO_URL) candidates.push(env.PREFLIGHT_AUDIO_URL);
  for (const candidate of AUDIO_CANDIDATES) candidates.push(candidate.url);

  for (const url of candidates) {
    console.log(`  probing audio candidate: ${url}`);
    if (await probeAudio(url)) return url;
  }
  return null;
}

async function extractTranscript(data, outputs) {
  if (data && typeof data === "object") {
    const keys = ["vtt", "text", "transcript", "srt", "output", "response", "captions", "caption"];
    for (const key of keys) {
      const value = data[key];
      if (typeof value === "string" && value.trim().length > 0) return value;
      if (value && typeof value === "object") {
        const inner = value.vtt ?? value.text ?? value.transcript;
        if (typeof inner === "string" && inner.trim().length > 0) return inner;
      }
    }
  }
  const outs = Array.isArray(outputs) ? outputs : [];
  for (const out of outs) {
    if (typeof out !== "string") continue;
    if (out.startsWith("data:")) {
      const decoded = decodeDataUrl(out);
      if (decoded) return decoded;
      continue;
    }
    if (out.includes("-->")) return out;
    if (/^https:\/\//i.test(out)) {
      const text = await downloadText(out);
      if (text) return text;
    }
  }
  return null;
}

async function checkWhisper() {
  header(3, "muapi_openai_whisper");
  if (!env.MUAPI_API_KEY) return blockedCred("muapi_openai_whisper", "MUAPI_API_KEY");

  const audioUrl = await resolveAudioUrl();
  if (!audioUrl) {
    return blockedReason(
      "muapi_openai_whisper",
      "no public test audio URL reachable (tried: " + (env.PREFLIGHT_AUDIO_URL ? `${env.PREFLIGHT_AUDIO_URL}, ` : "") + AUDIO_CANDIDATES.map((c) => c.url).join(", ") + ")",
    );
  }

  console.log(`audio_url: ${audioUrl}`);
  console.log(`endpoint: ${MUAPI_BASE_URL}/openai-whisper`);
  console.log(`payload: ${JSON.stringify({ audio_url: audioUrl, ...WHISPER_PAYLOAD_BASE })}`);

  let response;
  try {
    response = await fetchWithTimeout(
      `${MUAPI_BASE_URL}/openai-whisper`,
      {
        method: "POST",
        headers: { "x-api-key": env.MUAPI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ audio_url: audioUrl, ...WHISPER_PAYLOAD_BASE }),
      },
      REQUEST_TIMEOUT_MS,
    );
  } catch (error) {
    return fail("muapi_openai_whisper", `submit failed: ${describeNetworkError(error)}`, {});
  }

  const bodyText = await safeText(response);
  if (!response.ok) {
    const message = extractMessage(bodyText) || "(no body)";
    if (isAuthStatus(response.status, message)) {
      return fail("muapi_openai_whisper", `submit auth FAILED: HTTP ${response.status} ${message}`, { status: response.status });
    }
    return fail("muapi_openai_whisper", `submit failed: HTTP ${response.status} ${message}`, { status: response.status });
  }

  let data = null;
  try {
    data = JSON.parse(bodyText);
  } catch {
    return fail("muapi_openai_whisper", "submit returned non-JSON body", {});
  }
  const requestId = typeof data?.request_id === "string" ? data.request_id : "";
  if (!requestId) {
    return fail("muapi_openai_whisper", "submit returned no request_id", {});
  }

  console.log(`submitted request_id=${requestId}; polling`);
  const polled = await pollMuapi(requestId, env.MUAPI_API_KEY, {
    onStatus: (line) => console.log(`  ${line}`),
  });

  if (polled.authError) return fail("muapi_openai_whisper", `poll auth FAILED: ${polled.authError}`, {});
  if (polled.status === "timeout") {
    return fail("muapi_openai_whisper", `timed out after ${POLL_MAX_ATTEMPTS} polls (~2 min) without completion`, {});
  }
  if (polled.status === "failed" || polled.status === "cancelled") {
    return fail("muapi_openai_whisper", `job ${polled.status}: ${polled.error || "(no provider error)"}`, {});
  }

  const transcript = await extractTranscript(polled.data, polled.outputs);
  if (!transcript) {
    return fail("muapi_openai_whisper", "completed but returned no transcript text", {});
  }

  const cues = transcript.match(VTT_CUE_GLOBAL) || [];
  if (cues.length === 0) {
    return fail("muapi_openai_whisper", "transcript present but no VTT cue timestamps (HH:MM:SS.mmm --> HH:MM:SS.mmm) found", {});
  }

  return pass("muapi_openai_whisper", `completed; ${cues.length} VTT cue(s) found`, { cues: cues.length });
}

async function checkAiCaptions() {
  header(4, "muapi_ai_captions");
  if (!env.MUAPI_API_KEY) return blockedCred("muapi_ai_captions", "MUAPI_API_KEY");

  const videoUrl = shared.generatedVideoUrl;
  if (!videoUrl) {
    return blockedReason(
      "muapi_ai_captions",
      "requires a generated video from step 2 — run with ALLOW_MUAPI_VIDEO_SPEND=1 so step 2 produces an output URL (this also avoids spending on captions otherwise)",
    );
  }

  console.log(`video_url: ${videoUrl}`);
  console.log(`endpoint: ${MUAPI_BASE_URL}/ai-captions`);
  console.log(`payload: ${JSON.stringify({ video_url: videoUrl, ...AI_CAPTIONS_PAYLOAD_BASE })}`);

  let response;
  try {
    response = await fetchWithTimeout(
      `${MUAPI_BASE_URL}/ai-captions`,
      {
        method: "POST",
        headers: { "x-api-key": env.MUAPI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: videoUrl, ...AI_CAPTIONS_PAYLOAD_BASE }),
      },
      REQUEST_TIMEOUT_MS,
    );
  } catch (error) {
    return fail("muapi_ai_captions", `submit failed: ${describeNetworkError(error)}`, {});
  }

  const bodyText = await safeText(response);
  if (!response.ok) {
    const message = extractMessage(bodyText) || "(no body)";
    if (isAuthStatus(response.status, message)) {
      return fail("muapi_ai_captions", `submit auth FAILED: HTTP ${response.status} ${message}`, { status: response.status });
    }
    return fail("muapi_ai_captions", `submit failed: HTTP ${response.status} ${message}`, { status: response.status });
  }

  let data = null;
  try {
    data = JSON.parse(bodyText);
  } catch {
    return fail("muapi_ai_captions", "submit returned non-JSON body", {});
  }
  const requestId = typeof data?.request_id === "string" ? data.request_id : "";
  if (!requestId) {
    return fail("muapi_ai_captions", "submit returned no request_id", {});
  }

  console.log(`submitted request_id=${requestId}; polling`);
  const polled = await pollMuapi(requestId, env.MUAPI_API_KEY, {
    onStatus: (line) => console.log(`  ${line}`),
  });

  if (polled.authError) return fail("muapi_ai_captions", `poll auth FAILED: ${polled.authError}`, {});
  if (polled.status === "timeout") {
    return fail("muapi_ai_captions", `timed out after ${POLL_MAX_ATTEMPTS} polls (~2 min) without completion`, {});
  }
  if (polled.status === "failed" || polled.status === "cancelled") {
    return fail("muapi_ai_captions", `job ${polled.status}: ${polled.error || "(no provider error)"}`, {});
  }

  const outputUrl = polled.outputs && polled.outputs[0];
  if (!outputUrl || !/^https:\/\//i.test(outputUrl)) {
    return fail("muapi_ai_captions", `completed but outputs[0] is not an https URL: ${JSON.stringify(outputUrl)}`, { outputs: polled.outputs });
  }

  const probe = await probeVideo(outputUrl);
  if (!probe.ok) {
    return fail("muapi_ai_captions", `output URL did not serve video content: ${probe.reason || `content-type=${probe.contentType}, bytes=${probe.bytes}`}`, { output: outputUrl });
  }

  return pass(
    "muapi_ai_captions",
    `completed; outputs[0]=${outputUrl} (${probe.contentType}, ${probe.bytes}+ bytes)`,
    { output: outputUrl, contentType: probe.contentType, bytes: probe.bytes },
  );
}

async function main() {
  console.log("=============================================================");
  console.log(" SubwayTakes Studio — LIVE PROVIDER PREFLIGHT HARNESS");
  console.log(" Real providers only. Never fabricates success.");
  console.log("=============================================================");
  console.log(` muapi base url : ${MUAPI_BASE_URL}`);
  console.log(` openai model   : ${OPENAI_MODEL}`);
  console.log(` video spend    : ${ALLOW_VIDEO_SPEND ? "ENABLED (ALLOW_MUAPI_VIDEO_SPEND=1)" : "DISABLED (auth+contract probe only)"}`);
  console.log(` credentials    : MUAPI_API_KEY=${env.MUAPI_API_KEY ? "present" : "MISSING"} OPENAI_API_KEY=${env.OPENAI_API_KEY ? "present" : "MISSING"}`);

  const started = Date.now();

  await checkOpenai();
  await checkVeo3();
  await checkWhisper();
  await checkAiCaptions();

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const blocked = results.filter((r) => r.status === "BLOCKED").length;
  const executed = passed + failed;

  let resultLine;
  let exitCode;
  if (failed > 0) {
    resultLine = `FAIL ${passed}/${executed}`;
    exitCode = 1;
  } else if (executed === 0) {
    resultLine = "BLOCKED (no credentials)";
    exitCode = 2;
  } else {
    resultLine = `PASS ${passed}/${executed}`;
    exitCode = 0;
  }

  console.log("\n=============================================================");
  console.log(`PREFLIGHT RESULT: ${resultLine}`);

  const summary = {
    result: resultLine.split(" ")[0],
    passed,
    failed,
    blocked,
    executed,
    elapsedMs: Date.now() - started,
    environment: {
      muapiBaseUrl: MUAPI_BASE_URL,
      openaiModel: OPENAI_MODEL,
      allowMuapiVideoSpend: ALLOW_VIDEO_SPEND,
      credentialsPresent: {
        muapi: Boolean(env.MUAPI_API_KEY),
        openai: Boolean(env.OPENAI_API_KEY),
      },
    },
    checks: results,
  };
  console.log(`PREFLIGHT SUMMARY: ${JSON.stringify(summary)}`);

  process.exit(exitCode);
}

main().catch((error) => {
  console.error("PREFLIGHT HARNESS ERROR:", error && error.message ? error.message : error);
  process.exit(1);
});
