import * as React from "react"
import { clsx } from "clsx"

type AquaBarChartDatum = {
  label: string
  value: number
}

type AquaBarChartProps = {
  data: AquaBarChartDatum[]
  formatValue?: (value: number) => string
  className?: string
  height?: number
  variant?: "accent" | "success" | "warning" | "danger"
}

const AquaBarChart = React.forwardRef<HTMLDivElement, AquaBarChartProps>(
  function AquaBarChart(
    { data, formatValue = (value) => String(value), className, height = 160, variant = "accent" },
    ref,
  ) {
    const max = Math.max(1, ...data.map((datum) => Math.abs(datum.value)))
    const summary = data.map((datum) => `${datum.label}: ${formatValue(datum.value)}`).join("، ")

    return (
      <div ref={ref} className={clsx("aqua-bar-chart", className)} dir="ltr">
        <div
          className="aqua-bar-chart__bars"
          style={{ blockSize: height }}
          role="img"
          aria-label={summary}
        >
          {data.map((datum) => {
            const percent = max === 0 ? 0 : (Math.abs(datum.value) / max) * 100

            return (
              <div className="aqua-bar-chart__col" key={datum.label}>
                <div className="aqua-bar-chart__track">
                  <div
                    className={clsx("aqua-bar-chart__bar", `aqua-bar-chart__bar--${variant}`)}
                    style={{ blockSize: `${percent}%` }}
                    title={`${datum.label}: ${formatValue(datum.value)}`}
                  />
                </div>
                <div className="aqua-bar-chart__value">{formatValue(datum.value)}</div>
                <div className="aqua-bar-chart__label">{datum.label}</div>
              </div>
            )
          })}
        </div>
      </div>
    )
  },
)

AquaBarChart.displayName = "AquaBarChart"

export type { AquaBarChartDatum, AquaBarChartProps }
export default AquaBarChart
