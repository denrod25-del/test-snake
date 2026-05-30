import { requireAdminSession } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminSession();
  return <div className="space-y-6">{children}</div>;
}
