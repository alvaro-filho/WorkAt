import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Layers, Search, X } from "lucide-react";

import { ArtImage } from "@/components/art/ArtPieces";
import { ArtistsBoard } from "@/components/artists/ArtistsBoard";
import { CallsBoard } from "@/components/calls/CallsBoard";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserAvatar } from "@/components/posts/PostCard";
import { api, type Post, type PublicProjectCard } from "@/lib/api";

export const Route = createFileRoute("/_public/explorar")({
  head: () => ({ meta: [{ title: "Explorar — WorkAt" }] }),
  // ?q= vem da busca da coluna lateral.
  validateSearch: (
    search: Record<string, unknown>,
  ): { q?: string; aba?: "chamadas" | "artistas" } => ({
    ...(typeof search["q"] === "string" && search["q"] ? { q: search["q"] } : {}),
    ...(search["aba"] === "chamadas" || search["aba"] === "artistas" ? { aba: search["aba"] } : {}),
  }),
  component: ExplorePage,
});

const PAGE = 40;

type Tab = "descobrir" | "recentes" | "projetos" | "chamadas" | "artistas";
const TABS: { id: Tab; label: string; hint: string }[] = [
  {
    id: "descobrir",
    label: "Descobrir",
    hint: "O que a comunidade está curtindo e republicando agora",
  },
  { id: "recentes", label: "Recentes", hint: "Tudo, do mais novo para o mais antigo" },
  { id: "projetos", label: "Projetos", hint: "Projetos abertos ao público, com todas as etapas" },
  { id: "chamadas", label: "Chamadas", hint: "Vagas e jobs abertos por estúdios" },
  {
    id: "artistas",
    label: "Artistas",
    hint: "Artistas por função, com quem está disponível primeiro",
  },
];

/** Em alta: curtidas e republicações pesam, mas perdem força com o tempo (para o feed não congelar). */
function discoverScore(post: Post, now: number) {
  const hours = Math.max(0, (now - new Date(post.createdAt).getTime()) / 3_600_000);
  return (1 + post.likeCount + 2 * post.repostCount) / Math.pow(hours + 2, 0.8);
}

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

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
 * Explorar: grade de artes de ponta a ponta (estilo galeria de portfólio), todas do mesmo tamanho,
 * abas por tipo, busca e carregamento contínuo. Só mostra o que é público (NDA e privados ficam fora).
 */
