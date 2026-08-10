import { saveMonthlyLearningInterest } from "@/app/interest-actions";

export function MonthlyInterestPrompt({ role }: { role: "teacher" | "guardian" | "student" }) {
  return (
    <aside className="monthly-interest-prompt" aria-label="Interesse em novos conhecimentos">
      <div className="eyebrow">Novos cursos</div>
      <h3>O que você gostaria de aprender?</h3>
      <p>É opcional. A resposta ajuda o CURIÓ a escolher temas para cursos livres e novos materiais.</p>
      <form action={saveMonthlyLearningInterest} className="form-stack compact-form">
        <input type="hidden" name="role" value={role} />
        <div className="field"><label>Sugestão</label><input className="input" name="interest" maxLength={500} placeholder="Ex.: robótica, desenho, astronomia..." /></div>
        <div className="monthly-interest-actions">
          <button className="button button-primary button-small" type="submit">Enviar ideia</button>
          <button className="button button-ghost button-small" type="submit" name="dismissed" value="true">Agora não</button>
        </div>
      </form>
    </aside>
  );
}
