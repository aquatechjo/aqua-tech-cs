import { NextResponse } from "next/server"

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status })
}

export function err(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      message,
      details,
    },
    { status }
  )
}