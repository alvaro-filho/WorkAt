import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { RefreshCw, Send } from "lucide-react";

import { relativeTime } from "@/components/posts/PostCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, type CallConversation as Conversation } from "@/lib/api";

const MAX = 1000;

/**
 * Conversa da Chamada entre o estúdio e um candidato. Sem tempo real: carrega ao abrir, ao enviar e no
 * botão de atualizar; cada mensagem nova chega ao outro lado como notificação.
 */
export function CallConversation({
  callId,
  interestId,
  otherName,
  studioView,
  onCountChange,
}: {
  callId: number;
  interestId: number;
  /** Nome de quem está do outro lado (aparece no vazio e no campo). */
  otherName: string;
  /** Quem vê é o estúdio (muda o texto do vazio). */
  studioView: boolean;
  onCountChange?: (count: number) => void;
}) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const loaded = await api.callConversation(callId, interestId);
      setConversation(loaded);
      onCountChange?.(loaded.messages.length);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar a conversa.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega uma vez por candidatura
  }, [callId, interestId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [conversation?.messages.length]);

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.sendCallMessage(callId, interestId, text);
      setConversation(updated);
      onCountChange?.(updated.messages.length);
      setBody("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setBusy(false);
    }
  };

  // Enter envia; Shift+Enter quebra a linha.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  const now = Date.now();

  return (
    <div className="space-y-3 rounded-xl border border-border bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Conversa com {otherName}</p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Atualizar conversa"
          title="Atualizar"
          className="rounded-full p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {conversation === null && !error && (
        <div className="h-16 animate-pulse rounded-lg bg-white/5" />
      )}

      {conversation && conversation.messages.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {studioView
            ? `Tire dúvidas antes de decidir. Só você e ${otherName} veem esta conversa.`
            : "O estúdio ainda não começou a conversa. Quando escrever, você é avisado e pode responder aqui."}
        </p>
      )}

      {conversation && conversation.messages.length > 0 && (
        <ol className="max-h-80 space-y-2 overflow-y-auto pr-1" aria-label="Mensagens">
          {conversation.messages.map((message) => (
            <li
              key={message.id}
              className={`flex ${message.mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  message.mine ? "bg-primary/20 text-foreground" : "bg-white/[0.06]"
                }`}
              >
                <p className="whitespace-pre-line break-words">{message.body}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {message.mine ? "Você" : message.author.fullName} ·{" "}
                  {relativeTime(message.createdAt, now)}
                </p>
              </div>
            </li>
          ))}
          <div ref={bottom} />
        </ol>
      )}

      {conversation &&
        !conversation.canSend &&
        conversation.blockedReason &&
        conversation.messages.length > 0 && (
          <p className="text-xs text-muted-foreground">{conversation.blockedReason}</p>
        )}

      {conversation?.canSend && (
        <form onSubmit={send} className="space-y-1.5">
          <label htmlFor={`msg-${interestId}`} className="sr-only">
            Mensagem para {otherName}
          </label>
          <div className="flex items-end gap-2">
            <Textarea
              id={`msg-${interestId}`}
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX))}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder={`Escreva para ${otherName}`}
              className="min-h-0 resize-none"
            />
            <Button
              type="submit"
              size="icon"
              disabled={busy || !body.trim()}
              aria-label="Enviar mensagem"
              className="shrink-0 gradient-primary text-primary-foreground"
            >
              <Send className="size-4" />
            </Button>
          </div>
          {body.length > MAX - 100 && (
            <p className="text-right text-xs text-muted-foreground">
              {body.length}/{MAX}
            </p>
          )}
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
