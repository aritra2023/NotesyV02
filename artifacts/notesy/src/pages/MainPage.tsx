import { useState } from "react";
import { AppSidebar } from "@/components/Sidebar";
import { ChatArea } from "@/components/ChatArea";
import { NotesyLogo } from "@/components/NotesyLogo";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { useCreateInvite } from "@workspace/api-client-react";
import { Share2, Settings, Menu, FileDown, Palette, User, Lock, Eye, EyeOff, Check } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { marked } from "marked";
import { toast } from "sonner";

const COLOR_OPTIONS: { value: "black" | "purple" | "blue" | "green"; label: string; dot: string }[] = [
  { value: "black", label: "Default", dot: "bg-gray-900" },
  { value: "purple", label: "Purple", dot: "bg-purple-500" },
  { value: "blue", label: "Blue", dot: "bg-blue-500" },
  { value: "green", label: "Green", dot: "bg-green-500" },
];

export default function MainPage() {
  const {
    colorMode, setColorMode,
    activeSessionId, sessions, subjects, messages,
    markSessionShared, currentUser, updateUser,
  } = useStore();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const createInvite = useCreateInvite();

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeSubject = activeSession ? subjects.find((s) => s.id === activeSession.subjectId) : null;
  const sessionMessages = messages
    .filter((m) => m.sessionId === activeSessionId)
    .sort((a, b) => a.createdAt - b.createdAt);

  const handleInvite = async () => {
    if (!activeSession || !activeSubject) return;
    try {
      const res = await createInvite.mutateAsync({
        data: {
          sessionId: activeSession.id,
          sessionTitle: activeSession.title,
          subjectName: activeSubject.name,
          messages: sessionMessages.map((m) => ({ role: m.role, content: m.content })),
        },
      });
      markSessionShared(activeSession.id);
      setInviteLink(window.location.origin + "/join/" + res.token);
      setInviteOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportPDF = () => {
    if (!activeSession || sessionMessages.length === 0) return;
    const headingColor =
      colorMode === "purple" ? "#9333ea" : colorMode === "blue" ? "#2563eb" :
      colorMode === "green" ? "#16a34a" : "#111827";

    let html = `<html><head><title>${activeSession.title}</title><style>
      body{font-family:system-ui;max-width:800px;margin:0 auto;padding:40px;line-height:1.6}
      .user-label{font-weight:bold;color:#4b5563;font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
      .model{background:#f9fafb;padding:16px;border-radius:8px;border:1px solid #e5e7eb}
      h1{color:${headingColor};border-bottom:2px solid ${headingColor};padding-bottom:8px}
      h2,h3,h4{color:${headingColor}}
      table{border-collapse:collapse;width:100%}th,td{border:1px solid #e5e7eb;padding:8px 12px}
      th{background:#f3f4f6}code{background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:.9em}
      pre{background:#1e1e1e;color:#d4d4d4;padding:16px;border-radius:8px;overflow-x:auto}
    </style></head><body><h1>${activeSubject?.name ?? ""} — ${activeSession.title}</h1>`;

    sessionMessages.forEach((m) => {
      if (m.role === "user") {
        html += `<div style="margin-bottom:20px"><div class="user-label">You</div><div>${m.content}</div></div>`;
      } else {
        html += `<div style="margin-bottom:20px"><div class="model">${marked.parse(m.content)}</div></div>`;
      }
    });
    html += `</body></html>`;
    const win = window.open("", "", "width=900,height=700");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 600); }
    setSettingsOpen(false);
  };

  // Initials for avatar
  const initials = currentUser?.name
    ? currentUser.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "YO";

  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-background">
      {/* Top Header */}
      <header className="h-14 border-b flex items-center justify-between px-3 md:px-4 bg-card shrink-0 z-10">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="md:hidden h-9 w-9" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" strokeWidth={2.8} />
          </Button>
          <NotesyLogo size={30} className="md:hidden" />
          <span className="font-bold text-base tracking-tight text-primary md:hidden">Notesy</span>
        </div>

        <div className="flex items-center gap-2">
          {activeSession && (
            <Button variant="outline" size="sm" className="rounded-full h-8 px-3 font-medium text-xs" onClick={handleInvite}>
              <Share2 className="w-3.5 h-3.5 mr-1.5" />
              Invite
            </Button>
          )}
          <div className="h-8 flex items-center bg-muted rounded-full px-1 border gap-0.5">
            {/* Color dot (keeps quick cycling) */}
            <Button
              variant="ghost" size="icon"
              className="h-6 w-6 rounded-full hover:bg-background"
              onClick={() => {
                const modes: ("black" | "purple" | "blue" | "green")[] = ["black", "purple", "blue", "green"];
                setColorMode(modes[(modes.indexOf(colorMode) + 1) % modes.length]);
              }}
              title="Cycle heading color"
            >
              <div className={`w-3.5 h-3.5 rounded-full shadow-inner ${
                colorMode === "purple" ? "bg-purple-500" : colorMode === "blue" ? "bg-blue-500" :
                colorMode === "green" ? "bg-green-500" : "bg-gray-900"
              }`} />
            </Button>
            {/* Settings icon */}
            <Button
              variant="ghost" size="icon"
              className="h-6 w-6 rounded-full hover:bg-background"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
            >
              <Settings className="w-3.5 h-3.5 text-foreground" />
            </Button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="hidden md:block shrink-0">
          <AppSidebar />
        </div>
        <ChatArea />
      </div>

      {/* Mobile sidebar drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-72 flex flex-col" aria-describedby={undefined}>
          <SheetTitle className="sr-only">Subjects & Sessions</SheetTitle>
          <div className="flex-1 overflow-hidden flex flex-col">
            <AppSidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Account */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <User className="h-3.5 w-3.5" /> Account
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border">
                <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{currentUser?.name ?? "Guest"}</p>
                  <p className="text-xs text-muted-foreground truncate">{currentUser?.email ?? "Data saved locally"}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => {
                  setEditName(currentUser?.name ?? "");
                  setEditEmail(currentUser?.email ?? "");
                  setEditingProfile(!editingProfile);
                }}>
                  <Check className={`h-3.5 w-3.5 transition-opacity ${editingProfile ? "opacity-100 text-primary" : "opacity-0"}`} />
                  {!editingProfile && <User className="h-3.5 w-3.5 absolute" />}
                </Button>
              </div>

              {editingProfile && (
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Display Name</label>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Your name"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Email</label>
                    <Input
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="your@email.com"
                      type="email"
                      className="h-8 text-sm"
                    />
                  </div>
                  <Button size="sm" className="w-full h-8 text-xs" onClick={() => {
                    if (editName.trim()) {
                      updateUser({ name: editName.trim(), email: editEmail.trim() });
                      setEditingProfile(false);
                      toast.success("Profile updated");
                    }
                  }}>
                    Save Profile
                  </Button>
                </div>
              )}
            </div>

            {/* Change Password */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Lock className="h-3.5 w-3.5" /> Change Password
              </div>
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    className="h-8 text-sm pr-8"
                  />
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPw(!showPw)}>
                    {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="h-8 text-sm"
                />
                <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={() => {
                  if (!newPassword) return;
                  if (newPassword !== confirmPassword) { toast.error("Passwords don't match"); return; }
                  if (newPassword.length < 6) { toast.error("Password too short (min 6 chars)"); return; }
                  updateUser({ passwordHash: newPassword });
                  setNewPassword(""); setConfirmPassword("");
                  toast.success("Password updated");
                }}>
                  Update Password
                </Button>
              </div>
            </div>

            <Separator />

            {/* Appearance */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Palette className="h-3.5 w-3.5" /> Heading Color
              </div>
              <div className="flex gap-2 flex-wrap">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setColorMode(c.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      colorMode === c.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted hover:border-muted-foreground/40 text-muted-foreground"
                    }`}
                  >
                    <span className={`h-3 w-3 rounded-full ${c.dot}`} />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Export */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <FileDown className="h-3.5 w-3.5" /> Export
              </div>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-sm"
                onClick={handleExportPDF}
                disabled={!activeSession || sessionMessages.length === 0}
              >
                <FileDown className="h-4 w-4" />
                Export session as PDF
              </Button>
              {(!activeSession || sessionMessages.length === 0) && (
                <p className="text-xs text-muted-foreground">Open a session with messages to export.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Share Session</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Share this link — anyone with it joins and both of you stay in sync live.
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
