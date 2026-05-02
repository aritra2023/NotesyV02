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
  const [open, setOpen] = useState(false);
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
      <button
        onClick={() => { setValue(apiKey || ""); setError(""); setOpen(true); }}
        className="fixed bottom-4 right-4 z-50 text-xs text-muted-foreground hover:text-foreground underline"
        data-testid="button-change-api-key"
      >
        {apiKey ? "Change API key" : "Add own API key"}
      </button>

      <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Groq API Key (Optional)</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Notesy works out of the box — no key needed. Optionally add your own{" "}
                  <strong>Groq API key</strong> for higher rate limits.
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
              placeholder="gsk_... (leave blank to use shared key)"
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            {apiKey && (
              <Button variant="outline" onClick={() => { setApiKey(""); setOpen(false); }}>
                Clear key
              </Button>
            )}
            <Button
              data-testid="button-save-api-key"
              onClick={handleSave}
              disabled={value.trim().length > 0 && value.trim().length < 20}
            >
              Save Key
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
