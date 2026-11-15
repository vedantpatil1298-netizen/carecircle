import Link from "next/link";
import type { ReactNode } from "react";

export function AccessLayout({ children, dashboard = false }: { children: ReactNode; dashboard?: boolean }) {
  return (
    <main className="shell mx-auto">
      <header className="masthead flex items-center">
        <Link href="/" className="brand-link">
          <span className="brand-mark" aria-hidden="true" />
          CareCircle
        </Link>
      </header>
      <div className={dashboard ? "access-page care-dashboard" : "access-page"}>{children}</div>
    </main>
  );
}
