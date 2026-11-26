import { useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";

import { getSlowRequestCount, subscribeSlowRequests } from "@/lib/api";

/**
 * Aviso quando o backend demora a responder. No plano grátis ele dorme sem uso e leva até
 * 1 minuto para acordar; sem este aviso a tela parece travada.
 */
export function ServerWakeNotice() {
  const slow = useSyncExternalStore(subscribeSlowRequests, getSlowRequestCount, () => 0);
  if (slow === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex justify-center px-4"
    >
      <div className="glass flex max-w-md items-start gap-3 rounded-2xl border border-border px-4 py-3 text-sm shadow-lg">
        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
        <div>
          <p className="font-medium">Acordando o servidor…</p>
          <p className="text-xs text-muted-foreground">
            Quando ninguém usa por um tempo, ele entra em repouso. A primeira resposta pode levar
            até 1 minuto; depois fica rápido.
          </p>
        </div>
      </div>
    </div>
  );
}
