import type { ReactNode } from "react"

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="aqua-page">
      <div className="aqua-grid" />

      <div className="aqua-layer">
        <div className="container min-vh-100 d-flex align-items-center py-5">
          <div className="row g-5 align-items-center w-100">
            <div className="col-12 col-lg-7 d-none d-lg-block">
              <span className="aqua-badge">Growth • Software • AI</span>

              <h1 className="display-3 fw-black mt-4 mb-4">
                AquaFlow
                <span className="d-block aqua-text-gradient">
                  Build. Launch. Grow.
                </span>
              </h1>

              <p className="fs-5 aqua-muted lh-lg col-xl-10">
                نظام داخلي يوحّد شغل Aqua.Tech: الفريق، العملاء، المشاريع،
                المهام، التنبيهات، وسير العمل من مكان واحد.
              </p>

              <div className="row g-3 mt-4 col-xl-10">
                {[
                  ["Core", "System"],
                  ["AI", "Ready"],
                  ["Ops", "Flow"],
                ].map(([title, subtitle]) => (
                  <div className="col-4" key={title}>
                    <div className="aqua-card-soft p-4 h-100">
                      <div className="fs-3 fw-bold text-info">{title}</div>
                      <div className="small aqua-muted mt-2">{subtitle}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-12 col-lg-5">
              <div
                className="aqua-card p-4 p-md-5 mx-auto"
                style={{ maxWidth: 480 }}
              >
                <div className="d-flex align-items-center gap-3 mb-4">
                  <div className="aqua-mark">AF</div>
                  <div>
                    <div className="fs-3 fw-black">AquaFlow</div>
                    <div className="small aqua-muted" dir="ltr">
                      Growth • Software • AI
                    </div>
                  </div>
                </div>

                {children}

                <div className="text-center small aqua-soft mt-4">
                  Aqua.Tech © Internal System
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
