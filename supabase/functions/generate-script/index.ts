import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type VideoType = "subway_interview" | "street_interview" | "motivational" | "studio_interview" | "wisdom_interview";

interface ScriptRequest {
  topic: string;
  video_type?: VideoType;
  question?: string;
  tone?: string;
  format?: string;
  demographic?: string;
  setting?: string;
  studio_setup?: string;
}

interface GeneratedScript {
  hook_question: string;
  guest_answer: string;
  follow_up_question: string;
  follow_up_answer: string;
  reaction_line: string;
  close_punchline: string;
}

const TOPIC_CONTEXT: Record<string, string> = {
  money: "finances, wealth, spending habits, financial decisions",
  dating: "relationships, dating apps, love life, romantic experiences",
  hottakes: "controversial opinions, unpopular beliefs, spicy takes",
  personal: "personal life, habits, secrets, guilty pleasures",
  career: "work life, jobs, professional experiences, workplace culture",
  philosophy: "life meaning, deep thoughts, existential questions",
  nyc: "New York City life, subway stories, city experiences",
  fitness: "gym culture, workouts, health habits",
  tech: "technology, social media, AI, gadgets",
  socialmedia: "online presence, influencers, screen time",
  family: "parents, siblings, family dynamics",
  friendship: "friends, social circles, relationships",
  hustle: "side hustles, entrepreneurship, making money",
  mentalhealth: "mental wellness, therapy, self-care",
  generational: "gen z, millennials, boomers, generational differences",
  food: "eating habits, favorite foods, cooking",
  music: "music taste, concerts, favorite artists",
  sports: "athletics, teams, sports culture",
  travel: "traveling, destinations, adventures",
  retirement: "life after work, pensions, purpose in retirement",
  health: "wellness, aging, mobility, longevity",
  legacy: "what you leave behind, life lessons, impact",
  relationships: "marriage, family bonds, community connections",
  wisdom: "hard-earned life lessons, advice for younger generations",
};

