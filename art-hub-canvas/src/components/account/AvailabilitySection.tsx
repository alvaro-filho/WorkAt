import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api, type Account, type CallFormat, type CallLocation } from "@/lib/api";
import { CALL_FORMATS, CALL_LOCATIONS } from "@/lib/call-labels";

const NOTE_MAX = 120;

/**
 * Conta › Disponibilidade (só artistas): o selo "Disponível para trabalho" no perfil e no Explorar.
 * Desligar guarda as escolhas para a próxima vez.
 */
export function AvailabilitySection({
  account,
  onSaved,
}: {
  account: Account;
  onSaved: (account: Account) => void;
}) {
  const current = account.availability;
  const [available, setAvailable] = useState(current.available);
  const [formats, setFormats] = useState<CallFormat[]>(current.formats);
  const [location, setLocation] = useState<CallLocation>(current.location ?? "REMOTO");
  const [city, setCity] = useState(current.city ?? "");
  const [note, setNote] = useState(current.note ?? "");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleFormat = (value: CallFormat) =>
    setFormats((list) =>
      list.includes(value) ? list.filter((item) => item !== value) : [...list, value],
    );

  const save = async (nextAvailable = available) => {
    setBusy(true);
    setOk(null);
    setError(null);
    try {
      const saved = await api.updateAvailability({
        available: nextAvailable,
        formats,
        location,
        city: location === "REMOTO" ? "" : city,
        note,
      });
      onSaved(saved);
      setAvailable(saved.availability.available);
      setOk(
        saved.availability.available
          ? 'Pronto: o selo aparece no seu perfil e você entra no filtro "Só disponíveis".'
          : "Selo desligado. Suas escolhas ficam guardadas para a próxima vez.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-5 px-4 pb-8">
      <p className="pt-1 text-[13px] text-muted-foreground">
        Estúdios procuram artistas disponíveis no Explorar e recebem sugestões quando publicam uma
        Chamada com a sua função. A função vem das especialidades do seu perfil.
      </p>

      <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
        <span>
          <span className="block font-medium">Disponível para trabalho</span>
          <span className="block text-[13px] text-muted-foreground">
            {available && !current.available
              ? "Escolha os formatos e salve para o selo aparecer."
              : available
                ? "O selo verde aparece ao lado do seu nome."
                : "Desligado: ninguém vê sua disponibilidade."}
          </span>
        </span>
        <Switch
          checked={available}
          disabled={busy}
          aria-label="Disponível para trabalho"
          onCheckedChange={(next) => {
            setAvailable(next);
            // Desligar salva na hora; ligar espera os campos abaixo.
            if (!next) void save(false);
          }}
        />
      </label>

      <fieldset className="space-y-2" disabled={busy}>
        <legend className="mb-2 text-sm font-medium">Formatos que você aceita</legend>
        <div className="flex flex-wrap gap-2">
          {CALL_FORMATS.map((item) => {
            const selected = formats.includes(item.value);
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleFormat(item.value)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  selected
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2" disabled={busy}>
        <legend className="mb-2 text-sm font-medium">Onde</legend>
        <div className="flex flex-wrap gap-2">
          {CALL_LOCATIONS.map((item) => (
            <label
              key={item.value}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                location === item.value
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border"
              }`}
            >
              <input
                type="radio"
                name="availability-location"
                className="sr-only"
                checked={location === item.value}
                onChange={() => setLocation(item.value)}
              />
              {item.label}
            </label>
          ))}
        </div>
        {location !== "REMOTO" && (
          <div className="space-y-1 pt-1">
            <Label htmlFor="availability-city">Cidade</Label>
            <Input
              id="availability-city"
              value={city}
              onChange={(e) => setCity(e.target.value.slice(0, 80))}
              placeholder="Ex.: Recife"
            />
          </div>
        )}
      </fieldset>

      <div className="space-y-1">
        <Label htmlFor="availability-note">Uma linha sobre sua disponibilidade (opcional)</Label>
        <Input
          id="availability-note"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
          placeholder="Ex.: Livre a partir de janeiro, 20h por semana"
          disabled={busy}
        />
        <p className="text-right text-xs text-muted-foreground">
          {note.length}/{NOTE_MAX}
        </p>
      </div>

      <Button
        onClick={() => void save()}
        disabled={busy}
        className="gradient-primary text-primary-foreground"
      >
        {busy ? "Salvando..." : available ? "Salvar disponibilidade" : "Salvar escolhas"}
      </Button>
      {ok && (
        <p role="status" className="text-sm text-emerald-400">
          {ok}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
