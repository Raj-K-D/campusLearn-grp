// Supabase Edge Function: ai-chat
// Deploy with: supabase functions deploy ai-chat
// This keeps the Gemini API key server-side

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { message, context } = await req.json();

    const systemPrompt = `You are the CampusLearn AI Study Buddy, an academic assistant for engineering students at Symbiosis Institute of Technology.
${context ? `Context: ${context}` : ''}
Instructions:
1. Be concise, helpful, and academic.
2. Use Markdown formatting (bold, lists, code blocks).
3. If asked for code, use markdown code blocks with language syntax highlighting.
4. Focus on helping students understand concepts, not just giving answers.
5. If the question is completely non-academic, gently redirect to study topics.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\nStudent: ${message}` }] }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error: ${err}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'I could not generate a response. Please try again.';

    return new Response(JSON.stringify({ text }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
