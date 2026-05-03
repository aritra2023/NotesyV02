import { useState, useRef } from "react";
import { useStore } from "@/store/useStore";
import { useSendChatMessage, useGenerateSessionTitle } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Copy, Edit2, Trash2, Youtube, Send, BookOpen,
  AlignLeft, Lightbulb, FileText, Search, FileSearch,
  BookMarked, Plus, Check, Pencil,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
          const md = `## 🎬 Top ${data.videos.length} Results for "${content}"\n\n` +
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

    const isFirstMessage = sessionMessages.length === 0;

    // Immediately name session from first message
    if (isFirstMessage) {
      const quickTitle = content.trim().split(/\s+/).slice(0, 6).join(" ");
      updateSessionTitle(activeSessionId, quickTitle);
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

      // Refine title with AI after first message
      if (isFirstMessage) {
        generateTitleMutation.mutateAsync({
          data: { apiKey, firstMessage: content },
        }).then((titleRes) => {
          updateSessionTitle(activeSessionId, titleRes.title);
        }).catch(() => {});
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

  const saveTitle = () => {
    if (activeSessionId && titleDraft.trim()) updateSessionTitle(activeSessionId, titleDraft.trim());
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

  const fontClass = {
    normal: "font-sans", caveat: "font-caveat text-xl",
    patrick: "font-patrick text-xl", satisfy: "font-satisfy text-xl",
  }[fontMode];

  const colorClass = {
    black: "prose-headings:text-gray-900", purple: "prose-headings:text-purple-600",
    blue: "prose-headings:text-blue-600", green: "prose-headings:text-green-600",
  }[colorMode];

  const activeMode = MODE_OPTIONS.find((m) => m.mode === answerMode);

  return (
    <div className="flex-1 flex flex-col h-full bg-background relative">
      {/* Session Header */}
      <div className="h-14 border-b flex items-center justify-between px-5 bg-card shrink-0">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-0.5">
            {activeSubject?.name}
          </div>
          {editingTitle ? (
            <Input
              autoFocus value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
              className="h-6 font-bold text-sm px-1 py-0 border-0 border-b rounded-none focus-visible:ring-0 shadow-none w-56"
            />
          ) : (
            <div
              className="group flex items-center gap-1 cursor-pointer w-fit"
              onClick={() => { setTitleDraft(activeSession.title); setEditingTitle(true); }}
              title="Click to rename"
            >
              <span className="font-bold text-base leading-none truncate max-w-xs">{activeSession.title}</span>
              <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-3">
          <div className="flex -space-x-1.5">
            {activeSession.participants.slice(0, 3).map((p, i) => (
              <Avatar key={i} className={`h-6 w-6 border-2 border-background ${p.color}`}>
                <AvatarFallback className="text-[9px] text-white">{p.initials}</AvatarFallback>
              </Avatar>
            ))}
          </div>
          {sessionMessages.length > 0 && (
            <>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setAiModal("summary")}>
                <FileSearch className="h-3.5 w-3.5 mr-1" /> Summary
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setAiModal("cheatsheet")}>
                <BookMarked className="h-3.5 w-3.5 mr-1" /> Cheat Sheet
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5" ref={scrollRef}>
        <div className="max-w-3xl mx-auto space-y-5 pb-20">
          {sessionMessages.map((msg) => (
            <div key={msg.id} className={`group flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[82%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm shadow-sm"
                  : "bg-muted/50 border shadow-sm rounded-bl-sm"
              }`}>
                {msg.role === "user" ? (
                  <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                ) : (
                  <div className={`prose prose-sm dark:prose-invert max-w-none ${fontClass} ${colorClass}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>

              {/* Action buttons — small row below message, on hover */}
              <div className={`flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <button
                  className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  onClick={() => handleCopy(msg.content)}
                  title="Copy"
                >
                  <Copy className="h-3 w-3" />
                </button>
                {msg.role === "user" && (
                  <button
                    className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    onClick={() => { setInput(msg.content); deleteMessageFromId(activeSessionId, msg.id); }}
                    title="Edit"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                )}
                <button
                  className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={() => deleteMessageFromId(activeSessionId, msg.id)}
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex flex-col items-start">
              <div className="bg-muted/50 border rounded-2xl rounded-bl-sm px-5 py-4 w-24 shadow-sm flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-background border-t shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-1 bg-card border rounded-xl p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring transition-shadow">
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 rounded-lg shrink-0 mb-0.5 relative"
                  data-testid="button-options-popover"
                  title="Options"
                >
                  <Plus className="h-4 w-4" />
                  {(answerMode !== "normal" || youtubeMode) && (
                    <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-48 p-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">Answer Mode</p>
                {MODE_OPTIONS.map(({ mode, label, icon: Icon }) => (
                  <button
                    key={mode}
                    className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-colors ${answerMode === mode ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"}`}
                    onClick={() => { setAnswerMode(mode); setPopoverOpen(false); }}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {label}
                    {answerMode === mode && <Check className="h-3 w-3 ml-auto" />}
                  </button>
                ))}
                <div className="border-t my-1" />
                <button
                  className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-colors ${youtubeMode ? "bg-red-50 text-red-600 font-medium dark:bg-red-950/30 dark:text-red-400" : "hover:bg-muted text-foreground"}`}
                  onClick={() => { setYoutubeMode(!youtubeMode); setPopoverOpen(false); }}
                >
                  <Youtube className="h-3.5 w-3.5 shrink-0" />
                  YouTube Search
                  {youtubeMode && <Check className="h-3 w-3 ml-auto" />}
                </button>
              </PopoverContent>
            </Popover>

            {(answerMode !== "normal" || youtubeMode) && (
              <div className="mb-0.5 self-end">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${youtubeMode ? "bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400" : "bg-primary/10 text-primary"}`}>
                  {youtubeMode ? "YouTube" : activeMode?.label}
                </span>
              </div>
            )}

            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={youtubeMode ? "Search YouTube for..." : "Ask Notesy..."}
              className="min-h-[40px] max-h-32 resize-none border-0 focus-visible:ring-0 shadow-none bg-transparent p-2 text-sm flex-1"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              data-testid="input-chat"
            />
            <Button
              size="icon"
              className="h-8 w-8 rounded-lg shrink-0 mb-0.5"
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              data-testid="button-send"
            >
              {youtubeMode ? <Search className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      <AiActionModal open={aiModal === "summary"} onClose={() => setAiModal(null)} type="summary" />
      <AiActionModal open={aiModal === "cheatsheet"} onClose={() => setAiModal(null)} type="cheatsheet" />
    </div>
  );
}
