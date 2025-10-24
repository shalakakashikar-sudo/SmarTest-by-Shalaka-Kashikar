// supabase/functions/gemini-regenerate-question-flash/index.ts

import { GoogleGenAI, Type } from "https://esm.sh/@google/genai@^1.27.0";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const questionSchema = {
    type: Type.OBJECT,
    properties: {
      type: { type: Type.STRING },
      text: { type: Type.STRING },
      marks: { type: Type.NUMBER },
      options: { type: Type.ARRAY, items: { type: Type.STRING } },
      correctAnswer: { type: Type.STRING },
      passage: { type: Type.STRING },
      comprehensionQuestions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            sampleAnswer: { type: Type.STRING },
            type: { type: Type.STRING },
            marks: { type: Type.NUMBER },
          }
        }
      },
      expectedWordLimit: { type: Type.NUMBER },
      markingScheme: { type: Type.STRING },
    },
    required: ["type", "text", "marks"],
};

async function generateWithFallback(prompt: string, schema: any, primaryModel: 'gemini-flash-latest' | 'gemini-2.5-pro', proConfig: any = {}) {
    // --- 1. Try Gemini First ---
    const geminiApiKey = (Deno as any).env.get('GEMINI_API_KEY');
    if (geminiApiKey) {
        try {
            console.log(`Attempting Gemini with model ${primaryModel}`);
            const ai = new GoogleGenAI({ apiKey: geminiApiKey });
            const payload = {
                model: primaryModel,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    ...proConfig,
                }
            };
            const response = await ai.models.generateContent(payload);
            console.log(`Success with Gemini.`);
            return response.text;
        } catch (error) {
            console.warn(`Gemini failed:`, error.message);
        }
    } else {
        console.log("GEMINI_API_KEY not found. Skipping Gemini.");
    }
    console.log("Gemini failed or was skipped. Falling back to Groq.");

    // --- 2. Fallback to Groq ---
    const groqApiKey = (Deno as any).env.get('GROQ_API_KEY');
    if (groqApiKey) {
        try {
            console.log("Attempting Groq...");
            const groqPrompt = `${prompt}\n\nIMPORTANT: Respond with a single, raw JSON object that strictly conforms to the provided JSON schema. Do not add any commentary or markdown formatting. The JSON schema is: ${JSON.stringify(schema)}`;
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "llama3-8b-8192",
                    messages: [{ role: "user", content: groqPrompt }],
                    response_format: { type: "json_object" },
                }),
            });
            if (!response.ok) throw new Error(`Groq API error (${response.status}): ${await response.text()}`);
            const data = await response.json();
            console.log("Success with Groq.");
            return data.choices[0].message.content;
        } catch (error) {
            console.warn("Groq fallback failed:", error.message);
        }
    } else {
        console.log("GROQ_API_KEY not found. Skipping Groq.");
    }
    console.log("Groq failed or was skipped. Falling back to OpenAI.");

    // --- 3. Fallback to OpenAI ---
    const openaiApiKey = (Deno as any).env.get('OPENAI_API_KEY');
    if (openaiApiKey) {
        try {
            console.log("Attempting OpenAI...");
            const openaiPrompt = `${prompt}\n\nIMPORTANT: Respond with a single, raw JSON object that strictly conforms to the provided JSON schema. Do not add any commentary or markdown formatting. The JSON schema is: ${JSON.stringify(schema)}`;
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [{ role: "user", content: openaiPrompt }],
                    response_format: { type: "json_object" },
                }),
            });
            if (!response.ok) throw new Error(`OpenAI API error (${response.status}): ${await response.text()}`);
            const data = await response.json();
            console.log("Success with OpenAI.");
            return data.choices[0].message.content;
        } catch (error) {
            console.warn("OpenAI fallback failed:", error.message);
        }
    } else {
        console.log("OPENAI_API_KEY not found. Skipping OpenAI.");
    }

    throw new Error('All API providers (Gemini, Groq, OpenAI) failed. Please check your keys, billing, and API status.');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { question } = await req.json();

    const prompt = `Regenerate the following question. Create a new, different question on the same underlying topic.
      The new question MUST have the same type ('${question.type}'), and the same number of marks (${question.marks}).
      Keep the difficulty level similar.
      
      Original Question: "${question.text}"`;

    const jsonResponseString = await generateWithFallback(prompt, questionSchema, 'gemini-flash-latest');

    return new Response(jsonResponseString, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in gemini-regenerate-question-flash:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});