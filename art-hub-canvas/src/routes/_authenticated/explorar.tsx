import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUp, Lock, RefreshCw } from "lucide-react";

import { ArtImage } from "@/components/art/ArtPieces";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { api, type PublicShowcaseArt } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/explorar")({
  head: () => ({ meta: [{ title: "Explorar — WorkAt" }] }),
  component: ExplorePage,
});

/** De quanto em quanto tempo o feed procura publicações novas. */
const POLL_MS = 20_000;

function relativeTime(value: string | null, now: number) {
  if (!value) return "";
  const seconds = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "agora";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d`;
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/**
 * Feed ao vivo (estilo X): as artes liberadas, da mais recente para a mais antiga.
 * A cada 20 s procura novidades e mostra "N novas publicações" no topo, sem pular a leitura.
 */
function ExplorePage() {
  const [arts, setArts] = useState<PublicShowcaseArt[] | null>(null);
  const [incoming, setIncoming] = useState<PublicShowcaseArt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const knownIds = useRef<Set<number>>(new Set());
  const topRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (mode: "replace" | "check") => {
    try {
      const latest = await api.publicShowcase();
      if (mode === "replace" || knownIds.current.size === 0) {
        knownIds.current = new Set(latest.map((art) => art.id));
        setArts(latest);
        setIncoming([]);
      } else {
        setIncoming(latest.filter((art) => !knownIds.current.has(art.id)));
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
    setArts((current) => {
      const merged = [...incoming, ...(current ?? [])];
      knownIds.current = new Set(merged.map((art) => art.id));
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

  // Artistas que mais publicaram, para a coluna lateral (como "Quem seguir" no X).
  const topArtists = useMemo(() => {
    const counts = new Map<string, { name: string; username: string; count: number }>();
    for (const art of arts ?? []) {
      const entry = counts.get(art.artistUsername) ?? {
        name: art.artistName,
        username: art.artistUsername,
        count: 0,
      };
      entry.count += 1;
      counts.set(art.artistUsername, entry);
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  }, [arts]);

  return (
    <AppLayout title="Explorar" subtitle="O que a comunidade acabou de publicar">
      <div ref={topRef} className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <div className="glass sticky top-[4.25rem] z-10 mb-4 flex items-center justify-between rounded-2xl px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Feed</h2>
              <p className="text-xs text-muted-foreground">
                Atualiza sozinho · artes liberadas, inclusive as que estavam sob NDA
              </p>
            </div>
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

          {arts === null && !error ? (
            <div className="space-y-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="glass h-72 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : arts && arts.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Nada publicado ainda. Quando alguém enviar a imagem final de uma tarefa para a
              vitrine, ela aparece aqui.
            </div>
          ) : (
            <ol
              className="glass divide-y divide-border overflow-hidden rounded-2xl"
              aria-label="Publicações"
            >
              {(arts ?? []).map((art) => (
                <FeedPost key={art.id} art={art} now={now} />
              ))}
            </ol>
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
                      <Avatar name={artist.name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{artist.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          @{artist.username}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {artist.count} {artist.count === 1 ? "arte" : "artes"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
              <Lock className="mt-0.5 size-3 shrink-0" />
              Artes de projetos sob NDA só entram no feed depois que o contratante libera.
            </p>
          </section>
        </aside>
      </div>
    </AppLayout>
  );
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden="true"
      className={`gradient-primary flex shrink-0 items-center justify-center rounded-full font-semibold text-primary-foreground ${
        size === "sm" ? "size-8 text-xs" : "size-10 text-sm"
      }`}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function FeedPost({ art, now }: { art: PublicShowcaseArt; now: number }) {
  const forSomeoneElse = art.companyUsername !== art.artistUsername;
  return (
    <li className="flex gap-3 p-4 transition-colors hover:bg-white/[0.03]">
      <Link
        to="/u/$username"
        params={{ username: art.artistUsername }}
        aria-label={`Perfil de ${art.artistName}`}
      >
        <Avatar name={art.artistName} />
      </Link>
      <article className="min-w-0 flex-1">
        <header className="flex flex-wrap items-baseline gap-x-1 text-sm">
          <Link
            to="/u/$username"
            params={{ username: art.artistUsername }}
            className="truncate font-semibold hover:underline"
          >
            {art.artistName}
          </Link>
          <span className="truncate text-muted-foreground">@{art.artistUsername}</span>
          <span className="text-muted-foreground" aria-hidden="true">
            ·
          </span>
          <time
            className="text-muted-foreground"
            dateTime={art.publishedAt ?? undefined}
            title={art.publishedAt ? new Date(art.publishedAt).toLocaleString("pt-BR") : undefined}
          >
            {relativeTime(art.publishedAt, now)}
          </time>
        </header>
        <p className="mt-0.5 text-sm text-muted-foreground">
          publicou <span className="font-medium text-foreground">{art.title}</span>
          {art.projectName && <> em {art.projectName}</>}
          {forSomeoneElse && (
            <>
              {" "}
              · para{" "}
              <Link
                to="/u/$username"
                params={{ username: art.companyUsername }}
                className="text-primary hover:underline"
              >
                {art.companyName}
              </Link>
            </>
          )}
        </p>
        {art.description && <p className="mt-2 text-sm whitespace-pre-wrap">{art.description}</p>}
        {art.imageUrl && (
          <div className="mt-3 overflow-hidden rounded-2xl border border-border">
            <ArtImage
              src={art.imageUrl}
              title={art.title}
              className="max-h-[520px] w-full object-cover"
            />
          </div>
        )}
      </article>
    </li>
  );
}
