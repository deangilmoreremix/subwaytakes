import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface BuildPromptRequest {
  video_type: string;
  topic: string;
  duration_seconds: number;
  angle_prompt?: string;
  interview_question?: string;
  scene_type?: string;
  city_style?: string;
  energy_level?: string;
  speaker_style?: string;
  motivational_setting?: string;
  camera_style?: string;
  lighting_mood?: string;
  street_scene?: string;
  interview_style?: string;
  time_of_day?: string;
  interviewer_type?: string;
  interviewer_position?: string;
  subject_demographic?: string;
  subject_gender?: string;
  subject_style?: string;
  subway_line?: string;
  neighborhood?: string;
  studio_setup?: string;
  studio_lighting?: string;
  wisdom_tone?: string;
  wisdom_format?: string;
  wisdom_demographic?: string;
  wisdom_setting?: string;
  target_age_group?: string;
  interview_mode?: string;
  custom_location?: string;
  scenario_description?: string;
  social_dynamics?: {
    crowdReaction?: string;
    passerbyInteraction?: string;
    bodyLanguage?: string;
  };
  subway_enhancements?: Record<string, unknown>;
  street_enhancements?: Record<string, unknown>;
  motivational_enhancements?: Record<string, unknown>;
  language?: string;
  niche?: string;
  interview_format?: string;
  caption_style?: string;
}

interface BuildPromptResponse {
  provider_prompt: string;
  negative_prompt: string;
  video_type: string;
  topic: string;
  duration_seconds: number;
  aspect_ratio: string;
  variation_hint: string;
  template_id: string | null;
  source: string;
}

interface PromptTemplate {
  id: string;
  base_prompt: string;
  negative_prompt: string;
  system_rules: string;
  visual_anchors: string;
  forbidden_elements: string;
  metadata: Record<string, unknown>;
}

interface PromptFragment {
  category: string;
  key: string;
  content: string;
}

const GENERIC_QUALITY_RULES = `GLOBAL QUALITY RULES:
- Vertical 9:16, realistic documentary feel.
- Single continuous shot (no cuts).
- No text inside the video frame.
- Natural faces and proportions.`;

const FINAL_SELF_CHECK = `FINAL CHECK:
- Verify mandatory constraints are satisfied.
- If a mandatory visual anchor is missing, regenerate the scene.`;

function getDurationPacing(seconds: number): string {
  if (seconds <= 3)
    return `DIALOGUE PACING (<=3s):\n- One question (<=8 words).\n- One answer (<=12 words).\n- No follow-up.`;
  if (seconds <= 6)
    return `DIALOGUE PACING (4-6s):\n- One question (<=10 words).\n- One answer (2-3 short lines).\n- Optional 1-word reaction from interviewer.`;
  return `DIALOGUE PACING (8s+):\n- One question.\n- One follow-up.\n- Subject gives 2-4 short lines total.`;
}

function getVariationHint(type: string): string {
  const hints: Record<string, string[]> = {
    motivational: [
      "different speaker intensity",
      "vary the camera movement timing",
      "different lighting angle",
    ],
    street_interview: [
      "different pedestrian density",
      "vary the background activity",
      "change interviewee position",
    ],
    subway_interview: [
      "different platform angle",
      "vary commuter density",
      "change train timing",
    ],
    studio_interview: [
      "different camera angle",
      "vary lighting setup",
      "change guest positioning",
    ],
    wisdom_interview: [
      "different tone",
      "vary subject demographic",
      "change setting location",
    ],
  };
  const options = hints[type] || hints.subway_interview;
  return options[Math.floor(Math.random() * options.length)];
}

function lookupFragment(
  fragments: PromptFragment[],
  category: string,
  key: string | undefined
): string {
  if (!key) return "";
  const found = fragments.find(
    (f) => f.category === category && f.key === key
  );
  return found?.content || "";
}

function buildCharacterDescription(
  fragments: PromptFragment[],
  req: BuildPromptRequest
): string {
  const parts: string[] = [];

  const interviewerContent = lookupFragment(
    fragments,
    "interviewer_type",
    req.interviewer_type
  );
  if (interviewerContent) parts.push(`Interviewer: ${interviewerContent}`);

  const subjectParts: string[] = [];
  if (req.subject_gender && req.subject_gender !== "any") {
    subjectParts.push(`${req.subject_gender} subject`);
  }
  const demoContent = lookupFragment(
    fragments,
    "subject_demographic",
    req.subject_demographic
  );
  if (demoContent) subjectParts.push(demoContent);
  if (req.subject_style) {
    subjectParts.push(
      `${req.subject_style.replace(/_/g, " ")} clothing style`
    );
  }
  if (subjectParts.length > 0) parts.push(`Subject: ${subjectParts.join(", ")}`);

  return parts.join("\n");
}

