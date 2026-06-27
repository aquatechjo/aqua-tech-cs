"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href: string;
  enabled: boolean;
};

export default function AquaSidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="d-flex flex-column gap-2">
      {items.map((item) => {
        if (!item.enabled) {
          return (
            <div key={item.label} className="aqua-nav-link disabled">
              <span>{item.label}</span>
            </div>
          );
        }

        const active = isActive(item.href);

        return (
          <Link
            key={item.label}
            href={item.href}
            className={`aqua-nav-link ${active ? "active" : ""}`}
          >
            <span>{item.label}</span>
            <span className="aqua-nav-dot" />
          </Link>
        );
      })}
    </nav>
  );
}