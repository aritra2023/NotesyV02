import { Router } from "express";
import { SendChatMessageBody, GenerateSessionTitleBody } from "@workspace/api-zod";

const router = Router();

const GROQ_BASE = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const ANSWER_MODE_INSTRUCTIONS: Record<string, string> = {
  exam: `You are Notesy, an AI study assistant created by Aritra Mahatma. Answer in exam-ready format: use structured headings (##), bold key terms, bullet points, and end with a "## Key Points" summary section. Be comprehensive but organized.`,
  short: `You are Notesy, an AI study assistant created by Aritra Mahatma. Give a concise 2-4 sentence answer. Bold the single most important term or concept. No lengthy explanations.`,
  explanation: `You are Notesy, an AI study assistant created by Aritra Mahatma. Provide a detailed explanation with real-world analogies, examples, and clear ## headings. Make it easy to understand for a student encountering this topic for the first time.`,
  normal: `You are Notesy, an AI study assistant created by Aritra Mahatma. Provide a helpful, well-structured response using markdown formatting (headings, bullet points, code blocks where relevant). Be thorough but concise.`,
};

async function callGroq(apiKey: string, messages: Array<{ role: string; content: string }>, systemPrompt: string, maxTokens = 2048) {
  const response = await fetch(GROQ_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  });
  return response;
}

router.post("/chat", async (req, res) => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { messages, answerMode } = parsed.data;
  const apiKey = parsed.data.apiKey || process.env.GROQ_API_KEY || "";

  if (!apiKey) {
    res.status(400).json({ error: "No API key provided. Enter your Groq API key." });
    return;
  }

  const systemPrompt = ANSWER_MODE_INSTRUCTIONS[answerMode] || ANSWER_MODE_INSTRUCTIONS.normal;
  const groqMessages = messages.map((m) => ({ role: m.role === "model" ? "assistant" : "user", content: m.content }));

  try {
    const response = await callGroq(apiKey, groqMessages, systemPrompt, 2048);

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
  const apiKey = parsed.data.apiKey || process.env.GROQ_API_KEY || "";

  if (!apiKey) {
    res.json({ title: "Study Session" });
    return;
  }

  try {
    const response = await callGroq(
      apiKey,
      [{ role: "user", content: firstMessage }],
      "Generate a concise 4-6 word title for a study session based on the user's message. Return ONLY the title, nothing else. No quotes, no punctuation at the end.",
      20,
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
