import { useEffect, useRef, useState, type FormEvent } from "react";
import { ImagePlus, X } from "lucide-react";

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
import { api, MAX_POST_IMAGES, type Post } from "@/lib/api";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

type Picked = { file: File; url: string };

/**
 * Post avulso (estilo X): de 1 a 6 imagens, título e subtítulo opcionais. Vai para o feed e o portfólio.
 * Para registrar mais etapas de um trabalho, o lugar é um projeto (sem limite de imagens).
 */
export function PostComposer({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (post: Post) => void;
}) {
  const [picked, setPicked] = useState<Picked[]>([]);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const pickedRef = useRef<Picked[]>([]);
  pickedRef.current = picked;

  // Libera as prévias ao fechar e ao desmontar.
  useEffect(() => {
    if (!open) {
      pickedRef.current.forEach((item) => URL.revokeObjectURL(item.url));
      setPicked([]);
      setTitle("");
      setSubtitle("");
      setError(null);
      setNotice(null);
    }
  }, [open]);
  useEffect(() => () => pickedRef.current.forEach((item) => URL.revokeObjectURL(item.url)), []);

  const add = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_POST_IMAGES - picked.length;
    const chosen = Array.from(files).slice(0, Math.max(0, room));
    setNotice(
      files.length > room
        ? `Uma publicação aceita até ${MAX_POST_IMAGES} imagens. Para registrar mais etapas, use um projeto.`
        : null,
    );
    setPicked((current) => [
      ...current,
      ...chosen.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ]);
    if (input.current) input.current.value = "";
  };

  const remove = (index: number) => {
    setPicked((current) => {
      URL.revokeObjectURL(current[index]!.url);
      return current.filter((_, position) => position !== index);
    });
    setNotice(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (picked.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const post = await api.createPost(
        picked.map((item) => item.file),
        title,
        subtitle,
      );
      onCreated(post);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível publicar.");
    } finally {
      setSaving(false);
    }
  };

  const full = picked.length >= MAX_POST_IMAGES;

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="border-border bg-card">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nova publicação</DialogTitle>
            <DialogDescription>
              Até {MAX_POST_IMAGES} imagens. Aparece no feed e no seu portfólio; dá para ocultar do
              portfólio depois.
            </DialogDescription>
          </DialogHeader>

          {picked.length === 0 ? (
            <label
              htmlFor="post-image"
              className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-white/5 text-sm text-muted-foreground hover:bg-white/10"
            >
              <ImagePlus className="size-6" />
              Escolher imagens (PNG, JPG, WEBP ou GIF, até 50 MB cada)
            </label>
          ) : (
            <ul className="grid grid-cols-3 gap-2" aria-label="Imagens escolhidas">
              {picked.map((item, index) => (
                <li
                  key={item.url}
                  className="relative aspect-square overflow-hidden rounded-xl border border-border bg-black/40"
                >
                  <img
                    src={item.url}
                    alt={`Imagem ${index + 1}`}
                    className="size-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label={`Tirar a imagem ${index + 1}`}
                    className="absolute top-1 right-1 rounded-full bg-black/70 p-1 text-white hover:bg-black"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
              {!full && (
                <li>
                  <label
                    htmlFor="post-image"
                    className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-white/5 text-xs text-muted-foreground hover:bg-white/10"
                  >
                    <ImagePlus className="size-5" />
                    Adicionar
                  </label>
                </li>
              )}
            </ul>
          )}
          <input
            ref={input}
            id="post-image"
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            disabled={full}
            onChange={(e) => add(e.target.files)}
          />
          <p className="text-xs text-muted-foreground">
            {picked.length}/{MAX_POST_IMAGES} imagens
          </p>
          {notice && <p className="text-xs text-amber-300">{notice}</p>}

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
              disabled={picked.length === 0 || saving}
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
