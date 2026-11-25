import { useEffect, useState, type FormEvent } from "react";
import { ImagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, type Post } from "@/lib/api";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

/** Post avulso (estilo X): uma imagem, título e subtítulo opcionais. Vai para o feed e o portfólio. */
export function PostComposer({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (post: Post) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setTitle("");
      setSubtitle("");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const post = await api.createPost(file, title, subtitle);
      onCreated(post);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível publicar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="border-border bg-card">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nova publicação</DialogTitle>
            <DialogDescription>
              Aparece no feed Publicações e no seu portfólio. Dá para ocultar do portfólio depois.
            </DialogDescription>
          </DialogHeader>

          <label
            htmlFor="post-image"
            className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-border bg-white/5 text-sm text-muted-foreground hover:bg-white/10"
          >
            {preview ? (
              <img
                src={preview}
                alt="Prévia da imagem"
                className="max-h-72 w-full object-contain"
              />
            ) : (
              <>
                <ImagePlus className="size-6" />
                Escolher imagem (PNG, JPG, WEBP ou GIF, até 50 MB)
              </>
            )}
          </label>
          <input
            id="post-image"
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />

          <div className="space-y-2">
            <Label htmlFor="post-title">Título (opcional)</Label>
            <Input
              id="post-title"
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="post-subtitle">Subtítulo (opcional)</Label>
            <Textarea
              id="post-subtitle"
              maxLength={2000}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!file || saving}
              className="gradient-primary text-primary-foreground"
            >
              {saving ? "Publicando..." : "Publicar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
