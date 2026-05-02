import { AppSidebar } from "@/components/Sidebar";
import { ChatArea } from "@/components/ChatArea";
import { ApiKeyModal } from "@/components/ApiKeyModal";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { useCreateInvite } from "@workspace/api-client-react";
import { Share2, Type, Palette } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export default function MainPage() {
  const { colorMode, fontMode, setColorMode, setFontMode, activeSessionId, sessions, subjects, messages } = useStore();
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
          messages: messages.filter(m => m.sessionId === activeSession.id).map(m => ({ role: m.role, content: m.content }))
        }
      });
      setInviteLink(window.location.origin + "/join/" + res.token);
      setInviteOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  const cycleColor = () => {
    const modes: ("black" | "purple" | "blue" | "green")[] = ["black", "purple", "blue", "green"];
    setColorMode(modes[(modes.indexOf(colorMode) + 1) % modes.length]);
  };

  const cycleFont = () => {
    const modes: ("normal" | "caveat" | "patrick" | "satisfy")[] = ["normal", "caveat", "patrick", "satisfy"];
    setFontMode(modes[(modes.indexOf(fontMode) + 1) % modes.length]);
  };

  const colorDotMap = {
    black: "bg-gray-900",
    purple: "bg-purple-600",
    blue: "bg-blue-600",
    green: "bg-green-600"
  };

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-background">
      <ApiKeyModal />
      
      {/* Top Header */}
      <header className="h-14 border-b flex items-center justify-between px-4 bg-card shrink-0 z-10">
        <div className="flex items-center gap-4">
          <div className="font-bold text-xl tracking-tight text-primary">Notesy</div>
        </div>
        
        <div className="flex items-center gap-2">
          {activeSession && (
            <Button variant="outline" size="sm" className="rounded-full h-9 px-4 font-medium" onClick={handleInvite}>
              <Share2 className="w-4 h-4 mr-2" /> Invite
            </Button>
          )}
          
          <div className="h-9 flex items-center bg-muted rounded-full p-1 border">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-background" onClick={cycleColor} title="Cycle Color">
              <div className={`w-4 h-4 rounded-full ${colorDotMap[colorMode]} shadow-inner`} />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-background" onClick={cycleFont} title="Cycle Font">
              <Type className="w-4 h-4 text-foreground" />
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

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Session</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">Share this link to invite others to this study session.</p>
            <div className="flex items-center gap-2">
              <Input readOnly value={inviteLink} />
              <Button onClick={() => { navigator.clipboard.writeText(inviteLink); setInviteOpen(false); }}>Copy</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
