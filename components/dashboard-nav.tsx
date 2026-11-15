"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/dashboard", title: "Care overview" },
  { href: "/dashboard/medications", title: "Medication schedules" },
  { href: "/dashboard/appointments", title: "Appointments" },
  { href: "/dashboard/history", title: "Dose history" },
  { href: "/dashboard/assistant", title: "Care assistant" },
  { href: "/dashboard/account", title: "Account" },
];

export function DashboardNav({ hasAssistant }: { hasAssistant: boolean }) {
  const current = usePathname();

  return (
    <nav className="dashboard-tabs" aria-label="Care dashboard">
      {navigation.filter(({ href }) => hasAssistant || href !== "/dashboard/assistant").map(({ href, title }) => (
        <Link key={href} href={href} aria-current={current === href ? "page" : undefined}>{title}</Link>
      ))}
    </nav>
  );
}
