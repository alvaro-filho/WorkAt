import { createFileRoute, Outlet } from "@tanstack/react-router";

import { useAuth } from "@/lib/AuthContext";

/**
 * Páginas abertas a qualquer pessoa: perfil (/u/...), Publicações e a visão pública do projeto.
 * Quem tem login vê tudo como antes; quem não tem vê só o que é público e um convite para entrar.
 * Os links de portfólio funcionam para quem os recebe, sem exigir conta.
 */
export const Route = createFileRoute("/_public")({
  component: PublicLayout,
});

function PublicLayout() {
  const { isLoading } = useAuth();

  // Espera restaurar a sessão para não piscar a versão "sem login" para quem já entrou.
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return <Outlet />;
}
