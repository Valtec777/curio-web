"use client";

import { useState } from "react";
import { setFamilyPin } from "@/app/familia/access-actions";

export function FamilyPinGate({ required, children }: { required: boolean; children: React.ReactNode }) {
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <>
      {children}
      {required && (
        <div className="family-pin-backdrop" role="presentation">
          <section className="family-pin-card" role="dialog" aria-modal="true" aria-labelledby="family-pin-title">
            <span className="family-pin-lock" aria-hidden="true">4</span>
            <div className="eyebrow eyebrow-pink">Primeiro acesso da família</div>
            <h2 id="family-pin-title">Crie um PIN de 4 números</h2>
            <p>Esse PIN protege o Ninho da Família quando a criança estiver usando o mesmo aparelho. Ele não substitui a senha do seu e-mail.</p>
            {localError && <div className="form-message form-error" role="alert">{localError}</div>}
            <form
              action={setFamilyPin}
              className="form-stack"
              onSubmit={(event) => {
                if (!/^\d{4}$/.test(pin) || pin !== confirmation) {
                  event.preventDefault();
                  setLocalError("Digite o mesmo PIN de 4 números nos dois campos.");
                  return;
                }
                setLocalError(null);
              }}
            >
              <input type="hidden" name="returnTo" value="/familia" />
              <div className="form-row">
                <div className="field">
                  <label>Novo PIN</label>
                  <input className="input family-pin-input" name="pin" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4}" minLength={4} maxLength={4} required placeholder="••••" />
                </div>
                <div className="field">
                  <label>Repita o PIN</label>
                  <input className="input family-pin-input" name="pinConfirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4}" minLength={4} maxLength={4} required placeholder="••••" />
                </div>
              </div>
              <button className="button button-primary button-block" type="submit">Salvar PIN e continuar</button>
            </form>
            <small>Depois, a criança entra pelo seu e-mail e usa apenas o espaço dela. Para voltar para esta área, o Plumareli pedirá esse PIN.</small>
          </section>
        </div>
      )}
    </>
  );
}
