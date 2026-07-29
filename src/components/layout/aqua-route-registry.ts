export type AquaRouteDefinition = {
  path: string
  title: string
  subtitle: string
}

export type AquaResolvedRoute = AquaRouteDefinition & {
  isNested: boolean
}

export const aquaRouteDefinitions: readonly AquaRouteDefinition[] = [
  {
    path: "/dashboard",
    title: "لوحة التحكم",
    subtitle: "نظام Aqua tech CS للتشغيل الداخلي",
  },
  {
    path: "/dashboard/team",
    title: "الفريق",
    subtitle: "إدارة موظفي Aqua.Tech وصلاحياتهم",
  },
  {
    path: "/dashboard/organization",
    title: "الهيكل التنظيمي",
    subtitle: "إدارة الإدارات والفرق والأدوار الوظيفية",
  },
  {
    path: "/dashboard/sales",
    title: "المبيعات",
    subtitle: "خط الفرص والمتابعات والعروض والتحويل إلى مشاريع",
  },
  {
    path: "/dashboard/leads",
    title: "العملاء المحتملون",
    subtitle: "تأهيل Leads وتحديد المسؤول والإجراء التالي",
  },
  {
    path: "/dashboard/sales/opportunities",
    title: "فرص المبيعات",
    subtitle: "متابعة تفاصيل الفرص والأنشطة والعروض",
  },
  {
    path: "/dashboard/clients",
    title: "العملاء",
    subtitle: "إدارة العملاء الحاليين وسجلهم داخل Aqua.Tech",
  },
  {
    path: "/dashboard/projects",
    title: "المشاريع",
    subtitle: "إدارة مشاريع Aqua.Tech ومراحل التنفيذ",
  },
  {
    path: "/dashboard/my-day",
    title: "يومي",
    subtitle: "المهام المسندة إليك حسب الأولوية والاستحقاق",
  },
  {
    path: "/dashboard/tasks",
    title: "المهام",
    subtitle: "إدارة المهام وربطها بالمشاريع والفريق",
  },
  {
    path: "/dashboard/time",
    title: "الوقت والطاقة",
    subtitle: "متابعة الوقت والطاقة التشغيلية واعتماد السجلات",
  },
  {
    path: "/dashboard/hr",
    title: "الموارد البشرية والحضور",
    subtitle: "جداول الدوام والحضور والإجازات والأرصدة والعطل",
  },
  {
    path: "/dashboard/finance",
    title: "المالية التشغيلية",
    subtitle: "الفواتير والتحصيل والمصروفات وربحية المشاريع",
  },
  {
    path: "/dashboard/finance/invoices",
    title: "الفواتير",
    subtitle: "إصدار الفواتير ومتابعة التحصيل والمدفوعات",
  },
  {
    path: "/dashboard/finance/expenses",
    title: "المصروفات",
    subtitle: "إدارة المصروفات ودورة الاعتماد والدفع",
  },
  {
    path: "/dashboard/activity",
    title: "النشاطات",
    subtitle: "سجل العمليات الداخلية داخل Aqua tech CS",
  },
  {
    path: "/dashboard/design-system",
    title: "نظام التصميم",
    subtitle: "Showcase الحزمة والمكونات وقواعد الحوكمة",
  },
  {
    path: "/dashboard/notifications",
    title: "التنبيهات",
    subtitle: "مركز التنبيهات الداخلية",
  },
  {
    path: "/dashboard/settings",
    title: "الإعدادات",
    subtitle: "إعدادات الشركة والهوية الداخلية",
  },
  {
    path: "/dashboard/service-requests",
    title: "طلبات الخدمة",
    subtitle: "إدارة الطلبات القادمة من الموقع والقنوات المختلفة",
  },
] as const

const fallbackRoute: AquaRouteDefinition = {
  path: "/dashboard",
  title: "Aqua tech CS",
  subtitle: "نظام Aqua.Tech للتشغيل الداخلي",
}

export function resolveAquaRoute(pathname: string): AquaResolvedRoute {
  const exactRoute = aquaRouteDefinitions.find(
    (definition) => definition.path === pathname
  )

  if (exactRoute) {
    return {
      ...exactRoute,
      isNested: false,
    }
  }

  const parentRoute = [...aquaRouteDefinitions]
    .filter(
      (definition) =>
        definition.path !== "/dashboard" &&
        pathname.startsWith(`${definition.path}/`)
    )
    .sort((left, right) => right.path.length - left.path.length)[0]

  if (parentRoute) {
    return {
      ...parentRoute,
      isNested: true,
    }
  }

  return {
    ...fallbackRoute,
    isNested: pathname !== "/dashboard",
  }
}
