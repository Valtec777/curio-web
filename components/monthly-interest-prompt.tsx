import { saveMonthlyLearningInterest } from "@/app/interest-actions";

export function MonthlyInterestPrompt({ role }: { role: "teacher" | "guardian" | "student" }) {
  return (
    <aside className="monthly-interest-prompt" aria-label="Interesse em novos conhecimentos">
      <div className="eyebrow">Modo Pensar</div>
      <h3>O que você gostaria de aprender?</h3>
      <p>É opcional. A resposta ajuda a escolher novas trilhas, temas e materiais que façam sentido para a comunidade.</p>
      <form action={saveMonthlyLearningInterest} className="form-stack compact-form">
        <input type="hidden" name="role" value={role} />
        <div className="field"><label>Sugestão</label><input className="input" name="interest" maxLength={500} placeholder="Ex.: inglês, desenho, Excel, astronomia..." /></div>
        <div className="monthly-interest-actions">
          <button className="button button-primary button-small" type="submit">Enviar ideia</button>
          <button className="button button-ghost button-small" type="submit" name="dismissed" value="true">Agora não</button>
        </div>
      </form>
    </aside>
  );
}
