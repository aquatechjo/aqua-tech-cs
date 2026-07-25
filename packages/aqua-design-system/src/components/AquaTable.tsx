import * as React from "react"
import { clsx } from "clsx"

import type {
  AquaDataDensity,
  AquaTableMobileStrategy,
} from "../design-system"

type AquaTableProps = React.TableHTMLAttributes<HTMLTableElement> & {
  density?: AquaDataDensity
  mobileStrategy?: AquaTableMobileStrategy
  minWidth?: string
  caption?: string
  wrapperClassName?: string
}

const AquaTable = React.forwardRef<HTMLTableElement, AquaTableProps>(
  function AquaTable(
    {
      density = "comfortable",
      mobileStrategy = "scroll",
      minWidth = "760px",
      caption,
      className,
      wrapperClassName,
      children,
      style,
      ...props
    },
    ref
  ) {
    const wrapperStyle = {
      "--aqua-table-min-width": minWidth,
    } as React.CSSProperties

    return (
      <div
        className={clsx("aqua-table-shell", wrapperClassName)}
        data-aqua-density={density}
        data-aqua-mobile-strategy={mobileStrategy}
        style={wrapperStyle}
      >
        <table
          ref={ref}
          className={clsx("table aqua-table", className)}
          style={style}
          {...props}
        >
          {caption ? <caption className="visually-hidden">{caption}</caption> : null}
          {children}
        </table>
      </div>
    )
  }
)

AquaTable.displayName = "AquaTable"

export type { AquaTableProps }
export default AquaTable
