import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bookmark,
  CalendarDays,
  Check,
  ExternalLink,
  Globe,
  Layers,
  Link2,
  Lock,
} from "lucide-react";

import { ArtImage } from "@/components/art/ArtPieces";
import { ActivityHeatmap } from "@/components/dashboard/ActivityHeatmap";
import { AppLayout } from "@/components/layout/AppLayout";
import { DefaultAside } from "@/components/layout/RightAside";
import { PostCard } from "@/components/posts/PostCard";
import { PostComposer } from "@/components/posts/PostComposer";
import { Button } from "@/components/ui/button";
import { api, ApiError, type Post, type Profile, type ProfileProject } from "@/lib/api";
import { projectTypeInfo } from "@/lib/project-labels";

export const Route = createFileRoute("/_public/u/$username")({
  head: () => ({ meta: [{ title: "Perfil — WorkAt" }] }),
  component: ProfilePage,
});

type Tab = "portfolio" | "projects" | "posts" | "saved";

type PortfolioItem =
  | { kind: "post"; post: Post; date: string }
  | { kind: "project"; project: ProfileProject & { id: number }; date: string };

/**
 * Perfil profissional: capa, foto, nome, atividade logo abaixo do nome e as abas
 * Portfólio (abre primeiro), Projetos, Posts e Salvos (só a própria pessoa).
 * Visitantes veem só o que é público; projetos sob NDA aparecem mascarados.
 */