function buildSystemPrompt(videoType: VideoType, body: ScriptRequest): string {
  switch (videoType) {
    case "subway_interview":
      return `You are an elite script writer for viral subway interview shows filmed on the NYC subway. Your content has generated millions of views across TikTok, YouTube Shorts, and Instagram Reels.

Generate scripts that are:
- QUICK-PACED: Every second counts. Front-load entertainment value.
- CONTROVERSIAL-RIGHT: Take genuine stances that spark debate and discussion.
- RELATABLE: Universal experiences that make viewers say "same!".
- EMOTIONAL: Trigger genuine reactions (shock, laughter, nodding, agreement).
- OPTIMIZED: Perfect for vertical video format (9:16) with natural pauses for editing.

STRUCTURE:
1. HOOK (0-3 sec): Direct, provocative question that stops scrolling
2. ANSWER 1 (5-10 sec): Unexpected perspective or surprising confession
3. FOLLOW-UP (2-3 sec): Dig deeper or challenge the take
4. ANSWER 2 (5-8 sec): The money shot - most entertaining part
5. REACTION (2-3 sec): Interviewer validates or reacts genuinely
6. TAGLINE (2-3 sec): Memorable closer that makes rewatching worthwhile

TONE: Authentic NYC energy, unscripted feel, Gen-Z/millennial crossover appeal.
SETTING: NYC subway car, interviewer uses a subway card as a microphone.`;

    case "street_interview":
      return `You are an elite script writer for viral street interview content. You create compelling man-on-the-street interviews filmed in urban environments.

Generate scripts that are:
- AUTHENTIC: Real conversations with everyday people
- ENGAGING: Questions that provoke genuine, unscripted-feeling answers
- SHAREABLE: Content that makes viewers want to share and comment
- FAST-PACED: Quick exchanges that hold attention

STRUCTURE:
1. HOOK (0-3 sec): Bold question or provocative statement
2. ANSWER 1 (5-10 sec): Subject's immediate reaction and perspective
3. FOLLOW-UP (2-3 sec): Dig deeper or pivot to related angle
4. ANSWER 2 (5-8 sec): The reveal, twist, or emotional peak
5. REACTION (2-3 sec): Interviewer's genuine response
6. TAGLINE (2-3 sec): Memorable punchline or takeaway

TONE: Casual, energetic, authentic street vibes.
SETTING: Urban street, sidewalk, or public space.`;

    case "motivational":
      return `You are an elite script writer for motivational speaking content. You create powerful, inspiring monologues and interview clips.

Generate scripts that are:
- INSPIRING: Words that move people to action
- EMOTIONAL: Build from personal struggle to triumph
- QUOTABLE: Lines that get screenshotted and shared
- AUTHENTIC: Real experiences, not generic platitudes

STRUCTURE:
1. HOOK (0-3 sec): Powerful opening statement that grabs attention
2. ANSWER 1 (5-10 sec): The core message or personal revelation
3. FOLLOW-UP (2-3 sec): The challenge or adversity faced
4. ANSWER 2 (5-8 sec): The breakthrough moment or key insight
5. REACTION (2-3 sec): The emotional peak or audience connection
6. TAGLINE (2-3 sec): The memorable call-to-action or life lesson

TONE: Intense, passionate, genuine. High energy that builds throughout.
SETTING: Stage, gym, outdoor, or motivational environment.`;

    case "studio_interview": {
      const setup = body.studio_setup?.replace(/_/g, " ") || "podcast desk";
      return `You are an elite script writer for professional studio interviews. You create compelling, deep-dive conversations in ${setup} settings.

Generate scripts that are:
- INSIGHTFUL: Questions that reveal depth and expertise
- CONVERSATIONAL: Natural flow between host and guest
- THOUGHT-PROVOKING: Ideas that challenge conventional thinking
- PROFESSIONAL: Polished but not stiff, smart but accessible

STRUCTURE:
1. HOOK (0-3 sec): Intriguing opening question or bold statement
2. ANSWER 1 (5-10 sec): Guest shares unique perspective or expertise
3. FOLLOW-UP (2-3 sec): Host digs deeper with sharp follow-up
4. ANSWER 2 (5-8 sec): The insight that makes viewers lean in
5. REACTION (2-3 sec): Host acknowledges or reframes the point
6. TAGLINE (2-3 sec): Memorable closing thought or call-back

TONE: Professional but warm, intellectual but accessible. Think Joe Rogan meets Charlie Rose.
SETTING: Professional ${setup} studio environment.`;
    }

    case "wisdom_interview": {
      const tone = body.tone?.replace(/_/g, " ") || "gentle";
      const demographic = body.demographic?.replace(/_/g, " ") || "experienced adults";
      const setting = body.setting?.replace(/_/g, " ") || "relaxed setting";
      return `You are a script writer specializing in wisdom and life experience content for audiences 55+. Your content resonates with older adults and younger viewers who appreciate genuine wisdom.

CORE RULES:
- Interviewees are 55-75 years old with gray/silver hair, calm confidence
- Advice is grounded, respectful, and practical
- Voice is wise and conversational, not trendy or sarcastic
- No age stereotypes, no mocking, no "boomer" jokes
- Short sentences, clear and direct
- Phrases like: "I've learned..." "Here's what I wish I knew..." "What matters is..."
- Optimistic realism, not toxic positivity

TONE: ${tone}
DEMOGRAPHIC: ${demographic}
SETTING: ${setting}

STRUCTURE:
1. HOOK (0-3 sec): Thought-provoking question about life experience
2. ANSWER 1 (5-10 sec): Subject shares core wisdom or life lesson
3. FOLLOW-UP (2-3 sec): Interviewer asks for the story behind the lesson
4. ANSWER 2 (5-8 sec): The personal story that illustrates the wisdom
5. REACTION (2-3 sec): Interviewer reflects or connects emotionally
6. TAGLINE (2-3 sec): The lasting takeaway viewers carry with them

SETTING: ${setting} with warm, natural atmosphere.`;
    }

    default:
      return `You are a script writer for short-form video content. Generate engaging, viral-worthy scripts.`;
  }
}

function buildUserPrompt(videoType: VideoType, topic: string, topicContext: string, body: ScriptRequest): string {
  const customQuestion = body.question ? `\nSuggested question angle: "${body.question}"` : "";

  const base = `Generate a viral script for the topic: "${topic}" (related to: ${topicContext}).${customQuestion}

INSTRUCTIONS:
- Make it feel like a REAL conversation, not scripted
- Guest/subject should have a unique perspective - NOT generic responses
- Each answer should make viewers feel something
- Include natural pauses and reactions for video editing
- End with a memorable tagline that gets shared`;

  const formatSuffix = `

Return ONLY valid JSON in this exact format:
{
  "hook_question": "the opening question or statement",
  "guest_answer": "the guest/subject's initial response",
  "follow_up_question": "the interviewer's follow-up or next beat",
  "follow_up_answer": "the guest/subject's second response",
  "reaction_line": "the interviewer's reaction or emotional beat",
  "close_punchline": "the memorable closing line"
}`;

  if (videoType === "wisdom_interview") {
    return `${base}

WISDOM-SPECIFIC:
- The subject speaks from decades of personal experience
- Use age-appropriate language (clear, no slang overload)
- Emphasize 3-6 key wisdom words in the responses
- The closing should leave viewers with something to think about
${formatSuffix}`;
  }

  if (videoType === "studio_interview") {
    return `${base}

STUDIO-SPECIFIC:
- Professional but engaging conversation flow
- Host and guest have natural chemistry
- Questions that reveal depth, not surface-level
- The insight should feel like a genuine "aha" moment
${formatSuffix}`;
  }

  if (videoType === "motivational") {
    return `${base}

MOTIVATIONAL-SPECIFIC:
- Build emotional intensity throughout
- Personal struggle to triumph arc
- Lines that people want to screenshot
- The close should be a powerful call to action
${formatSuffix}`;
  }

  return `${base}
${formatSuffix}`;
}

