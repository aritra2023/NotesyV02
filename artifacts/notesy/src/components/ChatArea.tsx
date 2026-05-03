import { useState, useRef } from "react";
import { useStore } from "@/store/useStore";
import { useSendChatMessage, useGenerateSessionTitle } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Copy, Edit2, Trash2, Youtube, Send, BookOpen,
  AlignLeft, Lightbulb, FileText, Search, FileSearch,
  BookMarked, Plus, Check, Pencil,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { marked } from "marked";
import { toast } from "sonner";
import { AiActionModal } from "@/components/AiActionModal";

interface YoutubeVideo { id: string; title: string; url: string; channel: string; views: string; duration: string; }

const MODE_OPTIONS = [
  { mode: "normal" as const, label: "Normal", icon: FileText },
  { mode: "exam" as const, label: "Exam Mode", icon: BookOpen },
  { mode: "short" as const, label: "Short", icon: AlignLeft },
  { mode: "explanation" as const, label: "Explain", icon: Lightbulb },
];

export function ChatArea() {
  const {
    activeSessionId, sessions, subjects, messages,
    addMessage, deleteMessageFromId, updateSessionTitle,
    apiKey, colorMode, fontMode, answerMode, youtubeMode,
    setAnswerMode, setYoutubeMode,
  } = useStore();

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [aiModal, setAiModal] = useState<"summary" | "cheatsheet" | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeSubject = activeSession ? subjects.find((s) => s.id === activeSession.subjectId) : null;
  const sessionMessages = messages
    .filter((m) => m.sessionId === activeSessionId)
    .sort((a, b) => a.createdAt - b.createdAt);

  const sendChatMutation = useSendChatMessage();
  const generateTitleMutation = useGenerateSessionTitle();

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 50);
  };

  const handleSend = async () => {
    if (!input.trim() || !activeSessionId) return;
    const content = input.trim();
    setInput("");
    scrollToBottom();

    if (youtubeMode) {
      addMessage(activeSessionId, "user", `🔍 Search YouTube: ${content}`);
      setIsTyping(true);
      setYoutubeMode(false);
      try {
        const r = await fetch(`/api/youtube-search?q=${encodeURIComponent(content)}`);
        const data = await r.json() as { videos?: YoutubeVideo[]; error?: string };
        if (data.videos && data.videos.length > 0) {
          const md = `## 🎬 Top ${data.videos.length} YouTube Results for "${content}"\n\n` +
            data.videos.map((v, i) =>
              `**${i + 1}. [${v.title}](${v.url})**  \n${[v.channel, v.views, v.duration].filter(Boolean).join(" • ")}`
            ).join("\n\n");
          addMessage(activeSessionId, "model", md);
        } else {
          addMessage(activeSessionId, "model", `No results found. [Search on YouTube directly](https://www.youtube.com/results?search_query=${encodeURIComponent(content)})`);
        }
      } catch {
        addMessage(activeSessionId, "model", `[Search YouTube for "${content}"](https://www.youtube.com/results?search_query=${encodeURIComponent(content)})`);
      } finally {
        setIsTyping(false);
        scrollToBottom();
      }
      return;
    }

    addMessage(activeSessionId, "user", content);
    setIsTyping(true);
    scrollToBottom();

    try {
      const allMsgs = messages
        .filter((m) => m.sessionId === activeSessionId)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((m) => ({ role: m.role, content: m.content }));
      allMsgs.push({ role: "user" as const, content });

      const res = await sendChatMutation.mutateAsync({
        data: { apiKey: apiKey || "", messages: allMsgs, answerMode },
      });
      addMessage(activeSessionId, "model", res.reply);
      scrollToBottom();

      if (sessionMessages.length === 0) {
        const titleRes = await generateTitleMutation.mutateAsync({
          data: { apiKey, firstMessage: content },
        });
        updateSessionTitle(activeSessionId, titleRes.title);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err as { message?: string })?.message ||
        "Failed to get a response.";
      toast.error(msg, { duration: 6000 });
    } finally {
      setIsTyping(false);
      scrollToBottom();
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copied!");
  };

  const handleExportPDF = () => {
    if (!activeSession || sessionMessages.length === 0) return;
    const headingColor =
      colorMode === "purple" ? "#9333ea" : colorMode === "blue" ? "#2563eb" :
      colorMode === "green" ? "#16a34a" : "#111827";
    let html = `<html><head><title>${activeSession.title}</title><style>
      body { font-family: system-ui; max-width: 800px; margin: 0 auto; padding: 40px; }
      .message { margin-bottom: 24px; } .user { font-weight: bold; color: #4b5563; margin-bottom: 8px; }
      .model { background: #f9fafb; padding: 16px; border-radius: 8px; }
      h1, h2, h3, h4 { color: ${headingColor}; }
      table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #e5e7eb; padding: 8px; }
      code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
    </style></head><body><h1>${activeSubject?.name} — ${activeSession.title}</h1><hr/>`;
    sessionMessages.forEach((m) => {
      if (m.role === "user") html += `<div class="message"><div class="user">You:</div><div>${m.content}</div></div>`;
      else html += `<div class="message"><div class="model">${marked.parse(m.content)}</div></div>`;
    });
    html += `</body></html>`;
    const win = window.open("", "", "width=800,height=600");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500); }
  };

  const saveTitle = () => {
    if (activeSessionId && titleDraft.trim()) {
      updateSessionTitle(activeSessionId, titleDraft.trim());
    }
    setEditingTitle(false);
  };

  if (!activeSession) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background/50">
        <div className="text-center text-muted-foreground">
          <BookOpen className="mx-auto h-12 w-12 opacity-20 mb-4" />
          <p className="text-lg font-medium">Select a session to start</p>
          <p className="text-sm">Or create a new subject in the sidebar</p>
        </div>
      </div>
    );
  }

  const fontClass = { normal: "font-sans", caveat: "font-caveat text-xl", patrick: "font-patrick text-xl", satisfy: "font-satisfy text-xl" }[fontMode];
  const colorClass = { black: "prose-headings:text-gray-900", purple: "prose-headings:text-purple-600", blue: "prose-headings:text-blue-600", green: "prose-headings:text-green-600" }[colorMode];
  const activeMode = MODE_OPTIONS.find((m) => m.mode === answerMode);

  return (
    <div className="flex-1 flex flex-col h-full bg-background relative">
      {/* Header */}
      <div className="h-16 border-b flex items-center justify-between px-6 bg-card shrink-0">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
            {activeSubject?.name}
          </div>
          {editingTitle ? (
            <Input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
              className="h-7 font-bold text-base px-1 py-0 border-0 border-b rounded-none focus-visible:ring-0 shadow-none w-64"
            />
          ) : (
            <div
              className="group flex items-center gap-1.5 cursor-pointer"
              onClick={() => { setTitleDraft(activeSession.title); setEditingTitle(true); }}
              title="Click to rename"
            >
              <span className="font-bold text-lg leading-none truncate max-w-xs">{activeSession.title}</span>
              <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex -space-x-2">
            {activeSession.participants.slice(0, 4).map((p, i) => (
              <Avatar key={i} className={`h-7 w-7 border-2 border-background ${p.color}`}>
                <AvatarFallback className="text-xs text-white">{p.initials}</AvatarFallback>
              </Avatar>
            ))}
          </div>
          {sessionMessages.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={() => setAiModal("summary")} data-testid="button-summary">
                <FileSearch className="h-3.5 w-3.5 mr-1.5" /> Summary
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAiModal("cheatsheet")} data-testid="button-cheatsheet">
                <BookMarked className="h-3.5 w-3.5 mr-1.5" /> Cheat Sheet
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} data-testid="button-export-pdf">
                Export PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6" ref={scrollRef}>
        <div className="max-w-3xl mx-auto space-y-6 pb-20">
          {sessionMessages.map((msg) => (
            <div key={msg.id} className={`group flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`relative max-w-[85%] rounded-2xl px-5 py-3.5 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm shadow-sm"
                  : "bg-muted/50 border shadow-sm rounded-bl-sm"
              }`}>
                {msg.role === "user" ? (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  <div className={`prose prose-sm dark:prose-invert max-w-none ${fontClass} ${colorClass}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                )}
                <div className={`absolute -top-3 ${msg.role === "user" ? "left-0 -translate-x-full pr-2" : "right-0 translate-x-full pl-2"} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1`}>
                  <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full shadow-sm" onClick={() => handleCopy(msg.content)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  {msg.role === "user" && (
                    <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full shadow-sm" onClick={() => { setInput(msg.content); deleteMessageFromId(activeSessionId, msg.id); }}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full shadow-sm text-destructive" onClick={() => deleteMessageFromId(activeSessionId, msg.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex flex-col items-start">
              <div className="bg-muted/50 border rounded-2xl rounded-bl-sm px-5 py-4 w-32 shadow-sm flex items-center gap-1.5">
                <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce"></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-background border-t shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-1 bg-card border rounded-xl p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring transition-shadow">
            {/* + Options Popover */}
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost" size="icon"
                  className="h-9 w-9 rounded-lg shrink-0 mb-1 relative"
                  data-testid="button-options-popover"
                  title="Options"
                >
                  <Plus className="h-5 w-5" />
                  {(answerMode !== "normal" || youtubeMode) && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-52 p-2">
                <p className="text-xs font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">Answer Mode</p>
                {MODE_OPTIONS.map(({ mode, label, icon: Icon }) => (
                  <button
                    key={mode}
                    className={`flex items-center gap-2.5 w-full px-2 py-2 rounded-md text-sm transition-colors ${answerMode === mode ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"}`}
                    onClick={() => { setAnswerMode(mode); setPopoverOpen(false); }}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                    {answerMode === mode && <Check className="h-3.5 w-3.5 ml-auto" />}
                  </button>
                ))}
                <div className="border-t my-1.5" />
                <button
                  className={`flex items-center gap-2.5 w-full px-2 py-2 rounded-md text-sm transition-colors ${youtubeMode ? "bg-red-50 text-red-600 font-medium dark:bg-red-950/30 dark:text-red-400" : "hover:bg-muted text-foreground"}`}
                  onClick={() => { setYoutubeMode(!youtubeMode); setPopoverOpen(false); }}
                >
                  <Youtube className="h-4 w-4 shrink-0" />
                  YouTube Search
                  {youtubeMode && <Check className="h-3.5 w-3.5 ml-auto" />}
                </button>
              </PopoverContent>
            </Popover>

            {/* Current mode badge */}
            {(answerMode !== "normal" || youtubeMode) && (
              <div className="mb-1 self-end">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${youtubeMode ? "bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400" : "bg-primary/10 text-primary"}`}>
                  {youtubeMode ? "YouTube" : activeMode?.label}
                </span>
              </div>
            )}

            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={youtubeMode ? "Search YouTube for..." : "Ask Notesy..."}
              className="min-h-[44px] max-h-32 resize-none border-0 focus-visible:ring-0 shadow-none bg-transparent p-2 text-base flex-1"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              data-testid="input-chat"
            />
            <Button
              size="icon"
              className="h-10 w-10 rounded-lg shrink-0 mb-1"
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              data-testid="button-send"
            >
              {youtubeMode ? <Search className="h-5 w-5" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      <AiActionModal open={aiModal === "summary"} onClose={() => setAiModal(null)} type="summary" />
      <AiActionModal open={aiModal === "cheatsheet"} onClose={() => setAiModal(null)} type="cheatsheet" />
    </div>
  );
}
