"use client";

import { usePathname } from "next/navigation";

const titles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": {
    title: "لوحة التحكم",
    subtitle: "Aqua.Tech internal operating system",
  },
  "/dashboard/team": {
    title: "الفريق",
    subtitle: "إدارة موظفي Aqua.Tech وصلاحياتهم",
  },
  "/dashboard/activity": {
    title: "النشاطات",
    subtitle: "سجل العمليات الداخلية داخل AquaFlow",
  },
  "/dashboard/settings": {
    title: "الإعدادات",
    subtitle: "إعدادات الشركة والهوية الداخلية",
  },

  "/dashboard/notifications": {
    title: "التنبيهات",
    subtitle: "مركز التنبيهات الداخلية",
  },

  "/dashboard/sales": {
    title: "المبيعات",
    subtitle: "خط الفرص والمتابعات والعروض والتحويل إلى مشاريع",
  },

  "/dashboard/clients": {
    title: "العملاء",
    subtitle: "إدارة العملاء الحاليين وسجلهم داخل Aqua.Tech",
  },

  "/dashboard/projects": {
    title: "المشاريع",
    subtitle: "إدارة مشاريع Aqua.Tech ومراحل التنفيذ",
  },

  "/dashboard/my-day": {
    title: "يومي",
    subtitle: "المهام المسندة إليك حسب الأولوية والاستحقاق",
  },

  "/dashboard/tasks": {
    title: "المهام",
    subtitle: "إدارة مهام Aqua.Tech وربطها بالمشاريع والفريق",
  },
  "/dashboard/finance": {
    title: "المالية التشغيلية",
    subtitle: "الفواتير والتحصيل والمصروفات وربحية المشاريع",
  },
  "/dashboard/service-requests": {
    title: "طلبات الخدمة",
    subtitle: "إدارة طلبات العملاء القادمة من الموقع والقنوات المختلفة",
  },
};

export default function AquaPageTitle() {
  const pathname = usePathname();

  const exactPage = titles[pathname];
  const parentPath = Object.keys(titles)
    .filter((path) => path !== "/dashboard" && pathname.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)[0];

  const page = exactPage ?? (parentPath ? titles[parentPath] : undefined) ?? {
    title: "AquaFlow",
    subtitle: "Aqua.Tech internal operating system",
  };

  return (
    <div>
      <div
        className="small fw-bold text-info text-uppercase"
        style={{ letterSpacing: 6 }}
      >
        Aqua.Tech OS
      </div>
      <h1 className="h3 fw-black mt-2 mb-0">{page.title}</h1>
      <p className="small aqua-muted mb-0 mt-1">{page.subtitle}</p>
    </div>
  );
}
