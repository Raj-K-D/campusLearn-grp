import { supabase } from './supabase';

export async function requestAI({ message, context = '', history = [] }) {
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: { message, context, history },
  });

  if (error) throw error;
  if (typeof data?.text !== 'string' || !data.text.trim()) {
    throw new Error(data?.error || 'The AI service returned an empty response.');
  }

  return data.text;
}
