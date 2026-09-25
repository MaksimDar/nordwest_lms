import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";

import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id";

export const AI_MODEL = "openai/gpt-6-astra";
const BASE_URL = "https://ai.gateway.lovable.dev/v1";

function provider(initialRunId?: string) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("The AI service is not configured (missing LOVABLE_API_KEY).");
  const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);
  const openai = createOpenAI({
    baseURL: BASE_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  return { openai, runIdFetch };
}

const providerOptions = {
  openai: {
    forceReasoning: true,
    reasoningEffort: "low",
    reasoningSummary: "auto",
    store: false,
    include: ["reasoning.encrypted_content"],
  },
};

/** Streaming chat for the UI-message protocol. */
export function streamChat(request: Request, system: string, messages: ModelMessage[]) {
  const { openai, runIdFetch } = provider(getLovableAiGatewayRunId(request));
  const result = streamText({
    model: openai.responses(AI_MODEL),
    system,
    messages,
    abortSignal: request.signal,
    providerOptions,
  });
  return withLovableAiGatewayRunIdHeader(
    result.toUIMessageStreamResponse({ sendReasoning: true }),
    runIdFetch,
  );
}

/** One-shot generation that still streams from the gateway, returning final text. */
export async function generateOnce(system: string, messages: ModelMessage[]) {
  const { openai } = provider();
  let failure: unknown;
  const result = streamText({
    model: openai.responses(AI_MODEL),
    system,
    messages,
    providerOptions,
    onError: ({ error }) => {
      failure = error;
    },
  });
  const text = await result.text;
  if (!text.trim()) {
    const status = (failure as { statusCode?: number } | undefined)?.statusCode;
    if (status === 429) throw new Error("The AI is busy right now. Please try again in a minute.");
    if (status === 402) throw new Error("AI credits have run out. Please add credits to continue.");
    throw new Error("The AI could not produce an answer. Please try again.");
  }
  return text.trim();
}
