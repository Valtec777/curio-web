import Link from "next/link";

type LogoVariant = "wordmark" | "symbol" | "primary" | "negative";

// A logo oficial fica versionada diretamente em public/brand para não depender
// do materializador de assets durante o deploy.
const PLUMARELI_LOGO = "/brand/plumareli-logo-oficial.webp?v=20260817-1";

export function Logo({
  compact = false,
  variant: _variant,
}: {
  compact?: boolean;
  variant?: LogoVariant;
}) {
  return (
    <Link
      href="/"
      className={`brand brand-slot brand-slot-unified${compact ? " is-compact" : ""}`}
      aria-label="Plumareli — página inicial"
    >
      <img
        className="brand-slot-unified-image"
        src={PLUMARELI_LOGO}
        alt="Plumareli"
      />
    </Link>
  );
}
