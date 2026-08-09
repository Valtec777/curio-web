import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireRole("admin");
  return (
    <AppShell role="admin" roles={viewer.roles} name={viewer.profile?.preferred_name || viewer.profile?.full_name}>
      {children}
    </AppShell>
  );
}
