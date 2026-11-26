import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AuthCard } from "@/components/layout/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({ meta: [{ title: "Nova senha — WorkAt" }] }),
  validateSearch: (search: Record<string, unknown>): { token?: string } =>
    typeof search["token"] === "string" ? { token: search["token"] } : {},
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      setError("As duas senhas não são iguais.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setDone((await api.resetPassword(token ?? "", password)).message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível trocar a senha.");
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <AuthCard title="Link incompleto">
        <p className="text-sm text-muted-foreground">
          Abra o link inteiro que enviamos, ou peça um novo.
        </p>
        <Button asChild className="mt-4 w-full">
          <Link to="/esqueci-senha">Pedir um novo link</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Criar nova senha" subtitle="Mínimo de 8 caracteres, com maiúscula, minúscula e número">
      {done ? (
        <div className="space-y-4">
          <p role="status" className="text-sm">
            {done}
          </p>
          <Button asChild className="gradient-primary w-full text-primary-foreground">
            <Link to="/login">Entrar</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nova senha</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Repita a nova senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={busy} className="gradient-primary w-full text-primary-foreground">
            {busy ? "Salvando..." : "Salvar nova senha"}
          </Button>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      )}
    </AuthCard>
  );
}