function buildLocationContext(
  fragments: PromptFragment[],
  req: BuildPromptRequest,
  category: string,
  defaultKey: string
): string {
  if (req.custom_location && req.city_style === "custom") {
    return req.custom_location;
  }
  return lookupFragment(fragments, category, req.city_style || defaultKey);
}

function buildScenarioContext(req: BuildPromptRequest): string {
  if (!req.scenario_description) return "";
  return `\n\nSCENARIO: ${req.scenario_description}`;
}

function buildSocialDynamicsContext(req: BuildPromptRequest): string {
  if (!req.social_dynamics) return "";
  const parts: string[] = [];
  if (req.social_dynamics.crowdReaction) {
    parts.push(`crowd reaction: ${req.social_dynamics.crowdReaction}`);
  }
  if (req.social_dynamics.passerbyInteraction) {
    parts.push(`passerby interaction: ${req.social_dynamics.passerbyInteraction}`);
  }
  if (req.social_dynamics.bodyLanguage) {
    parts.push(`body language: ${req.social_dynamics.bodyLanguage}`);
  }
  if (parts.length === 0) return "";
  return `\n\nSOCIAL DYNAMICS: ${parts.join(", ")}.`;
}

function buildSubwayEnhancementsContext(req: BuildPromptRequest): string {
  const enh = req.subway_enhancements;
  if (!enh) return "";
  const parts: string[] = [];
  if (enh.multiStopJourney && (enh.multiStopJourney as Record<string, unknown>).enabled) {
    const stops = (enh.multiStopJourney as Record<string, unknown>).stops as { station: string; question: string }[] | undefined;
    if (stops?.length) {
      parts.push(`Multi-stop journey through: ${stops.map(s => s.station).join(" -> ")}`);
    }
  }
  if (enh.crowdReactions && (enh.crowdReactions as Record<string, unknown>).enabled) {
    const rt = (enh.crowdReactions as Record<string, unknown>).reactionType;
    if (rt) parts.push(`crowd reactions: ${rt}`);
  }
  if (enh.soundscape && (enh.soundscape as Record<string, unknown>).enabled) {
    const amb = (enh.soundscape as Record<string, unknown>).ambiance;
    if (amb) parts.push(`soundscape: ${amb}`);
  }
  if (enh.plotTwist) parts.push(`plot twist: ${enh.plotTwist}`);
  if (enh.platformPoll && (enh.platformPoll as Record<string, unknown>).enabled) {
    const q = (enh.platformPoll as Record<string, unknown>).question;
    if (q) parts.push(`platform poll: "${q}"`);
  }
  if (enh.trainArrival && (enh.trainArrival as Record<string, unknown>).enabled) {
    parts.push(`train arrival moment`);
  }
  if (enh.seasonalContext && (enh.seasonalContext as Record<string, unknown>).enabled) {
    const season = (enh.seasonalContext as Record<string, unknown>).season;
    if (season) parts.push(`seasonal: ${season}`);
  }
  if (parts.length === 0) return "";
  return `\n\nSUBWAY ENHANCEMENTS: ${parts.join(". ")}.`;
}

