import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AuthCard } from "@/components/layout/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

export const Route = createFileRoute("/esqueci-senha")({
  head: () => ({ meta: [{ title: "Esqueci minha senha — WorkAt" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSent((await api.forgotPassword(email.trim())).message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar agora.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Esqueci minha senha" subtitle="Enviamos um link para você criar uma nova">
      {sent ? (
        <div className="space-y-4">
          <p role="status" className="text-sm">
            {sent}
          </p>
          <p className="text-xs text-muted-foreground">
            O link vale por 1 hora. Confira também a caixa de spam.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link to="/login">Voltar para o login</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="forgotEmail">E-mail da conta</Label>
            <Input
              id="forgotEmail"
              type="email"
              autoComplete="email"
              placeholder="voce@atelie.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={busy} className="gradient-primary w-full text-primary-foreground">
            {busy ? "Enviando..." : "Enviar link"}
          </Button>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <p className="text-center text-sm">
            <Link to="/login" className="text-muted-foreground hover:text-foreground">
              Lembrei a senha
            </Link>
          </p>
        </form>
      )}
    </AuthCard>
  );
}
