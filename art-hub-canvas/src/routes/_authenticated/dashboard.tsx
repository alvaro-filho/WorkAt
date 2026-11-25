import { createFileRoute, Navigate } from "@tanstack/react-router";

import { useAuth } from "@/lib/AuthContext";

// O antigo Início virou o perfil (portfólio, projetos e gráfico de atividade).
export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardRedirect,
});

function DashboardRedirect() {
  const { user } = useAuth();
  if (!user) return null;
  return <Navigate to="/u/$username" params={{ username: user.username }} replace />;
}
