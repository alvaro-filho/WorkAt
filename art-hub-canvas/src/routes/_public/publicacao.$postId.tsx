import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  Check,
  FolderKanban,
  Globe,
  Link2,
  Lock,
  ShieldAlert,
  Trash2,
} from "lucide-react";

import { ActionDialog } from "@/components/admin/AdminDialogs";
import { ArtImage } from "@/components/art/ArtPieces";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConfirmDialog } from "@/components/layout/ConfirmDialog";
import { CommentsPanel } from "@/components/posts/CommentsPanel";
import { Lightbox } from "@/components/posts/Lightbox";
import { PostActions } from "@/components/posts/PostActions";
import { relativeTime, UserAvatar } from "@/components/posts/PostCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { adminApi, api, ApiError, type Post } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

export const Route = createFileRoute("/_public/publicacao/$postId")({
  head: () => ({ meta: [{ title: "Publicação — WorkAt" }] }),
  component: PostPage,
});

const KIND_LABEL: Record<Post["kind"], string> = {
  WIP: "Em andamento",
  STANDALONE: "Arte",
  PROJECT_PUBLISHED: "Projeto aberto",
};

/**
 * Página da arte: imagens grandes à esquerda, sobre fundo escuro; à direita, quem fez, título, contexto
 * (projeto e tarefa, quando públicos), data e "Mais de" com outras publicações da mesma pessoa.
 */
