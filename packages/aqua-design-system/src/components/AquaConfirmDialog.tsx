"use client"

import { Archive, CircleAlert, RotateCcw } from "lucide-react"

import AquaAlert from "./AquaAlert"
import AquaButton from "./AquaButton"
import AquaModal from "./AquaModal"

type AquaConfirmDialogProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: "primary" | "danger"
  loading?: boolean
  tone?: "warning" | "danger" | "neutral"
  icon?: React.ReactNode
}

function defaultIcon(tone: AquaConfirmDialogProps["tone"]) {
  if (tone === "danger") return <CircleAlert />
  if (tone === "neutral") return <RotateCcw />
  return <Archive />
}

export default function AquaConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  confirmVariant = "primary",
  loading = false,
  tone = "warning",
  icon,
}: AquaConfirmDialogProps) {
  return (
    <AquaModal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      closeOnBackdrop={!loading}
      footer={
        <div className="aqua-modal__action-row">
          <AquaButton
            variant="ghost"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </AquaButton>
          <AquaButton
            variant={confirmVariant}
            onClick={onConfirm}
            loading={loading}
            loadingLabel="جارٍ التنفيذ"
            data-aqua-autofocus
          >
            {confirmLabel}
          </AquaButton>
        </div>
      }
    >
      <AquaAlert
        variant={tone === "neutral" ? "neutral" : tone}
        icon={icon ?? defaultIcon(tone)}
      >
        {description}
      </AquaAlert>
    </AquaModal>
  )
}

export type { AquaConfirmDialogProps }
