import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { MessageCircle, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/layout/ConfirmDialog";
import { relativeTime, UserAvatar } from "@/components/posts/PostCard";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, type CommentThread, type FeedbackComment } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

const MAX = 1000;

/**
 * Comentários de feedback de uma publicação ou da página pública de um projeto.
 * Ficam aqui, embaixo da arte: não viram post no perfil de quem comentou.
 */
export function CommentsPanel({
  target,
  id,
  onCountChange,
}: {
  target: "post" | "project";
  id: number;
  onCountChange?: (count: number) => void;
}) {
  const { user } = useAuth();
  const [thread, setThread] = useState<CommentThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const now = Date.now();

  // Guardado em ref: uma função nova a cada render do pai não pode recarregar os comentários.
  const countChange = useRef(onCountChange);
  countChange.current = onCountChange;
  const apply = useCallback((next: CommentThread) => {
    setThread(next);
    countChange.current?.(next.count);
  }, []);

  useEffect(() => {
    let active = true;
    setThread(null);
    api
      .commentThread(target, id)
      .then((loaded) => {
        if (!active) return;
        apply(loaded);
        // Veio pelo contador do card (#comentarios): rola até os comentários depois de carregar.
        if (window.location.hash === "#comentarios") {
          requestAnimationFrame(() =>
            document
              .getElementById("comentarios")
              ?.scrollIntoView({ behavior: "smooth", block: "start" }),
          );
        }
      })
      .catch(
        (e) =>
          active &&
          setError(e instanceof Error ? e.message : "Não foi possível carregar os comentários."),
      );
    return () => {
      active = false;
    };
  }, [target, id, apply]);

  const send = async (body: string, parentId?: number) => {
    setError(null);
    const next = await api.addFeedback(target, id, body, parentId);
    apply(next);
    setReplyTo(null);
  };

  const toggle = async (enabled: boolean) => {
    setBusy(true);
    setError(null);
    try {
      apply(await api.setFeedbackEnabled(target, id, enabled));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (removing === null) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteFeedback(removing);
      apply(await api.commentThread(target, id));
      setRemoving(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível apagar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      id="comentarios"
      aria-labelledby="comments-title"
      className="border-t border-border pt-5"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 id="comments-title" className="flex items-center gap-2 font-bold">
          <MessageCircle className="size-4" /> Feedback
          {thread && thread.count > 0 && (
            <span className="font-normal text-muted-foreground">· {thread.count}</span>
          )}
        </h3>
        {thread?.canToggle && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {thread.enabled ? "Ligados" : "Desligados"}
            <Switch
              checked={thread.enabled}
              disabled={busy}
              onCheckedChange={(checked) => void toggle(checked)}
              aria-label="Comentários ligados"
            />
          </label>
        )}
      </div>

      {thread === null && !error && <div className="h-16 animate-pulse rounded-xl bg-white/5" />}

      {thread && (
        <>
          {thread.enabled ? (
            user ? (
              <Composer
                placeholder="Deixe um feedback sobre o trabalho"
                onSend={(body) => send(body)}
              />
            ) : (
              <p className="rounded-xl border border-border p-3 text-sm text-muted-foreground">
                <Link to="/login" className="text-primary hover:underline">
                  Entre
                </Link>{" "}
                para deixar um feedback.
              </p>
            )
          ) : (
            <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
              {thread.canToggle
                ? "Os comentários estão desligados. Ligue acima para receber feedback."
                : "Os comentários estão desligados aqui."}
            </p>
          )}

          {thread.comments.length === 0 ? (
            thread.enabled && (
              <p className="mt-3 text-sm text-muted-foreground">
                Nenhum feedback ainda. Seja o primeiro.
              </p>
            )
          ) : (
            <ul className="mt-4 space-y-4">
              {thread.comments.map((comment) => (
                <li key={comment.id}>
                  <CommentItem
                    comment={comment}
                    now={now}
                    canReply={thread.enabled && Boolean(user) && !comment.removed}
                    onReply={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                    onDelete={(commentId) => setRemoving(commentId)}
                  />
                  {(comment.replies.length > 0 || replyTo === comment.id) && (
                    <ul className="mt-3 ml-11 space-y-3 border-l border-border pl-3">
                      {comment.replies.map((reply) => (
                        <li key={reply.id}>
                          <CommentItem
                            comment={reply}
                            now={now}
                            canReply={false}
                            onDelete={(commentId) => setRemoving(commentId)}
                          />
                        </li>
                      ))}
                      {replyTo === comment.id && (
                        <li>
                          <Composer
                            autoFocus
                            placeholder={`Responder a ${comment.author?.fullName ?? "este comentário"}`}
                            onSend={(body) => send(body, comment.id)}
                            onCancel={() => setReplyTo(null)}
                          />
                        </li>
                      )}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Apagar este comentário?"
        description="Ele some para todos. Se tiver respostas, fica a marca de comentário removido."
        confirmLabel="Apagar"
        destructive
        busy={busy}
        onConfirm={() => void remove()}
      />
    </section>
  );
}

function CommentItem({
  comment,
  now,
  canReply,
  onReply,
  onDelete,
}: {
  comment: FeedbackComment;
  now: number;
  canReply: boolean;
  onReply?: () => void;
  onDelete: (commentId: number) => void;
}) {
  if (comment.removed || !comment.author) {
    return <p className="text-sm text-muted-foreground italic">Comentário removido.</p>;
  }
  return (
    <div className="flex gap-3">
      <Link
        to="/u/$username"
        params={{ username: comment.author.username }}
        aria-label={`Perfil de ${comment.author.fullName}`}
      >
        <UserAvatar name={comment.author.fullName} src={comment.author.avatarUrl} size="sm" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
          <Link
            to="/u/$username"
            params={{ username: comment.author.username }}
            className="font-semibold hover:underline"
          >
            {comment.author.fullName}
          </Link>
          <time className="text-xs text-muted-foreground" dateTime={comment.createdAt}>
            {relativeTime(comment.createdAt, now)}
          </time>
        </p>
        <p className="mt-0.5 text-sm whitespace-pre-wrap break-words">{comment.body}</p>
        <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
          {canReply && (
            <button type="button" onClick={onReply} className="hover:text-foreground">
              Responder
            </button>
          )}
          {comment.canDelete && (
            <button
              type="button"
              onClick={() => onDelete(comment.id)}
              className="inline-flex items-center gap-1 hover:text-destructive"
            >
              <Trash2 className="size-3" /> Apagar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Composer({
  placeholder,
  onSend,
  onCancel,
  autoFocus = false,
}: {
  placeholder: string;
  onSend: (body: string) => Promise<void>;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    try {
      await onSend(text);
      setBody("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, MAX))}
        placeholder={placeholder}
        rows={2}
        autoFocus={autoFocus}
        className="min-h-[64px] resize-y text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void submit(e);
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {body.length}/{MAX}
        </span>
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={sending}>
              Cancelar
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            className="rounded-full"
            disabled={sending || !body.trim()}
          >
            {sending ? "Enviando..." : "Enviar"}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
