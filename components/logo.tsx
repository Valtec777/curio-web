import Link from "next/link";
import { BRAND_LOGO_ENDPOINT } from "@/lib/brand-assets";

type LogoVariant = "wordmark" | "symbol" | "primary" | "negative";

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
        src={BRAND_LOGO_ENDPOINT}
        alt="Plumareli"
      />
    </Link>
  );
}
