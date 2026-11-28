import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ActionInput = { reason: string; days: number | null; password: string };

/**
 * Caixa de confirmação das ações do painel: motivo (vai para o registro, para a prova e, quando é o caso, para o
 * aviso da pessoa), prazo da suspensão e a senha nas ações sem volta.
 */
export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  askReason = true,
  askDays = false,
  askPassword = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  askReason?: boolean;
  askDays?: boolean;
  askPassword?: boolean;
  onConfirm: (input: ActionInput) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [days, setDays] = useState<string>("7");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setDays("7");
      setPassword("");
      setError(null);
    }
  }, [open]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (askReason && reason.trim().length < 3) {
      setError("Escreva o motivo (pelo menos 3 caracteres).");
      return;
    }
    if (askPassword && !password) {
      setError("Digite a sua senha para confirmar.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm({
        reason: reason.trim(),
        days: days === "none" ? null : Number(days),
        password,
      });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="border-border bg-card sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {askDays && (
            <div className="space-y-1">
              <Label htmlFor="admin-days">Por quanto tempo</Label>
              <select
                id="admin-days"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="1">1 dia</option>
                <option value="3">3 dias</option>
                <option value="7">7 dias</option>
                <option value="30">30 dias</option>
                <option value="90">90 dias</option>
                <option value="none">Sem prazo (até você reativar)</option>
              </select>
            </div>
          )}
          {askReason && (
            <div className="space-y-1">
              <Label htmlFor="admin-reason">Motivo</Label>
              <Textarea
                id="admin-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="Ex.: publicou conteúdo adulto, que quebra as diretrizes"
              />
            </div>
          )}
          {askPassword && (
            <div className="space-y-1">
              <Label htmlFor="admin-password">Sua senha</Label>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={busy} variant={destructive ? "destructive" : "default"}>
              {busy ? "Aguarde..." : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function formatBytes(bytes: number | null | undefined) {
  if (bytes == null) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativa",
  SUSPENDED: "Suspensa",
  BANNED: "Banida",
};

export const ACTION_LABEL: Record<string, string> = {
  SUSPEND: "Suspendeu",
  REACTIVATE: "Reativou",
  BAN: "Baniu",
  PURGE: "Apagou o conteúdo",
  REMOVE_POST: "Removeu publicação",
  APPROVE: "Aprovou publicação",
  TRUST: "Confiou na conta",
  QUOTA: "Mudou a cota",
  NOTE: "Anotou",
  DOSSIER: "Baixou o dossiê",
};

export const EVENT_LABEL: Record<string, string> = {
  SIGNUP: "Cadastro",
  LOGIN_OK: "Entrou",
  LOGIN_FAIL: "Errou a senha",
  POST: "Publicou",
  UPLOAD: "Enviou arquivo",
  COMMENT: "Comentou",
  BLOCKED_VPN: "Barrado: VPN",
  BLOCKED_BAN: "Barrado: banido",
  BLOCKED_LIMIT: "Barrado: limite por IP",
  BLOCKED_EMAIL: "Barrado: e-mail descartável",
};
