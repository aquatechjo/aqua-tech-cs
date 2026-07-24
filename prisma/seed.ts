import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { SYSTEM_OWNER_EMAIL } from "../src/lib/system-owner";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function requiredOwnerPassword() {
  const value = process.env.SEED_OWNER_PASSWORD?.trim();

  if (!value) {
    throw new Error("SEED_OWNER_PASSWORD is required to run the seed safely");
  }

  return value;
}

async function main() {
  const configuredOwnerEmail = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();

  if (configuredOwnerEmail && configuredOwnerEmail !== SYSTEM_OWNER_EMAIL) {
    throw new Error(`SEED_OWNER_EMAIL must be ${SYSTEM_OWNER_EMAIL}`);
  }

  const ownerEmail = SYSTEM_OWNER_EMAIL;
  const ownerPassword = requiredOwnerPassword();

  if (ownerPassword.length < 12) {
    throw new Error("SEED_OWNER_PASSWORD must contain at least 12 characters");
  }

  const passwordHash = await bcrypt.hash(ownerPassword, 12);

  const company = await prisma.company.upsert({
    where: {
      slug: "aqua-tech",
    },
    update: {
      name: "Aqua Tech",
      email: process.env.SEED_COMPANY_EMAIL?.trim() || ownerEmail,
      website: "https://aquatechagency.com",
      country: "Jordan",
      currency: "JOD",
      timezone: "Asia/Amman",
      language: "ar",
    },
    create: {
      name: "Aqua Tech",
      slug: "aqua-tech",
      email: process.env.SEED_COMPANY_EMAIL?.trim() || ownerEmail,
      website: "https://aquatechagency.com",
      country: "Jordan",
      currency: "JOD",
      timezone: "Asia/Amman",
      language: "ar",
    },
  });

  const [existingOwner, ownerEmailUser] = await Promise.all([
    prisma.user.findFirst({
      where: {
        companyId: company.id,
        role: "OWNER",
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.user.findUnique({
      where: {
        email: ownerEmail,
      },
    }),
  ]);

  if (ownerEmailUser && existingOwner && ownerEmailUser.id !== existingOwner.id) {
    throw new Error(
      `${ownerEmail} is already assigned to another user; resolve the duplicate before seeding`,
    );
  }

  if (ownerEmailUser && !existingOwner) {
    throw new Error(
      `${ownerEmail} is assigned to a non-owner account; resolve it before seeding`,
    );
  }

  const owner = existingOwner
    ? await prisma.user.update({
        where: {
          id: existingOwner.id,
        },
        data: {
          companyId: company.id,
          name: process.env.SEED_OWNER_NAME?.trim() || "Aqua Tech",
          email: ownerEmail,
          passwordHash,
          role: "OWNER",
          isActive: true,
        },
      })
    : await prisma.user.create({
        data: {
          companyId: company.id,
          name: process.env.SEED_OWNER_NAME?.trim() || "Aqua Tech",
          email: ownerEmail,
          passwordHash,
          role: "OWNER",
          isActive: true,
        },
      });

  const managementDepartment = await prisma.department.upsert({
    where: {
      companyId_code: {
        companyId: company.id,
        code: "MANAGEMENT",
      },
    },
    update: {
      name: "الإدارة",
      isActive: true,
    },
    create: {
      companyId: company.id,
      name: "الإدارة",
      code: "MANAGEMENT",
      description: "الإدارة الأساسية لشركة Aqua Tech",
      sortOrder: 10,
    },
  });

  const ownerJobRole = await prisma.jobRole.upsert({
    where: {
      companyId_code: {
        companyId: company.id,
        code: "OWNER",
      },
    },
    update: {
      name: "مالك الشركة",
      departmentId: managementDepartment.id,
      isActive: true,
    },
    create: {
      companyId: company.id,
      departmentId: managementDepartment.id,
      name: "مالك الشركة",
      code: "OWNER",
      description: "المسمى الوظيفي لمالك Aqua Tech",
    },
  });

  const ownerProfile = await prisma.employeeProfile.upsert({
    where: {
      userId: owner.id,
    },
    update: {
      companyId: company.id,
      departmentId: managementDepartment.id,
      jobRoleId: ownerJobRole.id,
      status: "ACTIVE",
    },
    create: {
      companyId: company.id,
      userId: owner.id,
      departmentId: managementDepartment.id,
      jobRoleId: ownerJobRole.id,
      employmentType: "FULL_TIME",
      status: "ACTIVE",
      startDate: new Date(),
    },
  });

  await prisma.department.update({
    where: { id: managementDepartment.id },
    data: { leadProfileId: ownerProfile.id },
  });

  const welcomeNotification = await prisma.notification.findFirst({
    where: {
      companyId: company.id,
      userId: owner.id,
      entityType: "SystemSeed",
      entityId: "aquaflow-initialized",
    },
  });

  if (!welcomeNotification) {
    await prisma.notification.create({
      data: {
        companyId: company.id,
        userId: owner.id,
        title: "مرحبًا بك في AquaFlow",
        message: "تم تجهيز النظام الداخلي الأولي لشركة Aqua Tech بنجاح.",
        type: "SUCCESS",
        entityType: "SystemSeed",
        entityId: "aquaflow-initialized",
      },
    });
  }

  console.log("Seed completed successfully");
  console.log("Company:", company.name);
  console.log("Owner email:", owner.email);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