function ProfilePage() {
  const { username } = Route.useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("portfolio");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    setProfile(null);
    setNotFound(false);
    setError(null);
    setTab("portfolio");
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

  /** Uma publicação mudou (editada, curtida, republicada ou salva): atualiza todas as listas do perfil. */
  const changePost = (post: Post) =>
    setProfile((current) => {
      if (!current) return current;
      const swap = (list: Post[]) => list.map((item) => (item.id === post.id ? post : item));
      const isOwn = post.author.username === current.user.username;
      let portfolio = swap(current.portfolio);
      if (isOwn && post.kind === "STANDALONE") {
        portfolio = post.hiddenFromPortfolio
          ? portfolio.filter((item) => item.id !== post.id)
          : portfolio.some((item) => item.id === post.id)
            ? portfolio
            : [post, ...portfolio];
      }
      let reposts = current.reposts.map((item) =>
        item.post.id === post.id ? { ...item, post } : item,
      );
      let saved = swap(current.saved);
      if (current.me) {
        if (!post.reposted) reposts = reposts.filter((item) => item.post.id !== post.id);
        else if (!isOwn && !reposts.some((item) => item.post.id === post.id))
          reposts = [{ post, repostedAt: new Date().toISOString() }, ...reposts];
        if (!post.saved) saved = saved.filter((item) => item.id !== post.id);
        else if (!saved.some((item) => item.id === post.id)) saved = [post, ...saved];
      }
      return { ...current, posts: swap(current.posts), portfolio, reposts, saved };
    });
  const removePost = (postId: number) =>
    setProfile((current) =>
      current
        ? {
            ...current,
            posts: current.posts.filter((item) => item.id !== postId),
            portfolio: current.portfolio.filter((item) => item.id !== postId),
            saved: current.saved.filter((item) => item.id !== postId),
            reposts: current.reposts.filter((item) => item.post.id !== postId),
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

  // Portfólio: artes avulsas e projetos públicos no mesmo quadro, do mais recente para o mais antigo.
  const portfolio = useMemo<PortfolioItem[]>(() => {
    if (!profile) return [];
    const posts: PortfolioItem[] = profile.portfolio
      .filter((post) => post.images.length > 0)
      .map((post) => ({ kind: "post", post, date: post.createdAt }));
    const projects: PortfolioItem[] = profile.projects
      .filter(
        (project): project is ProfileProject & { id: number } =>
          project.publicView && project.id !== null,
      )
      .map((project) => ({ kind: "project", project, date: project.lastActivityAt ?? "" }));
    return [...posts, ...projects].sort((a, b) => b.date.localeCompare(a.date));
  }, [profile]);

  // Posts: o que a pessoa publicou e o que republicou, por data.
  const timeline = useMemo(() => {
    if (!profile) return [];
    return [
      ...profile.posts.map((post) => ({ post, date: post.createdAt, repost: false })),
      ...profile.reposts.map((item) => ({ post: item.post, date: item.repostedAt, repost: true })),
    ].sort((a, b) => b.date.localeCompare(a.date));
  }, [profile]);

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
  const artCount = portfolio.length;

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
    { id: "portfolio", label: "Portfólio" },
    { id: "projects", label: "Projetos" },
    { id: "posts", label: "Posts" },
    ...(profile.me ? [{ id: "saved" as const, label: "Salvos" }] : []),
  ];

  return (
    <AppLayout
      title={user.fullName}
      subtitle={`${artCount} ${artCount === 1 ? "trabalho" : "trabalhos"} no portfólio`}
      back={!profile.me}
      flush
      revealTitleAfter={260}
      aside={
        <DefaultAside
          extra={
            profile.me ? (
              <FirstSteps profile={profile} onPublish={() => setComposerOpen(true)} />
            ) : undefined
          }
        />
      }
    >
      {/* Capa 3:1 (o enquadramento é escolhido ao enviar, em Minha conta) */}
      <div className="aspect-[3/1] w-full overflow-hidden bg-gradient-to-br from-primary/60 via-primary/20 to-neon/30">
        {profile.bannerUrl && (
          <img src={profile.bannerUrl} alt="" className="size-full object-cover" />
        )}
      </div>

      <div className="px-4 pt-3">
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
            <Button
              variant="outline"
              className="h-9 rounded-full px-4 font-bold"
              onClick={() => void share()}
            >
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

        {/* Atividade logo abaixo do nome */}
        <section
          aria-label="Atividade de produção"
          className="mt-3 rounded-2xl border border-border p-3"
        >
          <ActivityHeatmap data={heatmap} variant="inline" />
        </section>

        {profile.bio && (
          <p className="mt-3 text-[15px] leading-5 whitespace-pre-wrap">{profile.bio}</p>
        )}

        {profile.specialties.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Especialidades">
            {profile.specialties.map((item) => (
              <li key={item} className="rounded-full bg-white/[0.08] px-3 py-1 text-[13px]">
                {item}
              </li>
            ))}
          </ul>
        )}

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
                <span className="truncate">
                  {link.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                </span>
              </a>
            </li>
          ))}
          {profile.memberSince && (
            <li className="inline-flex items-center gap-1">
              <CalendarDays className="size-[18px]" />
              Entrou em{" "}
              {new Date(profile.memberSince).toLocaleDateString("pt-BR", {
                month: "long",
                year: "numeric",
              })}
            </li>
          )}
        </ul>

        {/* Números */}
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[15px]">
          <button type="button" onClick={() => setTab("portfolio")} className="hover:underline">
            <span className="font-bold">{artCount}</span>{" "}
            <span className="text-muted-foreground">no portfólio</span>
          </button>
          <button type="button" onClick={() => setTab("projects")} className="hover:underline">
            <span className="font-bold">{totalProjects}</span>{" "}
            <span className="text-muted-foreground">
              {totalProjects === 1 ? "projeto" : "projetos"}
            </span>
          </button>
          <button type="button" onClick={() => setTab("posts")} className="hover:underline">
            <span className="font-bold">{profile.posts.length}</span>{" "}
            <span className="text-muted-foreground">
              {profile.posts.length === 1 ? "publicação" : "publicações"}
            </span>
          </button>
        </p>
      </div>

      {profile.me && (
        <div className="px-4 pt-4 lg:hidden">
          <FirstSteps profile={profile} onPublish={() => setComposerOpen(true)} />
        </div>
      )}

      <div
        role="tablist"
        aria-label="Seções do perfil"
        className="mt-4 flex border-b border-border"
      >
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
                <span
                  className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-primary"
                  aria-hidden="true"
                />
              )}
            </span>
          </button>
        ))}
      </div>

      {tab === "portfolio" &&
        (portfolio.length === 0 ? (
          <EmptyTab
            title="Portfólio vazio"
            text={
              profile.me
                ? "Publique artes ou abra um projeto ao público (WIP automático) para montar seu portfólio."
                : "Ainda não há nada no portfólio."
            }
          />
        ) : (
          <ul className="grid grid-cols-3 gap-0.5" aria-label="Portfólio">
            {portfolio.map((item) => (
              <PortfolioTile
                key={item.kind === "post" ? `p${item.post.id}` : `j${item.project.id}`}
                item={item}
              />
            ))}
          </ul>
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
              {profile.hiddenPersonalProjects === 1 ? "projeto pessoal" : "projetos pessoais"}{" "}
              (privados)
            </p>
          )}
        </div>
      )}

      {tab === "posts" &&
        (timeline.length === 0 ? (
          <EmptyTab
            title={profile.me ? "Você ainda não publicou nada" : "Nenhuma publicação ainda"}
            text={
              profile.me
                ? "Use o botão Publicar no menu, ou ligue o WIP automático em um projeto."
                : "Quando esta conta publicar ou republicar algo, aparece aqui."
            }
          />
        ) : (
          <ol className="divide-y divide-border border-b border-border" aria-label="Posts">
            {timeline.map((item) => (
              <PostCard
                key={`${item.repost ? "r" : "p"}${item.post.id}`}
                post={item.post}
                now={now}
                onChanged={changePost}
                onDeleted={removePost}
                {...(item.repost ? { repostedBy: profile.me ? "Você" : user.fullName } : {})}
              />
            ))}
          </ol>
        ))}

      {tab === "saved" &&
        profile.me &&
        (profile.saved.length === 0 ? (
          <EmptyTab
            title="Nada salvo ainda"
            text="Toque no marcador de uma publicação para guardar aqui. Só você vê seus itens salvos."
          />
        ) : (
          <>
            <p className="flex items-center gap-2 border-b border-border px-4 py-3 text-[13px] text-muted-foreground">
              <Bookmark className="size-4" /> Só você vê seus itens salvos.
            </p>
            <ol className="divide-y divide-border border-b border-border" aria-label="Salvos">
              {profile.saved.map((post) => (
                <PostCard key={post.id} post={post} now={now} onChanged={changePost} />
              ))}
            </ol>
          </>
        ))}
      {profile.me && (
        <PostComposer open={composerOpen} onOpenChange={setComposerOpen} onCreated={addPost} />
      )}
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

