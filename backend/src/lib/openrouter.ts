import { env } from "./env";
import { AppError, ServiceUnavailableError } from "./errors";



export type ChatMessage =
    | { role: "system" | "user"; content: string }
    | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
    | { role: "tool"; tool_call_id: string; content: string };

export type ToolCall = {
    id: string;
    type: "function";
    function: { name: string; arguments: string }; // arguments is a JSON STRING
};

export type ToolDefinition = {
    type: "function";
    function: { name: string; description: string; parameters: Record<string, unknown> };
};

type ChatOptions = {
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } };
    temperature?: number;
};

type ChatResponse = {
    choices?: { message: { content: string | null; tool_calls?: ToolCall[] } }[];
    error?: { message: string };
};

export function isAiConfigured(): boolean {
    return env.OPENROUTER_API_KEY !== "";
}

export async function chatCompletion(options: ChatOptions) {
    if (!isAiConfigured()) {
        throw new ServiceUnavailableError("AI assistant is not configured (OPENROUTER_API_KEY missing)");
    }

    let response: Response;
    try {
        response = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",

                "HTTP-Referer": "https://github.com/yunoqii/rent-mate",
                "X-Title": "RentMate AI",
            },
            body: JSON.stringify({
                model: env.OPENROUTER_MODEL,
                messages: options.messages,
                ...(options.tools ? { tools: options.tools } : {}),
                ...(options.toolChoice ? { tool_choice: options.toolChoice } : {}),
                temperature: options.temperature ?? 0.2,
            }),

            signal: AbortSignal.timeout(30_000),
        });
    } catch (error) {
        console.error("OpenRouter request failed:", error);
        throw new AppError("AI provider is unreachable", 502);
    }

    const data = (await response.json().catch(() => ({}))) as ChatResponse;
    if (!response.ok || !data.choices?.[0]) {
        console.error("OpenRouter error:", response.status, data.error?.message);
        throw new AppError("AI provider returned an error", 502);
    }
    return data.choices[0].message;
}
