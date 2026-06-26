import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TeamClient from "./TeamClient";

export default async function TeamPage() {
  const currentUser = await requireAuth();

  const users = await prisma.user.findMany({
    where: {
      companyId: currentUser.companyId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return (
    <TeamClient
      users={users}
      currentUser={{
        id: currentUser.id,
        role: currentUser.role,
      }}
    />
  );
}
