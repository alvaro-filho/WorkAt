import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Eye,
  FolderKanban,
  ImageIcon,
  Link2,
  Star,
} from "lucide-react";

import { ArtImage } from "@/components/art/ArtPieces";
import { AppLayout } from "@/components/layout/AppLayout";
import { CommentsPanel } from "@/components/posts/CommentsPanel";
import { Lightbox } from "@/components/posts/Lightbox";
import { UserAvatar } from "@/components/posts/PostCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, ApiError, type PublicProject } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { projectTypeInfo } from "@/lib/project-labels";

export const Route = createFileRoute("/_public/projetos/$projectId_/publico")({
  head: () => ({ meta: [{ title: "Projeto — WorkAt" }] }),
  component: PublicProjectPage,
});

type Image = PublicProject["updates"][number]["images"][number] & {
  taskTitle: string;
  done: boolean;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Projeto aberto como uma publicação com várias imagens (como no X): a capa primeiro e depois as etapas,
 * da mais antiga para a mais recente, cada uma com o nome da tarefa. À direita, o diretor, a descrição e
 * quem participa. O diretor escolhe a capa ("Usar como capa").
 */
function PublicProjectPage() {
  const { projectId: projectIdParam } = Route.useParams();
  const projectId = Number(projectIdParam);
  const { user } = useAuth();
  const [project, setProject] = useState<PublicProject | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savingCover, setSavingCover] = useState<number | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    setProject(null);
    window.scrollTo({ top: 0 });
    api
      .publicProject(projectId, "asc")
      .then((loaded) => active && setProject(loaded))
      .catch((e: unknown) => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(e instanceof Error ? e.message : "Não foi possível carregar o projeto.");
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  // Todas as imagens, da mais antiga para a mais recente; a capa vai para o topo.
  const { cover, rest } = useMemo(() => {
    const all: Image[] = (project?.updates ?? [])
      .flatMap((update) =>
        update.images.map((image) => ({ ...image, taskTitle: update.title, done: update.done })),
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const chosen =
      all.find((image) => image.fileId === project?.coverFileId) ?? all[all.length - 1] ?? null;
    return { cover: chosen, rest: all.filter((image) => image !== chosen) };
  }, [project]);

  if (notFound || (error && !project)) {
    return (
      <AppLayout title="Projeto" back>
        <div className="mx-auto max-w-md rounded-2xl border border-border p-8 text-center">
          <p className="font-semibold">{error ?? "Projeto não encontrado ou privado."}</p>
          <Link to="/explorar" className="mt-3 inline-block text-sm text-primary hover:underline">
            Voltar para Explorar
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout title="Projeto" back wide>
        <div className="grid min-h-[70vh] lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="animate-pulse bg-white/5" />
          <div className="hidden border-l border-border lg:block" />
        </div>
      </AppLayout>
    );
  }

  const info = projectTypeInfo(project.type);
  const director = project.owner;
  const isDirector = Boolean(user && director && user.username === director.username);
  const total = (cover ? 1 : 0) + rest.length;

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie o link:", window.location.href);
    }
  };

  const chooseCover = async (fileId: number) => {
    setSavingCover(fileId);
    setError(null);
    try {
      await api.setProjectCover(project.id, fileId);
      setProject({ ...project, coverFileId: fileId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível trocar a capa.");
    } finally {
      setSavingCover(null);
    }
  };

  const renderImage = (image: Image, isCover: boolean, index: number) => (
    <figure key={image.fileId} className="group relative">
      <button
        type="button"
        onClick={() => setViewing(index)}
        aria-label={`Ver em tela cheia: ${image.taskTitle} (${index + 1} de ${total})`}
        title="Ver em tela cheia"
        className="flex w-full cursor-zoom-in justify-center focus-visible:outline-2 focus-visible:outline-primary"
      >
        <ArtImage
          src={image.url}
          title={`${project.name}: ${image.taskTitle} (${index + 1} de ${total})`}
          className="h-auto max-h-[88vh] w-full object-contain"
        />
      </button>
      <figcaption className="mt-1 flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground">
        {isCover && (
          <span className="inline-flex items-center gap-1 font-semibold text-foreground">
            <Star className="size-3 fill-current text-amber-300" /> Capa
          </span>
        )}
        <span className="truncate">{image.taskTitle}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={image.createdAt}>{formatDate(image.createdAt)}</time>
        {image.finalImage && (
          <Badge variant="outline" className="border-neon/50 px-1.5 py-0 text-[10px] text-neon">
            Final
          </Badge>
        )}
        {isDirector && !isCover && (
          <button
            type="button"
            onClick={() => void chooseCover(image.fileId)}
            disabled={savingCover !== null}
            className="ml-auto rounded-full border border-border px-2.5 py-0.5 text-foreground opacity-80 hover:bg-white/10 hover:opacity-100 disabled:opacity-50"
          >
            {savingCover === image.fileId ? "Salvando..." : "Usar como capa"}
          </button>
        )}
      </figcaption>
    </figure>
  );

  return (
    <AppLayout
      title={project.name}
      subtitle={`${info.label} · ${total} ${total === 1 ? "imagem" : "imagens"}`}
      back
      wide
    >
      <div className="grid lg:grid-cols-[minmax(0,1fr)_380px]">
        <section
          aria-label="Imagens do projeto"
          className="space-y-6 bg-black/50 p-2 sm:p-4 lg:min-h-[calc(100vh-53px)]"
        >
          {project.viewerParticipates && !project.isPublic && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-background/80 p-4 text-sm">
              <Eye className="mt-0.5 size-4 shrink-0 text-amber-300" />
              <p>
                <span className="font-medium">Pré-visualização.</span>{" "}
                <span className="text-muted-foreground">
                  Este projeto ainda é privado: só quem participa vê esta página. Ligue o WIP
                  automático nas configurações para publicá-lo.
                </span>
              </p>
            </div>
          )}
          {!cover ? (
            <div className="flex h-80 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <ImageIcon className="size-6" /> Nenhuma imagem pública ainda.
            </div>
          ) : (
            <>
              {renderImage(cover, true, 0)}
              {rest.map((image, index) => renderImage(image, false, index + 1))}
            </>
          )}
        </section>

        <aside className="border-border lg:border-l">
          <div className="space-y-5 p-5 lg:sticky lg:top-[53px]">
            {director && (
              <div className="flex items-center gap-3">
                <Link
                  to="/u/$username"
                  params={{ username: director.username }}
                  aria-label={`Perfil de ${director.fullName}`}
                >
                  <UserAvatar name={director.fullName} src={director.avatarUrl} size="md" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/u/$username"
                    params={{ username: director.username }}
                    className="block truncate font-bold hover:underline"
                  >
                    {director.fullName}
                  </Link>
                  <p className="truncate text-sm text-muted-foreground">Diretor do projeto</p>
                </div>
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <Link to="/u/$username" params={{ username: director.username }}>
                    Ver perfil
                  </Link>
                </Button>
              </div>
            )}

            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="bg-white/10">
                  Projeto · {info.label}
                </Badge>
                {project.status === "CLOSED" && (
                  <Badge variant="outline" className="border-neon/50 text-neon">
                    <CheckCircle2 className="mr-1 size-3" /> Concluído
                  </Badge>
                )}
              </div>
              <h2 className="text-2xl leading-tight font-bold">{project.name}</h2>
              {project.description && (
                <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
                  {project.description}
                </p>
              )}
            </div>

            {project.members.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Equipe</h3>
                <ul className="flex flex-wrap gap-2">
                  {project.members.map((person) => (
                    <li key={person.id}>
                      <Link
                        to="/u/$username"
                        params={{ username: person.username }}
                        className="flex items-center gap-2 rounded-full border border-border py-1 pr-3 pl-1 text-sm hover:bg-white/5"
                      >
                        <UserAvatar name={person.fullName} src={person.avatarUrl} size="xs" />
                        {person.fullName}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <ul className="space-y-1 text-sm text-muted-foreground">
              {project.publicSince && (
                <li className="flex items-center gap-2">
                  <CalendarDays className="size-4" /> Público desde{" "}
                  {formatDate(project.publicSince)}
                </li>
              )}
              <li className="flex items-center gap-2">
                <ImageIcon className="size-4" /> {total} {total === 1 ? "imagem" : "imagens"} em{" "}
                {project.updates.length} {project.updates.length === 1 ? "etapa" : "etapas"}
              </li>
            </ul>

            {isDirector && (
              <p className="text-xs text-muted-foreground">
                Você é o diretor: use "Usar como capa" numa imagem para escolher como o projeto
                aparece no portfólio e no Explorar.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => void share()}>
                {copied ? <Check className="mr-1 size-4" /> : <Link2 className="mr-1 size-4" />}
                {copied ? "Link copiado" : "Copiar link"}
              </Button>
              {project.viewerParticipates && (
                <Button asChild variant="outline" className="rounded-full">
                  <Link to="/projetos/$projectId" params={{ projectId: String(project.id) }}>
                    <FolderKanban className="mr-1 size-4" /> Abrir projeto
                  </Link>
                </Button>
              )}
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {project.isPublic && <CommentsPanel target="project" id={project.id} />}
          </div>
        </aside>
      </div>
      <Lightbox
        images={(cover ? [cover, ...rest] : rest).map((image, position) => ({
          url: image.url,
          alt: `${project.name}: ${image.taskTitle} (${position + 1} de ${total})`,
          caption: `${image.taskTitle} · ${formatDate(image.createdAt)}`,
        }))}
        index={viewing}
        onIndexChange={setViewing}
        onClose={() => setViewing(null)}
      />
    </AppLayout>
  );
}