function buildStreetEnhancementsContext(req: BuildPromptRequest): string {
  const enh = req.street_enhancements;
  if (!enh) return "";
  const parts: string[] = [];
  if (enh.multiLocationJourney && (enh.multiLocationJourney as Record<string, unknown>).enabled) {
    const locs = (enh.multiLocationJourney as Record<string, unknown>).locations as { name: string; activity: string }[] | undefined;
    if (locs?.length) {
      parts.push(`multi-location journey: ${locs.map(l => l.name).join(" -> ")}`);
    }
  }
  if (enh.crowdConfig && (enh.crowdConfig as Record<string, unknown>).enabled) {
    const density = (enh.crowdConfig as Record<string, unknown>).density;
    const reaction = (enh.crowdConfig as Record<string, unknown>).reaction;
    if (density) parts.push(`crowd density: ${density}`);
    if (reaction) parts.push(`crowd reaction: ${reaction}`);
  }
  if (enh.urbanSoundscape && (enh.urbanSoundscape as Record<string, unknown>).enabled) {
    const amb = (enh.urbanSoundscape as Record<string, unknown>).ambiance;
    if (amb) parts.push(`urban soundscape: ${amb}`);
  }
  if (enh.plotTwist) parts.push(`plot twist: ${enh.plotTwist}`);
  if (enh.streetPoll && (enh.streetPoll as Record<string, unknown>).enabled) {
    const q = (enh.streetPoll as Record<string, unknown>).question;
    if (q) parts.push(`street poll: "${q}"`);
  }
  if (enh.dramaticMoment && (enh.dramaticMoment as Record<string, unknown>).enabled) {
    const t = (enh.dramaticMoment as Record<string, unknown>).type;
    if (t) parts.push(`dramatic moment: ${t}`);
  }
  if (enh.seasonalContext && (enh.seasonalContext as Record<string, unknown>).enabled) {
    const season = (enh.seasonalContext as Record<string, unknown>).season;
    if (season) parts.push(`seasonal: ${season}`);
  }
  if (enh.crossStreetPivot && (enh.crossStreetPivot as Record<string, unknown>).enabled) {
    const pt = (enh.crossStreetPivot as Record<string, unknown>).pivotType;
    if (pt) parts.push(`cross-street pivot: ${pt}`);
  }
  if (parts.length === 0) return "";
  return `\n\nSTREET ENHANCEMENTS: ${parts.join(". ")}.`;
}

function buildMotivationalEnhancementsContext(req: BuildPromptRequest): string {
  const enh = req.motivational_enhancements;
  if (!enh) return "";
  const parts: string[] = [];
  if (enh.transformationArc && (enh.transformationArc as Record<string, unknown>).enabled) {
    const from = (enh.transformationArc as Record<string, unknown>).fromState;
    const to = (enh.transformationArc as Record<string, unknown>).toState;
    if (from && to) parts.push(`transformation arc: ${from} -> ${to}`);
  }
  if (enh.audienceEnergy && (enh.audienceEnergy as Record<string, unknown>).enabled) {
    const level = (enh.audienceEnergy as Record<string, unknown>).level;
    if (level) parts.push(`audience energy: ${level}`);
  }
  if (enh.soundscape && (enh.soundscape as Record<string, unknown>).enabled) {
    const t = (enh.soundscape as Record<string, unknown>).type;
    if (t) parts.push(`soundscape: ${t}`);
  }
  if (enh.breakthroughMoment && (enh.breakthroughMoment as Record<string, unknown>).enabled) {
    const t = (enh.breakthroughMoment as Record<string, unknown>).type;
    if (t) parts.push(`breakthrough moment: ${t}`);
  }
  if (enh.speakerArchetype && (enh.speakerArchetype as Record<string, unknown>).enabled) {
    const a = (enh.speakerArchetype as Record<string, unknown>).archetype;
    if (a) parts.push(`speaker archetype: ${a}`);
  }
  if (enh.pauseForEffect && (enh.pauseForEffect as Record<string, unknown>).enabled) {
    parts.push(`dramatic pause for effect`);
  }
  if (enh.ctaPivot && (enh.ctaPivot as Record<string, unknown>).enabled) {
    const ctaText = (enh.ctaPivot as Record<string, unknown>).ctaText;
    if (ctaText) parts.push(`CTA: "${ctaText}"`);
  }
  if (parts.length === 0) return "";
  return `\n\nMOTIVATIONAL ENHANCEMENTS: ${parts.join(". ")}.`;
}

function buildAdvancedContext(req: BuildPromptRequest): string {
  const parts: string[] = [];
  if (req.language && req.language !== "en") {
    parts.push(`Language: deliver dialogue in ${req.language}`);
  }
  if (req.niche) {
    parts.push(`Content niche: ${req.niche.replace(/_/g, " ")}`);
  }
  if (req.interview_format && req.interview_format !== "solo") {
    parts.push(`Interview format: ${req.interview_format.replace(/_/g, " ")}`);
  }
  if (parts.length === 0) return "";
  return `\n\nADVANCED SETTINGS: ${parts.join(". ")}.`;
}

