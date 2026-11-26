import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { ArtImage } from "@/components/art/ArtPieces";
import { UserAvatar } from "@/components/posts/PostCard";
import { api, type Post, type UserSummary } from "@/lib/api";

/** Publicações públicas recentes, guardadas por 1 min (a coluna lateral aparece em quase todas as telas). */
let cache: { at: number; posts: Post[] } | null = null;
async function recentPosts(): Promise<Post[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.posts;
  const posts = await api.feed(undefined, 50);
  cache = { at: Date.now(), posts };
  return posts;
}

/** Cartão da coluna lateral: título grande, itens e "Mostrar mais". */
export function AsideCard({
  title,
  children,
  more,
}: {
  title: string;
  children: ReactNode;
  more?: { label: string; to: string };
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border">
      <h2 className="px-4 pt-3 pb-1 text-xl font-extrabold">{title}</h2>
      <div>{children}</div>
      {more && (
        <Link to={more.to} className="block px-4 py-4 text-[15px] text-primary hover:bg-white/[0.03]">
          {more.label}
        </Link>
      )}
    </section>
  );
}

/** Busca da coluna lateral: leva ao Explorar com o texto já preenchido. */
export function AsideSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        void navigate({ to: "/explorar", search: query.trim() ? { q: query.trim() } : {} });
      }}
      className="relative"
    >
      <label htmlFor="aside-search" className="sr-only">
        Buscar no WorkAt
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground" />
      <input
        id="aside-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar artes e artistas"
        className="h-11 w-full rounded-full border border-border bg-white/[0.04] pr-4 pl-11 text-[15px] outline-none focus:border-primary focus:bg-transparent"
      />
    </form>
  );
}

/** Coluna lateral padrão: busca, artistas em destaque e projetos abertos ao público. */
export function DefaultAside({ extra }: { extra?: ReactNode }) {
  const [posts, setPosts] = useState<Post[] | null>(null);

  useEffect(() => {
    recentPosts()
      .then(setPosts)
      .catch(() => setPosts([]));
  }, []);

  const artists = topArtists(posts ?? []);
  const projects = openProjects(posts ?? []);

  return (
    <>
      <AsideSearch />
      {extra}
      {artists.length > 0 && (
        <AsideCard title="Artistas em destaque" more={{ label: "Mostrar mais", to: "/explorar" }}>
          <ul>
            {artists.map(({ user, count }) => (
              <li key={user.username}>
                <Link
                  to="/u/$username"
                  params={{ username: user.username }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03]"
                >
                  <UserAvatar name={user.fullName} src={user.avatarUrl} size="md" />
                  <span className="min-w-0 flex-1 leading-5">
                    <span className="block truncate text-[15px] font-bold">{user.fullName}</span>
                    <span className="block truncate text-[15px] text-muted-foreground">@{user.username}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-foreground px-4 py-1.5 text-sm font-bold text-background">
                    Ver perfil
                  </span>
                </Link>
                <span className="sr-only">{count} publicações recentes</span>
              </li>
            ))}
          </ul>
        </AsideCard>
      )}
      {projects.length > 0 && (
        <AsideCard title="Projetos abertos">
          <ul>
            {projects.map((post) => (
              <li key={post.project!.id}>
                <Link
                  to="/projetos/$projectId/publico"
                  params={{ projectId: String(post.project!.id) }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03]"
                >
                  <ArtImage
                    src={post.images[0]?.url ?? null}
                    title={post.project!.name}
                    className="size-12 shrink-0 rounded-lg object-cover"
                  />
                  <span className="min-w-0 leading-5">
                    <span className="block text-[13px] text-muted-foreground">por {post.author.fullName}</span>
                    <span className="block truncate text-[15px] font-bold">{post.project!.name}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </AsideCard>
      )}
      <p className="px-4 text-[13px] leading-5 text-muted-foreground">
        WorkAt · portfólio e produção artística · {new Date().getFullYear()}
      </p>
    </>
  );
}

function topArtists(posts: Post[]): { user: UserSummary; count: number }[] {
  const counts = new Map<string, { user: UserSummary; count: number }>();
  for (const post of posts) {
    const entry = counts.get(post.author.username) ?? { user: post.author, count: 0 };
    entry.count += 1;
    counts.set(post.author.username, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 3);
}

function openProjects(posts: Post[]): Post[] {
  const seen = new Set<number>();
  return posts
    .filter((post) => post.project && post.kind !== "STANDALONE")
    .filter((post) => {
      if (seen.has(post.project!.id)) return false;
      seen.add(post.project!.id);
      return true;
    })
    .slice(0, 3);
}
