import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Check, ExternalLink, FolderKanban, Globe, ImageIcon, Lock, Pencil, Plus } from "lucide-react";

import { ArtImage } from "@/components/art/ArtPieces";
import { ActivityHeatmap } from "@/components/dashboard/ActivityHeatmap";
import { AppLayout } from "@/components/layout/AppLayout";
import { PostCard } from "@/components/posts/PostCard";
import { PostComposer } from "@/components/posts/PostComposer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiError, type Post, type Profile, type ProfileProject } from "@/lib/api";
import { projectTypeInfo, roleLabel } from "@/lib/project-labels";

export const Route = createFileRoute("/_public/u/$username")({
  head: () => ({ meta: [{ title: "Perfil — WorkAt" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    setProfile(null);
    setNotFound(false);
    setError(null);
    api
      .profile(username)
      .then((loaded) => active && setProfile(loaded))
      .catch((e: unknown) => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(e instanceof Error ? e.message : "Não foi possível carregar o perfil.");
      });
    return () => {
      active = false;
    };
  }, [username]);

  const changePost = (post: Post) =>
    setProfile((current) =>
      current
        ? {
            ...current,
            posts: current.posts.map((item) => (item.id === post.id ? post : item)),
            portfolio: post.hiddenFromPortfolio
              ? current.portfolio.filter((item) => item.id !== post.id)
              : current.portfolio.some((item) => item.id === post.id)
                ? current.portfolio.map((item) => (item.id === post.id ? post : item))
                : [post, ...current.portfolio],
          }
        : current,
    );
  const removePost = (postId: number) =>
    setProfile((current) =>
      current
        ? {
            ...current,
            posts: current.posts.filter((item) => item.id !== postId),
            portfolio: current.portfolio.filter((item) => item.id !== postId),
          }
        : current,
    );
  const addPost = (post: Post) => {
    setNow(Date.now());
    setProfile((current) =>
      current
        ? { ...current, posts: [post, ...current.posts], portfolio: [post, ...current.portfolio] }
        : current,
    );
  };

  const heatmap = useMemo(
    () =>
      (profile?.heatmap ?? []).reduce<Record<string, number>>((result, item) => {
        result[item.date] = item.count;
        return result;
      }, {}),
    [profile],
  );

  if (notFound || error) {
    return (
      <AppLayout title="Perfil">
        <div className="glass rounded-2xl p-8 text-center">
          <p className="font-medium">{error ?? "Perfil não encontrado."}</p>
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

  if (!profile) {
    return (
      <AppLayout title="Perfil">
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Carregando perfil...
        </div>
      </AppLayout>
    );
  }

  const { user } = profile;
  const isCompany = user.role === "COMPANY";
  const ownProjects = profile.projects.filter((project) => project.role === "OWNER").length;
  const publicProjects = profile.projects.filter(
    (project): project is ProfileProject & { id: number } =>
      project.publicView && project.id !== null,
  );

  return (
    <AppLayout
      title={profile.me ? "Meu perfil" : user.fullName}
      subtitle={`@${user.username} · ${isCompany ? "Estúdio / Empresa" : "Artista"}`}
    >
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={`Foto de ${user.fullName}`}
              className="aspect-square w-40 rounded-full object-cover shadow-[var(--shadow-glow)] lg:w-full"
            />
          ) : (
            <div className="gradient-primary flex aspect-square w-40 items-center justify-center rounded-full text-6xl font-semibold text-primary-foreground shadow-[var(--shadow-glow)] lg:w-full">
              {user.fullName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-semibold leading-tight">{user.fullName}</h2>
            <p className="text-lg text-muted-foreground">@{user.username}</p>
          </div>
          <Badge variant="outline">{isCompany ? "Estúdio / Empresa" : "Artista"}</Badge>
          {profile.bio && <p className="text-sm whitespace-pre-wrap">{profile.bio}</p>}
          {profile.specialties.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Especialidades">
              {profile.specialties.map((item) => (
                <li key={item}>
                  <Badge variant="secondary" className="bg-white/10 font-normal">
                    {item}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          {profile.links.length > 0 && (
            <ul className="space-y-1 text-sm" aria-label="Links">
              {profile.links.map((link) => (
                <li key={link}>
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex max-w-full items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="size-3 shrink-0" />
                    <span className="truncate">{link.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {profile.me && (
            <div className="grid gap-2">
              <Button asChild variant="outline" className="w-full">
                <Link to="/conta">
                  <Pencil className="size-4" /> Editar perfil
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/projetos">
                  <Plus className="size-4" /> Novo projeto
                </Link>
              </Button>
            </div>
          )}
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <ImageIcon className="size-4" />
              <span>
                <span className="font-semibold text-foreground">{profile.posts.length}</span>{" "}
                {profile.posts.length === 1 ? "publicação" : "publicações"}
              </span>
            </li>
            <li className="flex items-center gap-2">
              <FolderKanban className="size-4" />
              <span>
                <span className="font-semibold text-foreground">
                  {profile.projects.length + profile.hiddenPersonalProjects}
                </span>{" "}
                projetos ({ownProjects} como dono)
              </span>
            </li>
            {profile.memberSince && (
              <li className="flex items-center gap-2">
                <CalendarDays className="size-4" />
                No WorkAt desde{" "}
                {new Date(profile.memberSince).toLocaleDateString("pt-BR", {
                  month: "long",
                  year: "numeric",
                })}
              </li>
            )}
          </ul>
        </aside>

        <div className="min-w-0 space-y-8">
          {profile.me && <FirstSteps profile={profile} onPublish={() => setComposerOpen(true)} />}
          <Tabs defaultValue="portfolio">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <TabsList>
                <TabsTrigger value="portfolio">Portfólio</TabsTrigger>
                <TabsTrigger value="posts">Posts ({profile.posts.length})</TabsTrigger>
                <TabsTrigger value="projects">
                  Projetos ({profile.projects.length + profile.hiddenPersonalProjects})
                </TabsTrigger>
              </TabsList>
              {profile.me && (
                <Button
                  size="sm"
                  className="gradient-primary text-primary-foreground"
                  onClick={() => setComposerOpen(true)}
                >
                  <Plus className="mr-1 size-4" /> Publicar
                </Button>
              )}
            </div>

            <TabsContent value="portfolio" className="space-y-6">
              {publicProjects.length === 0 && profile.portfolio.length === 0 ? (
                <div className="glass rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  {profile.me
                    ? "Seu portfólio ainda está vazio. Publique uma imagem pelo botão Publicar, ou ligue o WIP automático nas configurações de um projeto para ele aparecer aqui com todas as atualizações."
                    : "Ainda não há nada no portfólio."}
                </div>
              ) : (
                <>
                  {publicProjects.length > 0 && (
                    <section aria-labelledby="public-projects-title">
                      <h3 id="public-projects-title" className="mb-3 text-sm font-semibold">
                        Projetos públicos
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {publicProjects.map((project) => (
                          <Link
                            key={project.id}
                            to="/projetos/$projectId/publico"
                            params={{ projectId: String(project.id) }}
                            className="glass glass-hover block overflow-hidden rounded-2xl"
                          >
                            <ArtImage
                              src={project.coverUrl}
                              title={project.name ?? "Projeto"}
                              className="h-44 w-full object-cover"
                            />
                            <div className="space-y-1 p-3">
                              <p className="truncate text-sm font-medium">{project.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {projectTypeInfo(project.type).label}
                                {project.role === "MEMBER" && project.ownerName
                                  ? ` · de ${project.ownerName}`
                                  : ""}
                              </p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </section>
                  )}
                  {profile.portfolio.length > 0 && (
                    <section aria-labelledby="portfolio-posts-title">
                      <h3 id="portfolio-posts-title" className="mb-3 text-sm font-semibold">
                        Artes
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {profile.portfolio.map((post) => (
                          <article key={post.id} className="glass overflow-hidden rounded-2xl">
                            <ArtImage
                              src={post.images[0]?.url ?? null}
                              title={post.title ?? "Arte"}
                              className="h-44 w-full object-cover"
                            />
                            <div className="space-y-1 p-3">
                              <p className="truncate text-sm font-medium">
                                {post.title ?? "Sem título"}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {post.subtitle ??
                                  (post.project ? post.project.name : "Post avulso")}
                              </p>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="posts">
              {profile.posts.length === 0 ? (
                <div className="glass rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  {profile.me ? "Você ainda não publicou nada." : "Nenhuma publicação ainda."}
                </div>
              ) : (
                <ol
                  className="glass divide-y divide-border overflow-hidden rounded-2xl"
                  aria-label="Posts"
                >
                  {profile.posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      now={now}
                      onChanged={changePost}
                      onDeleted={removePost}
                    />
                  ))}
                </ol>
              )}
            </TabsContent>

            <TabsContent value="projects">
              {profile.projects.length === 0 && profile.hiddenPersonalProjects === 0 ? (
                <div className="glass rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  Nenhum projeto ainda.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {profile.projects.map((project, index) => (
                    <ProjectCard
                      key={project.id ?? `nda-${index}`}
                      project={project}
                      me={profile.me}
                    />
                  ))}
                </div>
              )}
              {profile.hiddenPersonalProjects > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  + {profile.hiddenPersonalProjects}{" "}
                  {profile.hiddenPersonalProjects === 1 ? "projeto pessoal" : "projetos pessoais"}{" "}
                  (privados)
                </p>
              )}
            </TabsContent>
          </Tabs>

          <section aria-label="Atividade">
            <ActivityHeatmap data={heatmap} />
          </section>
        </div>
      </div>
      {profile.me && (
        <PostComposer open={composerOpen} onOpenChange={setComposerOpen} onCreated={addPost} />
      )}
    </AppLayout>
  );
}

function ProjectCard({ project, me }: { project: ProfileProject; me: boolean }) {
  const info = projectTypeInfo(project.type);
  const Icon = info.icon;

  if (project.masked) {
    return (
      <div className="glass rounded-2xl border border-dashed border-amber-500/40 p-4">
        <p className="flex items-center gap-2 font-medium">
          <Lock className="size-4 text-amber-300" /> Projeto sob NDA
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Trabalhando para{" "}
          <span className="text-foreground">{project.ownerName ?? "um estúdio"}</span>. O conteúdo é
          confidencial.
        </p>
        <Badge variant="outline" className="mt-3">
          {info.label}
        </Badge>
      </div>
    );
  }

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 font-medium text-primary">
          <Icon className="size-4 shrink-0" />
          <span className="truncate">{project.name}</span>
        </p>
        <Badge variant="outline" className="shrink-0">
          {project.status === "CLOSED" ? "Encerrado" : roleLabel(project.role, project.type)}
        </Badge>
      </div>
      <p className="mt-2 line-clamp-2 min-h-8 text-xs text-muted-foreground">
        {project.description || "Sem descrição."}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{info.label}</span>
        {project.nda && (
          <span className="inline-flex items-center gap-1 text-amber-300">
            <Lock className="size-3" /> NDA
          </span>
        )}
        {project.publicView && (
          <span className="inline-flex items-center gap-1 text-neon">
            <Globe className="size-3" /> Público
          </span>
        )}
        {project.role === "MEMBER" && project.ownerName && <span>· de {project.ownerName}</span>}
      </div>
    </>
  );

  // Quem participa abre o projeto; visitantes abrem a visão pública, se o projeto for público.
  if (!me && project.publicView && project.id !== null) {
    return (
      <Link
        to="/projetos/$projectId/publico"
        params={{ projectId: String(project.id) }}
        className="glass glass-hover block rounded-2xl p-4"
      >
        {body}
      </Link>
    );
  }
  return me && project.id !== null ? (
    <Link
      to="/projetos/$projectId"
      params={{ projectId: String(project.id) }}
      className="glass glass-hover block rounded-2xl p-4"
    >
      {body}
    </Link>
  ) : (
    <div className="glass rounded-2xl p-4">{body}</div>
  );
}


/** Primeiros passos para conta nova: some sozinho quando tudo estiver feito. */
function FirstSteps({ profile, onPublish }: { profile: Profile; onPublish: () => void }) {
  const steps = [
    {
      done: Boolean(profile.user.avatarUrl || profile.bio),
      label: "Coloque foto e bio no perfil",
      action: (
        <Link to="/conta" className="text-primary hover:underline">
          Editar perfil
        </Link>
      ),
    },
    {
      done: profile.projects.length + profile.hiddenPersonalProjects > 0,
      label: "Crie seu primeiro projeto (há modelos prontos)",
      action: (
        <Link to="/projetos" className="text-primary hover:underline">
          Criar projeto
        </Link>
      ),
    },
    {
      done: profile.posts.length > 0,
      label: "Publique sua primeira arte",
      action: (
        <button type="button" onClick={onPublish} className="text-primary hover:underline">
          Publicar
        </button>
      ),
    },
  ];
  const remaining = steps.filter((step) => !step.done).length;
  if (remaining === 0) return null;
  return (
    <section className="glass rounded-2xl p-4" aria-labelledby="first-steps-title">
      <h3 id="first-steps-title" className="text-sm font-semibold">
        Primeiros passos · faltam {remaining}
      </h3>
      <ol className="mt-3 space-y-2">
        {steps.map((step) => (
          <li key={step.label} className="flex flex-wrap items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className={`flex size-5 items-center justify-center rounded-full border ${
                step.done ? "border-emerald-500 bg-emerald-500/20 text-emerald-300" : "border-border"
              }`}
            >
              {step.done && <Check className="size-3" />}
            </span>
            <span className={step.done ? "text-muted-foreground line-through" : ""}>{step.label}</span>
            {!step.done && <span className="ml-auto">{step.action}</span>}
            <span className="sr-only">{step.done ? "(feito)" : "(pendente)"}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
