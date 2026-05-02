import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Timer, X, RotateCcw, Play, Pause, Coffee } from "lucide-react";

type Phase = "focus" | "break";

const PHASES: Record<Phase, number> = { focus: 25 * 60, break: 5 * 60 };

export function PomodoroTimer() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("focus");
  const [secondsLeft, setSecondsLeft] = useState(PHASES.focus);
  const [running, setRunning] = useState(false);
  const [cycles, setCycles] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = PHASES[phase];
  const progress = ((total - secondsLeft) / total) * 100;
  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");

  const notify = useCallback((msg: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Notesy Timer", { body: msg, icon: "/favicon.ico" });
    }
  }, []);

  useEffect(() => {
    if (open && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [open]);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (phase === "focus") {
            notify("Focus session done! Take a break.");
            setPhase("break");
            setSecondsLeft(PHASES.break);
            setCycles((c) => c + 1);
          } else {
            notify("Break over! Time to focus.");
            setPhase("focus");
            setSecondsLeft(PHASES.focus);
          }
          return s;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, phase, notify]);

  const reset = () => {
    setRunning(false);
    setPhase("focus");
    setSecondsLeft(PHASES.focus);
    setCycles(0);
  };

  const circumference = 2 * Math.PI * 36;
  const strokeDash = circumference - (progress / 100) * circumference;

  return (
    <>
      <button
        data-testid="button-pomodoro-toggle"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 left-4 z-50 bg-card border shadow-md rounded-full p-3 hover:shadow-lg transition-all flex items-center gap-2 text-sm font-medium"
      >
        <Timer className={`h-4 w-4 ${running ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
        {running && <span className="tabular-nums text-primary font-mono text-xs">{mins}:{secs}</span>}
      </button>

      {open && (
        <div className="fixed bottom-16 left-4 z-50 bg-card border shadow-xl rounded-2xl p-5 w-56 flex flex-col items-center gap-4">
          <div className="w-full flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${phase === "focus" ? "text-primary" : "text-green-500"}`}>
              {phase === "focus" ? "Focus" : "Break"}
            </span>
            <div className="flex items-center gap-1">
              {cycles > 0 && <span className="text-xs text-muted-foreground">{cycles} done</span>}
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="relative w-24 h-24">
            <svg className="-rotate-90" width="96" height="96" viewBox="0 0 96 96">
              <circle cx="48" cy="48" r="36" fill="none" stroke="hsl(var(--muted))" strokeWidth="7" />
              <circle
                cx="48" cy="48" r="36" fill="none"
                stroke={phase === "focus" ? "hsl(var(--primary))" : "#22c55e"}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDash}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-mono text-xl font-bold tabular-nums">{mins}:{secs}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={reset}
              data-testid="button-pomodoro-reset"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              className="h-11 w-11 rounded-full"
              onClick={() => setRunning((r) => !r)}
              data-testid="button-pomodoro-play"
            >
              {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={() => {
                setRunning(false);
                setPhase(phase === "focus" ? "break" : "focus");
                setSecondsLeft(phase === "focus" ? PHASES.break : PHASES.focus);
              }}
              data-testid="button-pomodoro-switch"
              title={phase === "focus" ? "Switch to break" : "Switch to focus"}
            >
              <Coffee className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {phase === "focus" ? "Stay focused. You've got this." : "Rest your eyes and stretch."}
          </p>
        </div>
      )}
    </>
  );
}
