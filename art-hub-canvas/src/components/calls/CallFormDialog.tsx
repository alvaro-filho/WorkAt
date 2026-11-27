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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, type CallFormat, type CallLocation, type CallRole, type JobCall } from "@/lib/api";
import { CALL_FORMATS, CALL_LOCATIONS, CALL_ROLES } from "@/lib/call-labels";
import { todayString } from "@/lib/dates";

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

/** Publicar (call = null) ou editar uma Chamada. Pagamento é opcional: o estúdio decide se mostra. */
export function CallFormDialog({
  open,
  onOpenChange,
  call,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  call: JobCall | null;
  onSaved: (call: JobCall) => void;
}) {
  const [title, setTitle] = useState("");
  const [role, setRole] = useState<CallRole>("CONCEPT");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState<CallFormat>("FREELA");
  const [location, setLocation] = useState<CallLocation>("REMOTO");
  const [city, setCity] = useState("");
  const [showPay, setShowPay] = useState(false);
  const [payMin, setPayMin] = useState("");
  const [payMax, setPayMax] = useState("");
  const [closesOn, setClosesOn] = useState(todayString(14));
  const [nda, setNda] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(call?.title ?? "");
    setRole(call?.role ?? "CONCEPT");
    setDescription(call?.description ?? "");
    setFormat(call?.format ?? "FREELA");
    setLocation(call?.location ?? "REMOTO");
    setCity(call?.city ?? "");
    setShowPay(call ? call.payMin != null || call.payMax != null : false);
    setPayMin(call?.payMin != null ? String(call.payMin) : "");
    setPayMax(call?.payMax != null ? String(call.payMax) : "");
    setClosesOn(call?.closesOn ?? todayString(14));
    setNda(call?.nda ?? false);
    setError(null);
  }, [open, call]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const input = {
        title: title.trim(),
        role,
        description: description.trim(),
        format,
        location,
        city: location === "REMOTO" ? null : city.trim(),
        payMin: showPay && payMin ? Number(payMin) : null,
        payMax: showPay && payMax ? Number(payMax) : null,
        closesOn,
        nda,
      };
      onSaved(call ? await api.updateCall(call.id, input) : await api.createCall(input));
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar a Chamada.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{call ? "Editar Chamada" : "Nova Chamada"}</DialogTitle>
            <DialogDescription>
              Artistas respondem com "Tenho interesse" e o portfólio. Só você vê quem se candidatou.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="callTitle">Título</Label>
            <Input
              id="callTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Ex.: Concept de criaturas para jogo mobile"
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="callRole">Função</Label>
              <select
                id="callRole"
                className={selectClass}
                value={role}
                onChange={(e) => setRole(e.target.value as CallRole)}
              >
                {CALL_ROLES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="callFormat">Formato</Label>
              <select
                id="callFormat"
                className={selectClass}
                value={format}
                onChange={(e) => setFormat(e.target.value as CallFormat)}
              >
                {CALL_FORMATS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="callLocation">Onde</Label>
              <select
                id="callLocation"
                className={selectClass}
                value={location}
                onChange={(e) => setLocation(e.target.value as CallLocation)}
              >
                {CALL_LOCATIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            {location !== "REMOTO" && (
              <div className="space-y-2">
                <Label htmlFor="callCity">Cidade</Label>
                <Input
                  id="callCity"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  maxLength={80}
                  required
                />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="callDescription">Descrição do trabalho</Label>
            <Textarea
              id="callDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={3000}
              rows={5}
              placeholder="O que será feito, estilo, quantidade de peças, o que vocês esperam do artista."
              required
            />
            <p className="text-xs text-muted-foreground">{description.length}/3000 · mínimo 20</p>
          </div>

          <div className="space-y-2 rounded-xl border border-border p-3">
            <label className="flex items-center justify-between gap-3 text-sm font-medium">
              Mostrar faixa de pagamento
              <Switch
                checked={showPay}
                onCheckedChange={setShowPay}
                aria-label="Mostrar faixa de pagamento"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Opcional. Sem valor, a Chamada não fala de pagamento.
            </p>
            {showPay && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="payMin">De (R$)</Label>
                  <Input
                    id="payMin"
                    type="number"
                    min={0}
                    value={payMin}
                    onChange={(e) => setPayMin(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="payMax">Até (R$)</Label>
                  <Input
                    id="payMax"
                    type="number"
                    min={0}
                    value={payMax}
                    onChange={(e) => setPayMax(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="callCloses">Recebe interessados até</Label>
              <Input
                id="callCloses"
                type="date"
                min={todayString()}
                max={todayString(180)}
                value={closesOn}
                onChange={(e) => setClosesOn(e.target.value)}
                required
              />
            </div>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm">
              <span>
                <span className="block font-medium">Trabalho sob NDA</span>
                <span className="block text-xs text-muted-foreground">
                  O projeto criado já nasce com NDA.
                </span>
              </span>
              <Switch checked={nda} onCheckedChange={setNda} aria-label="Trabalho sob NDA" />
            </label>
          </div>

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
            <Button
              type="submit"
              disabled={busy}
              className="gradient-primary text-primary-foreground"
            >
              {busy ? "Salvando..." : call ? "Salvar" : "Publicar Chamada"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
