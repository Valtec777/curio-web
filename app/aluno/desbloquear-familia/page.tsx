import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { unlockFamilyWithPin } from "@/app/familia/access-actions";

export default async function UnlockFamilyPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const cookieStore = await cookies();
  if (!cookieStore.get("curio_student_context")?.value) redirect("/familia");
  const { erro } = await searchParams;

  return (
    <section className="panel family-unlock-panel">
      <div className="family-unlock-icon" aria-hidden="true">••••</div>
      <div className="eyebrow eyebrow-pink">Área protegida</div>
      <h1>Chame um responsável</h1>
      <p>Para sair do espaço da criança e voltar ao Ninho da Família, digite o PIN de 4 números criado pelo responsável.</p>
      {erro && <div className="form-message form-error">{erro}</div>}
      <form action={unlockFamilyWithPin} className="form-stack family-unlock-form">
        <div className="field">
          <label>PIN da família</label>
          <input className="input family-pin-input" name="pin" inputMode="numeric" autoComplete="off" pattern="[0-9]{4}" minLength={4} maxLength={4} required autoFocus placeholder="••••" />
        </div>
        <button className="button button-primary button-block" type="submit">Desbloquear Ninho da Família</button>
      </form>
      <small className="muted">Após 5 tentativas incorretas, o PIN fica bloqueado por 5 minutos.</small>
    </section>
  );
}
