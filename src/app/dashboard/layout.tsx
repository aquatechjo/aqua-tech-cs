import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import LogoutButton from "@/components/auth/LogoutButton";
import AquaPageTitle from "@/components/layout/AquaPageTitle";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth().catch(() => null);

  if (!user) {
    redirect("/login");
  }

  const navItems = [
    { label: "لوحة التحكم", href: "/dashboard", enabled: true },
    { label: "الفريق", href: "/dashboard/team", enabled: true },
    { label: "العملاء — قريبًا", href: "#", enabled: false },
    { label: "المشاريع — قريبًا", href: "#", enabled: false },
    { label: "المهام — قريبًا", href: "#", enabled: false },
    { label: "النشاطات", href: "/dashboard/activity", enabled: true },
    { label: "التنبيهات", href: "/dashboard/notifications", enabled: true },
    { label: "الإعدادات", href: "/dashboard/settings", enabled: true },
    { label: "العملاء", href: "/dashboard/clients", enabled: true },
  ];

  return (
    <div className="aqua-page" dir="rtl">
      <div className="aqua-grid" />

      <div className="aqua-layer">
        <aside className="aqua-sidebar p-4">
          <div className="d-flex align-items-center gap-3 mb-4">
            <div className="aqua-mark">AF</div>
            <div>
              <div className="fs-4 fw-black">AquaFlow</div>
              <div className="small aqua-muted" dir="ltr">
                Growth • Software • AI
              </div>
            </div>
          </div>

          <div className="aqua-card-soft p-3 mb-4">
            <span className="aqua-badge">Internal OS</span>
            <div className="fw-bold mt-3">{user.company.name}</div>
            <div className="small aqua-soft mt-1" dir="ltr">
              {"</>"} Aqua.Tech Stack
            </div>
          </div>

          <nav className="d-flex flex-column gap-2">
            {navItems.map((item, index) =>
              item.enabled ? (
                <a key={item.label} href={item.href} className="aqua-nav-link">
                  <span>{item.label}</span>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: "var(--aqua-cyan)",
                    }}
                  />
                </a>
              ) : (
                <div key={item.label} className="aqua-nav-link disabled">
                  <span>{item.label}</span>
                </div>
              ),
            )}
          </nav>
        </aside>

        <div className="aqua-main">
          <header className="aqua-topbar">
            <div className="container-fluid px-4 py-3">
              <div className="d-flex align-items-center justify-content-between gap-3">
                <AquaPageTitle />

                <div className="d-flex align-items-center gap-3">
                  <div
                    className="aqua-card-soft px-3 py-2 d-none d-sm-block text-start"
                    dir="ltr"
                  >
                    <div className="fw-bold">{user.email}</div>
                    <div className="small aqua-soft">{user.role}</div>
                  </div>

                  <LogoutButton />
                </div>
              </div>
            </div>
          </header>

          <main className="container-fluid px-4 py-4">{children}</main>
        </div>
      </div>
    </div>
  );
}
