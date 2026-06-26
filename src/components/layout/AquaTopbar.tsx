import LogoutButton from "@/components/auth/LogoutButton"
import { AquaBadge } from "@/components/aqua"

export default function AquaTopbar({
  title,
  subtitle,
  userEmail,
  userRole,
}: {
  title: string
  subtitle: string
  userEmail: string
  userRole: string
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/75 px-6 py-4 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <AquaBadge>Growth • Software • AI</AquaBadge>
          <h1 className="mt-3 text-2xl font-black">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-left text-sm sm:block"
            dir="ltr"
          >
            <div className="font-semibold text-white">{userEmail}</div>
            <div className="text-xs text-slate-500">{userRole}</div>
          </div>

          <LogoutButton />
        </div>
      </div>
    </header>
  )
}
