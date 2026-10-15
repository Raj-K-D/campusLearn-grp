import { supabase } from './supabase';

export async function requestAI({ message, context = '', notes = '', history = [] }) {
    let data;
    try {
        const result = await supabase.functions.invoke('ai-chat', {
            body: { message, context, notes, history },
        });
        data = result.data;
        if (result.error) throw result.error;
    } catch (error) {
        if (error && error.name === 'FunctionsFetchError') {
            throw new Error('Gooloogulu could not reach the Supabase ai-chat function. Deploy the function to this Supabase project and check its CORS/network settings.');
        }
        throw error;
    }

    if (!data || typeof data.text !== 'string' || !data.text.trim()) {
        throw new Error((data && data.error) || 'The AI service returned an empty response.');
    }

    return data.text;
}