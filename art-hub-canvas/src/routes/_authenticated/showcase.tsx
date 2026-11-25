import { createFileRoute, redirect } from "@tanstack/react-router";

// A antiga vitrine virou o feed Publicações e o portfólio do perfil (V3).
export const Route = createFileRoute("/_authenticated/showcase")({
  beforeLoad: () => {
    throw redirect({ to: "/publicacoes" });
  },
});
