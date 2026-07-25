"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { clsx } from "clsx"

import type { AquaModalSize } from "@/design-system"

import AquaButton from "./AquaButton"

const emptySubscribe = () => () => undefined

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",")

type AquaModalProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: AquaModalSize
  closeLabel?: string
  closeOnBackdrop?: boolean
  className?: string
}

export default function AquaModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeLabel = "إغلاق النافذة",
  closeOnBackdrop = true,
  className,
}: AquaModalProps) {
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
  const dialogRef = React.useRef<HTMLDivElement | null>(null)
  const onCloseRef = React.useRef(onClose)
  const titleId = React.useId()
  const descriptionId = React.useId()

  React.useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  React.useEffect(() => {
    if (!open) return

    const previousActiveElement = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const dialog = dialogRef.current
    const firstFocusable = dialog?.querySelector<HTMLElement>(
      `[data-aqua-autofocus], ${focusableSelector}`
    )
    window.requestAnimationFrame(() => {
      ;(firstFocusable ?? dialog)?.focus()
    })

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (event.key !== "Tab" || !dialogRef.current) return

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)
      ).filter((element) => !element.hasAttribute("disabled"))

      if (focusable.length === 0) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousActiveElement?.focus()
    }
  }, [open])

  if (!mounted || !open) return null

  return createPortal(
    <div
      className="aqua-modal-layer"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="aqua-modal-backdrop" aria-hidden="true" />
      <div
        ref={dialogRef}
        className={clsx(
          "aqua-modal",
          `aqua-modal--${size}`,
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="aqua-modal__header">
          <div className="aqua-modal__heading">
            <h2 id={titleId} className="aqua-modal__title">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="aqua-modal__description">
                {description}
              </p>
            ) : null}
          </div>

          <AquaButton
            variant="ghost"
            size="sm"
            className="aqua-modal__close"
            leadingIcon={<X />}
            aria-label={closeLabel}
            onClick={onClose}
          >
            {closeLabel}
          </AquaButton>
        </header>

        <div className="aqua-modal__body">{children}</div>

        {footer ? <footer className="aqua-modal__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body
  )
}

export type { AquaModalProps }
