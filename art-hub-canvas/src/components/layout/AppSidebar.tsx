import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { FolderKanban, LogOut, Newspaper, Palette, UserRound } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/AuthContext";

// O Kanban e o Canvas vivem dentro de cada projeto/tarefa, não na navegação global.

export function AppSidebar() {
  const { state } = useSidebar();
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  // Estilo GitHub: o perfil é a página inicial; o Kanban e o Canvas vivem dentro dos projetos.
  const profileUrl = user ? `/u/${user.username}` : "/dashboard";
  const items = [
    { title: "Meu perfil", url: profileUrl, icon: UserRound },
    { title: "Projetos", url: "/projetos", icon: FolderKanban },
    { title: "Publicações", url: "/publicacoes", icon: Newspaper },
  ];

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
                    tooltip={item.title}
                  >
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 p-3">
        <div className="glass flex items-center gap-3 rounded-xl p-2">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/20 text-xs text-foreground">
              {(user?.fullName ?? user?.username ?? "?")
                .split(/\s+/)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium">
                {user?.fullName ?? user?.username ?? "Usuário"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.role === "COMPANY" ? "Empresa / Estúdio" : "Artista / Freelancer"}
              </p>
            </div>
          )}
          {!collapsed && (
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sair"
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
