import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Layers, Search, X } from "lucide-react";

import { ArtImage } from "@/components/art/ArtPieces";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserAvatar } from "@/components/posts/PostCard";
import { api, type Post } from "@/lib/api";

export const Route = createFileRoute("/_public/explorar")({
  head: () => ({ meta: [{ title: "Explorar — WorkAt" }] }),
  // ?q= vem da busca da coluna lateral.
  validateSearch: (search: Record<string, unknown>): { q?: string } =>
    typeof search["q"] === "string" && search["q"] ? { q: search["q"] } : {},
  component: ExplorePage,
});

const PAGE = 40;

type Tab = "todas" | "finais" | "wip" | "projetos";
const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "todas", label: "Descobrir", hint: "Tudo o que a comunidade publicou" },
  { id: "finais", label: "Finais", hint: "Artes prontas: imagens finais e posts avulsos" },
  { id: "wip", label: "Em andamento", hint: "WIPs de projetos abertos ao público" },
  { id: "projetos", label: "Projetos abertos", hint: "Projetos que acabaram de ficar públicos" },
];

function matchesTab(post: Post, tab: Tab) {
  if (tab === "finais") return post.label === "FINAL" || post.kind === "STANDALONE";
  if (tab === "wip") return post.label === "WIP";
  if (tab === "projetos") return post.kind === "PROJECT_PUBLISHED";
  return true;
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function matchesSearch(post: Post, query: string) {
  if (!query) return true;
  const haystack = normalize(
    [post.title, post.subtitle, post.author.fullName, post.author.username, post.project?.name]
      .filter(Boolean)
      .join(" "),
  );
  return normalize(query)
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

/**
 * Explorar: grade de artes de ponta a ponta (estilo galeria de portfólio), com destaques maiores,
 * abas por tipo, busca e carregamento contínuo. Só mostra o que é público (NDA e privados ficam fora).
 */
function ExplorePage() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("todas");
  const { q } = Route.useSearch();
  const [query, setQuery] = useState(q ?? "");
  useEffect(() => setQuery(q ?? ""), [q]);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .feed(undefined, PAGE)
      .then((page) => {
        setPosts(page);
        setHasMore(page.length >= PAGE);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Não foi possível carregar."));
  }, []);

  const loadMore = useCallback(async () => {
    if (!posts || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.feed(posts[posts.length - 1]?.id, PAGE);
      setPosts((current) => [...(current ?? []), ...page.filter((p) => !current?.some((c) => c.id === p.id))]);
      setHasMore(page.length >= PAGE);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [posts, hasMore, loadingMore]);

  // Carrega a próxima página quando o fim da grade aparece na tela.
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "600px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  const visible = useMemo(
    () =>
      (posts ?? []).filter((post) => post.images.length > 0 && matchesTab(post, tab) && matchesSearch(post, query)),
    [posts, tab, query],
  );

  return (
    <AppLayout title="Explorar" subtitle="Artes da comunidade" wide>
      <div className="sticky top-[53px] z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="px-4 pt-3">
          <label className="relative block md:max-w-md">
            <span className="sr-only">Buscar artes, artistas ou projetos</span>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar artes, artistas ou projetos"
              className="h-11 w-full rounded-full border border-border bg-white/5 pr-10 pl-11 text-sm outline-none focus:border-primary focus:bg-transparent"
            />
            {query && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => setQuery("")}
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </label>
        </div>
        <div role="tablist" aria-label="Tipo de publicação" className="mt-1 flex overflow-x-auto">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              title={item.hint}
              onClick={() => setTab(item.id)}
              className={`relative shrink-0 px-5 py-3.5 text-sm transition-colors hover:bg-white/5 ${
                tab === item.id ? "font-bold text-foreground" : "text-muted-foreground"
              }`}
            >
              {item.label}
              {tab === item.id && (
                <span className="absolute inset-x-4 bottom-0 h-1 rounded-full bg-primary" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div role="alert" className="m-4 rounded-2xl border border-border p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {posts === null && !error && (
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-label="Carregando">
          {Array.from({ length: 15 }, (_, i) => (
            <div key={i} className="aspect-square animate-pulse bg-white/5" />
          ))}
        </div>
      )}

      {posts && visible.length === 0 && (
        <div className="mx-auto max-w-md p-10 text-center">
          <p className="font-semibold">{query ? "Nada encontrado." : "Ainda não há artes aqui."}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {query
              ? "Tente outras palavras ou outra aba."
              : "Quando alguém publicar uma arte ou abrir um projeto ao público, ela aparece aqui."}
          </p>
        </div>
      )}

      {visible.length > 0 && (
        <ul className="grid grid-flow-row-dense grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((post, index) => (
            <ArtTile key={post.id} post={post} featured={index % 9 === 0} />
          ))}
        </ul>
      )}

      <div ref={sentinel} className="h-10" aria-hidden="true" />
      {loadingMore && <p className="pb-6 text-center text-sm text-muted-foreground">Carregando mais...</p>}
    </AppLayout>
  );
}

/** Um quadro da grade. Os destaques ocupam 2×2 (a partir do tablet). Passando o mouse, título e artista. */
function ArtTile({ post, featured }: { post: Post; featured: boolean }) {
  const cover = post.images[0];
  const title = post.title ?? post.project?.name ?? "Sem título";
  return (
    <li className={`group relative overflow-hidden bg-white/5 ${featured ? "sm:col-span-2 sm:row-span-2" : ""}`}>
      <Link
        to="/publicacao/$postId"
        params={{ postId: String(post.id) }}
        className="block aspect-square focus-visible:outline-2 focus-visible:outline-primary"
        aria-label={`${title}, de ${post.author.fullName}`}
      >
        <ArtImage
          src={cover?.url ?? null}
          title={title}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 p-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <UserAvatar name={post.author.fullName} src={post.author.avatarUrl} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">{title}</span>
            <span className="block truncate text-xs text-white/80">{post.author.fullName}</span>
          </span>
        </span>
        <span className="pointer-events-none absolute top-2 right-2 flex gap-1">
          {post.label && (
            <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
              {post.label === "FINAL" ? "Final" : "WIP"}
            </span>
          )}
          {post.images.length > 1 && (
            <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
              <Layers className="size-3" /> {post.images.length}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}
