import Link from "next/link"
import { AquaBadge, AquaMark } from "@/components/aqua"

const navItems = [
  { label: "لوحة التحكم", href: "/dashboard", active: true },
  { label: "الفريق", href: "/dashboard/team", disabled: true },
  { label: "العملاء", href: "/dashboard/clients", disabled: true },
  { label: "المشاريع", href: "/dashboard/projects", disabled: true },
  { label: "المهام", href: "/dashboard/tasks", disabled: true },
  { label: "التقارير", href: "/dashboard/reports", disabled: true },
]

const systemItems = [
  { label: "النشاطات", href: "/dashboard/activity", disabled: true },
  { label: "التنبيهات", href: "/dashboard/notifications", disabled: true },
  { label: "الإعدادات", href: "/dashboard/settings", disabled: true },
]

export default function AquaSidebar({
  companyName,
}: {
  companyName: string
}) {
  return (
    <aside className="fixed right-0 top-0 hidden h-screen w-76 border-l border-white/10 bg-[#030712]/90 p-5 backdrop-blur-xl xl:block">
      <div className="mb-7">
        <AquaMark />

        <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <AquaBadge>Internal OS</AquaBadge>
          <div className="mt-3 text-sm font-semibold text-white">
            {companyName}
          </div>
          <div className="mt-1 text-xs text-slate-500" dir="ltr">
            Growth • Software • AI
          </div>
        </div>
      </div>

      <nav className="space-y-6">
        <div>
          <div className="mb-3 px-3 text-xs font-bold uppercase tracking-[0.25em] text-slate-600">
            Operations
          </div>

          <div className="space-y-2">
            {navItems.map((item) =>
              item.disabled ? (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm text-slate-500"
                >
                  <span>{item.label}</span>
                  <span className="text-[10px] text-slate-700">قريبًا</span>
                </div>
              ) : (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center justify-between rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-bold text-cyan-200"
                >
                  <span>{item.label}</span>
                  <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-lg shadow-cyan-300/50" />
                </Link>
              )
            )}
          </div>
        </div>

        <div>
          <div className="mb-3 px-3 text-xs font-bold uppercase tracking-[0.25em] text-slate-600">
            System
          </div>

          <div className="space-y-2">
            {systemItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm text-slate-500"
              >
                <span>{item.label}</span>
                <span className="text-[10px] text-slate-700">قريبًا</span>
              </div>
            ))}
          </div>
        </div>
      </nav>

      <div className="absolute bottom-5 left-5 right-5 rounded-3xl border border-white/10 bg-slate-950/70 p-4">
        <div className="text-xs text-slate-500" dir="ltr">
          {"</>"} Aqua.Tech Stack
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {["Next.js", "AI", "API", "DB"].map((item) => (
            <span
              key={item}
              className="rounded-full border border-cyan-400/10 bg-cyan-400/5 px-2 py-1 text-[10px] text-cyan-200/80"
              dir="ltr"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </aside>
  )
}