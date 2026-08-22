import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "PLUMARELI | Fase piloto privada",
  description: "O PLUMARELI está em fase piloto privada e recebe novas famílias por convite.",
  keywords: [],
  robots: { index: false, follow: false },
  alternates: { canonical: "/" },
  openGraph: {
    title: "PLUMARELI | Fase piloto privada",
    description: "Acesso por convite durante a fase piloto.",
  },
};

export default async function PrivateBetaPage({
  searchParams,
}: {
  searchParams: Promise<{ convite?: string }>;
}) {
  const { convite } = await searchParams;
  const whatsappUrl = process.env.NEXT_PUBLIC_WHATSAPP_URL?.trim();

  return (
    <>
      <header className="public-header">
        <div className="site-shell public-header-inner">
          <Logo />
          <div className="public-actions">
            <Link className="button button-secondary" href="/login">Entrar</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="hero curio-public-hero">
          <div className="site-shell" style={{ maxWidth: 860, paddingBlock: 72 }}>
            <div className="kicker kicker-pill">Fase piloto privada</div>
            <h1 style={{ maxWidth: 760 }}>O Plumareli está crescendo em silêncio.</h1>
            <p style={{ maxWidth: 720, fontSize: "1.08rem" }}>
              Estamos acompanhando um grupo pequeno de famílias durante a fase piloto. Novos acessos são liberados por convite da equipe, de uma família ou de um professor participante.
            </p>

            {convite === "necessario" ? (
              <div className="notice mt-16" style={{ maxWidth: 720 }}>
                Este formulário faz parte do piloto privado. Para participar, use um link de convite válido ou fale com a equipe Plumareli.
              </div>
            ) : null}

            <div className="hero-buttons mt-16">
              <Link className="button button-primary" href="/login">Já tenho acesso</Link>
              {whatsappUrl ? (
                <a className="button button-pink" href={whatsappUrl} target="_blank" rel="noreferrer">Falar no WhatsApp</a>
              ) : null}
            </div>

            <div className="hero-chips mt-16">
              <span>Acesso por convite</span>
              <span>Grupo piloto reduzido</span>
              <span>Acompanhamento humano</span>
            </div>

            <p className="muted mt-16" style={{ maxWidth: 720 }}>
              Recebeu um convite? Abra o link enviado a você. Ele identifica o convite e leva diretamente à página de apresentação do piloto.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
