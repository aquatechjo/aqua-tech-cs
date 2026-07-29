import { redirect } from "next/navigation"

import AquaDashboardShell from "@/components/layout/AquaDashboardShell"
import type { AquaNavigationSection } from "@/design-system"
import { aquaTechCsTheme } from "@/design-system"
import { ACCESS_ROLES, hasRole } from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth().catch(() => null)

  if (!user) {
    redirect("/login")
  }

  const navigationSections: AquaNavigationSection[] = [
    {
      label: "التشغيل اليومي",
      items: [
        { label: "لوحة التحكم", href: "/dashboard", enabled: true },
        { label: "يومي", href: "/dashboard/my-day", enabled: true },
        { label: "المهام", href: "/dashboard/tasks", enabled: true },
        { label: "الوقت والطاقة", href: "/dashboard/time", enabled: true },
      ],
    },
    {
      label: "الأعمال",
      items: [
        {
          label: "العملاء المحتملون",
          href: "/dashboard/leads",
          enabled: hasRole(user.role, ACCESS_ROLES.salesRead),
        },
        {
          label: "جمع المتطلبات",
          href: "/dashboard/discovery",
          enabled: hasRole(user.role, ACCESS_ROLES.discoveryRead),
        },
        {
          label: "المبيعات",
          href: "/dashboard/sales",
          enabled: hasRole(user.role, ACCESS_ROLES.salesRead),
        },
        {
          label: "طلبات الخدمة",
          href: "/dashboard/service-requests",
          enabled: hasRole(
            user.role,
            ACCESS_ROLES.serviceRequestManagement
          ),
        },
        {
          label: "العملاء",
          href: "/dashboard/clients",
          enabled: hasRole(user.role, ACCESS_ROLES.clientRead),
        },
        { label: "المشاريع", href: "/dashboard/projects", enabled: true },
        {
          label: "المالية",
          href: "/dashboard/finance",
          enabled: hasRole(user.role, ACCESS_ROLES.financeRead),
        },
      ],
    },
    {
      label: "الأشخاص",
      items: [
        { label: "الفريق", href: "/dashboard/team", enabled: true },
        {
          label: "الهيكل التنظيمي",
          href: "/dashboard/organization",
          enabled: true,
        },
        {
          label: "الموارد البشرية",
          href: "/dashboard/hr",
          enabled: true,
        },
      ],
    },
    {
      label: "النظام",
      items: [
        {
          label: "النشاطات",
          href: "/dashboard/activity",
          enabled: hasRole(user.role, ACCESS_ROLES.activityLog),
        },
        {
          label: "نظام التصميم",
          href: "/dashboard/design-system",
          enabled: hasRole(user.role, ACCESS_ROLES.companySettings),
        },
        {
          label: "التنبيهات",
          href: "/dashboard/notifications",
          enabled: true,
        },
        {
          label: "الإعدادات",
          href: "/dashboard/settings",
          enabled: true,
        },
      ],
    },
  ]

  return (
    <AquaDashboardShell
      projectName={aquaTechCsTheme.productName}
      language={user.company.language}
      userEmail={user.email}
      userRole={user.role}
      sections={navigationSections}
      density={aquaTechCsTheme.density}
    >
      {children}
    </AquaDashboardShell>
  )
}
