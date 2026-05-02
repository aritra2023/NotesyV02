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

  const handleSave = () => {
    if (value.trim().length > 10) {
      setApiKey(value.trim());
      setOpen(false);
    }
  };

  if (apiKey) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to Notesy</DialogTitle>
          <DialogDescription>
            To start studying with AI, please enter your Gemini API key.
            This key is stored locally in your browser.{" "}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="underline text-primary"
            >
              Get a free key here
            </a>
            .
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Input
            type="password"
            placeholder="Enter your Gemini API key..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={value.trim().length <= 10}>
            Save Key
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
