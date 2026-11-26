import { createFileRoute, redirect } from "@tanstack/react-router";

// O Explorar virou o feed Publicações (V3).
export const Route = createFileRoute("/_public/explorar")({
  beforeLoad: () => {
    throw redirect({ to: "/publicacoes" });
  },
});
