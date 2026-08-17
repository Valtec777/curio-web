import Link from "next/link";

type LogoVariant = "wordmark" | "symbol" | "primary" | "negative";

const PLUMARELI_LOGO = "/brand/plumareli-primary-20260816.webp?v=4";

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
      <img className="brand-slot-unified-image" src={PLUMARELI_LOGO} alt="Plumareli" />
    </Link>
  );
}
