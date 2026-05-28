import { getModelSettings } from "@/lib/settings";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type StreamChunk = {
  text?: string;
  meta?: Record<string, string>;
  done?: boolean;
};

export type OpenAICompatibleConfig = {
  baseUrl: string;
  apiKey?: string;
  model?: string;
};

function encoderPayload(payload: StreamChunk) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export function encodeStreamChunk(payload: StreamChunk) {
  return new TextEncoder().encode(encoderPayload(payload));
}

export async function* streamModelResponse(messages: ChatMessage[]) {
  const config = await getModelSettings();

  if (config.MODEL_PROVIDER === "openai") {
    if (!config.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured.");
    }
    yield* streamOpenAIResponses(messages, config.OPENAI_API_KEY, config.OPENAI_MODEL);
    return;
  }

  if (!config.LOCAL_OPENAI_BASE_URL) {
    throw new Error("Local model base URL is not configured.");
  }

  yield* streamOpenAICompatibleChat(
    messages,
    config.LOCAL_OPENAI_BASE_URL,
    config.LOCAL_OPENAI_API_KEY || config.OPENAI_API_KEY,
    config.LOCAL_OPENAI_MODEL,
  );
}

async function* streamOpenAIResponses(
  messages: ChatMessage[],
  apiKey: string,
  model: string,
) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(await readError(response));
  }

  yield* parseServerSentEvents(response.body, (event) => {
    if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
      return event.delta;
    }

    return "";
  });
}

async function* streamOpenAICompatibleChat(
  messages: ChatMessage[],
  baseUrl: string,
  apiKey: string | undefined,
  model: string,
) {
  const apiUrl = getOpenAICompatibleUrl(baseUrl, "chat/completions");

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(
      `Local provider request failed (${response.status}) for model "${model}": ${await readError(response)}`,
    );
  }

  yield* parseServerSentEvents(response.body, (event) => {
    const delta = event.choices?.[0]?.delta?.content;
    return typeof delta === "string" ? delta : "";
  });
}

export async function listOpenAICompatibleModels({
  baseUrl,
  apiKey,
}: OpenAICompatibleConfig) {
  const response = await fetch(getOpenAICompatibleUrl(baseUrl, "models"), {
    method: "GET",
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Models request failed (${response.status}): ${await readError(response)}`);
  }

  const payload = await response.json();
  const models = Array.isArray(payload.data)
    ? payload.data
        .map((item: { id?: unknown }) => item.id)
        .filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
    : [];

  return models;
}

export async function testOpenAICompatibleChat({
  baseUrl,
  apiKey,
  model,
}: Required<OpenAICompatibleConfig>) {
  const response = await fetch(getOpenAICompatibleUrl(baseUrl, "chat/completions"), {
    method: "POST",
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "ping" }],
      stream: false,
      max_tokens: 8,
    }),
  });

  if (!response.ok) {
    throw new Error(`Chat test failed (${response.status}) for model "${model}": ${await readError(response)}`);
  }

  return true;
}

function getOpenAICompatibleUrl(baseUrl: string, path: string) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  return normalizedBaseUrl.endsWith("/v1")
    ? `${normalizedBaseUrl}/${path}`
    : `${normalizedBaseUrl}/v1/${path}`;
}

async function* parseServerSentEvents(
  body: ReadableStream<Uint8Array>,
  readText: (event: any) => string,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const eventBlock of events) {
      const line = eventBlock
        .split("\n")
        .find((part) => part.startsWith("data:"));

      if (!line) {
        continue;
      }

      const data = line.replace(/^data:\s*/, "");
      if (data === "[DONE]") {
        return;
      }

      try {
        const text = readText(JSON.parse(data));
        if (text) {
          yield text;
        }
      } catch {
        continue;
      }
    }
  }
}

async function readError(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) {
    return `Model request failed with status ${response.status}.`;
  }

  try {
    const payload = JSON.parse(text);
    return payload.error?.message ?? text;
  } catch {
    return text;
  }
}
