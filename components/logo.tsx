import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={`brand brand-slot${compact ? " is-compact" : ""}`} aria-label="Página inicial">
      <span className="brand-slot-mark" aria-hidden="true" />
      <span className="brand-slot-name">PLUMARELI</span>
    </Link>
  );
}