function ExplorePage() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { q, aba } = Route.useSearch();
  const [tab, setTab] = useState<Tab>(aba ?? "descobrir");
  const [projects, setProjects] = useState<PublicProjectCard[] | null>(null);
  const [query, setQuery] = useState(q ?? "");
  useEffect(() => setQuery(q ?? ""), [q]);
  useEffect(() => {
    if (aba) setTab(aba);
  }, [aba]);
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
      setPosts((current) => [
        ...(current ?? []),
        ...page.filter((p) => !current?.some((c) => c.id === p.id)),
      ]);
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
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  // A aba Projetos carrega na primeira vez que é aberta.
  useEffect(() => {
    if (tab !== "projetos" || projects !== null) return;
    api
      .exploreProjects()
      .then(setProjects)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Não foi possível carregar os projetos."),
      );
  }, [tab, projects]);

  const visible = useMemo(() => {
    const withImages = (posts ?? []).filter(
      (post) => post.images.length > 0 && matchesSearch(post, query),
    );
    if (tab !== "descobrir") return withImages;
    const now = Date.now();
    return [...withImages].sort(
      (a, b) => discoverScore(b, now) - discoverScore(a, now) || b.id - a.id,
    );
  }, [posts, tab, query]);

  const visibleProjects = useMemo(() => {
    if (!query) return projects ?? [];
    const words = normalize(query).split(/\s+/);
    return (projects ?? []).filter((project) => {
      const haystack = normalize(
        [project.name, project.description, project.director?.fullName].filter(Boolean).join(" "),
      );
      return words.every((word) => haystack.includes(word));
    });
  }, [projects, query]);
  const showingProjects = tab === "projetos";
  const showingCalls = tab === "chamadas";
  const showingArtists = tab === "artistas";
  const showingArt = !showingProjects && !showingCalls && !showingArtists;

  return (
    <AppLayout title="Explorar" subtitle="Artes da comunidade" wide>
      <div className="sticky top-[53px] z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto w-full max-w-xl px-4 pt-3">
          <label className="relative block">
            <span className="sr-only">Buscar artes, artistas ou projetos</span>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                showingCalls
                  ? "Buscar Chamadas ou estúdios"
                  : showingArtists
                    ? "Buscar artistas, especialidades ou cidade"
                    : "Buscar artes, artistas ou projetos"
              }
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
        <div
          role="tablist"
          aria-label="O que explorar"
          className="mx-auto mt-1 flex w-full max-w-xl"
        >
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              title={item.hint}
              onClick={() => setTab(item.id)}
              className={`relative flex-1 px-1 py-3.5 text-center text-[13px] transition-colors sm:text-sm hover:bg-white/5 ${
                tab === item.id ? "font-bold text-foreground" : "text-muted-foreground"
              }`}
            >
              {item.label}
              {tab === item.id && (
                <span
                  className="absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-primary"
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {showingCalls && <CallsBoard query={query} />}
      {showingArtists && <ArtistsBoard query={query} />}

      {error && !showingCalls && !showingArtists && (
        <div
          role="alert"
          className="m-4 rounded-2xl border border-border p-4 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {showingArt && posts === null && !error && (
        <div
          className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          aria-label="Carregando"
        >
          {Array.from({ length: 15 }, (_, i) => (
            <div key={i} className="aspect-square animate-pulse bg-white/5" />
          ))}
        </div>
      )}

      {showingProjects && projects === null && !error && (
        <div
          className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          aria-label="Carregando projetos"
        >
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="aspect-square animate-pulse bg-white/5" />
          ))}
        </div>
      )}

      {showingProjects && projects !== null && visibleProjects.length === 0 && (
        <div className="mx-auto max-w-md p-10 text-center">
          <p className="font-semibold">
            {query ? "Nenhum projeto encontrado." : "Ainda não há projetos abertos."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {query
              ? "Tente outras palavras."
              : "Quando alguém abrir um projeto ao público, ele aparece aqui."}
          </p>
        </div>
      )}

      {showingProjects && visibleProjects.length > 0 && (
        <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleProjects.map((project) => (
            <ProjectTile key={project.id} project={project} />
          ))}
        </ul>
      )}

      {showingArt && posts && visible.length === 0 && (
        <div className="mx-auto max-w-md p-10 text-center">
          <p className="font-semibold">{query ? "Nada encontrado." : "Ainda não há artes aqui."}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {query
              ? "Tente outras palavras ou a aba Projetos."
              : "Quando alguém publicar uma arte, ela aparece aqui."}
          </p>
        </div>
      )}

      {showingArt && visible.length > 0 && (
        <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((post) => (
            <ArtTile key={post.id} post={post} />
          ))}
        </ul>
      )}

      {showingArt && <div ref={sentinel} className="h-10" aria-hidden="true" />}
      {showingArt && loadingMore && (
        <p className="pb-6 text-center text-sm text-muted-foreground">Carregando mais...</p>
      )}
    </AppLayout>
  );
}

/** Um quadro da grade, todos do mesmo tamanho. Passando o mouse, título e artista. */
function ArtTile({ post }: { post: Post }) {
  const cover = post.images[0];
  const title = post.title ?? post.project?.name ?? "Sem título";
  return (
    <li className="group relative overflow-hidden bg-white/5">
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

/** Projeto na grade: mesmo quadro das artes, com a capa; abre como uma publicação com várias imagens. */
function ProjectTile({ project }: { project: PublicProjectCard }) {
  return (
    <li className="group relative overflow-hidden bg-white/5">
      <Link
        to="/projetos/$projectId/publico"
        params={{ projectId: String(project.id) }}
        className="block aspect-square focus-visible:outline-2 focus-visible:outline-primary"
        aria-label={`Projeto ${project.name}${project.director ? `, dirigido por ${project.director.fullName}` : ""}`}
      >
        <ArtImage
          src={project.coverUrl}
          title={project.name}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 p-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {project.director && (
            <UserAvatar
              name={project.director.fullName}
              src={project.director.avatarUrl}
              size="sm"
            />
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">{project.name}</span>
            {project.director && (
              <span className="block truncate text-xs text-white/80">
                {project.director.fullName}
              </span>
            )}
          </span>
        </span>
        <span className="pointer-events-none absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
          <Layers className="size-3" /> {project.imageCount}
        </span>
      </Link>
    </li>
  );
}
