import { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { useSendChatMessage, useGenerateSessionTitle } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Copy,
  Edit2,
  Trash2,
  Youtube,
  Send,
  BookOpen,
  AlignLeft,
  Lightbulb,
  FileText,
  Search
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { marked } from "marked";
import { toast } from "sonner";

export function ChatArea() {
  const {
    activeSessionId,
    sessions,
    subjects,
    messages,
    addMessage,
    deleteMessageFromId,
    updateSessionTitle,
    apiKey,
    colorMode,
    fontMode,
    answerMode,
    youtubeMode,
    setAnswerMode,
    setYoutubeMode,
  } = useStore();

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeSubject = activeSession ? subjects.find((s) => s.id === activeSession.subjectId) : null;
  const sessionMessages = messages.filter((m) => m.sessionId === activeSessionId).sort((a, b) => a.createdAt - b.createdAt);

  const sendChatMutation = useSendChatMessage();
  const generateTitleMutation = useGenerateSessionTitle();

  const handleSend = async () => {
    if (!input.trim() || !activeSessionId || !apiKey) return;

    const content = input.trim();
    setInput("");

    if (youtubeMode) {
      window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(content)}`, '_blank');
      addMessage(activeSessionId, 'model', `*Searching YouTube for:* **${content}**`);
      setYoutubeMode(false);
      return;
    }

    addMessage(activeSessionId, "user", content);
    setIsTyping(true);

    try {
      const allMsgs = messages.filter(m => m.sessionId === activeSessionId).map(m => ({ role: m.role, content: m.content }));
      allMsgs.push({ role: "user", content });
      
      const res = await sendChatMutation.mutateAsync({
        data: {
          apiKey: apiKey || "",
          messages: allMsgs,
          answerMode
        }
      });
      
      addMessage(activeSessionId, "model", res.reply);

      if (sessionMessages.length === 0) {
        const titleRes = await generateTitleMutation.mutateAsync({
          data: {
            apiKey,
            firstMessage: content
          }
        });
        updateSessionTitle(activeSessionId, titleRes.title);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err as { message?: string })?.message ||
        "Failed to get a response. Check your API key.";
      toast.error(msg, { duration: 6000 });
    } finally {
      setIsTyping(false);
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard");
  };

  const handleExportPDF = () => {
    if (!activeSession || sessionMessages.length === 0) return;
    
    let html = `<html><head><title>${activeSession.title}</title><style>
      body { font-family: system-ui; max-width: 800px; margin: 0 auto; padding: 40px; }
      .message { margin-bottom: 24px; }
      .user { font-weight: bold; color: #4b5563; margin-bottom: 8px; }
      .model { background: #f9fafb; padding: 16px; border-radius: 8px; }
      h1, h2, h3, h4 { color: ${colorMode === 'black' ? '#111827' : colorMode === 'purple' ? '#9333ea' : colorMode === 'blue' ? '#2563eb' : '#16a34a'}; }
    </style></head><body>
    <h1>${activeSubject?.name} - ${activeSession.title}</h1><hr/>`;

    sessionMessages.forEach(m => {
      if (m.role === 'user') {
        html += `<div class="message"><div class="user">You:</div><div>${m.content}</div></div>`;
      } else {
        html += `<div class="message"><div class="model">${marked.parse(m.content)}</div></div>`;
      }
    });
    html += `</body></html>`;
    
    const win = window.open('', '', 'width=800,height=600');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => { win.print(); }, 500);
    }
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
    normal: "font-sans",
    caveat: "font-caveat text-xl",
    patrick: "font-patrick text-xl",
    satisfy: "font-satisfy text-xl",
  }[fontMode];

  const colorClass = {
    black: "prose-headings:text-gray-900",
    purple: "prose-headings:text-purple-600",
    blue: "prose-headings:text-blue-600",
    green: "prose-headings:text-green-600",
  }[colorMode];

  return (
    <div className="flex-1 flex flex-col h-full bg-background relative">
      {/* Header */}
      <div className="h-16 border-b flex items-center justify-between px-6 bg-card shrink-0">
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
            {activeSubject?.name}
          </div>
          <div className="font-bold text-lg leading-none">{activeSession.title}</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            {activeSession.participants.slice(0, 5).map((p, i) => (
              <Avatar key={i} className={`h-8 w-8 border-2 border-background ${p.color}`}>
                <AvatarFallback className="text-xs text-white">{p.initials}</AvatarFallback>
              </Avatar>
            ))}
            {activeSession.participants.length > 5 && (
              <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium z-10">
                +{activeSession.participants.length - 5}
              </div>
            )}
          </div>
          {sessionMessages.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              Export PDF
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-6">
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
                
                {/* Actions Hover */}
                <div className={`absolute -top-3 ${msg.role === "user" ? "left-0 -translate-x-full pr-2" : "right-0 translate-x-full pl-2"} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1`}>
                  {msg.role === "model" && (
                    <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full shadow-sm" onClick={() => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(activeSession.title)}`, '_blank')}>
                      <Youtube className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full shadow-sm" onClick={() => handleCopy(msg.content)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  {msg.role === "user" && (
                    <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full shadow-sm" onClick={() => {
                      setInput(msg.content);
                      deleteMessageFromId(activeSessionId, msg.id);
                    }}>
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
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 bg-background border-t shrink-0">
        <div className="max-w-3xl mx-auto">
          {/* Modes */}
          <div className="flex items-center gap-2 mb-3">
            <Button variant={answerMode === 'normal' ? 'secondary' : 'ghost'} size="sm" className="rounded-full h-8 text-xs" onClick={() => setAnswerMode('normal')}>
              <FileText className="w-3.5 h-3.5 mr-1" /> Normal
            </Button>
            <Button variant={answerMode === 'exam' ? 'secondary' : 'ghost'} size="sm" className="rounded-full h-8 text-xs" onClick={() => setAnswerMode('exam')}>
              <BookOpen className="w-3.5 h-3.5 mr-1" /> Exam Mode
            </Button>
            <Button variant={answerMode === 'short' ? 'secondary' : 'ghost'} size="sm" className="rounded-full h-8 text-xs" onClick={() => setAnswerMode('short')}>
              <AlignLeft className="w-3.5 h-3.5 mr-1" /> Short
            </Button>
            <Button variant={answerMode === 'explanation' ? 'secondary' : 'ghost'} size="sm" className="rounded-full h-8 text-xs" onClick={() => setAnswerMode('explanation')}>
              <Lightbulb className="w-3.5 h-3.5 mr-1" /> Explain
            </Button>
            <div className="w-px h-4 bg-border mx-1"></div>
            <Button variant={youtubeMode ? 'default' : 'ghost'} size="sm" className="rounded-full h-8 text-xs" onClick={() => setYoutubeMode(!youtubeMode)}>
              <Youtube className="w-3.5 h-3.5 mr-1" /> YouTube Search
            </Button>
          </div>
          
          <div className="relative flex items-end gap-2 bg-card border rounded-xl p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring transition-shadow">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={youtubeMode ? "Search YouTube for..." : "Ask Notesy..."}
              className="min-h-[44px] max-h-32 resize-none border-0 focus-visible:ring-0 shadow-none bg-transparent p-2 text-base"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button size="icon" className="h-10 w-10 rounded-lg shrink-0 mb-1" onClick={handleSend} disabled={!input.trim() || isTyping}>
              {youtubeMode ? <Search className="h-5 w-5" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
