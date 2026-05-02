import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useGetInvite } from "@workspace/api-client-react";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen } from "lucide-react";

export default function JoinPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const token = params.token as string;
  
  const { data: invite, isLoading, error } = useGetInvite(token, { query: { enabled: !!token, queryKey: ["invite", token] } });
  
  const { currentUser, login, joinSession, sessions, createSubject } = useStore();
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleJoin = () => {
    if (!invite) return;
    if (currentUser) {
      joinSession(invite.sessionId);
      setLocation("/");
    } else {
      // Mock auth
      login({
        name: name || "Student",
        email,
        passwordHash: "mock",
        joinedSessions: [invite.sessionId]
      });
      setLocation("/");
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (error || !invite) return <div className="min-h-screen flex items-center justify-center">Invalid or expired invite link.</div>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <div className="mb-8 flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
          <BookOpen className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">Notesy</h1>
      </div>

      <Card className="w-full max-w-md shadow-lg border-primary/10">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">Join Study Session</CardTitle>
          <CardDescription>
            You've been invited to <strong>{invite.sessionTitle}</strong> in {invite.subjectName}.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {currentUser ? (
            <div className="space-y-4 text-center">
              <p className="text-sm">Logged in as <strong>{currentUser.name}</strong></p>
              <Button className="w-full" onClick={handleJoin}>Join Session</Button>
            </div>
          ) : (
            <Tabs defaultValue="register">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="register">New Account</TabsTrigger>
                <TabsTrigger value="login">Login</TabsTrigger>
              </TabsList>
              
              <TabsContent value="register" className="space-y-4">
                <div className="space-y-2">
                  <Input placeholder="Your Name" value={name} onChange={e => setName(e.target.value)} />
                  <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                  <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleJoin} disabled={!name || !email}>Create & Join</Button>
              </TabsContent>
              
              <TabsContent value="login" className="space-y-4">
                <div className="space-y-2">
                  <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                  <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleJoin} disabled={!email}>Login & Join</Button>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
