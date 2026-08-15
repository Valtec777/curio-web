import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand brand-slot${compact ? " is-compact" : ""}`}
      aria-label="Plumareli — página inicial"
    >
      {compact ? (
        <img
          className="brand-slot-symbol"
          src="/brand/plumareli-symbol.webp"
          alt="Plumareli"
        />
      ) : (
        <img
          className="brand-slot-wordmark"
          src="/brand/plumareli-wordmark.webp"
          alt="Plumareli"
        />
      )}
    </Link>
  );
}
