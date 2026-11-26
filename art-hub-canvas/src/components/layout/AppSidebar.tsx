import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  FolderKanban,
  ListTodo,
  LogIn,
  LogOut,
  Newspaper,
  Palette,
  Settings,
  UserPlus,
  UserRound,
} from "lucide-react";

import { UserAvatar } from "@/components/posts/PostCard";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

/** De quanto em quanto tempo o menu confere avisos e convites novos. */
const COUNTS_POLL_MS = 60_000;

/** Avisos não lidos e convites pendentes, para os números do menu. */
function useMenuCounts(enabled: boolean, pathname: string) {
  const [counts, setCounts] = useState({ notifications: 0, invitations: 0 });

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

export function AppSidebar() {
  const { state } = useSidebar();
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const counts = useMenuCounts(Boolean(user), pathname);
  const profileUrl = user ? `/u/${user.username}` : "/dashboard";

  // Sem login (perfil ou feed aberto por link): só o que é público.
  const items = user
    ? [
        { title: "Meu perfil", url: profileUrl, icon: UserRound, badge: 0 },
        { title: "Minhas tarefas", url: "/minhas-tarefas", icon: ListTodo, badge: 0 },
        { title: "Projetos", url: "/projetos", icon: FolderKanban, badge: counts.invitations },
        { title: "Publicações", url: "/publicacoes", icon: Newspaper, badge: 0 },
        { title: "Notificações", url: "/notificacoes", icon: Bell, badge: counts.notifications },
      ]
    : [{ title: "Publicações", url: "/publicacoes", icon: Newspaper, badge: 0 }];

  const handleLogout = () => {
    logout();
    navigate({ to: "/login", replace: true });
  };

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-3">
          <div className="gradient-primary flex size-9 shrink-0 items-center justify-center rounded-xl shadow-[var(--shadow-glow)]">
            <Palette className="size-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <p className="text-sm font-semibold">WorkAt</p>
              <p className="text-xs text-muted-foreground">Portfólio e produção</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url || pathname.startsWith(`${item.url}/`)}
                    tooltip={item.badge ? `${item.title} (${item.badge})` : item.title}
                  >
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.badge > 0 && (
                    <SidebarMenuBadge
                      aria-label={`${item.badge} novos`}
                      className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground"
                    >
                      {item.badge > 99 ? "99+" : item.badge}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 p-3">
        {!user ? (
          collapsed ? (
            <Link
              to="/login"
              aria-label="Entrar"
              className="flex justify-center rounded-xl p-2 text-muted-foreground hover:text-foreground"
            >
              <LogIn className="size-4" />
            </Link>
          ) : (
            <div className="glass space-y-2 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">
                Crie sua conta para montar seu portfólio e trabalhar em projetos.
              </p>
              <Button asChild size="sm" className="gradient-primary w-full text-primary-foreground">
                <Link to="/login">
                  <LogIn className="mr-1 size-4" /> Entrar
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link to="/login" search={{ modo: "cadastro" }}>
                  <UserPlus className="mr-1 size-4" /> Criar conta
                </Link>
              </Button>
            </div>
          )
        ) : (
          <div className="glass flex items-center gap-3 rounded-xl p-2">
            <UserAvatar name={user.fullName ?? user.username} src={user.avatarUrl} size="sm" />
            {!collapsed && (
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm font-medium">{user.fullName ?? user.username}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.role === "COMPANY" ? "Empresa / Estúdio" : "Artista / Freelancer"}
                </p>
              </div>
            )}
            {!collapsed && (
              <Link
                to="/conta"
                aria-label="Minha conta"
                title="Minha conta"
                className="text-muted-foreground hover:text-foreground"
              >
                <Settings className="size-4" />
              </Link>
            )}
            {!collapsed && (
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sair"
                title="Sair"
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="size-4" />
              </button>
            )}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
