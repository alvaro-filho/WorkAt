import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bookmark, Heart, Repeat2 } from "lucide-react";

import { api, type Post, type ReactionType } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

function compact(value: number) {
  if (value < 1000) return String(value);
  if (value < 1_000_000)
    return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0).replace(".0", "")} mil`;
  return `${(value / 1_000_000).toFixed(1).replace(".0", "")} mi`;
}

/**
 * Curtir, republicar e salvar. Muda na hora (otimista) e confirma com o servidor; se falhar, volta.
 * Sem login, leva para a tela de entrar.
 */
export function PostActions({
  post,
  onChange,
  size = "sm",
}: {
  post: Post;
  onChange?: ((post: Post) => void) | undefined;
  size?: "sm" | "lg";
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState(post);
  const stateRef = useRef(post);
  stateRef.current = state;
  // Cada botão é independente: curtir e republicar podem estar salvando ao mesmo tempo.
  const [pending, setPending] = useState<ReactionType[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setState(post), [post]);

  /** Copia só os campos de uma reação (para a resposta de uma não desfazer a outra que ainda está salvando). */
  const merge = (base: Post, source: Post, type: ReactionType): Post =>
    type === "like"
      ? { ...base, liked: source.liked, likeCount: source.likeCount }
      : type === "repost"
        ? { ...base, reposted: source.reposted, repostCount: source.repostCount }
        : { ...base, saved: source.saved };

  const toggle = async (type: ReactionType) => {
    if (!user) {
      void navigate({ to: "/login" });
      return;
    }
    if (pending.includes(type)) return;
    const current = stateRef.current;
    const before = current;
    const on =
      type === "like" ? !current.liked : type === "repost" ? !current.reposted : !current.saved;
    const optimistic: Post = {
      ...current,
      liked: type === "like" ? on : current.liked,
      reposted: type === "repost" ? on : current.reposted,
      saved: type === "save" ? on : current.saved,
      likeCount: current.likeCount + (type === "like" ? (on ? 1 : -1) : 0),
      repostCount: current.repostCount + (type === "repost" ? (on ? 1 : -1) : 0),
    };
    stateRef.current = optimistic;
    setState(optimistic);
    setPending((list) => [...list, type]);
    setError(null);
    try {
      const updated = await api.react(post.id, type, on);
      const next = merge(stateRef.current, updated, type);
      stateRef.current = next;
      setState(next);
      onChange?.(next);
    } catch (e) {
      const next = merge(stateRef.current, before, type);
      stateRef.current = next;
      setState(next);
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setPending((list) => list.filter((item) => item !== type));
    }
  };

  const icon = size === "lg" ? "size-5" : "size-[18px]";
  // No card: curtir e republicar alinhados à esquerda com o texto, salvar encostado à direita (como no X).
  const lg = size === "lg";
  const button = `group inline-flex items-center gap-1 rounded-full text-[13px] tabular-nums transition-colors disabled:opacity-60 ${
    lg ? "px-3 py-2" : "py-0.5"
  }`;
  const counter = lg ? "" : "min-w-[3.25rem]";

  return (
    <div className={size === "lg" ? "space-y-1" : ""}>
      <div className={`flex items-center ${lg ? "gap-2" : "-mx-2"}`}>
        <button
          type="button"
          onClick={() => void toggle("like")}
          disabled={pending.includes("like")}
          aria-pressed={state.liked}
          aria-label={state.liked ? "Descurtir" : "Curtir"}
          title={state.liked ? "Descurtir" : "Curtir"}
          className={`${button} ${counter} ${state.liked ? "text-rose-400" : "text-muted-foreground hover:text-rose-400"}`}
        >
          <span className="rounded-full p-2 group-hover:bg-rose-400/10">
            <Heart className={icon} fill={state.liked ? "currentColor" : "none"} />
          </span>
          <span>{state.likeCount > 0 ? compact(state.likeCount) : lg ? "Curtir" : ""}</span>
        </button>
        <button
          type="button"
          onClick={() => void toggle("repost")}
          disabled={pending.includes("repost")}
          aria-pressed={state.reposted}
          aria-label={state.reposted ? "Desfazer republicação" : "Republicar"}
          title={state.reposted ? "Desfazer republicação" : "Republicar no seu perfil"}
          className={`${button} ${counter} ${state.reposted ? "text-emerald-400" : "text-muted-foreground hover:text-emerald-400"}`}
        >
          <span className="rounded-full p-2 group-hover:bg-emerald-400/10">
            <Repeat2 className={icon} />
          </span>
          <span>{state.repostCount > 0 ? compact(state.repostCount) : lg ? "Republicar" : ""}</span>
        </button>
        <button
          type="button"
          onClick={() => void toggle("save")}
          disabled={pending.includes("save")}
          aria-pressed={state.saved}
          aria-label={state.saved ? "Remover dos salvos" : "Salvar"}
          title={state.saved ? "Remover dos salvos" : "Salvar (só você vê)"}
          className={`${button} ${lg ? "" : "ml-auto"} ${state.saved ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
        >
          <span className="rounded-full p-2 group-hover:bg-primary/10">
            <Bookmark className={icon} fill={state.saved ? "currentColor" : "none"} />
          </span>
          {lg && <span>{state.saved ? "Salvo" : "Salvar"}</span>}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
