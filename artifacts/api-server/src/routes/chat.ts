import { Router } from "express";
import { z } from "zod/v4";
import { SendChatMessageBody, GenerateSessionTitleBody } from "@workspace/api-zod";

const router = Router();

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const ANSWER_MODE_INSTRUCTIONS: Record<string, string> = {
  exam: `You are Notesy, created by Aritra Mahatma. Answer in exam-ready format: use structured headings, bold key terms, and end with a "Key Points" summary. Be comprehensive but organized.`,
  short: `You are Notesy, created by Aritra Mahatma. Give a concise 2-4 sentence answer. Bold the single most important term or concept.`,
  explanation: `You are Notesy, created by Aritra Mahatma. Provide a detailed explanation with analogies, real-world examples, and clear headings. Make it easy to understand for a student encountering this for the first time.`,
  normal: `You are Notesy, created by Aritra Mahatma. Provide a helpful, well-structured response with markdown formatting. Be thorough but concise.`,
};

router.post("/chat", async (req, res) => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { apiKey, messages, answerMode } = parsed.data;

  const systemInstruction = ANSWER_MODE_INSTRUCTIONS[answerMode] || ANSWER_MODE_INSTRUCTIONS.normal;

  const geminiContents = messages.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));

  try {
    const response = await fetch(`${GEMINI_BASE}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: geminiContents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({})) as Record<string, unknown>;
      const errMsg = (errData as { error?: { message?: string } })?.error?.message || `Gemini API error: ${response.status}`;
      res.status(400).json({ error: errMsg });
      return;
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
    };
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI.";
    const usage = {
      promptTokens: data?.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: data?.usageMetadata?.candidatesTokenCount ?? 0,
    };

    res.json({ reply, usage });
  } catch (err) {
    req.log.error({ err }, "Gemini API call failed");
    res.status(500).json({ error: "Failed to reach Gemini API" });
  }
});

router.post("/generate-title", async (req, res) => {
  const parsed = GenerateSessionTitleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { apiKey, firstMessage } = parsed.data;

  try {
    const response = await fetch(`${GEMINI_BASE}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: "You are a title generator. Generate a concise 4-6 word title for a study session based on the user's first message. Return ONLY the title, nothing else. No quotes, no punctuation at the end." }],
        },
        contents: [{ role: "user", parts: [{ text: firstMessage }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 20 },
      }),
    });

    if (!response.ok) {
      res.json({ title: "Study Session" });
      return;
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const title = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Study Session";
    res.json({ title });
  } catch {
    res.json({ title: "Study Session" });
  }
});

export default router;
