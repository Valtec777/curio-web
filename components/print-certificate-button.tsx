"use client";

export function PrintCertificateButton() {
  return (
    <button className="button button-primary" type="button" onClick={() => window.print()}>
      Imprimir / salvar em PDF
    </button>
  );
}
