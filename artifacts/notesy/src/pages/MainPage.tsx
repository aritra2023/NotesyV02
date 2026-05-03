import { AppSidebar } from "@/components/Sidebar";
import { ChatArea } from "@/components/ChatArea";
import { ApiKeyModal } from "@/components/ApiKeyModal";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { NotesyLogo } from "@/components/NotesyLogo";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { useCreateInvite } from "@workspace/api-client-react";
import { Share2, FileDown } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { marked } from "marked";

export default function MainPage() {
  const {
    colorMode, setColorMode,
    activeSessionId, sessions, subjects, messages,
  } = useStore();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const createInvite = useCreateInvite();

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeSubject = activeSession ? subjects.find((s) => s.id === activeSession.subjectId) : null;

  const handleInvite = async () => {
    if (!activeSession || !activeSubject) return;
    try {
      const res = await createInvite.mutateAsync({
        data: {
          sessionId: activeSession.id,
          sessionTitle: activeSession.title,
          subjectName: activeSubject.name,
          messages: messages
            .filter((m) => m.sessionId === activeSession.id)
            .sort((a, b) => a.createdAt - b.createdAt)
            .map((m) => ({ role: m.role, content: m.content })),
        },
      });
      setInviteLink(window.location.origin + "/join/" + res.token);
      setInviteOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportPDF = () => {
    if (!activeSession) return;
    const sessionMessages = messages
      .filter((m) => m.sessionId === activeSession.id)
      .sort((a, b) => a.createdAt - b.createdAt);
    if (sessionMessages.length === 0) return;

    const headingColor =
      colorMode === "purple" ? "#9333ea" : colorMode === "blue" ? "#2563eb" :
      colorMode === "green" ? "#16a34a" : "#111827";

    let html = `<html><head><title>${activeSession.title}</title><style>
      body { font-family: system-ui; max-width: 800px; margin: 0 auto; padding: 40px; }
      .message { margin-bottom: 24px; }
      .user { font-weight: bold; color: #4b5563; margin-bottom: 8px; }
      .model { background: #f9fafb; padding: 16px; border-radius: 8px; }
      h1, h2, h3, h4 { color: ${headingColor}; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #e5e7eb; padding: 8px; }
      code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
    </style></head><body>
    <h1>${activeSubject?.name ?? ""} — ${activeSession.title}</h1><hr/>`;
    sessionMessages.forEach((m) => {
      if (m.role === "user") {
        html += `<div class="message"><div class="user">You:</div><div>${m.content}</div></div>`;
      } else {
        html += `<div class="message"><div class="model">${marked.parse(m.content)}</div></div>`;
      }
    });
    html += `</body></html>`;
    const win = window.open("", "", "width=800,height=600");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500); }
  };

  const cycleColor = () => {
    const modes: ("black" | "purple" | "blue" | "green")[] = ["black", "purple", "blue", "green"];
    setColorMode(modes[(modes.indexOf(colorMode) + 1) % modes.length]);
  };

  const colorDotMap = {
    black: "bg-gray-900", purple: "bg-purple-600",
    blue: "bg-blue-600", green: "bg-green-600",
  };

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-background">
      <ApiKeyModal />

      {/* Top Header */}
      <header className="h-14 border-b flex items-center justify-between px-4 bg-card shrink-0 z-10">
        <div className="flex items-center gap-2.5">
          <NotesyLogo size={32} />
          <span className="font-bold text-lg tracking-tight text-primary">Notesy</span>
        </div>

        <div className="flex items-center gap-2">
          {activeSession && (
            <Button
              variant="outline" size="sm"
              className="rounded-full h-8 px-3 font-medium text-xs"
              onClick={handleInvite}
              data-testid="button-invite"
            >
              <Share2 className="w-3.5 h-3.5 mr-1.5" /> Invite
            </Button>
          )}
          <div className="h-8 flex items-center bg-muted rounded-full px-1 border gap-0.5">
            <Button
              variant="ghost" size="icon"
              className="h-6 w-6 rounded-full hover:bg-background"
              onClick={cycleColor}
              title="Cycle heading color"
              data-testid="button-color-cycle"
            >
              <div className={`w-3.5 h-3.5 rounded-full ${colorDotMap[colorMode]} shadow-inner`} />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-6 w-6 rounded-full hover:bg-background"
              onClick={handleExportPDF}
              title="Export PDF"
              disabled={!activeSession || messages.filter(m => m.sessionId === activeSessionId).length === 0}
              data-testid="button-export-pdf-header"
            >
              <FileDown className="w-3.5 h-3.5 text-foreground" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        <ChatArea />
      </div>

      <PomodoroTimer />

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Session</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Share this link — anyone with it can join and see the full chat history.
            </p>
            <div className="flex items-center gap-2">
              <Input readOnly value={inviteLink} className="text-xs" />
              <Button onClick={() => { navigator.clipboard.writeText(inviteLink); setInviteOpen(false); }}>
                Copy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
