import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { AIMessage, HumanMessage } from 'npm:@langchain/core/messages';
import { ChatPromptTemplate, MessagesPlaceholder } from 'npm:@langchain/core/prompts';
import { ChatGroq } from 'npm:@langchain/groq@1.3.1';

type ChatHistoryMessage = { role: 'user' | 'assistant'; content: string };

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function isChatHistoryMessage(item: unknown): item is ChatHistoryMessage {
  return typeof item === 'object' &&
    item !== null &&
    'role' in item &&
    (item.role === 'user' || item.role === 'assistant') &&
    'content' in item &&
    typeof item.content === 'string' &&
    item.content.length <= 8000;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Only POST requests are supported.' }, 405);
  }

  if (!GROQ_API_KEY) {
    console.error('GROQ_API_KEY is not configured for the ai-chat function.');
    return jsonResponse({ error: 'Mini Agent is not configured yet. Set the GROQ_API_KEY Supabase function secret.' }, 500);
  }

  let body: { message?: unknown; context?: unknown; history?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400);
  }

  const { message, context = '', history = [] } = body;
  if (typeof message !== 'string' || !message.trim() || message.length > 8000) {
    return jsonResponse({ error: 'Message must contain 1 to 8000 characters.' }, 400);
  }
  if (typeof context !== 'string' || context.length > 2000) {
    return jsonResponse({ error: 'Context must be at most 2000 characters.' }, 400);
  }
  if (!Array.isArray(history) || history.length > 100) {
    return jsonResponse({ error: 'Chat history must be an array of at most 100 messages.' }, 400);
  }

  const historyMessages: ChatHistoryMessage[] = [];
  for (const item of history) {
    if (!isChatHistoryMessage(item)) {
      return jsonResponse({ error: 'Chat history contains an invalid message.' }, 400);
    }
    historyMessages.push(item);
  }

  const recentHistory = historyMessages.slice(-20);

  const systemPrompt = `You are Mini Agent, CampusLearn's friendly academic assistant for engineering students.
${context ? `Task-specific instructions: ${context}` : ''}
Be concise, supportive, and accurate. Use Markdown when helpful. Explain concepts so students can learn rather than only giving answers. Never claim to have read uploaded files or verified facts you were not given.`;

  try {
    const model = new ChatGroq({
      apiKey: GROQ_API_KEY,
      model: 'openai/gpt-oss-120b',
      temperature: 0.7,
      maxTokens: 1024,
    });
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt],
      new MessagesPlaceholder('history'),
      ['human', '{input}'],
    ]);
    const chain = prompt.pipe(model);
    const response = await chain.invoke({
      history: recentHistory.map(({ role, content }) =>
        role === 'assistant' ? new AIMessage(content) : new HumanMessage(content)
      ),
      input: message.trim(),
    });
    const text = typeof response.content === 'string'
      ? response.content
      : response.content
        .filter((part) => typeof part !== 'string' && part.type === 'text')
        .map((part) => part.text)
        .join('');

    if (!text.trim()) throw new Error('Groq returned an empty response.');
    return jsonResponse({ text });
  } catch (error) {
    console.error('Mini Agent request failed:', error instanceof Error ? error.message : 'Unknown error');
    return jsonResponse({ error: 'Mini Agent could not complete the request. Please try again.' }, 502);
  }
});
