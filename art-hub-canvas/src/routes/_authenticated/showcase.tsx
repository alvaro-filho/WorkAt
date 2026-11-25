import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "@/components/layout/AppLayout";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/AuthContext";
import { api, type NdaStatus, type Project, type PublicShowcaseArt, type ShowcaseArt } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/showcase")({
  head: () => ({
    meta: [
      { title: "Vitrine & NDA — Art Hub" },
      { name: "description", content: "Controle de NDA e publicação de artes." },
    ],
  }),
  component: ShowcasePage,
});

type View = "mine" | "inbox" | "public";
type ReviewMode = "approve" | "lock";

function localDateString() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function ShowcasePage() {
  const { user } = useAuth();
  const isArtist = user?.role === "ARTIST";
  const [view, setView] = useState<View>(isArtist ? "mine" : "inbox");
  const [mine, setMine] = useState<ShowcaseArt[]>([]);
  const [inbox, setInbox] = useState<ShowcaseArt[]>([]);
  const [publicArts, setPublicArts] = useState<PublicShowcaseArt[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [projectId, setProjectId] = useState("");
  const [reviewItem, setReviewItem] = useState<ShowcaseArt | null>(null);
  const [reviewMode, setReviewMode] = useState<ReviewMode>("approve");
  const [releaseDate, setReleaseDate] = useState("");
  const [reviewNote, setReviewNote] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const publicRequest = api.publicShowcase();
      if (isArtist) {
        const [publicItems, mineItems, ownProjects] = await Promise.all([
          publicRequest,
          api.myShowcase(),
          api.projects(),
        ]);
        setPublicArts(publicItems);
        setMine(mineItems);
        setProjects(ownProjects);
      } else if (user?.role === "COMPANY") {
        const [publicItems, inboxItems] = await Promise.all([publicRequest, api.showcaseInbox()]);
        setPublicArts(publicItems);
        setInbox(inboxItems);
      } else {
        setPublicArts(await publicRequest);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar a vitrine.");
    } finally {
      setLoading(false);
    }
  }, [isArtist, user?.role]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submitArtwork = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const art = await api.createShowcaseArt({
        title,
        ...(description ? { description } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        companyEmail,
        ...(projectId ? { projectId: Number(projectId) } : {}),
      });
      setMine((items) => [art, ...items]);
      setTitle("");
      setDescription("");
      setImageUrl("");
      setCompanyEmail("");
      setProjectId("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar a arte.");
    } finally {
      setSubmitting(false);
    }
  };

  const openReview = (art: ShowcaseArt, mode: ReviewMode) => {
    setReviewItem(art);
    setReviewMode(mode);
    setReleaseDate("");
    setReviewNote("");
    setError(null);
  };

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reviewItem) return;
    setReviewSaving(true);
    setError(null);
    try {
      const status: NdaStatus = reviewMode === "approve" ? "APPROVED_FOR_RELEASE" : "LOCKED_BY_NDA";
      const updated = await api.updateShowcaseNdaStatus(reviewItem.id, {
        status,
        ...(reviewMode === "approve" && releaseDate ? { releaseDate } : {}),
        ...(reviewMode === "lock" ? { note: reviewNote } : {}),
      });
      setInbox((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setPublicArts(await api.publicShowcase());
      setReviewItem(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível atualizar a liberação.");
    } finally {
      setReviewSaving(false);
    }
  };

  const currentList = isArtist ? mine : inbox;

  return (
    <AppLayout title="Vitrine & NDA" subtitle="Controle de acesso e publicação das artes">
      <Tabs value={view} onValueChange={(value) => setView(value as View)}>
        <TabsList className="bg-white/5">
          {isArtist && <TabsTrigger value="mine">Minhas artes</TabsTrigger>}
          {user?.role === "COMPANY" && <TabsTrigger value="inbox">Caixa de entrada</TabsTrigger>}
          <TabsTrigger value="public">Vitrine pública</TabsTrigger>
        </TabsList>
      </Tabs>

      {error && <p role="alert" className="mt-4 rounded-xl border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Carregando vitrine...</p>
      ) : view === "mine" && isArtist ? (
        <div className="mt-5 space-y-6">
          <form onSubmit={submitArtwork} className="glass grid gap-4 rounded-2xl p-5 sm:grid-cols-2">
            <h2 className="text-base font-semibold sm:col-span-2">Enviar para vitrine</h2>
            <div className="space-y-2">
              <Label htmlFor="showcase-title">Título</Label>
              <Input id="showcase-title" maxLength={150} value={title} onChange={(event) => setTitle(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="showcase-company">E-mail da empresa</Label>
              <Input id="showcase-company" type="email" value={companyEmail} onChange={(event) => setCompanyEmail(event.target.value)} required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="showcase-description">Descrição</Label>
              <Textarea id="showcase-description" value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="showcase-image">URL da imagem</Label>
              <Input id="showcase-image" type="url" maxLength={500} placeholder="https://..." value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="showcase-project">Projeto (opcional)</Label>
              <select id="showcase-project" value={projectId} onChange={(event) => setProjectId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Sem projeto vinculado</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={submitting} className="gradient-primary text-primary-foreground">
                {submitting ? "Enviando..." : "Enviar para vitrine"}
              </Button>
            </div>
          </form>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Minhas artes</h2>
            <PrivateArtGrid items={mine} empty="Você ainda não enviou artes para a vitrine." />
          </section>
        </div>
      ) : view === "inbox" && user?.role === "COMPANY" ? (
        <section className="mt-5">
          <h2 className="mb-3 text-lg font-semibold">Caixa de entrada</h2>
          {inbox.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {inbox.map((art) => (
                <PrivateArtCard key={art.id} art={art} actions={(
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => openReview(art, "approve")}>Liberar</Button>
                    <Button size="sm" variant="outline" onClick={() => openReview(art, "lock")}>Recusar/Travar</Button>
                  </div>
                )} />
              ))}
            </div>
          ) : <Empty message="Sua caixa de entrada está vazia." />}
        </section>
      ) : (
        <section className="mt-5">
          <h2 className="mb-3 text-lg font-semibold">Vitrine pública</h2>
          {publicArts.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {publicArts.map((art) => <PublicArtCard key={art.id} art={art} />)}
            </div>
          ) : <Empty message="Ainda não há artes liberadas para publicação." />}
        </section>
      )}

      <Dialog open={reviewItem !== null} onOpenChange={(open) => {
        if (!open && !reviewSaving) setReviewItem(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewMode === "approve" ? "Liberar arte" : "Recusar ou travar arte"}</DialogTitle>
            <DialogDescription>{reviewItem?.title}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitReview} className="space-y-4">
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {reviewMode === "approve" ? (
              <div className="space-y-2">
                <Label htmlFor="release-date">Data de lançamento (opcional)</Label>
                <Input id="release-date" type="date" min={localDateString()} value={releaseDate} onChange={(event) => setReleaseDate(event.target.value)} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="review-note">Justificativa</Label>
                <Textarea id="review-note" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} required />
              </div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={reviewSaving || (reviewMode === "lock" && !reviewNote.trim())}>
                {reviewSaving ? "Salvando..." : reviewMode === "approve" ? "Confirmar liberação" : "Confirmar recusa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function PrivateArtGrid({ items, empty }: { items: ShowcaseArt[]; empty: string }) {
  return items.length ? (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((art) => <PrivateArtCard key={art.id} art={art} />)}
    </div>
  ) : <Empty message={empty} />;
}

function PrivateArtCard({ art, actions }: { art: ShowcaseArt; actions?: React.ReactNode }) {
  const isFutureRelease = art.ndaStatus === "APPROVED_FOR_RELEASE" && art.releaseDate && art.releaseDate > localDateString();
  const badge = art.ndaStatus === "LOCKED_BY_NDA"
    ? "Travado por NDA"
    : isFutureRelease ? `Liberação em ${formatDate(art.releaseDate!)}` : "Liberado";

  return (
    <article className="glass overflow-hidden rounded-2xl">
      <ArtImage src={art.imageUrl} title={art.title} />
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium">{art.title}</h3>
          <Badge variant={art.ndaStatus === "LOCKED_BY_NDA" ? "destructive" : "secondary"}>{badge}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">Empresa: {art.companyName}</p>
        {art.description && <p className="text-sm text-muted-foreground">{art.description}</p>}
        {art.reviewNote && <p className="rounded-md bg-destructive/10 p-2 text-sm">Nota da empresa: {art.reviewNote}</p>}
        {actions}
      </div>
    </article>
  );
}

function PublicArtCard({ art }: { art: PublicShowcaseArt }) {
  return (
    <article className="glass overflow-hidden rounded-2xl">
      <ArtImage src={art.imageUrl} title={art.title} />
      <div className="space-y-2 p-4">
        <h3 className="font-medium">{art.title}</h3>
        <p className="text-xs text-muted-foreground">Por {art.artistName} · {art.companyName}</p>
        {art.description && <p className="text-sm text-muted-foreground">{art.description}</p>}
        {art.releaseDate && <p className="text-xs text-muted-foreground">Liberado em {formatDate(art.releaseDate)}</p>}
      </div>
    </article>
  );
}

function ArtImage({ src, title }: { src: string | null; title: string }) {
  return src ? (
    <img src={src} alt={title} className="h-48 w-full object-cover" />
  ) : (
    <div className="flex h-48 items-center justify-center bg-white/5 text-sm text-muted-foreground">Sem imagem</div>
  );
}

function Empty({ message }: { message: string }) {
  return <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">{message}</div>;
}
