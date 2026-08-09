import Image from "next/image";
import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="CURIÓ">
      <Image
        src="/curio-logo.png"
        alt="CURIÓ"
        width={compact ? 100 : 132}
        height={compact ? 56 : 72}
        priority
      />
    </Link>
  );
}
