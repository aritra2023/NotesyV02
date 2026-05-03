import { useState, useRef, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Folder, FileText, Calendar, X, Pencil, MoreHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function ReviewBadge({ reviewDate }: { reviewDate: number | null }) {
  if (!reviewDate) return null;
  const now = Date.now();
  const overdue = reviewDate <= now;
  const soon = reviewDate <= now + 24 * 60 * 60 * 1000;
  return (
    <span
      className={`h-2 w-2 rounded-full shrink-0 ${overdue ? "bg-red-500" : soon ? "bg-yellow-400" : "bg-green-400"}`}
      title={overdue ? "Review overdue!" : `Review due ${new Date(reviewDate).toLocaleDateString()}`}
    />
  );
}

function InlineEdit({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <input
      ref={ref}
      className="bg-transparent border-b border-primary outline-none text-sm font-medium w-full pr-1"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft.trim()) onSave(draft.trim()); else onCancel(); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); if (draft.trim()) onSave(draft.trim()); }
        if (e.key === "Escape") onCancel();
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

interface AppSidebarProps {
  onNavigate?: () => void;
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const {
    subjects, sessions, activeSessionId, activeSubjectId,
    createSubject, deleteSubject, updateSubjectName,
    createSession, deleteSession,
    setActiveSession, setActiveSubject,
    updateSessionTitle,
    markForReview, clearReview,
  } = useStore();

  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  const reviewDueCount = sessions.filter(
    (s) => s.reviewDate != null && s.reviewDate <= Date.now()
  ).length;

  const handleCreateSubject = () => {
    if (newSubjectName.trim()) {
      createSubject(newSubjectName.trim());
      setNewSubjectName("");
      setIsAddSubjectOpen(false);
    }
  };

  const handleSelectSession = (subjectId: string, sessionId: string) => {
    setActiveSubject(subjectId);
    setActiveSession(sessionId);
    onNavigate?.();
  };

  return (
    <div className="w-full md:w-64 border-r bg-sidebar text-sidebar-foreground flex flex-col h-full">
      <div className="px-4 py-3 border-b flex items-center gap-2 pr-12 md:pr-4">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-1">Subjects</span>
        {reviewDueCount > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center">
            {reviewDueCount}
          </span>
        )}
      </div>

      <ScrollArea className="flex-1">
        {subjects.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground italic">
            No subjects yet.<br />Create one to get started.
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
                    <AccordionTrigger className="hover:no-underline py-0 flex-1 justify-start gap-2 min-w-0">
                      <Folder className="h-4 w-4 text-primary shrink-0" />
                      {editingSubjectId === subject.id ? (
                        <InlineEdit
                          value={subject.name}
                          onSave={(name) => { updateSubjectName(subject.id, name); setEditingSubjectId(null); }}
                          onCancel={() => setEditingSubjectId(null)}
                        />
                      ) : (
                        <span
                          className="font-medium text-sm truncate"
                          onDoubleClick={(e) => { e.stopPropagation(); setEditingSubjectId(subject.id); }}
                          title="Double-click to rename"
                        >
                          {subject.name}
                        </span>
                      )}
                    </AccordionTrigger>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity shrink-0">
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
                        onClick={(e) => { e.stopPropagation(); setEditingSubjectId(subject.id); }}
                        title="Rename"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); if (confirm("Delete subject and all its sessions?")) deleteSubject(subject.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-primary"
                        onClick={(e) => { e.stopPropagation(); createSession(subject.id); onNavigate?.(); }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <AccordionContent className="pb-0">
                    <div className="pl-6 ml-4 border-l border-sidebar-border py-1 flex flex-col gap-1">
                      {subjectSessions.length === 0 ? (
                        <div className="text-xs text-muted-foreground py-2 pl-2">No sessions yet</div>
                      ) : (
                        subjectSessions.map((session) => (
                          <div
                            key={session.id}
                            className={`group/item flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer text-sm transition-colors ${
                              activeSessionId === session.id
                                ? "bg-primary text-primary-foreground font-medium"
                                : "text-sidebar-foreground hover:bg-sidebar-accent"
                            }`}
                            onClick={() => handleSelectSession(subject.id, session.id)}
                          >
                            <FileText className="h-3.5 w-3.5 shrink-0" />

                            {editingSessionId === session.id ? (
                              <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                                <InlineEdit
                                  value={session.title}
                                  onSave={(title) => { updateSessionTitle(session.id, title); setEditingSessionId(null); }}
                                  onCancel={() => setEditingSessionId(null)}
                                />
                              </div>
                            ) : (
                              <span
                                className="flex-1 min-w-0 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                                title={session.title}
                              >{session.title}</span>
                            )}

                            <ReviewBadge reviewDate={session.reviewDate ?? null} />

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost" size="icon"
                                  className={`h-5 w-5 shrink-0 rounded opacity-0 group-hover/item:opacity-100 transition-opacity ${activeSessionId === session.id ? "text-primary-foreground/70 hover:text-white hover:bg-white/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent side="right" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem onClick={() => setEditingSessionId(session.id)}>
                                  <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => markForReview(session.id, 1)}>
                                  <Calendar className="h-3.5 w-3.5 mr-2" /> Review in 1 day
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => markForReview(session.id, 3)}>
                                  <Calendar className="h-3.5 w-3.5 mr-2" /> Review in 3 days
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => markForReview(session.id, 7)}>
                                  <Calendar className="h-3.5 w-3.5 mr-2" /> Review in 7 days
                                </DropdownMenuItem>
                                {session.reviewDate && (
                                  <DropdownMenuItem className="text-destructive" onClick={() => clearReview(session.id)}>
                                    <X className="h-3.5 w-3.5 mr-2" /> Clear reminder
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm("Delete session?")) deleteSession(session.id); }}>
                                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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

      {/* Footer — Add Subject */}
      <div className="p-3 border-t shrink-0">
        <Button
          variant="outline"
          className="w-full h-9 text-sm gap-2 rounded-lg"
          onClick={() => setIsAddSubjectOpen(true)}
          data-testid="button-add-subject"
        >
          <Plus className="h-4 w-4" />
          New Subject
        </Button>
      </div>

      <Dialog open={isAddSubjectOpen} onOpenChange={setIsAddSubjectOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Create Subject</DialogTitle></DialogHeader>
          <Input
            placeholder="e.g. Biology 101"
            value={newSubjectName}
            onChange={(e) => setNewSubjectName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateSubject(); }}
            autoFocus
          />
          <DialogFooter>
            <Button onClick={handleCreateSubject}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