function assembleSubwayPrompt(
  template: PromptTemplate,
  fragments: PromptFragment[],
  req: BuildPromptRequest
): string {
  const cityContent = buildLocationContext(fragments, req, "city", "nyc");
  const sceneContent = lookupFragment(
    fragments,
    "scene",
    req.scene_type || "platform_waiting"
  );
  const interviewStyleContent = lookupFragment(
    fragments,
    "interview_style",
    req.interview_style || "man_on_street"
  );
  const energyContent = lookupFragment(
    fragments,
    "energy",
    req.energy_level || "conversational"
  );
  const charDesc = buildCharacterDescription(fragments, req);

  const questionContext = req.interview_question
    ? `Being asked: "${req.interview_question}" - capture authentic reaction to this specific question.`
    : `Candid interview moment about ${req.topic.toLowerCase()}, authentic reactions.`;

  let prompt = template.base_prompt
    .replace("{{duration}}", String(req.duration_seconds))
    .replace("{{city_visuals}}", cityContent)
    .replace("{{scene_setting}}", sceneContent)
    .replace("{{interview_style}}", interviewStyleContent)
    .replace("{{character_description}}", charDesc)
    .replace("{{question_context}}", questionContext)
    .replace("{{energy_description}}", energyContent);

  if (req.subway_line) {
    prompt += `\n\nSUBWAY LINE: Set on the ${req.subway_line} line. Include visual cues specific to this line (signage, color coding, familiar station architecture).`;
  }

  if (req.interview_mode) {
    prompt += `\n\nINTERVIEW MODE: ${req.interview_mode.replace(/_/g, " ")} format.`;
  }

  prompt += buildSubwayEnhancementsContext(req);
  prompt += buildScenarioContext(req);
  prompt += buildSocialDynamicsContext(req);
  prompt += buildAdvancedContext(req);

  if (req.angle_prompt) {
    prompt += `\n\nSpecific creative direction: ${req.angle_prompt}`;
  }

  return prompt;
}

function assembleStreetPrompt(
  template: PromptTemplate,
  fragments: PromptFragment[],
  req: BuildPromptRequest
): string {
  const sceneContent = lookupFragment(
    fragments,
    "scene",
    req.street_scene || "busy_sidewalk"
  );
  const locationContent = req.custom_location
    ? req.custom_location
    : sceneContent;
  const interviewStyleContent = lookupFragment(
    fragments,
    "interview_style",
    req.interview_style || "man_on_street"
  );
  const timeContent = lookupFragment(
    fragments,
    "time_of_day",
    req.time_of_day || "midday"
  );
  const energyContent = lookupFragment(
    fragments,
    "energy",
    req.energy_level || "conversational"
  );
  const charDesc = buildCharacterDescription(fragments, req);

  let prompt = template.base_prompt
    .replace("{{duration}}", String(req.duration_seconds))
    .replace("{{location_description}}", locationContent)
    .replace("{{time_description}}", timeContent)
    .replace("{{interview_style}}", interviewStyleContent)
    .replace("{{character_description}}", charDesc)
    .replace("{{topic}}", req.topic.toLowerCase())
    .replace("{{energy_description}}", energyContent);

  prompt += buildStreetEnhancementsContext(req);
  prompt += buildScenarioContext(req);
  prompt += buildSocialDynamicsContext(req);
  prompt += buildAdvancedContext(req);

  if (req.angle_prompt) {
    prompt += `\n\nSpecific creative direction: ${req.angle_prompt}`;
  }

  return prompt;
}

function assembleMotivationalPrompt(
  template: PromptTemplate,
  fragments: PromptFragment[],
  req: BuildPromptRequest
): string {
  const speakerContent = lookupFragment(
    fragments,
    "speaker_style",
    req.speaker_style || "intense_coach"
  );
  const settingContent = lookupFragment(
    fragments,
    "scene",
    req.motivational_setting || "gym"
  );
  const cameraContent = lookupFragment(
    fragments,
    "camera",
    req.camera_style || "dramatic_push"
  );
  const lightingContent = lookupFragment(
    fragments,
    "lighting",
    req.lighting_mood || "dramatic_shadows"
  );

  let prompt = template.base_prompt
    .replace("{{duration}}", String(req.duration_seconds))
    .replace("{{speaker_style}}", speakerContent)
    .replace("{{topic}}", req.topic)
    .replace("{{setting}}", settingContent)
    .replace("{{camera_style}}", cameraContent)
    .replace("{{lighting}}", lightingContent);

  prompt += buildMotivationalEnhancementsContext(req);
  prompt += buildAdvancedContext(req);

  if (req.angle_prompt) {
    prompt += `\n\nSpecific creative direction: ${req.angle_prompt}`;
  }

  return prompt;
}

