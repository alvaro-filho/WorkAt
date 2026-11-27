import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";

import { ArtistCard } from "@/components/artists/ArtistCard";
import { api, type ArtistCard as Artist, type CallRole } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { CALL_ROLES } from "@/lib/call-labels";

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const chipClass = (active: boolean) =>
  `shrink-0 rounded-full border px-3 py-1 text-xs transition-colors ${
    active
      ? "border-primary bg-primary/15 text-primary"
      : "border-border text-muted-foreground hover:text-foreground"
  }`;

/**
 * Explorar › Artistas: quem tem trabalho público, com filtro por função (pelas especialidades do perfil) e
 * "Só disponíveis". Disponíveis aparecem primeiro.
 */
export function ArtistsBoard({ query }: { query: string }) {
  const { user } = useAuth();
  const [artists, setArtists] = useState<Artist[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<CallRole | null>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(user?.role === "COMPANY");

  useEffect(() => {
    let active = true;
    setArtists(null);
    setError(null);
    api
      .exploreArtists({ ...(role && { role }), available: onlyAvailable })
      .then((list) => active && setArtists(list))
      .catch(
        (e: unknown) =>
          active &&
          setError(e instanceof Error ? e.message : "Não foi possível carregar os artistas."),
      );
    return () => {
      active = false;
    };
  }, [role, onlyAvailable]);

  const visible = useMemo(() => {
    if (!artists) return [];
    const words = normalize(query.trim()).split(/\s+/).filter(Boolean);
    if (words.length === 0) return artists;
    return artists.filter((artist) => {
      const haystack = normalize(
        [
          artist.user.fullName,
          artist.user.username,
          ...artist.specialties,
          artist.availability?.city,
        ]
          .filter(Boolean)
          .join(" "),
      );
      return words.every((word) => haystack.includes(word));
    });
  }, [artists, query]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="space-y-2 border-b border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Artistas com trabalho público. A função vem das especialidades de cada perfil.
          </p>
          <button
            type="button"
            aria-pressed={onlyAvailable}
            onClick={() => setOnlyAvailable(!onlyAvailable)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
              onlyAvailable
                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${onlyAvailable ? "bg-emerald-400" : "bg-muted-foreground"}`}
              aria-hidden="true"
            />
            Só disponíveis
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Filtrar por função">
          {CALL_ROLES.filter((item) => item.value !== "OUTRO").map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={role === item.value}
              onClick={() => setRole(role === item.value ? null : item.value)}
              className={chipClass(role === item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="m-4 rounded-2xl border border-border p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {artists === null && !error && (
        <ul
          className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Carregando artistas"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="h-64 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </ul>
      )}

      {artists !== null && visible.length === 0 && (
        <div className="mx-auto max-w-md p-10 text-center">
          <Users className="mx-auto mb-2 size-8 text-muted-foreground" />
          <p className="font-semibold">Nenhum artista com esses filtros.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {onlyAvailable
              ? 'Tire o "Só disponíveis" para ver todo mundo que tem trabalho público.'
              : "Tente outra função ou outras palavras."}
          </p>
        </div>
      )}

      {visible.length > 0 && (
        <ul className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((artist) => (
            <ArtistCard key={artist.user.id} artist={artist} />
          ))}
        </ul>
      )}
    </div>
  );
}
