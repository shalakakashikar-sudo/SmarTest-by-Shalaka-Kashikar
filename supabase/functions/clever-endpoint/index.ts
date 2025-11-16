
// supabase/functions/clever-endpoint/index.ts
// FIX: Import GenerateContentResponse to correctly type the API response.
import { GoogleGenAI, Type, GenerateContentResponse } from "https://esm.sh/@google/genai@^1.27.0";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fix: Declare Deno to address "Cannot find name 'Deno'" error in TypeScript environments that don't have Deno types globally available.
declare const Deno: any;

// Minimal types for fallback API providers to avoid using `any`
interface ApiChoice { message: { content: string }; }
interface GroqApiResponse { choices: ApiChoice[]; }
interface OpenAiApiResponse { choices: ApiChoice[]; }


const evaluationSchema = {
  type: Type.OBJECT,
  properties: {
    overallScore: {
      type: Type.NUMBER,
      description: "This field is deprecated. Calculate on the client-side. Return 0."
    },
    feedback: {
      type: Type.STRING,
      description: "Overall constructive feedback for the student. Write in simple, encouraging language. Use bullet points (e.g., using '-') for any lists."
    },
    suggestions: {
      type: Type.STRING,
      description: "Actionable suggestions for what the student should study or practice next. Use bullet points."
    },
    strengths: {
      type: Type.STRING,
      description: "A summary of the topics or skills the student demonstrated well. Use bullet points and be specific and encouraging."
    },
    weaknesses: {
      type: Type.STRING,
      description: "A summary of the topics or skills the student struggled with. Use bullet points and be constructive."
    },
    questionScores: {
      type: Type.ARRAY,
      description: "An array of scores and feedback for each individual question.",
      items: {
        type: Type.OBJECT,
        properties: {
          score: {
            type: Type.NUMBER,
            description: "The raw number of marks awarded for this question."
          },
          feedback: {
            type: Type.STRING,
            description: "Specific, point-by-point feedback for the student's answer to this question. Praise what they did right first. Then, pinpoint specific mistakes in grammar, spelling, punctuation, or factual accuracy. Use bullet points for clarity."
          }
        },
        required: [
          "score",
          "feedback"
        ]
      }
    }
  },
  required: [
    "overallScore",
    "feedback",
    "suggestions",
    "strengths",
    "weaknesses",
    "questionScores"
  ]
};

// --- NEW: Exponential Backoff Retry Helper ---
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err; // Re-throw the last error
      const wait = 1000 * Math.pow(2, i) + Math.random() * 1000; // 1s, 2s, 4s + jitter
      console.warn(`Retry attempt ${i + 1} of ${retries} failed. Waiting ${wait.toFixed(0)}ms before next attempt. Error:`, err.message);
      await new Promise(res => setTimeout(res, wait));
    }
  }
  throw new Error("All retries failed.");
}

async function generateWithFallback(prompt: string, schema: any, primaryModel: 'gemini-flash-latest' | 'gemini-2.5-pro', proConfig: any = {}) {
  // --- 1. Try Gemini First ---
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
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
          ...proConfig
        }
      };
      // FIX: Explicitly type the awaited response to resolve the property 'text' does not exist error.
      const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent(payload));
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
  const groqApiKey = Deno.env.get('GROQ_API_KEY');
  if (groqApiKey) {
    try {
      console.log("Attempting Groq...");
      const groqPrompt = `${prompt}\n\nIMPORTANT: Respond with a single, raw JSON object that strictly conforms to the provided JSON schema. Do not add any commentary or markdown formatting. The JSON schema is: ${JSON.stringify(schema)}`;
      const response = await withRetry(() => fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          messages: [{ role: "user", content: groqPrompt }],
          response_format: { type: "json_object" }
        })
      }));
      if (!response.ok) throw new Error(`Groq API error (${response.status}): ${await response.text()}`);
      const data = await response.json() as GroqApiResponse;
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
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (openaiApiKey) {
    try {
      console.log("Attempting OpenAI...");
      const openaiPrompt = `${prompt}\n\nIMPORTANT: Respond with a single, raw JSON object that strictly conforms to the provided JSON schema. Do not add any commentary or markdown formatting. The JSON schema is: ${JSON.stringify(schema)}`;
      const response = await withRetry(() => fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: openaiPrompt }],
          response_format: { type: "json_object" }
        })
      }));
      if (!response.ok) throw new Error(`OpenAI API error (${response.status}): ${await response.text()}`);
      const data = await response.json() as OpenAiApiResponse;
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

