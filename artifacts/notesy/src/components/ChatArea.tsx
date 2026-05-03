import { useState, useRef, useEffect, useCallback } from "react";
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
  } = useStore();

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [aiModal, setAiModal] = useState<"summary" | "cheatsheet" | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSyncRef = useRef<string>(new Date(0).toISOString());

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

  // Real-time polling for shared sessions
  const pollSharedMessages = useCallback(async () => {
    if (!activeSessionId || !activeSession?.isShared) return;
    try {
      const since = lastSyncRef.current;
      const r = await fetch(`${BASE}/api/sync/messages/${activeSessionId}?since=${encodeURIComponent(since)}`);
      if (!r.ok) return;
      const data = await r.json() as { messages: Array<{ id: string; clientId: string | null; role: string; content: string; createdAt: string }> };
      if (data.messages.length > 0) {
        lastSyncRef.current = data.messages[data.messages.length - 1].createdAt;
        addRemoteMessages(activeSessionId, data.messages);
        scrollToBottom();
      }
    } catch { /* ignore */ }
  }, [activeSessionId, activeSession?.isShared, addRemoteMessages]);

  // Reset sync cursor when session changes
  useEffect(() => {
    lastSyncRef.current = new Date(0).toISOString();
  }, [activeSessionId]);

  // Poll every 3 seconds when in a shared session
  useEffect(() => {
    if (!activeSession?.isShared) return;
    // Initial fetch of all existing server messages
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

    const userMsgId = addMessage(activeSessionId, "user", content);
    // Sync user message if shared
    if (activeSession?.isShared) {
      postSyncMessage(activeSessionId, "user", content, userMsgId);
    }

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
      // Sync AI response if shared
      if (activeSession?.isShared) {
        postSyncMessage(activeSessionId, "model", res.reply, modelMsgId);
      }
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

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background relative">
      {/* Session Header */}
      <div className="h-14 border-b flex items-center justify-between px-4 bg-card shrink-0">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-0.5 truncate">
            {activeSubject?.name}
            {activeSession.isShared && (
              <span className="ml-2 text-[9px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full dark:bg-green-950 dark:text-green-400 font-semibold normal-case tracking-normal">
                Live
              </span>
            )}
          </div>
          {editingTitle ? (
            <Input
              autoFocus value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
              className="h-6 font-bold text-sm px-1 py-0 border-0 border-b rounded-none focus-visible:ring-0 shadow-none w-48"
            />
          ) : (
            <div
              className="group flex items-center gap-1 cursor-pointer w-fit max-w-full"
              onClick={() => { setTitleDraft(activeSession.title); setEditingTitle(true); }}
            >
              <span className="font-bold text-sm md:text-base leading-none truncate max-w-[140px] md:max-w-xs">{activeSession.title}</span>
              <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          <div className="flex -space-x-1.5">
            {activeSession.participants.slice(0, 3).map((p, i) => (
              <Avatar key={i} className={`h-6 w-6 border-2 border-background ${p.color}`}>
                <AvatarFallback className="text-[9px] text-white">{p.initials}</AvatarFallback>
              </Avatar>
            ))}
          </div>
          {sessionMessages.length > 0 && (
            <>
              <Button variant="ghost" size="sm" className="h-7 px-1.5 md:px-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setAiModal("summary")}>
                <FileSearch className="h-3.5 w-3.5 md:mr-1" />
                <span className="hidden md:inline">Summary</span>
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-1.5 md:px-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setAiModal("cheatsheet")}>
                <BookMarked className="h-3.5 w-3.5 md:mr-1" />
                <span className="hidden md:inline">Cheat Sheet</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 md:p-5" ref={scrollRef}>
        <div className="max-w-3xl mx-auto space-y-4 pb-4">
          {sessionMessages.map((msg) => (
            <div key={msg.id} className={`group flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[88%] md:max-w-[82%] rounded-2xl px-3 md:px-4 py-2.5 md:py-3 ${
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

              {/* Action buttons — tiny row below message on hover */}
              <div className={`flex items-center gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <button
                  className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  onClick={() => handleCopy(msg.content)} title="Copy"
                >
                  <Copy className="h-3 w-3" />
                </button>
                {msg.role === "user" && (
                  <button
                    className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    onClick={() => { setInput(msg.content); deleteMessageFromId(activeSessionId, msg.id); }} title="Edit"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                )}
                <button
                  className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={() => deleteMessageFromId(activeSessionId, msg.id)} title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex flex-col items-start">
              <div className="bg-muted/50 border rounded-2xl rounded-bl-sm px-5 py-4 w-20 shadow-sm flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-2 md:p-4 bg-background border-t shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-1.5 bg-card border rounded-xl p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring transition-shadow">

            {/* + button and active mode badge — always inline */}
            <div className="flex items-center gap-1 shrink-0 mb-0.5">
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 rounded-lg relative"
                    title="Answer mode"
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

              {/* Mode badge — right next to + button, same row */}
              {(answerMode !== "normal" || youtubeMode) && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${youtubeMode ? "bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400" : "bg-primary/10 text-primary"}`}>
                  {youtubeMode ? "YouTube" : activeMode?.label}
                </span>
              )}
            </div>

            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={youtubeMode ? "Search YouTube..." : "Ask Notesy..."}
              className="min-h-[36px] max-h-28 resize-none border-0 focus-visible:ring-0 shadow-none bg-transparent p-1.5 text-sm flex-1 leading-snug"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />

            <Button
              size="icon"
              className="h-8 w-8 rounded-lg shrink-0 mb-0.5"
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
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
