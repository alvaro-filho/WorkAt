import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, MessageSquare, RotateCcw, Send, Trash2 } from "lucide-react";

import { relativeTime, UserAvatar } from "@/components/posts/PostCard";
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
import { api, type ApiTask, type TaskComment, type TaskFile } from "@/lib/api";

/**
 * Revisão da tarefa. No corporativo o contratado não conclui sozinho: envia para revisão e o dono aprova
 * ou pede ajuste (com o motivo, que fica na conversa).
 */
export function ReviewPanel({
  task,
  isOwner,
  isCorporate,
  canWork,
  closed,
  onTaskChange,
  onReviewed,
}: {
  task: ApiTask;
  isOwner: boolean;
  isCorporate: boolean;
  canWork: boolean;
  closed: boolean;
  onTaskChange: (task: ApiTask) => void;
  onReviewed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askChanges, setAskChanges] = useState(false);
  const [note, setNote] = useState("");

  if (closed) return null;
  const contractor = isCorporate && !isOwner && canWork;

  const run = async (action: () => Promise<ApiTask>) => {
    setBusy(true);
    setError(null);
    try {
      onTaskChange(await action());
      onReviewed();
      setAskChanges(false);
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível concluir a ação.");
    } finally {
      setBusy(false);
    }
  };

  if (task.status === "REVIEW" && isOwner) {
    return (
      <section className="glass space-y-3 rounded-2xl border-primary/40 p-4" aria-labelledby="review-title">
        <div>
          <h3 id="review-title" className="text-sm font-semibold">
            Aguardando a sua revisão
          </h3>
          <p className="text-sm text-muted-foreground">
            {task.assignee ? `${task.assignee.fullName} enviou` : "A tarefa foi enviada"} para revisão. Aprove para
            concluir ou peça um ajuste.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy}
            className="gradient-primary text-primary-foreground"
            onClick={() => void run(() => api.reviewTask(task.id, "APPROVE"))}
          >
            <CheckCircle2 className="mr-1 size-4" /> Aprovar
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => setAskChanges(true)}>
            <RotateCcw className="mr-1 size-4" /> Pedir ajuste
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Dialog open={askChanges} onOpenChange={setAskChanges}>
          <DialogContent className="border-border bg-card">
            <DialogHeader>
              <DialogTitle>Pedir ajuste</DialogTitle>
              <DialogDescription>
                A tarefa volta para Em Progresso e o responsável recebe o seu pedido.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="changesNote">O que precisa mudar?</Label>
              <Textarea
                id="changesNote"
                value={note}
                maxLength={4000}
                placeholder="Ex.: aumentar o contraste do rosto e trocar a cor da capa."
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAskChanges(false)}>
                Cancelar
              </Button>
              <Button
                disabled={busy || !note.trim()}
                onClick={() => void run(() => api.reviewTask(task.id, "REQUEST_CHANGES", note.trim()))}
              >
                Enviar pedido
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    );
  }

  if (task.status === "REVIEW" && contractor) {
    return (
      <section className="glass rounded-2xl p-4 text-sm">
        <p className="font-medium">Em revisão</p>
        <p className="text-muted-foreground">O dono do projeto vai aprovar ou pedir ajuste. Você recebe um aviso.</p>
      </section>
    );
  }

  if (contractor && (task.status === "TODO" || task.status === "IN_PROGRESS")) {
    return (
      <section className="glass space-y-2 rounded-2xl p-4">
        <p className="text-sm text-muted-foreground">Terminou? Envie para o dono revisar.</p>
        <Button
          disabled={busy}
          className="gradient-primary w-full text-primary-foreground"
          onClick={() => void run(() => api.updateTaskStatus(task.id, "REVIEW"))}
        >
          <Send className="mr-1 size-4" /> Enviar para revisão
        </Button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </section>
    );
  }

  if (task.status === "DONE" && isCorporate) {
    return (
      <section className="glass flex items-center gap-2 rounded-2xl p-4 text-sm">
        <CheckCircle2 className="size-4 text-emerald-400" /> Aprovada e concluída.
      </section>
    );
  }
  return null;
}