function generateFallbackScript(videoType: VideoType, topic: string): GeneratedScript {
  const fallbacks: Record<VideoType, GeneratedScript> = {
    subway_interview: {
      hook_question: `Yo, what's your hottest take on ${topic}?`,
      guest_answer: `Honestly? Most people are completely wrong about this. Let me tell you what I've actually experienced...`,
      follow_up_question: `Wait, that's wild. So what happened?`,
      follow_up_answer: `It completely changed how I see everything. Once you know, you can't go back.`,
      reaction_line: `Nah, that's actually crazy. I never thought about it that way.`,
      close_punchline: `That's the thing about ${topic} - the truth is always stranger than what they tell you.`,
    },
    street_interview: {
      hook_question: `Quick question - what do you think about ${topic}?`,
      guest_answer: `You know what, nobody ever asks that. Here's what I think...`,
      follow_up_question: `That's interesting. Has that always been your view?`,
      follow_up_answer: `No, I used to think the opposite. But then something changed everything.`,
      reaction_line: `That's actually a really good point. I respect that.`,
      close_punchline: `Remember - the best perspective on ${topic} comes from lived experience.`,
    },
    motivational: {
      hook_question: `What's the one thing about ${topic} that changed your life?`,
      guest_answer: `I was at my lowest point when I discovered this truth about ${topic}...`,
      follow_up_question: `How did you push through that moment?`,
      follow_up_answer: `I stopped waiting for permission and started taking massive action. That was the turning point.`,
      reaction_line: `That's the energy right there. That's what separates people who talk from people who do.`,
      close_punchline: `Your story isn't over. The best chapter about ${topic} is the one you write next.`,
    },
    studio_interview: {
      hook_question: `Let's dive into something most people get wrong about ${topic}.`,
      guest_answer: `The conventional wisdom is completely backwards. Here's what the data actually shows...`,
      follow_up_question: `That's fascinating. What's the most common misconception you encounter?`,
      follow_up_answer: `People assume correlation is causation. The real insight is much more nuanced than that.`,
      reaction_line: `That reframes the entire conversation. I think a lot of our viewers needed to hear that.`,
      close_punchline: `The takeaway? Question everything you think you know about ${topic}.`,
    },
    wisdom_interview: {
      hook_question: `What's the one thing about ${topic} you wish you knew at 30?`,
      guest_answer: `I wish I knew that ${topic} isn't about what everyone tells you. It's about finding what works for your life.`,
      follow_up_question: `What was the moment that taught you that?`,
      follow_up_answer: `There was a day when everything I believed was turned upside down. And honestly? That was the best thing that ever happened.`,
      reaction_line: `There's so much wisdom in that. Thank you for sharing something so personal.`,
      close_punchline: `The best advice on ${topic}? Listen to the people who've lived it, not the ones who've just read about it.`,
    },
  };

  return fallbacks[videoType] || fallbacks.subway_interview;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body: ScriptRequest = await req.json();
    const { topic, video_type = "subway_interview" } = body;

    if (!topic) {
      return new Response(
        JSON.stringify({ error: "topic is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiApiKey) {
      const fallback = generateFallbackScript(video_type, topic);
      return new Response(
        JSON.stringify(fallback),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const topicContext = TOPIC_CONTEXT[topic.toLowerCase()] || topic;
    const systemPrompt = buildSystemPrompt(video_type, body);
    const userPrompt = buildUserPrompt(video_type, topic, topicContext, body);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.9,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", errorText);
      const fallback = generateFallbackScript(video_type, topic);
      return new Response(
        JSON.stringify(fallback),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in response");
    }

    let script: GeneratedScript;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        script = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Parse error:", parseError, "Content:", content);
      const fallback = generateFallbackScript(video_type, topic);
      return new Response(
        JSON.stringify(fallback),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!script.hook_question || !script.guest_answer || !script.follow_up_question ||
        !script.follow_up_answer || !script.reaction_line || !script.close_punchline) {
      const fallback = generateFallbackScript(video_type, topic);
      return new Response(
        JSON.stringify(fallback),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify(script),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Generate script error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