// Function to convert ArrayBuffer to hex string
function bufferToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { questions, answers } = await req.json();

    // --- NEW: Caching Logic ---
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const submissionString = JSON.stringify({ questions, answers });
    const submissionBuffer = new TextEncoder().encode(submissionString);
    // FIX: Corrected the hashing algorithm from the invalid "SHA-265" to "SHA-256".
    const hashBuffer = await crypto.subtle.digest("SHA-256", submissionBuffer);
    const hash = bufferToHex(hashBuffer);

    const { data: cached, error: cacheError } = await supabaseAdmin.from("evaluations_cache").select("result").eq("hash", hash).single();

    if (cacheError && cacheError.code !== 'PGRST116') { // Ignore 'PGRST116' (No rows found)
        console.warn("Cache read error:", cacheError.message);
    }

    if (cached) {
      console.log("Cache hit. Returning previous evaluation.");
      return new Response(JSON.stringify(cached.result), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    console.log("Cache miss. Proceeding with AI evaluation.");
    // --- End Caching Logic ---

    const prompt = `
      You are an expert AI Test Evaluator. Your persona is that of a meticulous, strict, yet fair and encouraging teacher. Your primary objective is to provide an exhaustive and highly detailed evaluation of a student's test answers to facilitate deep learning.

      **Core Evaluation Mandate:**
      You must scrutinize every single word and sentence. Your feedback for each question must be a comprehensive breakdown of every mistake, no matter how minor.

      **Detailed Error Analysis (For Each Question):**
      For every answer, you must identify and provide specific feedback on ALL of the following categories:
      1.  **Spelling Errors:** List every misspelled word and provide its correct spelling. (e.g., "The word 'seperate' should be spelled 'separate'.")
      2.  **Punctuation Mistakes:** Point out every missing comma, incorrect use of a period, missing apostrophe, etc. (e.g., "A comma is needed after the introductory phrase 'However'." or "The sentence ending 'its a great day' is missing an apostrophe in 'it's'.")
      3.  **Grammatical Errors:** Identify every grammatical mistake, such as subject-verb agreement, incorrect tense, or improper sentence structure. (e.g., "The phrase 'they was' should be 'they were'.")
      4.  **Capitalization Errors:** Note every instance where capitalization is used incorrectly, especially at the beginning of sentences or for proper nouns.
      5.  **Contextual & Factual Accuracy:** Compare the student's answer against the marking scheme and sample answer. Point out any factual inaccuracies or misunderstandings of the topic.
      6.  **Flow, Cohesion, and Expression:** Comment on the logical flow of the arguments, the clarity of the expression, and how well the ideas connect. Suggest better phrasing where applicable.

      **Grading:**
      - Award marks strictly based on the provided 'markingScheme' and 'sampleAnswer'. For reading comprehension sub-questions, you MUST use the 'markingScheme' provided within that specific sub-question if it exists.
      - **Deduct marks systematically for every single error** you identify in the categories above. The final score for a question should reflect both content accuracy and the quality of the writing.

      **Formatting and Tone:**
      - For each question's feedback, **ALWAYS start with one encouraging sentence** about what the student did well.
      - After the positive remark, create a bulleted list (using '*') detailing **every single mistake** found.
      - Maintain an encouraging but precise tone throughout.

      Here is the test and the student's answers:
      ${JSON.stringify({
      questions,
      studentAnswers: answers
    }, null, 2)}

      **Final Output Instructions (Strictly follow):**
      - Your response MUST be a single JSON object conforming to the provided schema.
      - The 'questionScores' array MUST have the exact same number of items as there are questions.
      - For reading comprehension, combine feedback for all sub-questions into the single feedback entry for the parent question. The total score is the sum of marks for the sub-questions.
      - Set the top-level 'overallScore' field to 0. The client application will calculate the final percentage.
    `;
    const jsonResponseString = await generateWithFallback(prompt, evaluationSchema, 'gemini-flash-latest');

    // --- NEW: Save to Cache ---
    try {
        const resultToCache = JSON.parse(jsonResponseString);
        const { error: insertError } = await supabaseAdmin.from("evaluations_cache").insert({ hash, result: resultToCache });
        if (insertError) {
            console.warn("Cache write error:", insertError.message);
        } else {
            console.log("Evaluation result saved to cache.");
        }
    } catch(e) {
        console.warn("Failed to parse and save to cache:", e.message);
    }
    // --- End Save to Cache ---

    return new Response(jsonResponseString, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in clever-endpoint (evaluation):', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});