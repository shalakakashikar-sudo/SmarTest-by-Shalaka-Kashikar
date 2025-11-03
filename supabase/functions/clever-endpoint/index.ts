// supabase/functions/clever-endpoint/index.ts
import { GoogleGenAI, Type } from "https://esm.sh/@google/genai@^1.27.0";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Fix: Declare Deno to address "Cannot find name 'Deno'" error in TypeScript environments that don't have Deno types globally available.
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const evaluationSchema = {
  type: Type.OBJECT,
  properties: {
    overallScore: {
      type: Type.NUMBER,
      description: "This field is deprecated. Calculate on the client-side. Return 0."
    },
    feedback: {
      type: Type.STRING,
      description: "Overall constructive feedback for the student on their performance."
    },
    suggestions: {
      type: Type.STRING,
      description: "Actionable suggestions for what the student should study or practice next."
    },
    strengths: {
      type: Type.STRING,
      description: "A summary of the topics or skills the student demonstrated well."
    },
    weaknesses: {
      type: Type.STRING,
      description: "A summary of the topics or skills the student struggled with."
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
            description: "Specific feedback for the student's answer to this question."
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
async function generateWithFallback(prompt, schema, primaryModel, proConfig = {}) {
  // --- 1. Try Gemini First ---
  // Fix: Use Deno.env.get after declaring Deno to fix type error.
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (geminiApiKey) {
    try {
      console.log(`Attempting Gemini with model ${primaryModel}`);
      const ai = new GoogleGenAI({
        apiKey: geminiApiKey
      });
      const payload = {
        model: primaryModel,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
          ...proConfig
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
  // Fix: Use Deno.env.get after declaring Deno to fix type error.
  const groqApiKey = Deno.env.get('GROQ_API_KEY');
  if (groqApiKey) {
    try {
      console.log("Attempting Groq...");
      const groqPrompt = `${prompt}\n\nIMPORTANT: Respond with a single, raw JSON object that strictly conforms to the provided JSON schema. Do not add any commentary or markdown formatting. The JSON schema is: ${JSON.stringify(schema)}`;
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          messages: [
            {
              role: "user",
              content: groqPrompt
            }
          ],
          response_format: {
            type: "json_object"
          }
        })
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
      const openaiPrompt = `${prompt}\n\nIMPORTANT: Respond with a single, raw JSON object that strictly conforms to the provided JSON schema. Do not add any commentary or markdown formatting. The JSON schema is: ${JSON.stringify(schema)}`;
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: openaiPrompt
            }
          ],
          response_format: {
            type: "json_object"
          }
        })
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
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { questions, answers } = await req.json();
    const prompt = `
      You are an expert AI Test Evaluator, acting as a very strict and meticulous teacher. Your task is to grade a student's test submission with a high standard for correctness in all aspects.

      **Primary Grading Criteria:**
      - Evaluate the answers strictly based on the factual accuracy and completeness according to the provided questions, correct answers, and marking schemes.

      **Secondary (but equally important) Grading Criteria:**
      - **Punctuation:** Penalize for missing or incorrect punctuation (e.g., periods, commas, question marks).
      - **Capitalization:** Penalize for incorrect capitalization (e.g., start of sentences, proper nouns).
      - **Grammar and Spelling:** Penalize for grammatical errors, awkward phrasing, and spelling mistakes.
      - **Clarity and Cohesion:** The answers must be clear, well-structured, and easy to understand.

      For each question, provide a specific score and constructive feedback that explicitly mentions any grammatical, punctuation, or capitalization errors. Deduct marks for these errors where appropriate.
      Then, provide overall feedback, strengths, weaknesses, and suggestions for improvement.

      Here is the test structure and the student's answers:
      ${JSON.stringify({
      questions,
      studentAnswers: answers
    }, null, 2)}

      **IMPORTANT INSTRUCTIONS:**
      - The 'questionScores' array in your response MUST have the same number of items as the 'questions' array in the input.
      - For reading comprehension questions, evaluate all sub-answers and provide a single total score and combined feedback for the main question. The total score should be the sum of marks for the sub-questions.
      - Award marks precisely based on the provided 'marks' and 'markingScheme' for each question, **deducting marks for the grammatical and formatting errors mentioned above.**
      - Do not calculate the final percentage 'overallScore'; the client will do this. Set it to 0.
    `;
    const jsonResponseString = await generateWithFallback(prompt, evaluationSchema, 'gemini-flash-latest');
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