function PostPage() {
  const { postId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [more, setMore] = useState<Post[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moderating, setModerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    setPost(null);
    setMore([]);
    setNotFound(false);
    setError(null);
    window.scrollTo({ top: 0 });
    api
      .post(Number(postId))
      .then((loaded) => {
        if (!active) return;
        if (loaded.kind === "PROJECT_PUBLISHED" && loaded.project) {
          void navigate({
            to: "/projetos/$projectId/publico",
            params: { projectId: String(loaded.project.id) },
            replace: true,
          });
          return;
        }
        setPost(loaded);
        // "Mais de": outras publicações da mesma pessoa que o visitante pode ver.
        api
          .profile(loaded.author.username)
          .then(
            (profile) =>
              active &&
              setMore(
                profile.posts.filter((p) => p.id !== loaded.id && p.images.length > 0).slice(0, 9),
              ),
          )
          .catch(() => undefined);
      })
      .catch((e: unknown) => {
        if (!active) return;
        if (e instanceof ApiError && (e.status === 404 || e.status === 403 || e.status === 401))
          setNotFound(true);
        else setError(e instanceof Error ? e.message : "Não foi possível carregar a publicação.");
      });
    return () => {
      active = false;
    };
  }, [postId, navigate]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie o link:", window.location.href);
    }
  };

  const remove = async () => {
    if (!post) return;
    setBusy(true);
    try {
      await api.deletePost(post.id);
      void navigate({ to: "/u/$username", params: { username: post.author.username } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível apagar.");
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  };

  if (notFound || error) {
    return (
      <AppLayout title="Publicação" back>
        <div className="mx-auto max-w-md rounded-2xl border border-border p-8 text-center">
          <p className="font-semibold">{error ?? "Esta publicação não existe ou não é pública."}</p>
          <Link to="/explorar" className="mt-3 inline-block text-sm text-primary hover:underline">
            Voltar para Explorar
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (!post) {
    return (
      <AppLayout title="Publicação" back wide>
        <div className="grid min-h-[70vh] lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="animate-pulse bg-white/5" />
          <div className="hidden border-l border-border lg:block" />
        </div>
      </AppLayout>
    );
  }

  const mine = user?.username === post.author.username;
  const title =
    post.title ?? (post.kind === "PROJECT_PUBLISHED" ? post.project?.name : null) ?? "Sem título";
  const created = new Date(post.createdAt);

  return (
    <AppLayout title={title} subtitle={`por ${post.author.fullName}`} back wide>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_380px]">
        <section
          aria-label="Imagens"
          className="space-y-2 bg-black/50 p-2 sm:p-4 lg:min-h-[calc(100vh-53px)]"
        >
          {post.images.length === 0 ? (
            <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
              Esta publicação não tem imagens.
            </div>
          ) : (
            post.images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => setViewing(index)}
                aria-label={`Ver em tela cheia: ${title} (${index + 1} de ${post.images.length})`}
                title="Ver em tela cheia"
                className="flex w-full cursor-zoom-in justify-center focus-visible:outline-2 focus-visible:outline-primary"
              >
                <ArtImage
                  src={image.url}
                  title={`${title} (${index + 1} de ${post.images.length})`}
                  className="h-auto max-h-[88vh] w-full object-contain"
                />
              </button>
            ))
          )}
        </section>

        <aside className="border-border lg:border-l">
          <div className="space-y-5 p-5 lg:sticky lg:top-[53px]">
            <div className="flex items-center gap-3">
              <Link
                to="/u/$username"
                params={{ username: post.author.username }}
                aria-label={`Perfil de ${post.author.fullName}`}
              >
                <UserAvatar name={post.author.fullName} src={post.author.avatarUrl} size="md" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  to="/u/$username"
                  params={{ username: post.author.username }}
                  className="block truncate font-bold hover:underline"
                >
                  {post.author.fullName}
                </Link>
                <p className="truncate text-sm text-muted-foreground">@{post.author.username}</p>
              </div>
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link to="/u/$username" params={{ username: post.author.username }}>
                  Ver perfil
                </Link>
              </Button>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="bg-white/10">
                  {post.label === "FINAL" ? "Final" : KIND_LABEL[post.kind]}
                </Badge>
                {!post.isPublic && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-300">
                    <Lock className="size-3" /> Só você e o projeto veem
                  </span>
                )}
              </div>
              <h2 className="text-2xl leading-tight font-bold">{title}</h2>
              {post.subtitle && (
                <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
                  {post.subtitle}
                </p>
              )}
            </div>

            {post.project && (
              <div className="rounded-2xl border border-border p-3 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <FolderKanban className="size-4 text-primary" />
                  {post.task ? (
                    <span className="min-w-0 truncate">
                      {post.task.title} <span className="text-muted-foreground">em</span>{" "}
                      {post.project.name}
                    </span>
                  ) : (
                    <span className="truncate">{post.project.name}</span>
                  )}
                </p>
                <Link
                  to="/projetos/$projectId/publico"
                  params={{ projectId: String(post.project.id) }}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Globe className="size-3" /> Acompanhar o projeto
                </Link>
              </div>
            )}

            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="size-4" />
              <time dateTime={post.createdAt} title={created.toLocaleString("pt-BR")}>
                {created.toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}{" "}
                · {relativeTime(post.createdAt, Date.now())}
              </time>
            </p>

            <div className="border-y border-border py-1">
              <PostActions post={post} onChange={setPost} size="lg" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => void share()}>
                {copied ? <Check className="mr-1 size-4" /> : <Link2 className="mr-1 size-4" />}
                {copied ? "Link copiado" : "Copiar link"}
              </Button>
              {mine && (
                <Button
                  variant="outline"
                  className="rounded-full text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="mr-1 size-4" /> Apagar
                </Button>
              )}
              {user?.admin && !mine && (
                <Button
                  variant="outline"
                  className="rounded-full text-destructive"
                  onClick={() => setModerating(true)}
                >
                  <ShieldAlert className="mr-1 size-4" /> Remover (moderação)
                </Button>
              )}
            </div>

            <CommentsPanel
              target="post"
              id={post.id}
              onCountChange={(count) =>
                setPost((current) =>
                  current && current.commentCount !== count
                    ? { ...current, commentCount: count }
                    : current,
                )
              }
            />

            {more.length > 0 && (
              <section aria-labelledby="more-title" className="border-t border-border pt-5">
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <h3 id="more-title" className="truncate font-bold">
                    Mais de {post.author.fullName}
                  </h3>
                  <Link
                    to="/u/$username"
                    params={{ username: post.author.username }}
                    className="shrink-0 text-xs text-primary hover:underline"
                  >
                    Ver tudo
                  </Link>
                </div>
                <ul className="grid grid-cols-3 gap-1">
                  {more.map((item) => (
                    <li key={item.id}>
                      <Link
                        to="/publicacao/$postId"
                        params={{ postId: String(item.id) }}
                        className="block aspect-square overflow-hidden rounded-md bg-white/5"
                        aria-label={item.title ?? "Publicação"}
                      >
                        <ArtImage
                          src={item.images[0]?.url ?? null}
                          title={item.title ?? "Publicação"}
                          className="size-full object-cover transition-transform hover:scale-105"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </aside>
      </div>
      <Lightbox
        images={post.images.map((image, index) => ({
          url: image.url,
          alt: `${title} (${index + 1} de ${post.images.length})`,
        }))}
        index={viewing}
        onIndexChange={setViewing}
        onClose={() => setViewing(null)}
      />
      {user?.admin && (
        <ActionDialog
          open={moderating}
          onOpenChange={setModerating}
          title="Remover pela moderação"
          description="A publicação é apagada, a prova fica guardada e o autor recebe o aviso de que ela quebrou as diretrizes, com o motivo."
          confirmLabel="Remover"
          destructive
          onConfirm={async ({ reason }) => {
            await adminApi.removePost(post.id, reason);
            void navigate({ to: "/explorar" });
          }}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Apagar esta publicação?"
        description="Ela sai do feed, do Explorar e do portfólio. Os arquivos da tarefa continuam no projeto."
        confirmLabel="Apagar"
        destructive
        busy={busy}
        onConfirm={() => void remove()}
      />
    </AppLayout>
  );
}
