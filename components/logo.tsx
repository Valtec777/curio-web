import Link from "next/link";
import { BRAND_LOGO_ENDPOINT, BRAND_SYMBOL_FALLBACK } from "@/lib/brand-assets";

type LogoVariant = "wordmark" | "symbol" | "primary" | "negative";

export function Logo({
  compact = false,
  variant,
}: {
  compact?: boolean;
  variant?: LogoVariant;
}) {
  const useSymbol = compact || variant === "symbol";
  const imageSrc = useSymbol ? BRAND_SYMBOL_FALLBACK : BRAND_LOGO_ENDPOINT;

  return (
    <Link
      href="/"
      className={`brand brand-slot ${useSymbol ? "brand-slot-symbol" : "brand-slot-primary"}${compact ? " is-compact" : ""}`}
      aria-label="Plumareli — página inicial"
    >
      <img
        className={useSymbol ? "brand-slot-symbol-image" : "brand-slot-primary-image"}
        src={imageSrc}
        alt="Plumareli"
      />
    </Link>
  );
}
