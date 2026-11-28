import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Compass,
  FolderKanban,
  Home,
  ListTodo,
  LogIn,
  LogOut,
  MoreHorizontal,
  Palette,
  PenLine,
  Settings,
  ShieldCheck,
  UserPlus,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { PostComposer } from "@/components/posts/PostComposer";
import { UserAvatar } from "@/components/posts/PostCard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

/** De quanto em quanto tempo o menu confere avisos e convites novos. */
const COUNTS_POLL_MS = 60_000;

export type MenuCounts = { notifications: number; invitations: number };

/** Avisos não lidos e convites pendentes, para os números do menu. */
export function useMenuCounts(enabled: boolean): MenuCounts {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [counts, setCounts] = useState<MenuCounts>({ notifications: 0, invitations: 0 });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const load = async () => {
      try {
        const [unread, invitations] = await Promise.all([
          api.unreadNotifications(),
          api.myInvitations(),
        ]);
        if (active) setCounts({ notifications: unread.unread, invitations: invitations.length });
      } catch {
        // Sem conexão: mantém os números anteriores.
      }
    };
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, COUNTS_POLL_MS);
    const refresh = () => void load();
    window.addEventListener("workat:counts-changed", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("workat:counts-changed", refresh);
    };
  }, [enabled, pathname]);

  return counts;
}

/** Avisa o menu para recontar (ex.: depois de ler avisos ou responder um convite). */
export function refreshMenuCounts() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("workat:counts-changed"));
}

export type NavItem = { title: string; url: string; icon: LucideIcon; badge?: number };

/** Itens da navegação principal (mesmos no menu, na gaveta e na barra do celular). */
export function navItems(username: string | null, counts: MenuCounts): NavItem[] {
  if (!username) {
    return [
      { title: "Início", url: "/publicacoes", icon: Home },
      { title: "Explorar", url: "/explorar", icon: Compass },
    ];
  }
  return [
    { title: "Início", url: "/publicacoes", icon: Home },
    { title: "Explorar", url: "/explorar", icon: Compass },
    { title: "Notificações", url: "/notificacoes", icon: Bell, badge: counts.notifications },
    { title: "Minhas tarefas", url: "/minhas-tarefas", icon: ListTodo },
    { title: "Projetos", url: "/projetos", icon: FolderKanban, badge: counts.invitations },
    { title: "Perfil", url: `/u/${username}`, icon: UserRound },
    { title: "Conta", url: "/conta", icon: Settings },
  ];
}

export function isActive(pathname: string, url: string) {
  return pathname === url || pathname.startsWith(`${url}/`);
}

/** Bolinha com número, no canto do ícone. */
export function CountBadge({ value }: { value?: number | undefined }) {
  if (!value) return null;
  return (
    <span
      aria-label={`${value} novos`}
      className="absolute -top-1.5 -right-2 min-w-[18px] rounded-full bg-primary px-1 text-center text-[11px] leading-[18px] font-bold text-primary-foreground"
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}

/** Abre o compositor de publicação de qualquer tela e leva à publicação criada. */
export function usePublish() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const composer = (
    <PostComposer
      open={open}
      onOpenChange={setOpen}
      onCreated={(post) => {
        setOpen(false);
        void navigate({ to: "/publicacao/$postId", params: { postId: String(post.id) } });
      }}
    />
  );
  return { openComposer: () => setOpen(true), composer };
}

/**
 * Coluna de navegação (computador e tablet): logo, itens grandes, botão Publicar e a conta no rodapé.
 * Com rótulos a partir de 1280px; só ícones entre 640px e 1280px. `inDrawer` = versão da gaveta do celular.
 */
