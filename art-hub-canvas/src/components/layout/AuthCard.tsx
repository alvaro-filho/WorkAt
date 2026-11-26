import type { ReactNode } from "react";
import { Palette } from "lucide-react";

/** Moldura das telas sem login (esqueci a senha, nova senha), no mesmo visual do login. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="absolute -top-32 -left-24 size-96 rounded-full bg-primary/25 blur-[120px]" />
      <div className="absolute -right-24 -bottom-32 size-96 rounded-full bg-neon/15 blur-[120px]" />
      <div className="glass fade-up relative w-full max-w-md rounded-3xl p-7">
        <div className="flex items-center gap-3">
          <div className="gradient-primary flex size-11 items-center justify-center rounded-2xl">
            <Palette className="size-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
