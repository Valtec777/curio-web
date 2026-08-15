import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintCertificateButton } from "@/components/print-certificate-button";
import { getCurrentStudent } from "@/lib/student";

function issueDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Bahia" }).format(new Date(value));
}

export default async function CourseCertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { student, supabase } = await getCurrentStudent();
  const { data: certificate } = await supabase
    .from("free_course_certificates")
    .select("certificate_code,issued_at,free_courses(title,slug,estimated_minutes,certificate_config),students(full_name,preferred_name)")
    .eq("course_id", id)
    .eq("student_id", student.id)
    .maybeSingle();

  if (!certificate) notFound();
  const course: any = certificate.free_courses;
  const certificateStudent: any = certificate.students;
  const config = course?.certificate_config && typeof course.certificate_config === "object" ? course.certificate_config : {};
  const certificateTitle = config.title || "Certificado de conclusão";
  const signatoryName = config.signatory_name || null;
  const signatoryRole = config.signatory_role || null;
  const validationHref = `/certificados/validar?codigo=${encodeURIComponent(certificate.certificate_code)}`;
  const backHref = course?.slug ? `/aluno/modo-pensar/${encodeURIComponent(course.slug)}` : "/aluno/modo-pensar";

  return (
    <div className="certificate-page">
      <div className="certificate-toolbar no-print">
        <Link className="button button-secondary" href={backHref}>Voltar à trilha</Link>
        <PrintCertificateButton />
        <Link className="button button-secondary" href={validationHref} target="_blank">Validar certificado</Link>
        <span className="muted">Na janela de impressão, escolha “Salvar como PDF” para guardar o certificado digital.</span>
      </div>
      <section className="certificate-sheet">
        <div className="certificate-mark">PLUMARELI</div>
        <div className="eyebrow">{certificateTitle}</div>
        <h1>Certificamos que</h1>
        <h2 className="certificate-name">{certificateStudent?.full_name || certificateStudent?.preferred_name || student.full_name}</h2>
        <p>concluiu a trilha do Modo Pensar</p>
        <h3 className="certificate-course">{course?.title || "Trilha Plumareli"}</h3>
        <p>com carga horária pedagógica estimada de <strong>{course?.estimated_minutes || 0} minutos</strong>, concluindo as etapas previstas no ambiente educacional PLUMARELI.</p>
        <div className="certificate-signature">
          <div><span>Emitido em</span><strong>{issueDate(certificate.issued_at)}</strong></div>
          <div><span>Código de validação</span><strong>{certificate.certificate_code}</strong></div>
          {signatoryName ? <div><span>Responsável</span><strong>{signatoryName}</strong>{signatoryRole ? <small>{signatoryRole}</small> : null}</div> : null}
        </div>
        <p className="certificate-validation no-print"><Link href={validationHref}>Verificar autenticidade deste certificado</Link></p>
        <footer>PLUMARELI · Modo Pensar · certificado digital verificável</footer>
      </section>
    </div>
  );
}
