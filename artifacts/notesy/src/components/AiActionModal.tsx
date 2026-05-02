import { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Printer, Copy, Loader2 } from "lucide-react";
import { marked } from "marked";
import { toast } from "sonner";

type ActionType = "summary" | "cheatsheet";

const PROMPTS: Record<ActionType, string> = {
  summary: `Please provide a clear, concise bullet-point summary of everything discussed in this conversation. Structure it as:
## Summary
- Key points as bullet points
- Group related ideas together
- Include any important conclusions or answers given

Keep it short, scannable, and exam-ready.`,

  cheatsheet: `Generate a clean reference cheat sheet from this conversation. Format it as:
## Key Terms & Definitions
| Term | Definition |
|------|-----------|
| ... | ... |

## Important Concepts
- Concept: explanation

## Formulas / Rules (if any)
- ...

## Quick Facts
- ...

Make it dense, scannable, and perfect for last-minute revision.`,
};

const TITLES: Record<ActionType, string> = {
  summary: "Session Summary",
  cheatsheet: "Cheat Sheet",
};

interface AiActionModalProps {
  open: boolean;
  onClose: () => void;
  type: ActionType;
}

export function AiActionModal({ open, onClose, type }: AiActionModalProps) {
  const { messages, activeSessionId, apiKey, colorMode } = useStore();
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !activeSessionId) return;
    setResult("");
    setError("");
    setLoading(true);

    const sessionMsgs = messages
      .filter((m) => m.sessionId === activeSessionId)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((m) => ({ role: m.role === "model" ? "assistant" : "user", content: m.content }));

    if (sessionMsgs.length === 0) {
      setError("No messages in this session yet.");
      setLoading(false);
      return;
    }

    sessionMsgs.push({ role: "user", content: PROMPTS[type] });

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: apiKey || "",
        messages: sessionMsgs.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          content: m.content,
        })),
        answerMode: "normal",
      }),
    })
      .then((r) => r.json())
      .then((data: { reply?: string; error?: string }) => {
        if (data.error) setError(data.error);
        else setResult(data.reply || "");
      })
      .catch(() => setError("Failed to generate. Check your API key."))
      .finally(() => setLoading(false));
  }, [open, type]);

  const handlePrint = () => {
    const headingColor =
      colorMode === "purple" ? "#9333ea" :
      colorMode === "blue"   ? "#2563eb" :
      colorMode === "green"  ? "#16a34a" : "#111827";

    const win = window.open("", "", "width=800,height=700");
    if (win) {
      win.document.write(`<html><head><title>${TITLES[type]}</title><style>
        body { font-family: system-ui; max-width: 700px; margin: 0 auto; padding: 40px; }
        h1,h2,h3,h4 { color: ${headingColor}; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; }
        th { background: #f9fafb; font-weight: 600; }
        code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
        pre { background: #f3f4f6; padding: 16px; border-radius: 8px; overflow-x: auto; }
      </style></head><body>
      <h1>${TITLES[type]}</h1>
      ${marked.parse(result)}
      </body></html>`);
      win.document.close();
      setTimeout(() => win.print(), 400);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    toast.success("Copied to clipboard");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
        <DialogHeader className="flex-row items-center justify-between shrink-0">
          <DialogTitle>{TITLES[type]}</DialogTitle>
          {result && (
            <div className="flex items-center gap-2 pr-8">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
              </Button>
            </div>
          )}
        </DialogHeader>

        <ScrollArea className="flex-1 pr-2">
          {loading && (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-sm">Generating {TITLES[type].toLowerCase()}...</p>
            </div>
          )}
          {error && (
            <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
          )}
          {result && (
            <div className="prose prose-sm max-w-none dark:prose-invert py-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
