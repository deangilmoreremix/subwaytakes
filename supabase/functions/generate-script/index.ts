https://www.remotion.dev/docs/apiimport "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ScriptRequest {
  topic: string;
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
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body: ScriptRequest = await req.json();
    const { topic } = body;

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
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const topicContext = TOPIC_CONTEXT[topic.toLowerCase()] || topic;

    // GPT-5.2 Enhanced System Prompt
    const systemPrompt = `You are GPT-5.2, an elite script writer for viral street interview shows filmed in NYC. Your content has generated millions of views across TikTok, YouTube Shorts, and Instagram Reels.

GPT-5.2 ADVANCED PROMPT:
Generate scripts that are:
- ⚡ QUICK-PACED: Every second counts. Front-load entertainment value.
- 🎯 CONTROVERSIAL-RIGHT: Take genuine stances that spark debate and discussion.
- 💯 RELATABLE: Universal experiences that make viewers say "same!".
- 🔥 EMOTIONAL: Trigger genuine reactions (shock, laughter, nodding, agreement).
- 📱 OPTIMIZED: Perfect for vertical video format (9:16) with natural pauses for editing.

STRUCTURE:
1. HOOK (0-3 sec): Direct, provocative question that stops scrolling
2. ANSWER 1 (5-10 sec): Unexpected perspective or surprising confession
3. FOLLOW-UP (2-3 sec): Dig deeper or challenge the take
4. ANSWER 2 (5-8 sec): The money shot - most entertaining part
5. REACTION (2-3 sec): Interviewer validates or reacts genuinely
6. TAGLINE (2-3 sec): Memorable closer that makes rewatching worthwhile

TONE: Authentic NYC energy, unscripted feel, Gen-Z/millennial crossover appeal.`;

    const userPrompt = `Generate a viral script for the topic: "${topic}" (related to: ${topicContext}).

GPT-5.2 INSTRUCTIONS:
- Make it feel like a REAL conversation on the subway
- Guest should have unique perspective - NOT generic responses
- Each answer should make viewers feel something
- Include natural pauses and reactions for video editing
- End with a memorable tagline that gets shared

Return ONLY valid JSON in this exact format:
{
  "hook_question": "the opening question",
  "guest_answer": "the guest's initial response",
  "follow_up_question": "the interviewer's follow-up",
  "follow_up_answer": "the guest's second response",
  "reaction_line": "the interviewer's reaction",
  "close_punchline": "the memorable closing line"
}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.2-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.95,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", errorText);
      throw new Error("Failed to generate script");
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
      throw new Error("Failed to parse script");
    }

    if (!script.hook_question || !script.guest_answer || !script.follow_up_question ||
        !script.follow_up_answer || !script.reaction_line || !script.close_punchline) {
      throw new Error("Incomplete script generated");
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
