import "server-only"

import type { AccessRole } from "@/generated/prisma/enums"
import {
  projectScopeFromTaskScope,
  type ProjectAccessScope,
} from "@/lib/project-scope"
import { resolveTaskAccessScope } from "@/lib/task-scope-server"

type ScopeUser = {
  id: string
  companyId: string
  role: AccessRole
}

export async function resolveProjectAccessScope(
  user: ScopeUser
): Promise<ProjectAccessScope> {
  const taskScope = await resolveTaskAccessScope(user)
  return projectScopeFromTaskScope(user.role, taskScope)
}
