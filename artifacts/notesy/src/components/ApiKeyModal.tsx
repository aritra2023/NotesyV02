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
    if (trimmed.length < 20) {
      setError("Key looks too short. Paste the full key from Groq.");
      return;
    }
    setApiKey(trimmed);
    setOpen(false);
    setError("");
  };

  return (
    <>
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
            <DialogTitle>Enter your Groq API Key</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Notesy uses <strong>Groq + Llama 3.3 70B</strong> — a powerful open-source model, completely free.
                </p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="underline text-primary font-medium">console.groq.com/keys</a></li>
                  <li>Sign up free (no credit card needed)</li>
                  <li>Click <strong>Create API Key</strong>, copy it</li>
                  <li>Paste it below</li>
                </ol>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Input
              data-testid="input-groq-api-key"
              type="password"
              placeholder="gsk_..."
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="flex justify-end gap-2">
            {apiKey && (
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            )}
            <Button
              data-testid="button-save-api-key"
              onClick={handleSave}
              disabled={value.trim().length < 20}
            >
              Save Key
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