export function NavRail({
  counts,
  inDrawer = false,
  onNavigate,
}: {
  counts: MenuCounts;
  inDrawer?: boolean;
  onNavigate?: () => void;
}) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const items = navItems(user?.username ?? null, counts);
  // Painel de administração: o link só aparece para quem está na lista de administradores do servidor.
  if (user?.admin) items.push({ title: "Administração", url: "/admin", icon: ShieldCheck });
  const { openComposer, composer } = usePublish();
  // Na gaveta sempre com rótulos; na coluna, os rótulos aparecem só a partir de xl.
  const label = inDrawer ? "inline" : "hidden xl:inline";
  const align = inDrawer ? "items-stretch" : "items-center xl:items-stretch";

  const handleLogout = () => {
    logout();
    onNavigate?.();
    navigate({ to: "/login", replace: true });
  };

  return (
    <div className={`flex h-full flex-col ${align} px-2 xl:px-3`}>
      <Link
        to={user ? "/publicacoes" : "/explorar"}
        onClick={onNavigate}
        aria-label="WorkAt, início"
        className="my-1 flex w-fit items-center gap-3 rounded-full p-3 hover:bg-white/10"
      >
        <span className="gradient-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
          <Palette className="size-5 text-primary-foreground" />
        </span>
        <span className={`${label} text-xl font-extrabold tracking-tight`}>WorkAt</span>
      </Link>

      <nav aria-label="Navegação principal" className="mt-1 flex flex-col gap-0.5">
        {items.map((item) => {
          const active = isActive(pathname, item.url);
          return (
            <Link
              key={item.url}
              to={item.url}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={item.title}
              className="group flex w-fit items-center"
            >
              <span className="flex items-center gap-5 rounded-full p-3 transition-colors group-hover:bg-white/10">
                <span className="relative">
                  <item.icon
                    className={`size-[26px] ${active ? "stroke-[2.6]" : "stroke-[1.75]"}`}
                  />
                  <CountBadge value={item.badge} />
                </span>
                <span className={`${label} pr-4 text-xl ${active ? "font-bold" : "font-normal"}`}>
                  {item.title}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      {user ? (
        <div className="my-4">
          <Button
            onClick={() => {
              onNavigate?.();
              openComposer();
            }}
            aria-label="Publicar"
            title="Publicar"
            className={`gradient-primary h-[52px] rounded-full text-[17px] font-bold text-primary-foreground ${
              inDrawer ? "w-full" : "w-[52px] p-0 xl:w-[90%] xl:px-8"
            }`}
          >
            <PenLine className={`size-6 ${inDrawer ? "hidden" : "xl:hidden"}`} />
            <span className={label}>Publicar</span>
          </Button>
        </div>
      ) : (
        <div
          className={`my-4 space-y-2 ${inDrawer ? "" : "hidden xl:block"} rounded-2xl border border-border p-4`}
        >
          <p className="text-[17px] font-extrabold">Novo por aqui?</p>
          <p className="text-sm text-muted-foreground">
            Crie sua conta para montar seu portfólio e trabalhar em projetos.
          </p>
          <Button
            asChild
            className="gradient-primary w-full rounded-full font-bold text-primary-foreground"
          >
            <Link to="/login" search={{ modo: "cadastro" }} onClick={onNavigate}>
              <UserPlus className="mr-1 size-4" /> Criar conta
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full rounded-full font-bold">
            <Link to="/login" onClick={onNavigate}>
              <LogIn className="mr-1 size-4" /> Entrar
            </Link>
          </Button>
        </div>
      )}
      {!user && !inDrawer && (
        <Link
          to="/login"
          aria-label="Entrar"
          title="Entrar"
          className="my-4 flex size-[52px] items-center justify-center rounded-full border border-border hover:bg-white/10 xl:hidden"
        >
          <LogIn className="size-6" />
        </Link>
      )}

      {user && (
        <div className="mt-auto mb-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Conta e opções"
                className="flex w-full items-center gap-3 rounded-full p-3 text-left hover:bg-white/10"
              >
                <UserAvatar name={user.fullName ?? user.username} src={user.avatarUrl} size="md" />
                <span
                  className={`${inDrawer ? "flex" : "hidden xl:flex"} min-w-0 flex-1 items-center gap-2`}
                >
                  <span className="min-w-0 flex-1 leading-5">
                    <span className="block truncate text-[15px] font-bold">
                      {user.fullName ?? user.username}
                    </span>
                    <span className="block truncate text-[15px] text-muted-foreground">
                      @{user.username}
                    </span>
                  </span>
                  <MoreHorizontal className="size-5 shrink-0" />
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-64">
              <DropdownMenuItem asChild>
                <Link to="/u/$username" params={{ username: user.username }} onClick={onNavigate}>
                  <UserRound className="mr-2 size-4" /> Meu perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/conta" onClick={onNavigate}>
                  <Settings className="mr-2 size-4" /> Minha conta
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleLogout} className="font-bold">
                <LogOut className="mr-2 size-4" /> Sair de @{user.username}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      {user && composer}
    </div>
  );
}
