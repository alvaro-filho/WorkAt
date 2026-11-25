import { useEffect, useState, type FormEvent } from "react";
import { Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, type ShowcaseArt } from "@/lib/api";

export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDay(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

/**
 * Imagem de uma arte. Imagens servidas pelo backend (/api/...) são buscadas com o token,
 * porque artes ainda travadas por NDA só aparecem para o artista e o contratante.
 */
export function ArtImage({
  src,
  title,
  className = "h-48 w-full object-cover",
}: {
  src: string | null;
  title: string;
  className?: string;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const fromBackend = Boolean(src?.startsWith("/api/"));

  useEffect(() => {
    if (!src || !fromBackend) return;
    let active = true;
    let created: string | null = null;
    const token = window.localStorage.getItem("authToken");
    fetch(src, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        created = URL.createObjectURL(blob);
        setObjectUrl(created);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [src, fromBackend]);

  const finalSrc = fromBackend ? objectUrl : src;
  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-white/5 text-sm text-muted-foreground ${className}`}
      >
        Sem imagem
      </div>
    );
  }
  if (!finalSrc) {
    return (
      <div className={`animate-pulse bg-white/5 ${className}`} aria-label={`Carregando ${title}`} />
    );
  }
  return <img src={finalSrc} alt={title} className={className} />;
}

/** Situação da arte na vitrine, em palavras para quem lê. */
export function artStatus(art: ShowcaseArt) {
  if (art.ndaStatus === "LOCKED_BY_NDA") {
    return art.reviewNote
      ? { label: "Recusada", tone: "destructive" as const }
      : { label: "Aguardando liberação (NDA)", tone: "locked" as const };
  }
  if (art.releaseDate && art.releaseDate > localDateString()) {
    return { label: `Liberação em ${formatDay(art.releaseDate)}`, tone: "scheduled" as const };
  }
  return { label: "Publicada", tone: "public" as const };
}

export function ArtStatusBadge({ art }: { art: ShowcaseArt }) {
  const status = artStatus(art);
  const className =
    status.tone === "public"
      ? "border-neon/50 text-neon"
      : status.tone === "destructive"
        ? "border-destructive/50 text-destructive"
        : "border-amber-500/50 text-amber-300";
  return (
    <Badge variant="outline" className={className}>
      {status.tone === "locked" && <Lock className="mr-1 size-3" />}
      {status.label}
    </Badge>
  );
}

/** Liberar (com data opcional) ou recusar (com justificativa) uma arte sob NDA. */
export function ReviewDialog({
  art,
  mode,
  onClose,
  onSaved,
}: {
  art: ShowcaseArt | null;
  mode: "approve" | "reject";
  onClose: () => void;
  onSaved: (art: ShowcaseArt) => void;
}) {
  const [releaseDate, setReleaseDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReleaseDate("");
    setNote("");
    setError(null);
  }, [art, mode]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!art) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateShowcaseNdaStatus(art.id, {
        status: mode === "approve" ? "APPROVED_FOR_RELEASE" : "LOCKED_BY_NDA",
        ...(mode === "approve" && releaseDate ? { releaseDate } : {}),
        ...(mode === "reject" ? { note } : {}),
      });
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={art !== null} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="border-border bg-card">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{mode === "approve" ? "Liberar arte" : "Recusar arte"}</DialogTitle>
            <DialogDescription>
              {art?.title} · por {art?.artistName}
            </DialogDescription>
          </DialogHeader>
          {mode === "approve" ? (
            <div className="space-y-2">
              <Label htmlFor="releaseDate">Data de lançamento (opcional)</Label>
              <Input
                id="releaseDate"
                type="date"
                min={localDateString()}
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Sem data, a arte aparece no portfólio do artista na hora. Com data, só a partir
                dela.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="reviewNote">Justificativa para o artista</Label>
              <Textarea
                id="reviewNote"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex.: aguardar o anúncio oficial do jogo"
                required
              />
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || (mode === "reject" && !note.trim())}
              className={mode === "approve" ? "gradient-primary text-primary-foreground" : ""}
              variant={mode === "reject" ? "destructive" : "default"}
            >
              {saving ? "Salvando..." : mode === "approve" ? "Liberar" : "Recusar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
