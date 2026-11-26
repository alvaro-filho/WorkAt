import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, Globe, Lock, MoreHorizontal, Trash2 } from "lucide-react";

import { ArtImage } from "@/components/art/ArtPieces";
import { ConfirmDialog } from "@/components/layout/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, type Post } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

export function relativeTime(value: string | null, now: number) {
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

const AVATAR_SIZES = {
  xs: "size-5 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-28 text-4xl",
} as const;

/** Foto da pessoa; sem foto (ou se a imagem falhar), a inicial do nome. */
export function UserAvatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string | null | undefined;
  size?: keyof typeof AVATAR_SIZES;
}) {
  const [failed, setFailed] = useState(false);
  const classes = `flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${AVATAR_SIZES[size]}`;
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className={`${classes} object-cover`}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span aria-hidden="true" className={`gradient-primary text-primary-foreground ${classes}`}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function PostLabel({ label }: { label: Post["label"] }) {
  if (!label) return null;
  return label === "FINAL" ? (
    <Badge variant="outline" className="border-neon/50 text-neon">
      Final
    </Badge>
  ) : (
    <Badge variant="outline" className="border-amber-500/50 text-amber-300">
      WIP
    </Badge>
  );
}

/** Uma imagem ocupa a largura toda; de 2 a 4 viram grade; acima de 4, mostra "+N" na quarta. */
export function PostImages({ post }: { post: Post }) {
  const images = post.images;
  if (images.length === 0) return null;
  const alt = post.title ?? "Imagem da publicação";
  if (images.length === 1) {
    return (
      <div className="mt-3 overflow-hidden rounded-2xl border border-border">
        <ArtImage src={images[0]!.url} title={alt} className="max-h-[520px] w-full object-cover" />
      </div>
    );
  }
  const shown = images.slice(0, 4);
  const extra = images.length - shown.length;
  return (
    <div className="mt-3 grid grid-cols-2 gap-1 overflow-hidden rounded-2xl border border-border">
      {shown.map((image, index) => (
        <div key={image.id} className="relative">
          <ArtImage src={image.url} title={alt} className="aspect-square w-full object-cover" />
          {extra > 0 && index === shown.length - 1 && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-lg font-semibold">
              +{extra}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function contextLine(post: Post) {
  if (post.kind === "PROJECT_PUBLISHED") {
    return (
      <>
        abriu o projeto <span className="font-medium text-foreground">{post.project?.name}</span> ao
        público
      </>
    );
  }
  if (post.kind === "WIP") {
    return (
      <>
        novo WIP em{" "}
        <span className="font-medium text-foreground">{post.project?.name ?? "um projeto"}</span>
      </>
    );
  }
  if (post.project) return <>publicou uma imagem de {post.project.name}</>;
  return null;
}

/**
 * Publicação no estilo X: autor, hora, contexto (WIP de tarefa, post avulso ou projeto aberto),
 * título, subtítulo e imagens. O autor tem o menu para ocultar do portfólio e apagar.
 */
export function PostCard({
  post,
  now,
  onChanged,
  onDeleted,
}: {
  post: Post;
  now: number;
  onChanged?: (post: Post) => void;
  onDeleted?: (postId: number) => void;
}) {
  const { user } = useAuth();
  const mine = user?.username === post.author.username;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const context = contextLine(post);
  const linksToProject = post.project && post.kind !== "STANDALONE";

  const toggleHidden = async () => {
    setBusy(true);
    setError(null);
    try {
      onChanged?.(
        await api.updatePost(post.id, { hiddenFromPortfolio: !post.hiddenFromPortfolio }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  const [confirmDelete, setConfirmDelete] = useState(false);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.deletePost(post.id);
      setConfirmDelete(false);
      onDeleted?.(post.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível apagar.");
      setBusy(false);
    }
  };

  return (
    <li className="flex gap-3 p-4 transition-colors hover:bg-white/[0.03]">
      <Link
        to="/u/$username"
        params={{ username: post.author.username }}
        aria-label={`Perfil de ${post.author.fullName}`}
      >
        <UserAvatar name={post.author.fullName} src={post.author.avatarUrl} />
      </Link>
      <article className="min-w-0 flex-1">
        <header className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1 text-[15px] leading-5">
            <Link
              to="/u/$username"
              params={{ username: post.author.username }}
              className="truncate font-semibold hover:underline"
            >
              {post.author.fullName}
            </Link>
            <span className="truncate text-muted-foreground">@{post.author.username}</span>
            <span className="text-muted-foreground" aria-hidden="true">
              ·
            </span>
            <time
              className="text-muted-foreground"
              dateTime={post.createdAt}
              title={new Date(post.createdAt).toLocaleString("pt-BR")}
            >
              {relativeTime(post.createdAt, now)}
            </time>
          </div>
          <PostLabel label={post.label} />
          {mine && (onChanged || onDeleted) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="-mt-1 size-7"
                  aria-label="Opções da publicação"
                  disabled={busy}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {post.kind === "STANDALONE" && onChanged && (
                  <DropdownMenuItem onSelect={() => void toggleHidden()}>
                    {post.hiddenFromPortfolio ? (
                      <>
                        <Eye className="mr-2 size-4" /> Mostrar no portfólio
                      </>
                    ) : (
                      <>
                        <EyeOff className="mr-2 size-4" /> Ocultar do portfólio
                      </>
                    )}
                  </DropdownMenuItem>
                )}
                {onDeleted && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="mr-2 size-4" /> Apagar publicação
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>
        {context && <p className="mt-0.5 text-[15px] leading-5 text-muted-foreground">{context}</p>}
        {post.title && post.kind !== "PROJECT_PUBLISHED" && (
          <h3 className="mt-1 text-[15px] leading-5 font-bold">
            <Link to="/publicacao/$postId" params={{ postId: String(post.id) }} className="hover:underline">
              {post.title}
            </Link>
          </h3>
        )}
        {post.subtitle && (
          <p className="mt-1 text-[15px] leading-5 whitespace-pre-wrap">{post.subtitle}</p>
        )}
        <Link
          to="/publicacao/$postId"
          params={{ postId: String(post.id) }}
          aria-label={`Abrir ${post.title ?? "publicação"}`}
          className="block"
        >
          <PostImages post={post} />
        </Link>
        {(linksToProject || !post.isPublic || (mine && post.hiddenFromPortfolio)) && (
          <footer className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {linksToProject && (
              <Link
                to="/projetos/$projectId/publico"
                params={{ projectId: String(post.project!.id) }}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Globe className="size-3" /> Ver projeto
              </Link>
            )}
            {!post.isPublic && (
              <span className="inline-flex items-center gap-1">
                <Lock className="size-3" /> Só você e quem participa do projeto veem
              </span>
            )}
            {mine && post.hiddenFromPortfolio && (
              <span className="inline-flex items-center gap-1">
                <EyeOff className="size-3" /> Oculto do portfólio
              </span>
            )}
          </footer>
        )}
        {error && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </article>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Apagar esta publicação?"
        description="Ela sai do feed e do portfólio. Os arquivos da tarefa continuam no projeto."
        confirmLabel="Apagar"
        destructive
        busy={busy}
        onConfirm={() => void remove()}
      />
    </li>
  );
}
