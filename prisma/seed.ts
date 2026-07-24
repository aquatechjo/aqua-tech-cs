import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function requiredEnv(name: "SEED_OWNER_EMAIL" | "SEED_OWNER_PASSWORD") {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required to run the seed safely`);
  }

  return value;
}

async function main() {
  const ownerEmail = requiredEnv("SEED_OWNER_EMAIL").toLowerCase();
  const ownerPassword = requiredEnv("SEED_OWNER_PASSWORD");

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

  const owner = await prisma.user.upsert({
    where: {
      email: ownerEmail,
    },
    update: {
      companyId: company.id,
      name: process.env.SEED_OWNER_NAME?.trim() || "Aqua Tech",
      passwordHash,
      role: "OWNER",
      isActive: true,
    },
    create: {
      companyId: company.id,
      name: process.env.SEED_OWNER_NAME?.trim() || "Aqua Tech",
      email: ownerEmail,
      passwordHash,
      role: "OWNER",
      isActive: true,
    },
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
