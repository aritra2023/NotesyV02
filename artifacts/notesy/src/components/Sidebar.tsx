import { useState } from "react";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Folder, FolderOpen, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function AppSidebar() {
  const {
    subjects,
    sessions,
    activeSessionId,
    activeSubjectId,
    createSubject,
    deleteSubject,
    createSession,
    deleteSession,
    setActiveSession,
    setActiveSubject,
  } = useStore();

  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");

  const handleCreateSubject = () => {
    if (newSubjectName.trim()) {
      createSubject(newSubjectName.trim());
      setNewSubjectName("");
      setIsAddSubjectOpen(false);
    }
  };

  const handleCreateSession = (subjectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    createSession(subjectId);
  };

  return (
    <div className="w-64 border-r bg-sidebar text-sidebar-foreground flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-bold text-lg text-primary tracking-tight">Notesy</h2>
        <Button variant="ghost" size="icon" onClick={() => setIsAddSubjectOpen(true)}>
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {subjects.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground italic">
            No subjects yet.<br/>Create one to get started.
          </div>
        ) : (
          <Accordion
            type="multiple"
            defaultValue={activeSubjectId ? [activeSubjectId] : []}
            className="w-full"
          >
            {subjects.map((subject) => {
              const subjectSessions = sessions.filter((s) => s.subjectId === subject.id);
              return (
                <AccordionItem value={subject.id} key={subject.id} className="border-b-0">
                  <div className="group flex items-center justify-between px-4 py-2 hover:bg-sidebar-accent cursor-pointer transition-colors">
                    <AccordionTrigger className="hover:no-underline py-0 flex-1 justify-start gap-2">
                      <Folder className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm truncate">{subject.name}</span>
                    </AccordionTrigger>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Delete subject and all its sessions?")) {
                            deleteSubject(subject.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-primary"
                        onClick={(e) => handleCreateSession(subject.id, e)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <AccordionContent className="pb-0">
                    <div className="pl-6 ml-4 border-l border-sidebar-border py-1 flex flex-col gap-1">
                      {subjectSessions.length === 0 ? (
                        <div className="text-xs text-muted-foreground py-2 pl-2">No sessions</div>
                      ) : (
                        subjectSessions.map((session) => (
                          <div
                            key={session.id}
                            className={`group flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer text-sm transition-colors ${
                              activeSessionId === session.id
                                ? "bg-primary text-primary-foreground font-medium"
                                : "text-sidebar-foreground hover:bg-sidebar-accent"
                            }`}
                            onClick={() => {
                              setActiveSubject(subject.id);
                              setActiveSession(session.id);
                            }}
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              <FileText className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{session.title}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity ${
                                activeSessionId === session.id ? "text-primary-foreground/80 hover:text-white" : "text-muted-foreground hover:text-destructive"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Delete session?")) {
                                  deleteSession(session.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </ScrollArea>

      <Dialog open={isAddSubjectOpen} onOpenChange={setIsAddSubjectOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Subject</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="e.g. Biology 101"
            value={newSubjectName}
            onChange={(e) => setNewSubjectName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateSubject();
            }}
          />
          <DialogFooter>
            <Button onClick={handleCreateSubject}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
