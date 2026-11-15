import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function AccessLayout({ children, dashboard = false }: { children: ReactNode; dashboard?: boolean }) {
  return (
    <main className="shell mx-auto">
      <header className="masthead flex items-center">
        <Link href="/" className="brand-link">
          <Image src="/carecircle-mark.png" className="brand-mark" width={32} height={32} alt="" unoptimized />
          CareCircle
        </Link>
      </header>
      <div className={dashboard ? "access-page care-dashboard" : "access-page"}>{children}</div>
    </main>
  );
}
