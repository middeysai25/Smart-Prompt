// @deno-types="https://deno.land/std@0.168.0/http/server.d.ts"
import { serve, Handler } from "https://deno.land/std@0.168.0/http/server.ts";

// Define CORS headers
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Define handler with correct typing
const handler: Handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let body: any = {};
  try {
    body = req.body ? await req.json() : {};
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Invalid JSON in request body" }),
      { status: 400, headers: corsHeaders }
    );
  }

  const { userPrompt, conversationHistory, imageData } = body;

  if (!userPrompt && !imageData) {
    return new Response(
      JSON.stringify({ error: "User prompt or image is required" }),
      { status: 400, headers: corsHeaders }
    );
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(
      JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
      { status: 500, headers: corsHeaders }
    );
  }

  const userMessageContent: any = imageData
    ? [
        { type: "text", text: userPrompt || "Analyze this image" },
        { type: "image_url", image_url: { url: imageData } },
      ]
    : userPrompt;

  const messages = [
    {
      role: "system",
      content: `You are Smart Prompt AI, an expert prompt optimizer and assistant.

**IMPORTANT: Your response MUST follow this exact structure:**

**Optimized Prompt:**
[Write a clear, specific, and actionable 2-4 line optimized version of the user's input here]

**Answer:**
[Provide a comprehensive, detailed answer to the optimized prompt here]

Guidelines:
1. ALWAYS show both the optimized prompt AND the detailed answer
2. The optimized prompt should be 2-4 lines maximum
3. Support multilingual queries (Telugu, Hindi, English, etc.) - respond in the same language
4. For images: analyze and provide detailed insights
5. When asked for specific formats (notes, MCQs, summary, code), structure the answer accordingly
6. Be accurate, efficient, and thorough
7. Include examples when relevant

Format-specific guidelines:
- Notes: Bullet-point summaries with key concepts
- MCQs: Multiple choice questions with correct answers marked
- Summary: Concise overview highlighting main points
- Code: Practical code examples with clear explanations`,
    },
    ...(conversationHistory || []),
    {
      role: "user",
      content: userMessageContent,
    },
  ];

  try {
    console.log("Sending request to AI gateway...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const optimizedPrompt = data.choices?.[0]?.message?.content;

    if (!optimizedPrompt) {
      throw new Error("No response from AI");
    }

    console.log("Successfully optimized prompt");

    return new Response(
      JSON.stringify({
        optimizedPrompt,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in optimize-prompt function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

// Start the server
serve(handler);
