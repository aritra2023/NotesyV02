import { Router } from "express";
import { SendChatMessageBody, GenerateSessionTitleBody } from "@workspace/api-zod";

const router = Router();

const GROQ_BASE = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const GROQ_KEYS = [
  "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",
  "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",
  "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",
];

let currentKeyIndex = 0;

function getNextKey(): string {
  currentKeyIndex = (currentKeyIndex + 1) % GROQ_KEYS.length;
  return GROQ_KEYS[currentKeyIndex];
}

const ANSWER_MODE_INSTRUCTIONS: Record<string, string> = {
  exam: `You are Notesy, an AI study assistant created by Aritra Mahatma. Answer in exam-ready format: use structured headings (##), bold key terms, bullet points, and end with a "## Key Points" summary section. Be comprehensive but organized.`,
  short: `You are Notesy, an AI study assistant created by Aritra Mahatma. Give a concise 2-4 sentence answer. Bold the single most important term or concept. No lengthy explanations.`,
  explanation: `You are Notesy, an AI study assistant created by Aritra Mahatma. Provide a detailed explanation with real-world analogies, examples, and clear ## headings. Make it easy to understand for a student encountering this topic for the first time.`,
  normal: `You are Notesy, an AI study assistant created by Aritra Mahatma. Provide a helpful, well-structured response using markdown formatting (headings, bullet points, code blocks where relevant). Be thorough but concise.`,
};

async function callGroqWithRotation(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string,
  maxTokens = 2048,
  overrideKey?: string,
): Promise<Response> {
  if (overrideKey) {
    return fetch(GROQ_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${overrideKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
    });
  }

  const startIndex = currentKeyIndex;
  let attempts = 0;

  while (attempts < GROQ_KEYS.length) {
    const key = GROQ_KEYS[currentKeyIndex];
    const response = await fetch(GROQ_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
    });

    if (response.status === 429 || response.status === 503) {
      currentKeyIndex = (currentKeyIndex + 1) % GROQ_KEYS.length;
      attempts++;
      continue;
    }

    if (response.status === 400) {
      const cloned = response.clone();
      const body = await cloned.json().catch(() => ({})) as { error?: { message?: string } };
      const msg = body?.error?.message ?? "";
      if (msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("token")) {
        currentKeyIndex = (currentKeyIndex + 1) % GROQ_KEYS.length;
        attempts++;
        continue;
      }
      return response;
    }

    return response;
  }

  return fetch(GROQ_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEYS[currentKeyIndex]}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  });
}

router.post("/chat", async (req, res) => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { messages, answerMode } = parsed.data;
  const overrideKey = parsed.data.apiKey || process.env.GROQ_API_KEY || undefined;

  const systemPrompt = ANSWER_MODE_INSTRUCTIONS[answerMode] || ANSWER_MODE_INSTRUCTIONS.normal;
  const groqMessages = messages.map((m) => ({ role: m.role === "model" ? "assistant" : "user", content: m.content }));

  try {
    const response = await callGroqWithRotation(groqMessages, systemPrompt, 2048, overrideKey || undefined);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({})) as Record<string, unknown>;
      const errMsg = (errData as { error?: { message?: string } })?.error?.message || `Groq API error: ${response.status}`;
      req.log.error({ status: response.status, groqError: errData }, "Groq returned non-OK status");
      res.status(400).json({ error: errMsg });
      return;
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const reply = data?.choices?.[0]?.message?.content || "No response from AI.";
    const usage = {
      promptTokens: data?.usage?.prompt_tokens ?? 0,
      completionTokens: data?.usage?.completion_tokens ?? 0,
    };

    res.json({ reply, usage });
  } catch (err) {
    req.log.error({ err }, "Groq API call failed");
    res.status(500).json({ error: "Failed to reach Groq API. Check your connection." });
  }
});

router.post("/generate-title", async (req, res) => {
  const parsed = GenerateSessionTitleBody.safeParse(req.body);
  if (!parsed.success) {
    res.json({ title: "Study Session" });
    return;
  }

  const { firstMessage } = parsed.data;
  const overrideKey = parsed.data.apiKey || process.env.GROQ_API_KEY || undefined;

  try {
    const response = await callGroqWithRotation(
      [{ role: "user", content: firstMessage }],
      "Generate a concise 4-6 word title for a study session based on the user's message. Return ONLY the title, nothing else. No quotes, no punctuation at the end.",
      20,
      overrideKey || undefined,
    );

    if (!response.ok) {
      res.json({ title: "Study Session" });
      return;
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const title = data?.choices?.[0]?.message?.content?.trim() || "Study Session";
    res.json({ title });
  } catch {
    res.json({ title: "Study Session" });
  }
});

export default router;
