import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUp, Lock, Plus, RefreshCw } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { PostCard, UserAvatar } from "@/components/posts/PostCard";
import { PostComposer } from "@/components/posts/PostComposer";
import { Button } from "@/components/ui/button";
import { api, type Post } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/publicacoes")({
  head: () => ({ meta: [{ title: "Publicações — WorkAt" }] }),
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

  // Quem mais publicou no que está carregado, para a coluna lateral (como "Quem seguir" no X).
  const topArtists = useMemo(() => {
    const counts = new Map<string, { name: string; username: string; count: number }>();
    for (const post of posts ?? []) {
      const entry = counts.get(post.author.username) ?? {
        name: post.author.fullName,
        username: post.author.username,
        count: 0,
      };
      entry.count += 1;
      counts.set(post.author.username, entry);
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  }, [posts]);

  return (
    <AppLayout title="Publicações" subtitle="WIPs e posts da comunidade, ao vivo">
      <div ref={topRef} className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <div className="glass sticky top-[4.25rem] z-10 mb-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">Feed</h2>
              <p className="truncate text-xs text-muted-foreground">
                Atualiza sozinho · WIPs de projetos públicos e posts avulsos
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Atualizar feed"
                title="Atualizar"
                disabled={refreshing}
                onClick={() => void refresh()}
              >
                <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
              <Button
                size="sm"
                className="gradient-primary text-primary-foreground"
                onClick={() => setComposerOpen(true)}
              >
                <Plus className="mr-1 size-4" /> Publicar
              </Button>
            </div>
          </div>

          {incoming.length > 0 && (
            <div className="sticky top-[8.5rem] z-10 mb-3 flex justify-center">
              <button
                type="button"
                onClick={showIncoming}
                className="gradient-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-primary-foreground shadow-[var(--shadow-glow)]"
              >
                <ArrowUp className="size-4" />
                {incoming.length === 1
                  ? "1 nova publicação"
                  : `${incoming.length} novas publicações`}
              </button>
            </div>
          )}

          {error && (
            <div role="alert" className="glass mb-4 rounded-2xl p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {posts === null && !error ? (
            <div className="space-y-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="glass h-72 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : posts && posts.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Nada publicado ainda. Publique uma imagem pelo botão acima ou ligue o WIP automático
              num projeto: cada imagem enviada nas tarefas aparece aqui.
            </div>
          ) : (
            <>
              <ol
                className="glass divide-y divide-border overflow-hidden rounded-2xl"
                aria-label="Publicações"
              >
                {(posts ?? []).map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    now={now}
                    onChanged={changed}
                    onDeleted={deleted}
                  />
                ))}
              </ol>
              {hasMore && (posts?.length ?? 0) > 0 && (
                <div className="mt-4 flex justify-center">
                  <Button variant="outline" disabled={loadingMore} onClick={() => void loadMore()}>
                    {loadingMore ? "Carregando..." : "Carregar mais"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <aside className="hidden space-y-4 lg:block">
          <section className="glass sticky top-[4.25rem] rounded-2xl p-4">
            <h2 className="mb-3 text-sm font-semibold">Artistas em destaque</h2>
            {topArtists.length === 0 ? (
              <p className="text-xs text-muted-foreground">Ainda sem publicações.</p>
            ) : (
              <ul className="space-y-3">
                {topArtists.map((artist) => (
                  <li key={artist.username}>
                    <Link
                      to="/u/$username"
                      params={{ username: artist.username }}
                      className="flex items-center gap-3 rounded-xl p-1 hover:bg-white/5"
                    >
                      <UserAvatar name={artist.name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{artist.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          @{artist.username}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {artist.count} {artist.count === 1 ? "post" : "posts"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
              <Lock className="mt-0.5 size-3 shrink-0" />
              Projetos privados e projetos sob NDA não aparecem aqui. Projeto com NDA só entra
              depois da data de liberação.
            </p>
          </section>
        </aside>
      </div>
      <PostComposer open={composerOpen} onOpenChange={setComposerOpen} onCreated={added} />
    </AppLayout>
  );
}
