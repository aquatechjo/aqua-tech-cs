import { redirect } from "next/navigation"

import AquaDashboardShell from "@/components/layout/AquaDashboardShell"
import type { AquaNavigationSection } from "@/design-system"
import { aquaFlowTheme } from "@/design-system"
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
        { label: "العملاء", href: "/dashboard/clients", enabled: true },
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
      companyName={user.company.name}
      userEmail={user.email}
      userRole={user.role}
      sections={navigationSections}
      density={aquaFlowTheme.density}
    >
      {children}
    </AquaDashboardShell>
  )
}
