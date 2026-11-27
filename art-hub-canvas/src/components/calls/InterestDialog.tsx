import { useEffect, useState, type FormEvent } from "react";
import { Check } from "lucide-react";

import { ArtImage } from "@/components/art/ArtPieces";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, type JobCall, type Post } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

const MAX_WORKS = 6;

/** "Tenho interesse": mensagem para o estúdio e até 6 trabalhos do próprio portfólio. */
export function InterestDialog({
  open,
  onOpenChange,
  call,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  call: JobCall;
  onSent: (call: JobCall) => void;
}) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [works, setWorks] = useState<Post[] | null>(null);
  const [chosen, setChosen] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setMessage("");
    setChosen([]);
    setError(null);
    setWorks(null);
    api
      .profile(user.username)
      .then((profile) => {
        const list = profile.posts.filter(
          (post) =>
            post.images.length > 0 && post.isPublic && post.author.username === user.username,
        );
        setWorks(list);
        setChosen(list.slice(0, 3).map((post) => post.id));
      })
      .catch(() => setWorks([]));
  }, [open, user]);

  const toggle = (id: number) =>
    setChosen((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length >= MAX_WORKS
          ? current
          : [...current, id],
    );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSent(await api.showInterest(call.id, message.trim(), chosen));
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Tenho interesse</DialogTitle>
            <DialogDescription>
              {call.author.fullName} vê sua mensagem e os trabalhos que você escolher. Ninguém mais
              vê sua candidatura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="interestMessage">Mensagem</Label>
            <Textarea
              id="interestMessage"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 600))}
              rows={4}
              placeholder="Conte por que você combina com esse trabalho e sua disponibilidade."
              required
            />
            <p className="text-xs text-muted-foreground">{message.length}/600</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Trabalhos para mostrar{" "}
              <span className="font-normal text-muted-foreground">
                ({chosen.length}/{MAX_WORKS})
              </span>
            </p>
            {works === null ? (
              <div className="h-24 animate-pulse rounded-xl bg-white/5" />
            ) : works.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                Seu portfólio ainda não tem artes públicas. Dá para enviar só a mensagem, mas
                mostrar trabalho ajuda muito.
              </p>
            ) : (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {works.map((post) => {
                  const selected = chosen.includes(post.id);
                  return (
                    <li key={post.id}>
                      <button
                        type="button"
                        onClick={() => toggle(post.id)}
                        aria-pressed={selected}
                        aria-label={`${selected ? "Tirar" : "Escolher"} ${post.title ?? "arte"}`}
                        className={`relative block aspect-square w-full overflow-hidden rounded-lg border-2 ${
                          selected
                            ? "border-primary"
                            : "border-transparent opacity-70 hover:opacity-100"
                        }`}
                      >
                        <ArtImage
                          src={post.images[0]?.url ?? null}
                          title={post.title ?? "Arte"}
                          className="size-full object-cover"
                        />
                        {selected && (
                          <span className="absolute top-1 right-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                            <Check className="size-3" />
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
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
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={busy || !message.trim()}
              className="gradient-primary text-primary-foreground"
            >
              {busy ? "Enviando..." : "Enviar interesse"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
