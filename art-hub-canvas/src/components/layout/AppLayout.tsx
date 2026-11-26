import { useState, type ReactNode } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, LogIn, Menu, Plus } from "lucide-react";

import {
  CountBadge,
  isActive,
  NavRail,
  navItems,
  useMenuCounts,
  usePublish,
  type MenuCounts,
} from "@/components/layout/AppSidebar";
import { DefaultAside } from "@/components/layout/RightAside";
import { UserAvatar } from "@/components/posts/PostCard";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/AuthContext";

/**
 * Moldura de todas as telas, no padrão das redes sociais (três colunas centralizadas):
 *  - navegação: 275px com rótulos (≥1280px) ou 88px só com ícones (640–1280px); no celular, barra inferior + gaveta;
 *  - conteúdo: coluna de 600px com bordas laterais e o título fixo no topo da própria coluna;
 *  - lateral: 350px (≥1024px) com busca e cartões (ou `aside` próprio da tela).
 * `layout="wide"` junta conteúdo e lateral numa coluna de 980px (quadro, tarefa, grade do Explorar, conta).
 * `flush` tira o espaçamento interno (listas e telas que encostam nas bordas, como no feed).
 */
export function AppLayout({
  title,
  subtitle,
  back = false,
  wide = false,
  layout,
  flush,
  aside,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  /** Atalho antigo: o mesmo que layout="wide" com flush. */
  wide?: boolean;
  layout?: "column" | "wide";
  flush?: boolean;
  aside?: ReactNode;
  /** Botões à direita do título (ex.: "Marcar todas como lidas"). */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const counts = useMenuCounts(Boolean(user));
  const [drawer, setDrawer] = useState(false);
  const mode = layout ?? (wide ? "wide" : "column");
  const noPadding = flush ?? wide;

  return (
    <div className="flex min-h-screen justify-center bg-background">
      <header className="hidden w-[88px] shrink-0 sm:block xl:w-[275px]">
        <div className="sticky top-0 h-screen overflow-y-auto">
          <NavRail counts={counts} />
        </div>
      </header>

      <div className="flex w-full min-w-0 sm:w-auto">
        <main
          className={`min-h-screen w-full min-w-0 border-border pb-24 sm:border-x sm:pb-0 ${
            mode === "wide" ? "sm:w-[min(980px,calc(100vw-88px))]" : "sm:w-[min(600px,calc(100vw-88px))]"
          }`}
        >
          <div className="sticky top-0 z-20 flex h-[53px] items-center gap-4 border-b border-border bg-background/85 px-4 backdrop-blur-md">
            <MobileMenuButton onOpen={() => setDrawer(true)} />
            {back && (
              <button
                type="button"
                aria-label="Voltar"
                onClick={() =>
                  window.history.length > 1 ? router.history.back() : router.navigate({ to: "/explorar" })
                }
                className="-ml-2 rounded-full p-2 hover:bg-white/10"
              >
                <ArrowLeft className="size-5" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl leading-6 font-bold">{title}</h1>
              {subtitle && <p className="truncate text-[13px] leading-4 text-muted-foreground">{subtitle}</p>}
            </div>
            {actions}
          </div>
          <div className={`fade-up ${noPadding ? "" : "p-4"}`}>{children}</div>
        </main>

        {mode === "column" && (
          <aside className="ml-[30px] hidden w-[350px] shrink-0 lg:block">
            <div className="sticky top-0 space-y-4 py-3">{aside ?? <DefaultAside />}</div>
          </aside>
        )}
      </div>

      <MobileNav counts={counts} />
      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side="left" className="w-[300px] border-border bg-background p-0 sm:hidden">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">Navegação do WorkAt</SheetDescription>
          <div className="h-full overflow-y-auto pt-2">
            <NavRail counts={counts} inDrawer onNavigate={() => setDrawer(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** No celular, a foto (ou o ícone de menu) no topo abre a gaveta com o menu completo. */
function MobileMenuButton({ onOpen }: { onOpen: () => void }) {
  const { user } = useAuth();
  return (
    <button type="button" aria-label="Abrir menu" onClick={onOpen} className="-ml-1 rounded-full sm:hidden">
      {user ? (
        <UserAvatar name={user.fullName ?? user.username} src={user.avatarUrl} size="sm" />
      ) : (
        <span className="flex size-8 items-center justify-center rounded-full hover:bg-white/10">
          <Menu className="size-5" />
        </span>
      )}
    </button>
  );
}

/** Barra inferior do celular: Início, Explorar, Publicar, Notificações e Perfil. */
function MobileNav({ counts }: { counts: MenuCounts }) {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { openComposer, composer } = usePublish();
  const all = navItems(user?.username ?? null, counts);
  const pick = (url: string) => all.find((item) => item.url === url || item.url.startsWith(url));
  const slots = user
    ? [pick("/publicacoes"), pick("/explorar"), null, pick("/notificacoes"), pick("/u/")]
    : [pick("/publicacoes"), pick("/explorar")];

  return (
    <nav
      aria-label="Navegação"
      className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-background/90 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:hidden"
    >
      {slots.map((item, index) =>
        item === null ? (
          <button
            key="publicar"
            type="button"
            aria-label="Publicar"
            onClick={openComposer}
            className="gradient-primary flex size-11 items-center justify-center rounded-full text-primary-foreground"
          >
            <Plus className="size-6" />
          </button>
        ) : item ? (
          <Link
            key={item.url}
            to={item.url}
            aria-label={item.title}
            aria-current={isActive(pathname, item.url) ? "page" : undefined}
            className="flex flex-col items-center rounded-full px-3 py-1.5"
          >
            <span className="relative">
              <item.icon className={`size-[26px] ${isActive(pathname, item.url) ? "stroke-[2.6]" : "stroke-[1.75]"}`} />
              <CountBadge value={item.badge} />
            </span>
          </Link>
        ) : (
          <span key={index} />
        ),
      )}
      {!user && (
        <Link
          to="/login"
          className="gradient-primary flex items-center gap-1 rounded-full px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          <LogIn className="size-4" /> Entrar
        </Link>
      )}
      {user && composer}
    </nav>
  );
}
