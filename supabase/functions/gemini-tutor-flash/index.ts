// supabase/functions/gemini-tutor-flash/index.ts

import { GoogleGenAI } from "https://esm.sh/@google/genai@^1.27.0";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Fix: Declare Deno to address "Cannot find name 'Deno'" error in TypeScript environments that don't have Deno types globally available.
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function generateTutorResponseWithFallback(prompt: string, history: { role: 'user' | 'model', parts: { text: string }[] }[]) {
    const systemInstruction = "You are SmarTest AI Tutor, a friendly and encouraging study assistant. Your goal is to help students understand concepts, not just give them answers. Explain things clearly and concisely. If a student asks for a direct answer to a test-like question, guide them toward the solution instead of providing it outright.";

    // --- 1. Try Gemini First ---
    // Fix: Use Deno.env.get after declaring Deno to fix type error.
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (geminiApiKey) {
        try {
            console.log(`Attempting Gemini`);
            const ai = new GoogleGenAI({ apiKey: geminiApiKey });
            const payload = {
                model: 'gemini-flash-latest',
                contents: [...history, { role: 'user', parts: [{ text: prompt }] }],
                config: { systemInstruction },
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
    // Fix: Use Deno.env.get after declaring Deno to fix type error.
    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    if (groqApiKey) {
        try {
            console.log("Attempting Groq...");
            const messages = [
                { role: "system", content: systemInstruction },
                ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.parts[0].text })),
                { role: "user", content: prompt }
            ];
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: "llama3-8b-8192", messages }),
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
    // Fix: Use Deno.env.get after declaring Deno to fix type error.
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (openaiApiKey) {
        try {
            console.log("Attempting OpenAI...");
            const messages = [
                { role: "system", content: systemInstruction },
                ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.parts[0].text })),
                { role: "user", content: prompt }
            ];
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: "gpt-4o-mini", messages }),
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
    const { prompt, history } = await req.json();
    const responseText = await generateTutorResponseWithFallback(prompt, history);

    return new Response(JSON.stringify({ text: responseText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in gemini-tutor-flash:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
