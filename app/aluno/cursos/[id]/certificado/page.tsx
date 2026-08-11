import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentStudent } from "@/lib/student";

function issueDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Bahia" }).format(new Date(value));
}

export default async function CourseCertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { student, supabase } = await getCurrentStudent();
  const { data: certificate } = await supabase
    .from("free_course_certificates")
    .select("certificate_code,issued_at,free_courses(title,estimated_minutes),students(full_name,preferred_name)")
    .eq("course_id", id)
    .eq("student_id", student.id)
    .maybeSingle();

  if (!certificate) notFound();
  const course: any = certificate.free_courses;
  const certificateStudent: any = certificate.students;
  const validationHref = `/certificados/validar?codigo=${encodeURIComponent(certificate.certificate_code)}`;

  return (
    <div className="certificate-page">
      <div className="certificate-toolbar no-print">
        <Link className="button button-secondary" href={`/aluno/cursos/${id}`}>← Voltar ao curso</Link>
        <Link className="button button-secondary" href={validationHref} target="_blank">Validar certificado</Link>
        <span className="muted">Para guardar em PDF: use Imprimir no navegador e escolha “Salvar como PDF”.</span>
      </div>
      <section className="certificate-sheet">
        <div className="certificate-mark">CURIÓ</div>
        <div className="eyebrow">Certificado de Curso Livre</div>
        <h1>Certificamos que</h1>
        <h2 className="certificate-name">{certificateStudent?.full_name || certificateStudent?.preferred_name || student.full_name}</h2>
        <p>concluiu o curso livre</p>
        <h3 className="certificate-course">{course?.title || "Curso Livre Curió"}</h3>
        <p>com carga horária pedagógica estimada de <strong>{course?.estimated_minutes || 0} minutos</strong>, concluindo as etapas previstas no ambiente educacional Curió.</p>
        <div className="certificate-signature">
          <div><span>Emitido em</span><strong>{issueDate(certificate.issued_at)}</strong></div>
          <div><span>Código de validação</span><strong>{certificate.certificate_code}</strong></div>
        </div>
        <p className="certificate-validation no-print"><Link href={validationHref}>Verificar autenticidade deste certificado</Link></p>
        <footer>Curió · Tecnologia ajuda. Seu cérebro resolve. · curio.educacao@gmail.com</footer>
      </section>
    </div>
  );
}
