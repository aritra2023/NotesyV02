import { useState } from "react";
import { useStore } from "@/store/useStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ApiKeyModal() {
  const { apiKey, setApiKey } = useStore();
  const [open, setOpen] = useState(!apiKey);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const handleSave = () => {
    const trimmed = value.trim();
    if (!trimmed.startsWith("AIza") || trimmed.length < 30) {
      setError("Key should start with 'AIza' and be at least 30 characters. Get one from Google AI Studio.");
      return;
    }
    setApiKey(trimmed);
    setOpen(false);
    setError("");
  };

  return (
    <>
      {/* Change key button always visible in corner */}
      {apiKey && (
        <button
          onClick={() => { setValue(""); setError(""); setOpen(true); }}
          className="fixed bottom-4 right-4 z-50 text-xs text-muted-foreground hover:text-foreground underline"
          data-testid="button-change-api-key"
        >
          Change API key
        </button>
      )}

      <Dialog open={open} onOpenChange={(o) => { if (apiKey) setOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gemini API Key</DialogTitle>
            <DialogDescription>
              Notesy uses Google Gemini AI. Paste your key below — it's saved only in your browser.{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="underline font-medium text-primary"
              >
                Get a free key from Google AI Studio →
              </a>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Input
              data-testid="input-gemini-api-key"
              type="password"
              placeholder="AIza..."
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              autoFocus
            />
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Make sure you copy the key from <strong>aistudio.google.com</strong> (not Google Cloud Console). AI Studio keys work on the free tier.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            {apiKey && (
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            )}
            <Button
              data-testid="button-save-api-key"
              onClick={handleSave}
              disabled={value.trim().length < 10}
            >
              Save Key
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
