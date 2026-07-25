import { AquaPageState } from "@/components/aqua"
import { ACCESS_ROLES, hasRole } from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"

import DesignSystemShowcase from "./DesignSystemShowcase"

export const metadata = {
  title: "نظام التصميم",
}

export default async function DesignSystemPage() {
  const user = await requireAuth()

  if (!hasRole(user.role, ACCESS_ROLES.companySettings)) {
    return (
      <AquaPageState
        variant="permission"
        title="هذه المساحة مخصصة للإدارة"
        description="يتطلب Showcase نظام التصميم صلاحية المالك أو مدير النظام."
      />
    )
  }

  return <DesignSystemShowcase />
}
