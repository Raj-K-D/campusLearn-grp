import { supabase } from "./supabase";

export async function requestAI({
    message,
    context = "",
    notes = "",
    pdfDocuments = [],
    history = [],
    onToken,
}) {
    let response;
    try {
        const result = await supabase.functions.invoke("ai-chat", {
            body: { message, context, notes, pdfDocuments, history },
        });
        if (result.error) throw result.error;
        response = result.data;
    } catch (error) {
        if (error && error.name === "FunctionsFetchError") {
            throw new Error(
                "Gooloogulu could not reach the Supabase ai-chat function. Deploy the function to this Supabase project and check its CORS/network settings.",
            );
        }
        throw error;
    }

    if (response && typeof response.text === "string") {
        if (typeof onToken === "function") onToken(response.text);
        return response.text;
    }
    if (typeof response === "string" && response.trim()) {
        if (typeof onToken === "function") onToken(response);
        return response;
    }
    if (response && typeof response.error === "string") {
        throw new Error(response.error);
    }
    if (!(response instanceof Response) || !response.body) {
        throw new Error(
            "The AI service did not return a readable response stream.",
        );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";

    try {
        while (true) {
            const { value, done } = await reader.read();
            buffer += decoder.decode(value || new Uint8Array(), {
                stream: !done,
            });

            let eventBoundary = buffer.indexOf("\n\n");
            while (eventBoundary !== -1) {
                const event = buffer.slice(0, eventBoundary);
                buffer = buffer.slice(eventBoundary + 2);
                const dataLine = event
                    .split("\n")
                    .find((line) => line.startsWith("data:"));

                if (dataLine) {
                    const payload = JSON.parse(dataLine.slice(5).trim());
                    if (payload.error) throw new Error(payload.error);
                    if (typeof payload.token === "string") {
                        answer += payload.token;
                        if (typeof onToken === "function")
                            onToken(payload.token);
                    }
                }

                eventBoundary = buffer.indexOf("\n\n");
            }

            if (done) break;
        }
    } finally {
        reader.releaseLock();
    }

    if (!answer.trim())
        throw new Error("The AI service returned an empty response.");
    return answer;
}