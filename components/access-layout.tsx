import Link from "next/link";
import type { ReactNode } from "react";

export function AccessLayout({ children }: { children: ReactNode }) {
  return (
    <main className="shell mx-auto">
      <header className="masthead flex items-center">
        <Link href="/" className="brand-link">
          <span className="brand-mark" aria-hidden="true" />
          CareCircle
        </Link>
      </header>
      <div className="access-page">{children}</div>
    </main>
  );
}
