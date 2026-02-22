import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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

function assembleSubwayPrompt(
  template: PromptTemplate,
  fragments: PromptFragment[],
  req: BuildPromptRequest
): string {
  const cityContent = lookupFragment(fragments, "city", req.city_style || "nyc");
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
    .replace("{{location_description}}", sceneContent)
    .replace("{{time_description}}", timeContent)
    .replace("{{interview_style}}", interviewStyleContent)
    .replace("{{character_description}}", charDesc)
    .replace("{{topic}}", req.topic.toLowerCase())
    .replace("{{energy_description}}", energyContent);

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    if (authHeader) {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        await supabase.from("prompt_generation_logs").insert({
          user_id: user.id,
          video_type,
          template_id: template.id,
          input_params: body,
          generated_prompt: provider_prompt,
          source: "backend",
        });
      }
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Build prompt error:", message);
    return new Response(JSON.stringify({ error: message, source: "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