/** Conversa da tarefa: comentários (opcionalmente sobre uma versão) e o registro da revisão. */
export function CommentsSection({
  taskId,
  files,
  currentUserId,
  isOwner,
  closed,
  reloadKey,
}: {
  taskId: number;
  files: TaskFile[];
  currentUserId: number | string | undefined;
  isOwner: boolean;
  closed: boolean;
  reloadKey: number;
}) {
  const [comments, setComments] = useState<TaskComment[] | null>(null);
  const [body, setBody] = useState("");
  const [fileId, setFileId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = Date.now();

  const load = useCallback(async () => {
    try {
      setComments(await api.comments(taskId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar a conversa.");
    }
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.addComment(taskId, body.trim(), fileId ? Number(fileId) : null);
      setBody("");
      setFileId("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível comentar.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (comment: TaskComment) => {
    setError(null);
    try {
      await api.deleteComment(comment.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível apagar o comentário.");
    }
  };

  return (
    <section className="glass space-y-4 rounded-2xl p-5" aria-labelledby="comments-title">
      <h3 id="comments-title" className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquare className="size-4" /> Conversa
        {comments && comments.length > 0 && <span className="font-normal text-muted-foreground">· {comments.length}</span>}
      </h3>

      {comments && comments.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum comentário ainda. Use para dar feedback sobre uma versão ou combinar detalhes.
        </p>
      )}
      {comments && comments.length > 0 && (
        <ol className="space-y-3">
          {comments.map((comment) => {
            const review = comment.kind !== "COMMENT";
            const mine = String(comment.author.id) === String(currentUserId);
            return (
              <li
                key={comment.id}
                className={`flex gap-3 rounded-xl p-3 ${
                  comment.kind === "CHANGES_REQUESTED"
                    ? "border border-amber-500/40 bg-amber-500/10"
                    : comment.kind === "APPROVED"
                      ? "border border-emerald-500/40 bg-emerald-500/10"
                      : "bg-white/[0.03]"
                }`}
              >
                <UserAvatar name={comment.author.fullName} src={comment.author.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-medium">{comment.author.fullName}</span>
                    <span className="text-xs text-muted-foreground">{relativeTime(comment.createdAt, now)}</span>
                    {comment.kind === "CHANGES_REQUESTED" && (
                      <span className="text-xs font-medium text-amber-300">pediu ajuste</span>
                    )}
                    {comment.kind === "APPROVED" && (
                      <span className="text-xs font-medium text-emerald-300">aprovou</span>
                    )}
                    {comment.fileName && (
                      <span className="text-xs text-muted-foreground">
                        sobre {comment.fileName} v{comment.fileVersion}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm whitespace-pre-wrap break-words">{comment.body}</p>
                </div>
                {!review && !closed && (mine || isOwner) && (
                  <button
                    type="button"
                    onClick={() => void remove(comment)}
                    aria-label="Apagar comentário"
                    title="Apagar comentário"
                    className="self-start text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {!closed && (
        <form onSubmit={send} className="space-y-2">
          <Label htmlFor="newComment" className="sr-only">
            Novo comentário
          </Label>
          <Textarea
            id="newComment"
            value={body}
            maxLength={4000}
            placeholder="Escreva um comentário..."
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            {files.length > 0 && (
              <select
                aria-label="Sobre qual versão"
                value={fileId}
                onChange={(e) => setFileId(e.target.value)}
                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Sobre a tarefa toda</option>
                {files.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.originalName} v{file.version}
                  </option>
                ))}
              </select>
            )}
            <Button type="submit" size="sm" disabled={busy || !body.trim()}>
              <Send className="mr-1 size-4" /> Comentar
            </Button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
