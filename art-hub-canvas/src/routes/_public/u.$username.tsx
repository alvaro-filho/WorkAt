import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Check, ExternalLink, Globe, Link2, Lock } from "lucide-react";

import { ArtImage } from "@/components/art/ArtPieces";
import { ActivityHeatmap } from "@/components/dashboard/ActivityHeatmap";
import { AppLayout } from "@/components/layout/AppLayout";
import { DefaultAside } from "@/components/layout/RightAside";
import { PostCard } from "@/components/posts/PostCard";
import { PostComposer } from "@/components/posts/PostComposer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, ApiError, type Post, type Profile, type ProfileProject } from "@/lib/api";
import { projectTypeInfo, roleLabel } from "@/lib/project-labels";

export const Route = createFileRoute("/_public/u/$username")({
  head: () => ({ meta: [{ title: "Perfil — WorkAt" }] }),
  component: ProfilePage,
});

type Tab = "posts" | "portfolio" | "projects" | "activity";

/**
 * Perfil no estilo das redes sociais: capa, foto sobre a capa, bio, links e abas.
 * Visitantes (com ou sem login) veem só o que é público; projetos com NDA aparecem mascarados.
 */
function ProfilePage() {
  const { username } = Route.useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("posts");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    setProfile(null);
    setNotFound(false);
    setError(null);
    setTab("posts");
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
      current ? { ...current, posts: [post, ...current.posts], portfolio: [post, ...current.portfolio] } : current,
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
      <AppLayout title="Perfil" back>
        <div className="mx-auto max-w-md rounded-2xl border border-border p-8 text-center">
          <p className="font-semibold">{error ?? "Esta conta não existe."}</p>
          <Link to="/explorar" className="mt-3 inline-block text-sm text-primary hover:underline">
            Ir para Explorar
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout title="Perfil" flush>
        <div>
          <div className="aspect-[3/1] animate-pulse bg-white/5" />
          <div className="space-y-3 p-4">
            <div className="-mt-16 size-32 animate-pulse rounded-full bg-white/10" />
            <div className="h-6 w-48 animate-pulse rounded bg-white/10" />
          </div>
        </div>
      </AppLayout>
    );
  }

  const { user } = profile;
  const isCompany = user.role === "COMPANY";
  const totalProjects = profile.projects.length + profile.hiddenPersonalProjects;
  const publicProjects = profile.projects.filter(
    (project): project is ProfileProject & { id: number } => project.publicView && project.id !== null,
  );

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie o link do perfil:", window.location.href);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "posts", label: "Posts" },
    { id: "portfolio", label: "Portfólio" },
    { id: "projects", label: "Projetos" },
    { id: "activity", label: "Atividade" },
  ];

  return (
    <AppLayout
      title={user.fullName}
      subtitle={`${profile.posts.length} ${profile.posts.length === 1 ? "publicação" : "publicações"}`}
      back={!profile.me}
      flush
      aside={
        <DefaultAside
          extra={profile.me ? <FirstSteps profile={profile} onPublish={() => setComposerOpen(true)} /> : undefined}
        />
      }
    >
      {/* Capa: 3:1 (200px de altura na coluna de 600px) */}
      <div className="aspect-[3/1] w-full overflow-hidden bg-gradient-to-br from-primary/60 via-primary/20 to-neon/30">
        {profile.bannerUrl && <img src={profile.bannerUrl} alt="" className="size-full object-cover" />}
      </div>

      <div className="px-4 pt-3">
        {/* Foto sobre a capa (metade para fora) e a ação principal à direita */}
        <div className="flex items-start justify-between gap-3">
          <div className="relative z-10 -mt-[clamp(40px,11vw,70px)] shrink-0">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={`Foto de ${user.fullName}`}
                className="size-[clamp(80px,22vw,134px)] rounded-full border-4 border-background bg-background object-cover"
              />
            ) : (
              <div className="gradient-primary flex size-[clamp(80px,22vw,134px)] items-center justify-center rounded-full border-4 border-background text-[clamp(28px,7vw,48px)] font-bold text-primary-foreground">
                {user.fullName.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          {profile.me ? (
            <Button asChild variant="outline" className="h-9 rounded-full px-4 font-bold">
              <Link to="/conta">Editar perfil</Link>
            </Button>
          ) : (
            <Button variant="outline" className="h-9 rounded-full px-4 font-bold" onClick={() => void share()}>
              {copied ? <Check className="mr-1 size-4" /> : <Link2 className="mr-1 size-4" />}
              {copied ? "Link copiado" : "Compartilhar"}
            </Button>
          )}
        </div>

        {/* Identidade */}
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-xl leading-6 font-extrabold">{user.fullName}</h2>
            <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              {isCompany ? "Estúdio" : "Artista"}
            </span>
          </div>
          <p className="text-[15px] text-muted-foreground">@{user.username}</p>
        </div>

        {profile.bio && <p className="mt-3 text-[15px] leading-5 whitespace-pre-wrap">{profile.bio}</p>}

        {profile.specialties.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Especialidades">
            {profile.specialties.map((item) => (
              <li key={item} className="rounded-full bg-white/[0.08] px-3 py-1 text-[13px]">
                {item}
              </li>
            ))}
          </ul>
        )}

        {/* Linha de informações */}
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[15px] text-muted-foreground">
          {profile.links.map((link) => (
            <li key={link} className="min-w-0">
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex max-w-full items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="size-[18px] shrink-0 text-muted-foreground" />
                <span className="truncate">{link.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>
              </a>
            </li>
          ))}
          {profile.memberSince && (
            <li className="inline-flex items-center gap-1">
              <CalendarDays className="size-[18px]" />
              Entrou em {new Date(profile.memberSince).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </li>
          )}
        </ul>

        {/* Números */}
        <p className="mt-3 flex gap-5 text-[15px]">
          <button type="button" onClick={() => setTab("posts")} className="hover:underline">
            <span className="font-bold">{profile.posts.length}</span>{" "}
            <span className="text-muted-foreground">publicações</span>
          </button>
          <button type="button" onClick={() => setTab("projects")} className="hover:underline">
            <span className="font-bold">{totalProjects}</span> <span className="text-muted-foreground">projetos</span>
          </button>
        </p>
      </div>

      {profile.me && (
        <div className="px-4 pt-4 lg:hidden">
          <FirstSteps profile={profile} onPublish={() => setComposerOpen(true)} />
        </div>
      )}

      {/* Abas: o traço fica do tamanho do rótulo */}
      <div role="tablist" aria-label="Seções do perfil" className="mt-4 flex border-b border-border">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className="flex h-[53px] flex-1 items-center justify-center text-[15px] transition-colors hover:bg-white/[0.06]"
          >
            <span
              className={`relative flex h-full items-center ${tab === item.id ? "font-bold text-foreground" : "font-medium text-muted-foreground"}`}
            >
              {item.label}
              {tab === item.id && (
                <span className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-primary" aria-hidden="true" />
              )}
            </span>
          </button>
        ))}
      </div>

      {tab === "posts" &&
        (profile.posts.length === 0 ? (
          <EmptyTab
            title={profile.me ? "Você ainda não publicou nada" : "Nenhuma publicação ainda"}
            text={
              profile.me
                ? "Use o botão Publicar no menu, ou ligue o WIP automático em um projeto."
                : "Quando esta conta publicar algo, aparece aqui."
            }
          />
        ) : (
          <ol className="divide-y divide-border border-b border-border" aria-label="Posts">
            {profile.posts.map((post) => (
              <PostCard key={post.id} post={post} now={now} onChanged={changePost} onDeleted={removePost} />
            ))}
          </ol>
        ))}

      {tab === "portfolio" &&
        (profile.portfolio.length === 0 && publicProjects.length === 0 ? (
          <EmptyTab
            title="Portfólio vazio"
            text={
              profile.me
                ? "Publique artes ou abra um projeto ao público para montar seu portfólio."
                : "Ainda não há nada no portfólio."
            }
          />
        ) : (
          <div>
            {profile.portfolio.length > 0 && (
              <ul className="grid grid-cols-3 gap-0.5" aria-label="Artes">
                {profile.portfolio
                  .filter((post) => post.images.length > 0)
                  .map((post) => (
                    <li key={post.id}>
                      <Link
                        to="/publicacao/$postId"
                        params={{ postId: String(post.id) }}
                        className="group block aspect-square overflow-hidden bg-white/5"
                        aria-label={post.title ?? "Arte"}
                      >
                        <ArtImage
                          src={post.images[0]?.url ?? null}
                          title={post.title ?? "Arte"}
                          className="size-full object-cover transition-transform group-hover:scale-105"
                        />
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
            {publicProjects.length > 0 && (
              <section aria-labelledby="public-projects-title" className="border-t border-border p-4">
                <h3 id="public-projects-title" className="mb-3 text-xl font-extrabold">
                  Projetos públicos
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {publicProjects.map((project) => (
                    <Link
                      key={project.id}
                      to="/projetos/$projectId/publico"
                      params={{ projectId: String(project.id) }}
                      className="block overflow-hidden rounded-2xl border border-border hover:bg-white/[0.03]"
                    >
                      <ArtImage src={project.coverUrl} title={project.name ?? "Projeto"} className="h-36 w-full object-cover" />
                      <div className="p-3">
                        <p className="truncate text-[15px] font-bold">{project.name}</p>
                        <p className="truncate text-[13px] text-muted-foreground">
                          {projectTypeInfo(project.type).label}
                          {project.role === "MEMBER" && project.ownerName ? ` · de ${project.ownerName}` : ""}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        ))}

      {tab === "projects" && (
        <div className="p-4">
          {totalProjects === 0 ? (
            <EmptyTab title="Nenhum projeto ainda" text="" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {profile.projects.map((project, index) => (
                <ProjectCard key={project.id ?? `nda-${index}`} project={project} me={profile.me} />
              ))}
            </div>
          )}
          {profile.hiddenPersonalProjects > 0 && (
            <p className="mt-3 text-[13px] text-muted-foreground">
              + {profile.hiddenPersonalProjects}{" "}
              {profile.hiddenPersonalProjects === 1 ? "projeto pessoal" : "projetos pessoais"} (privados)
            </p>
          )}
        </div>
      )}

      {tab === "activity" && (
        <section aria-label="Atividade" className="p-4">
          <ActivityHeatmap data={heatmap} />
        </section>
      )}
      {profile.me && <PostComposer open={composerOpen} onOpenChange={setComposerOpen} onCreated={addPost} />}
    </AppLayout>
  );
}

function EmptyTab({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto max-w-sm px-4 py-12 text-center">
      <p className="text-2xl font-extrabold">{title}</p>
      {text && <p className="mt-2 text-sm text-muted-foreground">{text}</p>}
    </div>
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
