import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownWideNarrow, ArrowLeft, ArrowUpNarrowWide, CheckCircle2, Eye } from "lucide-react";

import { ArtImage } from "@/components/art/ArtPieces";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserAvatar } from "@/components/posts/PostCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError, type PublicProject } from "@/lib/api";
import { projectTypeInfo } from "@/lib/project-labels";

export const Route = createFileRoute("/_public/projetos/$projectId_/publico")({
  head: () => ({ meta: [{ title: "Projeto — WorkAt" }] }),
  component: PublicProjectPage,
});

type Order = "asc" | "desc";
type Update = PublicProject["updates"][number];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Visão pública do projeto: o que um visitante vê. Só as atualizações, em linha do tempo; cada tarefa vira
 * título, subtítulo (descrição) e imagens. Sem Kanban, prazos, prioridades ou responsáveis.
 */
function PublicProjectPage() {
  const { projectId: projectIdParam } = Route.useParams();
  const projectId = Number(projectIdParam);
  const [order, setOrder] = useState<Order>("asc");
  const [project, setProject] = useState<PublicProject | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    api
      .publicProject(projectId, order)
      .then((loaded) => active && setProject(loaded))
      .catch((e: unknown) => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(e instanceof Error ? e.message : "Não foi possível carregar o projeto.");
      });
    return () => {
      active = false;
    };
  }, [projectId, order]);

  if (notFound || (error && !project)) {
    return (
      <AppLayout title="Projeto">
        <div className="glass rounded-2xl p-8 text-center">
          <p className="font-medium">{error ?? "Projeto não encontrado ou privado."}</p>
          <Link
            to="/publicacoes"
            className="mt-3 inline-block text-sm text-primary hover:underline"
          >
            Ir para Publicações
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout title="Projeto">
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Carregando projeto...
        </div>
      </AppLayout>
    );
  }

  const info = projectTypeInfo(project.type);
  const people = [...(project.owner ? [project.owner] : []), ...project.members];

  return (
    <AppLayout title={project.name} subtitle={`${info.label} · visão pública`}>
      {project.viewerParticipates && (
        <Link
          to="/projetos/$projectId"
          params={{ projectId: String(project.id) }}
          className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> Voltar ao projeto
        </Link>
      )}

      {project.viewerParticipates && !project.isPublic && (
        <div className="glass mb-4 flex items-start gap-3 rounded-2xl border border-amber-500/40 p-4 text-sm">
          <Eye className="mt-0.5 size-4 shrink-0 text-amber-300" />
          <p>
            <span className="font-medium">Pré-visualização.</span>{" "}
            <span className="text-muted-foreground">
              Este projeto ainda é privado: só quem participa vê esta página. Ligue o WIP automático
              nas configurações do projeto para publicá-lo.
            </span>
          </p>
        </div>
      )}

      <div className="mx-auto max-w-3xl space-y-6">
        <header className="glass rounded-2xl p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{project.name}</h2>
            <Badge variant="outline">{info.label}</Badge>
            {project.status === "CLOSED" && (
              <Badge variant="outline" className="border-neon/50 text-neon">
                Concluído
              </Badge>
            )}
          </div>
          {project.description && (
            <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
              {project.description}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {people.map((person) => (
              <Link
                key={person.id}
                to="/u/$username"
                params={{ username: person.username }}
                className="flex items-center gap-2 rounded-full pr-3 hover:bg-white/5"
              >
                <UserAvatar name={person.fullName} src={person.avatarUrl} size="sm" />
                <span className="text-sm">{person.fullName}</span>
              </Link>
            ))}
          </div>
          {project.publicSince && (
            <p className="mt-3 text-xs text-muted-foreground">
              Público desde {formatDate(project.publicSince)}
            </p>
          )}
        </header>

        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Atualizações ({project.updates.length})</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOrder((current) => (current === "asc" ? "desc" : "asc"))}
          >
            {order === "asc" ? (
              <>
                <ArrowUpNarrowWide className="mr-1 size-4" /> Mais antigas primeiro
              </>
            ) : (
              <>
                <ArrowDownWideNarrow className="mr-1 size-4" /> Mais recentes primeiro
              </>
            )}
          </Button>
        </div>

        {project.updates.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Nenhuma atualização com imagem ainda.
          </div>
        ) : (
          <ol className="relative space-y-6 border-l border-border pl-6">
            {project.updates.map((update) => (
              <UpdateBlock
                key={update.taskId}
                update={update}
                onZoom={(url) => setZoom({ url, title: update.title })}
              />
            ))}
          </ol>
        )}
      </div>

      <Dialog open={zoom !== null} onOpenChange={(open) => !open && setZoom(null)}>
        <DialogContent className="max-w-5xl border-border bg-card p-2">
          <DialogTitle className="sr-only">{zoom?.title}</DialogTitle>
          {zoom && (
            <ArtImage
              src={zoom.url}
              title={zoom.title}
              className="max-h-[85vh] w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function UpdateBlock({ update, onZoom }: { update: Update; onZoom: (url: string) => void }) {
  const sameDay = formatDate(update.firstImageAt) === formatDate(update.lastImageAt);
  return (
    <li className="relative">
      <span
        aria-hidden="true"
        className={`absolute top-1.5 -left-[1.95rem] size-3 rounded-full border-2 border-background ${
          update.done ? "bg-neon" : "bg-primary"
        }`}
      />
      <article className="glass rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-semibold">{update.title}</h4>
          {update.done && (
            <Badge variant="outline" className="border-neon/50 text-neon">
              <CheckCircle2 className="mr-1 size-3" /> Concluída
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {sameDay
            ? formatDate(update.firstImageAt)
            : `${formatDate(update.firstImageAt)} a ${formatDate(update.lastImageAt)}`}{" "}
          · {update.images.length} {update.images.length === 1 ? "imagem" : "imagens"}
        </p>
        {update.subtitle && (
          <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
            {update.subtitle}
          </p>
        )}
        <div
          className={`mt-3 grid gap-2 ${update.images.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"}`}
        >
          {update.images.map((image) => (
            <button
              key={image.fileId}
              type="button"
              onClick={() => onZoom(image.url)}
              className="group relative overflow-hidden rounded-xl border border-border"
              aria-label={`Ampliar imagem de ${update.title}`}
            >
              <ArtImage
                src={image.url}
                title={update.title}
                className={`w-full object-cover transition-transform group-hover:scale-[1.02] ${
                  update.images.length === 1 ? "max-h-[480px]" : "aspect-square"
                }`}
              />
              {image.finalImage && (
                <Badge className="absolute top-2 left-2 bg-neon text-black">Final</Badge>
              )}
            </button>
          ))}
        </div>
      </article>
    </li>
  );
}
