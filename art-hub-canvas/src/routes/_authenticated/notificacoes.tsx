import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";

import { refreshMenuCounts } from "@/components/layout/AppSidebar";
import { AppLayout } from "@/components/layout/AppLayout";
import { relativeTime } from "@/components/posts/PostCard";
import { Button } from "@/components/ui/button";
import { api, type AppNotification } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  head: () => ({ meta: [{ title: "Notificações — WorkAt" }] }),
  component: NotificationsPage,
});

/** Avisos: convites, tarefas atribuídas, revisões, comentários e prazos. */
function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const now = Date.now();

  const load = async () => {
    try {
      const data = await api.notifications();
      setItems(data.items);
      setUnread(data.unread);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const open = async (item: AppNotification) => {
    if (!item.read) {
      try {
        await api.readNotification(item.id);
        refreshMenuCounts();
      } catch {
        // Abrir o link é mais importante do que marcar como lida.
      }
    }
    if (item.link) void navigate({ to: item.link });
    else void load();
  };

  const readAll = async () => {
    try {
      await api.readAllNotifications();
      refreshMenuCounts();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível marcar como lidas.");
    }
  };

  return (
    <AppLayout title="Notificações" subtitle={unread ? `${unread} não lida(s)` : "Tudo em dia"}>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" disabled={unread === 0} onClick={() => void readAll()}>
            <CheckCheck className="mr-1 size-4" /> Marcar todas como lidas
          </Button>
        </div>
        {error && (
          <div role="alert" className="glass rounded-2xl p-4 text-sm text-destructive">
            {error}
          </div>
        )}
        {items === null && !error && <div className="glass h-40 animate-pulse rounded-2xl" />}
        {items && items.length === 0 && (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
            <Bell className="mx-auto mb-2 size-6" />
            Nenhum aviso ainda. Convites, tarefas novas, revisões e prazos aparecem aqui.
          </div>
        )}
        {items && items.length > 0 && (
          <ul className="glass divide-y divide-border overflow-hidden rounded-2xl">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void open(item)}
                  className={`flex w-full items-start gap-3 p-4 text-left hover:bg-white/[0.03] ${item.read ? "" : "bg-primary/[0.06]"}`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${item.read ? "bg-transparent" : "bg-primary"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${item.read ? "text-muted-foreground" : "font-medium"}`}>
                      {item.message}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {relativeTime(item.createdAt, now)}
                      {!item.read && <span className="sr-only"> · não lida</span>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  );
}
