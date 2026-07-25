import AquaPageState, { type AquaPageStateProps } from "./AquaPageState"

type AquaTableStateRowProps = AquaPageStateProps & {
  colSpan: number
}

export default function AquaTableStateRow({
  colSpan,
  ...stateProps
}: AquaTableStateRowProps) {
  return (
    <tr className="aqua-table__state-row">
      <td colSpan={colSpan}>
        <AquaPageState compact {...stateProps} />
      </td>
    </tr>
  )
}

export type { AquaTableStateRowProps }
