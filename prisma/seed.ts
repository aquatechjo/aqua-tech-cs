import "dotenv/config"
import bcrypt from "bcryptjs"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const passwordHash = await bcrypt.hash("Admin@123456", 12)

  const company = await prisma.company.upsert({
    where: {
      slug: "aqua-tech",
    },
    update: {
      name: "Aqua.Tech",
      email: "info@aquatechagency.com",
      website: "https://aquatechagency.com",
      country: "Jordan",
      currency: "JOD",
      timezone: "Asia/Amman",
      language: "ar",
    },
    create: {
      name: "Aqua.Tech",
      slug: "aqua-tech",
      email: "info@aquatechagency.com",
      website: "https://aquatechagency.com",
      country: "Jordan",
      currency: "JOD",
      timezone: "Asia/Amman",
      language: "ar",
    },
  })

  const owner = await prisma.user.upsert({
    where: {
      email: "admin@aquatech.local",
    },
    update: {
      companyId: company.id,
      name: "Aqua.Tech Owner",
      role: "OWNER",
      isActive: true,
    },
    create: {
      companyId: company.id,
      name: "Aqua.Tech Owner",
      email: "admin@aquatech.local",
      passwordHash,
      role: "OWNER",
      isActive: true,
    },
  })

  await prisma.notification.create({
    data: {
      companyId: company.id,
      userId: owner.id,
      title: "مرحبًا بك في AquaFlow",
      message: "تم تجهيز النظام الداخلي الأولي لشركة Aqua.Tech بنجاح.",
      type: "SUCCESS",
    },
  })

  console.log("Seed completed successfully")
  console.log("Company:", company.name)
  console.log("Owner email: admin@aquatech.local")
  console.log("Owner password: Admin@123456")
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })