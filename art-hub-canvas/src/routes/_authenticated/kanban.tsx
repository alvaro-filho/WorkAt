import { createFileRoute, redirect } from "@tanstack/react-router";

// O Kanban agora fica dentro de cada projeto (/projetos/:id). Mantido só para links antigos.
export const Route = createFileRoute("/_authenticated/kanban")({
  beforeLoad: () => {
    throw redirect({ to: "/projetos" });
  },
});
