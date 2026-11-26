import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUp, ImagePlus, RefreshCw } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { PostCard, UserAvatar } from "@/components/posts/PostCard";
import { PostComposer } from "@/components/posts/PostComposer";
import { Button } from "@/components/ui/button";
import { api, type Post } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

export const Route = createFileRoute("/_public/publicacoes")({
  head: () => ({ meta: [{ title: "Início — WorkAt" }] }),
  component: FeedPage,
});

/** De quanto em quanto tempo o feed procura publicações novas. */
const POLL_MS = 20_000;

/**
 * Feed ao vivo (estilo X): WIPs automáticos dos projetos públicos e posts avulsos, do mais novo para o
 * mais antigo. A cada 20 s procura novidades e mostra "N novas publicações" no topo, sem pular a leitura.
 */
function FeedPage() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [incoming, setIncoming] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const knownIds = useRef<Set<number>>(new Set());
  const topRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (mode: "replace" | "check") => {
    try {
      const latest = await api.feed();
      if (mode === "replace" || knownIds.current.size === 0) {
        knownIds.current = new Set(latest.map((post) => post.id));
        setPosts(latest);
        setIncoming([]);
        setHasMore(latest.length >= 20);
      } else {
        setIncoming(latest.filter((post) => !knownIds.current.has(post.id)));
      }
      setError(null);
    } catch (e) {
      if (mode === "replace")
        setError(e instanceof Error ? e.message : "Não foi possível carregar o feed.");
    }
  }, []);

  useEffect(() => {
    void load("replace");
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void load("check");
    }, POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [load]);

  const showIncoming = () => {
    setPosts((current) => {
      const merged = [...incoming, ...(current ?? [])];
      knownIds.current = new Set(merged.map((post) => post.id));
      return merged;
    });
    setIncoming([]);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const refresh = async () => {
    setRefreshing(true);
    await load("replace");
    setNow(Date.now());
    setRefreshing(false);
  };

  const loadMore = async () => {
    const last = posts?.[posts.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const older = await api.feed(last.id);
      older.forEach((post) => knownIds.current.add(post.id));
      setPosts((current) => [...(current ?? []), ...older]);
      setHasMore(older.length >= 20);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar mais.");
    } finally {
      setLoadingMore(false);
    }
  };

  const added = (post: Post) => {
    knownIds.current.add(post.id);
    setPosts((current) => [post, ...(current ?? [])]);
    setNow(Date.now());
  };
  const changed = (post: Post) =>
    setPosts((current) => (current ?? []).map((item) => (item.id === post.id ? post : item)));
  const deleted = (postId: number) =>
    setPosts((current) => (current ?? []).filter((item) => item.id !== postId));

  return (
    <AppLayout
      title="Início"
      flush
      actions={
        <button
          type="button"
          aria-label="Atualizar"
          title="Atualizar"
          disabled={refreshing}
          onClick={() => void refresh()}
          className="rounded-full p-2 hover:bg-white/10"
        >
          <RefreshCw className={`size-5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      }
    >
      <div ref={topRef} />
      {isAuthenticated && user ? (
        <div className="flex gap-3 border-b border-border px-4 pt-3 pb-2">
          <UserAvatar name={user.fullName ?? user.username} src={user.avatarUrl} size="md" />
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="w-full py-2 text-left text-xl text-muted-foreground"
            >
              O que você está criando?
            </button>
            <div className="flex items-center justify-between border-t border-border pt-2">
              <button
                type="button"
                aria-label="Adicionar imagem"
                onClick={() => setComposerOpen(true)}
                className="rounded-full p-2 text-primary hover:bg-primary/10"
              >
                <ImagePlus className="size-5" />
              </button>
              <Button
                onClick={() => setComposerOpen(true)}
                className="gradient-primary h-9 rounded-full px-5 font-bold text-primary-foreground"
              >
                Publicar
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <p className="text-[15px] text-muted-foreground">Entre para publicar suas artes e WIPs.</p>
          <Button asChild className="gradient-primary h-9 shrink-0 rounded-full px-5 font-bold text-primary-foreground">
            <Link to="/login">Entrar</Link>
          </Button>
        </div>
      )}

      {incoming.length > 0 && (
        <button
          type="button"
          onClick={showIncoming}
          className="flex w-full items-center justify-center gap-2 border-b border-border py-3 text-[15px] text-primary hover:bg-white/[0.03]"
        >
          <ArrowUp className="size-4" />
          {incoming.length === 1 ? "Mostrar 1 nova publicação" : `Mostrar ${incoming.length} novas publicações`}
        </button>
      )}

      {error && (
        <div role="alert" className="border-b border-border p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {posts === null && !error ? (
        <div aria-label="Carregando">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex gap-3 border-b border-border p-4">
              <div className="size-10 animate-pulse rounded-full bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 animate-pulse rounded bg-white/10" />
                <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      ) : posts && posts.length === 0 ? (
        <div className="mx-auto max-w-sm px-4 py-12 text-center">
          <p className="text-2xl font-extrabold">Nada por aqui ainda</p>
          <p className="mt-2 text-[15px] text-muted-foreground">
            Publique uma imagem ou ligue o WIP automático num projeto: cada imagem enviada nas tarefas aparece aqui.
          </p>
        </div>
      ) : (
        <>
          <ol className="divide-y divide-border border-b border-border" aria-label="Publicações">
            {(posts ?? []).map((post) => (
              <PostCard key={post.id} post={post} now={now} onChanged={changed} onDeleted={deleted} />
            ))}
          </ol>
          {hasMore && (posts?.length ?? 0) > 0 && (
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void loadMore()}
              className="w-full border-b border-border py-4 text-[15px] text-primary hover:bg-white/[0.03]"
            >
              {loadingMore ? "Carregando..." : "Mostrar mais"}
            </button>
          )}
        </>
      )}
      {isAuthenticated && <PostComposer open={composerOpen} onOpenChange={setComposerOpen} onCreated={added} />}
    </AppLayout>
  );
}