function assembleStudioPrompt(
  template: PromptTemplate,
  fragments: PromptFragment[],
  req: BuildPromptRequest
): string {
  const setupContent = lookupFragment(
    fragments,
    "scene",
    req.studio_setup || "podcast_desk"
  );
  const lightingContent = lookupFragment(
    fragments,
    "lighting",
    req.studio_lighting || "three_point"
  );

  const interviewerDesc = req.interviewer_type
    ? `Interviewer: ${req.interviewer_type.replace(/_/g, " ")}, ${(req.interviewer_position || "seated_across").replace(/_/g, " ")}.`
    : "Interviewer: Professional, confident, well-dressed host seated at desk.";

  const subjectParts: string[] = [];
  if (req.subject_demographic)
    subjectParts.push(req.subject_demographic.replace(/_/g, " "));
  if (req.subject_gender && req.subject_gender !== "any")
    subjectParts.push(req.subject_gender);
  if (req.subject_style)
    subjectParts.push(`wearing ${req.subject_style.replace(/_/g, " ")}`);
  const subjectDesc =
    subjectParts.length > 0
      ? `Guest: ${subjectParts.join(", ")}.`
      : "Guest: Professional, articulate, confident speaker with genuine expertise on the topic.";

  const questionLine = req.interview_question
    ? `INTERVIEW QUESTION: "${req.interview_question}"`
    : "";

  let prompt = template.base_prompt
    .replace("{{duration}}", String(req.duration_seconds))
    .replace("{{studio_setup}}", setupContent)
    .replace("{{studio_lighting}}", lightingContent)
    .replace("{{interviewer_description}}", interviewerDesc)
    .replace("{{subject_description}}", subjectDesc)
    .replace("{{topic}}", req.topic)
    .replace("{{question_line}}", questionLine);

  prompt += buildAdvancedContext(req);

  if (req.angle_prompt) {
    prompt += `\n\nCREATIVE DIRECTION: ${req.angle_prompt}`;
  }

  return prompt;
}

function assembleWisdomPrompt(
  template: PromptTemplate,
  fragments: PromptFragment[],
  req: BuildPromptRequest
): string {
  const toneContent = lookupFragment(
    fragments,
    "wisdom_tone",
    req.wisdom_tone || "gentle"
  );
  const formatContent = lookupFragment(
    fragments,
    "wisdom_format",
    req.wisdom_format || "street_conversation"
  );
  const demoContent = lookupFragment(
    fragments,
    "wisdom_demographic",
    req.wisdom_demographic || "retirees"
  );
  const settingContent = lookupFragment(
    fragments,
    "scene",
    req.wisdom_setting || "park_bench"
  );

  let prompt = template.base_prompt
    .replace("{{duration}}", String(req.duration_seconds))
    .replace("{{wisdom_format}}", formatContent)
    .replace("{{wisdom_tone}}", toneContent)
    .replace("{{wisdom_setting}}", settingContent)
    .replace("{{wisdom_demographic}}", demoContent)
    .replace("{{topic}}", req.topic);

  prompt += buildAdvancedContext(req);

  if (req.angle_prompt) {
    prompt += `\n\nSPECIFIC CREATIVE DIRECTION: ${req.angle_prompt}`;
  }

  return prompt;
}

function hardenPrompt(
  basePrompt: string,
  template: PromptTemplate,
  req: BuildPromptRequest
): string {
  const systemRules = template.system_rules?.trim() || "";
  const visualAnchors = template.visual_anchors?.trim() || "";
  const forbidden = template.forbidden_elements?.trim() || "";

  return `${GENERIC_QUALITY_RULES}

${systemRules ? `SYSTEM RULES:\n${systemRules}\n` : ""}

${getDurationPacing(req.duration_seconds)}

${visualAnchors ? `VISUAL ANCHORS (CRITICAL):\n${visualAnchors}\n` : ""}

${basePrompt}

${forbidden ? `FORBIDDEN:\n${forbidden}\n` : ""}

${FINAL_SELF_CHECK}`.trim();
}

