import Link from "next/link";

type LogoVariant = "wordmark" | "symbol" | "primary" | "negative";

const logoAssets: Record<LogoVariant, { src: string; className: string }> = {
  wordmark: {
    src: "/brand/plumareli-wordmark-20260816.webp?v=3",
    className: "brand-slot-wordmark",
  },
  symbol: {
    src: "/brand/plumareli-symbol.webp?v=3",
    className: "brand-slot-symbol",
  },
  primary: {
    src: "/brand/plumareli-primary-20260816.webp?v=3",
    className: "brand-slot-primary",
  },
  negative: {
    src: "/brand/plumareli-negative-20260816.webp?v=3",
    className: "brand-slot-negative",
  },
};

export function Logo({
  compact = false,
  variant,
}: {
  compact?: boolean;
  variant?: LogoVariant;
}) {
  const resolvedVariant = variant ?? (compact ? "symbol" : "wordmark");
  const asset = logoAssets[resolvedVariant];

  return (
    <Link
      href="/"
      className={`brand brand-slot is-${resolvedVariant}${compact ? " is-compact" : ""}`}
      aria-label="Plumareli — página inicial"
    >
      <img className={asset.className} src={asset.src} alt="Plumareli" />
    </Link>
  );
}
