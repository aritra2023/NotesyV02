import { useParams, useLocation } from "wouter";
import { useGetInvite } from "@workspace/api-client-react";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NotesyLogo } from "@/components/NotesyLogo";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function JoinPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const token = params.token as string;

  const { data: invite, isLoading, error } = useGetInvite(token, {
    query: { enabled: !!token, queryKey: ["invite", token] },
  });

  const { currentUser, login, importSession } = useStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const handleJoin = () => {
    if (!invite) return;

    if (!currentUser) {
      login({
        name: name.trim() || "Student",
        email: email.trim() || "guest@notesy.app",
        passwordHash: "mock",
        joinedSessions: [],
      });
    }

    importSession(
      invite.subjectName,
      invite.sessionId,
      invite.sessionTitle,
      (invite.messages as Array<{ role: string; content: string }>) ?? []
    );

    setLocation("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 gap-4">
        <NotesyLogo size={48} />
        <p className="text-muted-foreground text-center">Invalid or expired invite link.</p>
        <Button variant="outline" onClick={() => setLocation("/")}>Go to Notesy</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <div className="mb-8 flex items-center gap-3">
        <NotesyLogo size={44} />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary leading-none">Notesy</h1>
          <p className="text-xs text-muted-foreground">Ask. Learn. Dominate.</p>
        </div>
      </div>

      <Card className="w-full max-w-md shadow-lg border-primary/10">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">Join Study Session</CardTitle>
          <CardDescription>
            You've been invited to <strong>{invite.sessionTitle}</strong>
            {invite.subjectName ? ` in ${invite.subjectName}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {currentUser ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">Joining as <strong>{currentUser.name}</strong></p>
              <Button className="w-full" onClick={handleJoin}>Open Session</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground text-center">Enter your name to jump in — no account needed.</p>
              <Input
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
                autoFocus
              />
              <Input
                type="email"
                placeholder="Email (optional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button className="w-full" onClick={handleJoin}>
                Join Session
              </Button>
            </div>
          )}
          <p className="text-xs text-center text-muted-foreground">
            This session has {(invite.messages as unknown[])?.length ?? 0} message{(invite.messages as unknown[])?.length === 1 ? "" : "s"} to catch up on.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
