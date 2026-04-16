"use client";

import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopNav } from "@/components/admin/admin-topnav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Skip admin shell for login page (no sidebar or topnav)
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="bg-[#131313] min-h-screen">
      <AdminTopNav />
      <AdminSidebar activePath={pathname} />
      <main className="pl-20 pt-14 min-h-screen">
        <div className="max-w-[1600px] mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