const WISDOM_SYSTEM_RULES = `CORE IDENTITY FOR ALL SUBJECTS:
- Subject is 55-75 years old with gray/silver hair visible
- Calm confidence, grounded presence, earned wisdom
- No slang, no trendy expressions, no "influencer" energy
- Voice: warm, measured, respectful, wise conversational tone

VISUAL CASTING RULES:
- Natural faces, confident posture, no filter-looks
- Wardrobe: smart casual, timeless, no logos or trendy clothes
- Warm, authentic, real-world experience vibe

WRITING STYLE:
- Short sentences, clear and direct
- Phrases like: "I've learned..." "Here's what I wish I knew..." "What matters is..."
- Optimistic realism, not toxic positivity
- Measured delivery with thoughtful pauses implied

No stereotypes. No mocking age. No "boomer" jokes. Respectful disagreement only.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header is required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isInternalCall = authHeader === `Bearer ${serviceRoleKey}`;
    let authenticatedUserId: string | null = null;

    if (!isInternalCall) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: authUser }, error: authError } = await authClient.auth.getUser();
      if (authError || !authUser) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      authenticatedUserId = authUser.id;
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: BuildPromptRequest = await req.json();
    const { video_type, topic, duration_seconds } = body;

    const VALID_VIDEO_TYPES = ["subway_interview", "street_interview", "motivational", "studio_interview", "wisdom_interview"];
    if (!video_type || !topic || !duration_seconds) {
      return new Response(
        JSON.stringify({
          error: "video_type, topic, and duration_seconds are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!VALID_VIDEO_TYPES.includes(video_type)) {
      return new Response(
        JSON.stringify({ error: `Invalid video_type. Must be one of: ${VALID_VIDEO_TYPES.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (topic.length > 500) {
      return new Response(
        JSON.stringify({ error: "topic exceeds maximum length of 500 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.angle_prompt && body.angle_prompt.length > 2000) {
      return new Response(
        JSON.stringify({ error: "angle_prompt exceeds maximum length of 2000 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.scenario_description && body.scenario_description.length > 2000) {
      return new Response(
        JSON.stringify({ error: "scenario_description exceeds maximum length of 2000 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.custom_location && body.custom_location.length > 500) {
      return new Response(
        JSON.stringify({ error: "custom_location exceeds maximum length of 500 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.interview_question && body.interview_question.length > 1000) {
      return new Response(
        JSON.stringify({ error: "interview_question exceeds maximum length of 1000 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: templates } = await supabase
      .from("prompt_templates")
      .select("*")
      .eq("video_type", video_type)
      .eq("is_active", true)
      .is("user_id", null)
      .order("version", { ascending: false })
      .limit(1);

    const template: PromptTemplate | null = templates?.[0] || null;

    if (!template) {
      return new Response(
        JSON.stringify({
          error: `No active template found for video type: ${video_type}`,
          source: "no_template",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: fragmentRows } = await supabase
      .from("prompt_fragments")
      .select("category, key, content")
      .is("user_id", null)
      .or(`video_type.is.null,video_type.eq.${video_type}`);

    const fragments: PromptFragment[] = fragmentRows || [];

    let assembledPrompt: string;

    switch (video_type) {
      case "subway_interview":
        assembledPrompt = assembleSubwayPrompt(template, fragments, body);
        break;
      case "street_interview":
        assembledPrompt = assembleStreetPrompt(template, fragments, body);
        break;
      case "motivational":
        assembledPrompt = assembleMotivationalPrompt(
          template,
          fragments,
          body
        );
        break;
      case "studio_interview":
        assembledPrompt = assembleStudioPrompt(template, fragments, body);
        break;
      case "wisdom_interview":
        assembledPrompt = assembleWisdomPrompt(template, fragments, body);
        break;
      default:
        assembledPrompt = assembleSubwayPrompt(template, fragments, body);
    }

    if (
      video_type === "wisdom_interview" ||
      body.target_age_group === "older_adults"
    ) {
      assembledPrompt = `${WISDOM_SYSTEM_RULES}\n\n${assembledPrompt}`;
    }

    const provider_prompt = hardenPrompt(assembledPrompt, template, body);

    const response: BuildPromptResponse = {
      provider_prompt,
      negative_prompt: template.negative_prompt || "",
      video_type,
      topic,
      duration_seconds,
      aspect_ratio: "9:16",
      variation_hint: getVariationHint(video_type),
      template_id: template.id,
      source: "backend",
    };

    if (authenticatedUserId) {
      await supabase.from("prompt_generation_logs").insert({
        user_id: authenticatedUserId,
        video_type,
        template_id: template.id,
        input_params: body,
        generated_prompt: provider_prompt,
        source: "backend",
      });
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Build prompt error:", error);
    return new Response(JSON.stringify({ error: "Internal server error", source: "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
