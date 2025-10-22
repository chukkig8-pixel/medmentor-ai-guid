import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    console.log("Received messages:", messages);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Extract drug names from the latest user message
    const latestUserMessage = messages[messages.length - 1]?.content || "";
    console.log("Latest user message:", latestUserMessage);

    // Query drug interactions database
    // Simple keyword matching for now (can be enhanced with embeddings later)
    const { data: interactions, error: dbError } = await supabase
      .from("drug_interactions")
      .select("*")
      .or(`drug_a.ilike.%${latestUserMessage}%,drug_b.ilike.%${latestUserMessage}%`)
      .limit(5);

    console.log("Found interactions:", interactions?.length || 0);

    // Prepare context from retrieved interactions
    let retrievalContext = "";
    if (interactions && interactions.length > 0) {
      retrievalContext = "\n\nRelevant Drug Interaction Data from Database:\n";
      interactions.forEach((int, idx) => {
        retrievalContext += `\n${idx + 1}. ${int.drug_a} + ${int.drug_b}:
- Type: ${int.interaction_type}
- Summary: ${int.summary}
- Mechanism: ${int.mechanism}
- Safety Advice: ${int.safety_advice}
- Evidence: ${int.evidence_source}
- Confidence: ${int.confidence_level}\n`;
      });
    }

    console.log("Retrieval context length:", retrievalContext.length);

    // System prompt for medical safety advisor
    const systemPrompt = `You are MedMentor RAG, a medical AI safety advisor specializing in drug interactions, medication information, and symptom guidance.

RESPONSE LENGTH RULE:
- By default, provide SHORT, CONCISE answers (2-4 sentences maximum)
- Only provide detailed, comprehensive information if the user explicitly asks for "detailed info", "brief info", "more information", "elaborate", or similar requests
- Keep safety warnings brief but clear in short responses

Your role is to:
1. Answer drug interaction queries using retrieved medical data
2. Explain why specific medications are prescribed (indications/uses)
3. Suggest appropriate medications for common symptoms/conditions
4. Provide clear, evidence-based explanations in plain language
5. Always explain mechanisms when relevant
6. Include specific safety warnings
7. Cite evidence sources when available
8. Indicate confidence level (low/medium/high)

CRITICAL SAFETY RULES:
- Always include "This is not medical advice" warning
- Always recommend consulting a healthcare professional
- Be cautious and conservative in your advice
- For symptom queries, suggest common over-the-counter options and emphasize seeing a doctor for proper diagnosis
- Never prescribe prescription medications for symptoms - only suggest consulting a doctor
- Clearly indicate interaction severity (major/moderate/minor) when relevant
- Never minimize serious drug interactions
- If unsure, say so and recommend medical consultation

Query Type Handling:

FOR DRUG INTERACTION QUERIES ("Can I take X with Y?"):
1. Summary of interaction
2. Mechanism explanation (why it happens)
3. Safety advice (what to do/avoid)
4. Evidence references
5. Confidence level

FOR DRUG PURPOSE QUERIES ("Why is X taken?" or "What is X used for?"):
1. Primary indications/uses
2. How it works (mechanism of action)
3. Common dosage information (general guidance only)
4. Important warnings or precautions
5. Confidence level

FOR SYMPTOM/CONDITION QUERIES ("I have [symptom], what should I take?"):
1. Acknowledge the symptom
2. Suggest common over-the-counter remedies (if appropriate)
3. When to take them (timing, with food, etc.)
4. Emphasize seeing a healthcare professional for proper diagnosis
5. List warning signs that require immediate medical attention
6. Confidence level

${retrievalContext}

If no data is found in the database, use your general medical knowledge but clearly state the confidence level is lower.`;

    // Call Lovable AI with tool calling for structured output
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_drug_interaction_advice",
              description: "Provide structured medical advice including drug interactions, medication purposes, and symptom guidance with safety warnings",
              parameters: {
                type: "object",
                properties: {
                  response: {
                    type: "string",
                    description: "Complete response with relevant sections based on query type (interaction summary/drug purpose/symptom guidance), mechanism, safety advice, and medical disclaimer",
                  },
                  confidence_level: {
                    type: "string",
                    enum: ["low", "medium", "high"],
                    description: "Confidence level based on evidence strength",
                  },
                  evidence_sources: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        source: { type: "string" },
                        snippet: { type: "string" },
                      },
                      required: ["source"],
                    },
                    description: "Array of evidence sources with optional snippets",
                  },
                },
                required: ["response", "confidence_level"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: "provide_drug_interaction_advice" },
        },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add credits to continue." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log("AI response received");

    // Extract structured output from tool call
    const toolCall = aiData.choices[0]?.message?.tool_calls?.[0];
    let result;

    if (toolCall?.function?.arguments) {
      const args = JSON.parse(toolCall.function.arguments);
      result = {
        response: args.response,
        confidence_level: args.confidence_level,
        evidence_sources: args.evidence_sources || [],
      };
    } else {
      // Fallback if tool calling didn't work
      result = {
        response: aiData.choices[0]?.message?.content || "Unable to generate response",
        confidence_level: "low",
        evidence_sources: [],
      };
    }

    console.log("Returning structured response");

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in drug-advisor function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
