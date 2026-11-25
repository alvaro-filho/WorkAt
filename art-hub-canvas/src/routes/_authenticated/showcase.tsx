import { createFileRoute, redirect } from "@tanstack/react-router";

// A antiga aba "Vitrine & NDA" foi dividida: galeria pública em /explorar, liberação de NDA
// dentro do projeto corporativo (aba Vitrine) e envio a partir da imagem final da tarefa.
export const Route = createFileRoute("/_authenticated/showcase")({
  beforeLoad: () => {
    throw redirect({ to: "/explorar" });
  },
});