/** Um quadro do portfólio. Arte avulsa e projeto têm o mesmo formato; o projeto abre com todas as etapas. */
function PortfolioTile({ item }: { item: PortfolioItem }) {
  const title =
    item.kind === "post" ? (item.post.title ?? "Arte") : (item.project.name ?? "Projeto");
  const cover = item.kind === "post" ? (item.post.images[0]?.url ?? null) : item.project.coverUrl;
  const multiple = item.kind === "project" || (item.kind === "post" && item.post.images.length > 1);
  const body = (
    <>
      <ArtImage
        src={cover}
        title={title}
        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/0 to-black/0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate p-2 text-sm font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        {title}
      </span>
      {multiple && (
        <Layers
          className="pointer-events-none absolute top-2 right-2 size-4 text-white drop-shadow"
          aria-hidden="true"
        />
      )}
    </>
  );
  const className =
    "group relative block aspect-square overflow-hidden bg-white/5 focus-visible:outline-2 focus-visible:outline-primary";
  return (
    <li>
      {item.kind === "post" ? (
        <Link
          to="/publicacao/$postId"
          params={{ postId: String(item.post.id) }}
          className={className}
          aria-label={title}
        >
          {body}
        </Link>
      ) : (
        <Link
          to="/projetos/$projectId/publico"
          params={{ projectId: String(item.project.id) }}
          className={className}
          aria-label={`Projeto ${title}`}
        >
          {body}
        </Link>
      )}
    </li>
  );
}

/** Cartão de projeto: capa, título, descrição, tipo e diretor do projeto. */
function ProjectCard({ project, me }: { project: ProfileProject; me: boolean }) {
  const info = projectTypeInfo(project.type);
  const Icon = info.icon;
  const director = project.ownerName ?? "—";

  if (project.masked) {
    return (
      <div className="overflow-hidden rounded-2xl border border-dashed border-amber-500/40">
        <div className="flex h-36 items-center justify-center bg-amber-500/[0.06]">
          <Lock className="size-8 text-amber-300/80" />
        </div>
        <div className="p-3">
          <p className="text-[15px] font-bold">Projeto sob NDA</p>
          <p className="text-[13px] text-muted-foreground">
            O conteúdo é confidencial até a liberação.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-border px-2 py-0.5">{info.label}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 px-2 py-0.5 text-amber-300">
              <Lock className="size-3" /> NDA
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Diretor do projeto: <span className="text-foreground">{director}</span>
          </p>
        </div>
      </div>
    );
  }

  const body = (
    <>
      {project.coverUrl ? (
        <ArtImage
          src={project.coverUrl}
          title={project.name ?? "Projeto"}
          className="h-36 w-full object-cover"
        />
      ) : (
        <div className="flex h-36 items-center justify-center bg-white/[0.04]">
          <Icon className="size-8 text-muted-foreground" />
        </div>
      )}
      <div className="p-3">
        <p className="truncate text-[15px] font-bold">{project.name}</p>
        <p className="line-clamp-2 min-h-[2.5em] text-[13px] text-muted-foreground">
          {project.description || "Sem descrição."}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-border px-2 py-0.5">{info.label}</span>
          {project.nda && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 px-2 py-0.5 text-amber-300">
              <Lock className="size-3" /> NDA
            </span>
          )}
          {project.publicView && (
            <span className="inline-flex items-center gap-1 rounded-full border border-neon/40 px-2 py-0.5 text-neon">
              <Globe className="size-3" /> Público
            </span>
          )}
          {project.status === "CLOSED" && (
            <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
              Encerrado
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Diretor do projeto: <span className="text-foreground">{director}</span>
        </p>
      </div>
    </>
  );

  const className =
    "block overflow-hidden rounded-2xl border border-border transition-colors hover:bg-white/[0.03]";
  if (!me && project.publicView && project.id !== null) {
    return (
      <Link
        to="/projetos/$projectId/publico"
        params={{ projectId: String(project.id) }}
        className={className}
      >
        {body}
      </Link>
    );
  }
  if (me && project.id !== null) {
    return (
      <Link
        to="/projetos/$projectId"
        params={{ projectId: String(project.id) }}
        className={className}
      >
        {body}
      </Link>
    );
  }
  return <div className="overflow-hidden rounded-2xl border border-border">{body}</div>;
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
                step.done
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                  : "border-border"
              }`}
            >
              {step.done && <Check className="size-3" />}
            </span>
            <span className={step.done ? "text-muted-foreground line-through" : ""}>
              {step.label}
            </span>
            {!step.done && <span className="ml-auto">{step.action}</span>}
            <span className="sr-only">{step.done ? "(feito)" : "(pendente)"}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
