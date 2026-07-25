"use client"

import * as React from "react"
import { Toaster, toast } from "sonner"

type AquaToastViewportProps = React.ComponentProps<typeof Toaster>

export default function AquaToastViewport({
  position = "top-center",
  closeButton = true,
  ...props
}: AquaToastViewportProps) {
  return (
    <Toaster
      position={position}
      closeButton={closeButton}
      className="aqua-toast-viewport"
      {...props}
    />
  )
}

export const aquaToast = {
  success(
    message: React.ReactNode,
    options?: Parameters<typeof toast.success>[1]
  ) {
    return toast.success(message, options)
  },
  error(
    message: React.ReactNode,
    options?: Parameters<typeof toast.error>[1]
  ) {
    return toast.error(message, options)
  },
  warning(
    message: React.ReactNode,
    options?: Parameters<typeof toast.warning>[1]
  ) {
    return toast.warning(message, options)
  },
  info(message: React.ReactNode, options?: Parameters<typeof toast.info>[1]) {
    return toast.info(message, options)
  },
  loading(
    message: React.ReactNode,
    options?: Parameters<typeof toast.loading>[1]
  ) {
    return toast.loading(message, options)
  },
  dismiss(id?: string | number) {
    return toast.dismiss(id)
  },
}
