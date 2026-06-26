export default function AquaTechPattern() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-slate-950" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.20),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.16),transparent_34%)]" />

      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:56px_56px]" />

      <div
        className="absolute left-10 top-28 hidden select-none text-7xl font-black text-cyan-400/[0.025] lg:block"
        dir="ltr"
      >
        {"</>"}
      </div>

      <div
        className="absolute bottom-16 left-1/3 hidden select-none text-6xl font-black text-blue-400/[0.025] lg:block"
        dir="ltr"
      >
        {"{ API }"}
      </div>

      <div
        className="absolute bottom-28 right-96 hidden select-none text-5xl font-black text-cyan-400/[0.025] lg:block"
        dir="ltr"
      >
        SQL
      </div>
    </div>
  )
}