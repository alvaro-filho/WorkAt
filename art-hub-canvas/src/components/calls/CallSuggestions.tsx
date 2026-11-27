import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";

import { ArtistCard } from "@/components/artists/ArtistCard";
import { Button } from "@/components/ui/button";
import { api, type ArtistCard as Artist, type JobCall } from "@/lib/api";
import { roleLabel } from "@/lib/call-labels";

/**
 * Na própria Chamada (só o estúdio, com ela aberta): artistas disponíveis com a mesma função que ainda não
 * mostraram interesse. "Chamar para ver" manda um aviso, uma vez por artista.
 */
export function CallSuggestions({ call }: { call: JobCall }) {
  const [artists, setArtists] = useState<Artist[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .callSuggestions(call.id)
      .then((list) => active && setArtists(list))
      .catch(() => active && setArtists([]));
    return () => {
      active = false;
    };
  }, [call.id]);

  const nudge = async (username: string) => {
    setBusy(username);
    setError(null);
    try {
      await api.nudgeArtist(call.id, username);
      setArtists(
        (list) =>
          list?.map((item) =>
            item.user.username === username ? { ...item, nudged: true } : item,
          ) ?? null,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível avisar.");
    } finally {
      setBusy(null);
    }
  };

  if (artists === null) return <div className="h-24 animate-pulse rounded-2xl bg-white/5" />;

  return (
    <section aria-labelledby="sugestoes" className="space-y-3">
      <div>
        <h2 id="sugestoes" className="flex items-center gap-2 text-lg font-bold">
          <Sparkles className="size-5" /> Artistas disponíveis
        </h2>
        <p className="text-sm text-muted-foreground">
          Quem marcou "Disponível para trabalho" e tem {roleLabel(call.role)} nas especialidades.
          Chame para ver a Chamada: a pessoa recebe um aviso e decide se mostra interesse.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {artists.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhum artista disponível com essa função agora. Quem ligar o selo aparece aqui.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {artists.map((artist) => (
            <ArtistCard
              key={artist.user.id}
              artist={artist}
              action={
                artist.nudged ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check className="size-3.5" /> Chamado para ver a Chamada
                  </p>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={busy !== null}
                    onClick={() => void nudge(artist.user.username)}
                  >
                    {busy === artist.user.username ? "Avisando..." : "Chamar para ver a Chamada"}
                  </Button>
                )
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}
