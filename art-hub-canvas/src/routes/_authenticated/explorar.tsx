import { createFileRoute, redirect } from "@tanstack/react-router";

// O Explorar virou o feed Publicações (V3).
export const Route = createFileRoute("/_authenticated/explorar")({
  beforeLoad: () => {
    throw redirect({ to: "/publicacoes" });
  },
});
