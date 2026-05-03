import { useState, useRef, useEffect, useCallback } from "react";
import { useStore } from "@/store/useStore";
import { useSendChatMessage, useGenerateSessionTitle } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Copy, Edit2, Trash2, Youtube, Send, BookOpen,
  AlignLeft, Lightbulb, FileText, Search,
  FileSearch, BookMarked, Plus, Check, Pin, PinOff, X,
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

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

async function postSyncMessage(sessionId: string, role: string, content: string, clientId: string) {
  try {
    await fetch(`${BASE}/api/sync/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, role, content, clientId }),
    });
  } catch { /* ignore */ }
}

export function ChatArea() {
  const {
    activeSessionId, sessions, subjects, messages,
    addMessage, deleteMessageFromId, updateSessionTitle,
    apiKey, colorMode, fontMode, answerMode, youtubeMode,
    setAnswerMode, setYoutubeMode, addRemoteMessages,
    togglePinMessage,
  } = useStore();

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [aiModal, setAiModal] = useState<"summary" | "cheatsheet" | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [pinnedIndex, setPinnedIndex] = useState(0);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSyncRef = useRef<string>(new Date(0).toISOString());
  const msgRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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

  const pollSharedMessages = useCallback(async () => {
    if (!activeSessionId || !activeSession?.isShared) return;
    try {
      const since = lastSyncRef.current;
      const r = await fetch(`${BASE}/api/sync/messages/${activeSessionId}?since=${encodeURIComponent(since)}`, { cache: "no-store" });
      if (!r.ok) return;
      const data = await r.json() as { messages: Array<{ id: string; clientId: string | null; role: string; content: string; createdAt: string }> };
      if (data.messages.length > 0) {
        lastSyncRef.current = data.messages[data.messages.length - 1].createdAt;
        addRemoteMessages(activeSessionId, data.messages);
        scrollToBottom();
      }
    } catch { /* ignore */ }
  }, [activeSessionId, activeSession?.isShared, addRemoteMessages]);

  useEffect(() => {
    lastSyncRef.current = new Date(0).toISOString();
  }, [activeSessionId]);

  useEffect(() => {
    if (!activeSession?.isShared) return;
    lastSyncRef.current = new Date(0).toISOString();
    pollSharedMessages();
    const interval = setInterval(pollSharedMessages, 3000);
    return () => clearInterval(interval);
  }, [activeSession?.isShared, activeSessionId, pollSharedMessages]);

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
        const r = await fetch(`${BASE}/api/youtube-search?q=${encodeURIComponent(content)}`);
        const data = await r.json() as { videos?: YoutubeVideo[] };
        if (data.videos && data.videos.length > 0) {
          const md = `## 🎬 Top ${data.videos.length} Results for "${content}"\n\n` +
            data.videos.map((v, i) =>
              `**${i + 1}. [${v.title}](${v.url})**  \n${[v.channel, v.views, v.duration].filter(Boolean).join(" • ")}`
            ).join("\n\n");
          addMessage(activeSessionId, "model", md);
        } else {
          addMessage(activeSessionId, "model", `No results. [Search on YouTube](https://www.youtube.com/results?search_query=${encodeURIComponent(content)})`);
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
    if (isFirstMessage) {
      updateSessionTitle(activeSessionId, content.trim().split(/\s+/).slice(0, 6).join(" "));
    }

    const userMsgId = addMessage(activeSessionId, "user", content);
    if (activeSession?.isShared) postSyncMessage(activeSessionId, "user", content, userMsgId);

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

      const modelMsgId = addMessage(activeSessionId, "model", res.reply);
      if (activeSession?.isShared) postSyncMessage(activeSessionId, "model", res.reply, modelMsgId);
      scrollToBottom();

      if (isFirstMessage) {
        generateTitleMutation.mutateAsync({ data: { apiKey, firstMessage: content } })
          .then((r) => updateSessionTitle(activeSessionId, r.title))
          .catch(() => {});
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

  if (!activeSession) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background/50">
        <div className="text-center text-muted-foreground px-6">
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
  const hasMessages = sessionMessages.length > 0;

  const pinnedMessages = sessionMessages.filter((m) => m.pinned);
  const safePinnedIndex = pinnedMessages.length > 0 ? pinnedIndex % pinnedMessages.length : 0;
  const currentPinned = pinnedMessages[safePinnedIndex];

  const jumpToPinned = () => {
    if (!currentPinned) return;
    const el = msgRefs.current.get(currentPinned.id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(currentPinned.id);
      setTimeout(() => setHighlightedId(null), 1800);
    }
    if (pinnedMessages.length > 1) {
      setPinnedIndex((i) => (i + 1) % pinnedMessages.length);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background relative">

      {/* Telegram-style pin banner */}
      {currentPinned && (
        <div
          className="flex items-center gap-2.5 px-4 py-2 bg-card border-b cursor-pointer hover:bg-muted/40 transition-colors shrink-0 group/pin"
          onClick={jumpToPinned}
        >
          <div className="w-0.5 self-stretch rounded-full bg-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-primary mb-0.5 flex items-center gap-1">
              <Pin className="h-2.5 w-2.5" />
              Pinned Message {pinnedMessages.length > 1 ? `(${safePinnedIndex + 1}/${pinnedMessages.length})` : ""}
            </p>
            <p className="text-xs text-muted-foreground truncate leading-snug">
              {currentPinned.content.replace(/[#*`>]/g, "").slice(0, 100)}{currentPinned.content.length > 100 ? "…" : ""}
            </p>
          </div>
          <button
            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground opacity-0 group-hover/pin:opacity-100 hover:text-foreground hover:bg-muted transition-all shrink-0"
            onClick={(e) => { e.stopPropagation(); togglePinMessage(currentPinned.id); }}
            title="Unpin"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Messages */}
      <div
        className="flex-1 min-h-0 overflow-y-auto p-3 md:p-5 pb-20 md:pb-24"
        ref={scrollRef}
        style={{ maskImage: "linear-gradient(to bottom, black calc(100% - 72px), transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black calc(100% - 72px), transparent 100%)" }}
      >
        <div className="max-w-3xl mx-auto space-y-4 pb-2">

          {sessionMessages.map((msg) => (
            <div
              key={msg.id}
              ref={(el) => { if (el) msgRefs.current.set(msg.id, el); else msgRefs.current.delete(msg.id); }}
              className={`group flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} transition-all duration-300 ${highlightedId === msg.id ? "scale-[1.01]" : ""}`}
            >
              <div className={`max-w-[88%] md:max-w-[82%] rounded-2xl px-3 md:px-4 py-2.5 md:py-3 transition-all duration-300 ${
                highlightedId === msg.id ? "ring-2 ring-primary ring-offset-2" : ""
              } ${
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

              {/* Action row */}
              <div className={`flex items-center gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <button className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => handleCopy(msg.content)} title="Copy">
                  <Copy className="h-3 w-3" />
                </button>
                {/* Pin */}
                <button
                  className={`h-5 w-5 flex items-center justify-center rounded transition-colors ${msg.pinned ? "text-yellow-500 hover:text-yellow-600" : "text-muted-foreground hover:text-yellow-500 hover:bg-muted"}`}
                  onClick={() => togglePinMessage(msg.id)}
                  title={msg.pinned ? "Unpin" : "Pin"}
                >
                  {msg.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                </button>
                {msg.role === "user" && (
                  <button className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => { setInput(msg.content); deleteMessageFromId(activeSessionId, msg.id); }} title="Edit">
                    <Edit2 className="h-3 w-3" />
                  </button>
                )}
                <button className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => deleteMessageFromId(activeSessionId, msg.id)} title="Delete">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-start gap-2.5">
              <div className="bg-muted/50 border rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" />
                </div>
                <span className="text-xs text-muted-foreground">Notesy is thinking…</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input — floating */}
      <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-2 md:px-6 md:pb-4 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto">
          <div className="flex items-center gap-1 bg-card/90 backdrop-blur-md border rounded-full px-2 py-1.5 shadow-lg focus-within:ring-1 focus-within:ring-ring transition-shadow">

            {/* + button + inline badge */}
            <div className="flex items-center gap-1 shrink-0">
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full relative" title="Options">
                    <Plus className="h-4 w-4" />
                    {(answerMode !== "normal" || youtubeMode) && (
                      <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-52 p-1.5">
                  {/* Answer modes */}
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

                  {/* YouTube */}
                  <button
                    className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-colors ${youtubeMode ? "bg-red-50 text-red-600 font-medium dark:bg-red-950/30 dark:text-red-400" : "hover:bg-muted text-foreground"}`}
                    onClick={() => { setYoutubeMode(!youtubeMode); setPopoverOpen(false); }}
                  >
                    <Youtube className="h-3.5 w-3.5 shrink-0" />
                    YouTube Search
                    {youtubeMode && <Check className="h-3 w-3 ml-auto" />}
                  </button>

                  {/* AI Tools — only when there are messages */}
                  {hasMessages && (
                    <>
                      <div className="border-t my-1" />
                      <p className="text-[10px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">AI Tools</p>
                      <button
                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-muted text-foreground transition-colors"
                        onClick={() => { setAiModal("summary"); setPopoverOpen(false); }}
                      >
                        <FileSearch className="h-3.5 w-3.5 shrink-0" />
                        AI Summary
                      </button>
                      <button
                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-muted text-foreground transition-colors"
                        onClick={() => { setAiModal("cheatsheet"); setPopoverOpen(false); }}
                      >
                        <BookMarked className="h-3.5 w-3.5 shrink-0" />
                        Cheat Sheet
                      </button>
                    </>
                  )}
                </PopoverContent>
              </Popover>

              {/* Active mode badge */}
              {(answerMode !== "normal" || youtubeMode) && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${youtubeMode ? "bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400" : "bg-primary/10 text-primary"}`}>
                  {youtubeMode ? "YT" : activeMode?.label}
                </span>
              )}
            </div>

            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={youtubeMode ? "Search YouTube..." : "Ask Notesy..."}
              className="min-h-[28px] max-h-24 resize-none border-0 focus-visible:ring-0 shadow-none bg-transparent px-0 py-[5px] text-sm flex-1 leading-snug self-center"
              rows={1}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />

            <Button size="icon" className="h-7 w-7 rounded-full shrink-0" onClick={handleSend} disabled={!input.trim() || isTyping}>
              {youtubeMode ? <Search className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>

      <AiActionModal open={aiModal === "summary"} onClose={() => setAiModal(null)} type="summary" />
      <AiActionModal open={aiModal === "cheatsheet"} onClose={() => setAiModal(null)} type="cheatsheet" />
    </div>
  );
}
