import { NextResponse } from "next/server"

type ErrorResponseOptions = {
  code?: string
  details?: unknown
  headers?: HeadersInit
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown
  readonly headers?: HeadersInit

  constructor(
    message: string,
    status = 400,
    code = "BAD_REQUEST",
    options: Omit<ErrorResponseOptions, "code"> = {}
  ) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.details = options.details
    this.headers = options.headers
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status })
}

export function err(
  message: string,
  status = 400,
  optionsOrDetails?: ErrorResponseOptions | unknown
) {
  const options =
    optionsOrDetails === undefined
      ? {}
      : optionsOrDetails &&
    typeof optionsOrDetails === "object" &&
    ("code" in optionsOrDetails ||
      "details" in optionsOrDetails ||
      "headers" in optionsOrDetails)
      ? (optionsOrDetails as ErrorResponseOptions)
      : { details: optionsOrDetails }

  return NextResponse.json(
    {
      ok: false,
      message,
      code: options.code,
      details: options.details,
    },
    {
      status,
      headers: options.headers,
    }
  )
}

export function handleApiError(
  error: unknown,
  context: string,
  fallbackMessage = "حدث خطأ غير متوقع"
) {
  if (error instanceof ApiError) {
    return err(error.message, error.status, {
      code: error.code,
      details: error.details,
      headers: error.headers,
    })
  }

  console.error(`[${context}]`, error)

  return err(fallbackMessage, 500, {
    code: "INTERNAL_ERROR",
  })
}

export function withApiHandler<TArgs extends unknown[]>(
  context: string,
  handler: (...args: TArgs) => Promise<Response>,
  fallbackMessage?: string
) {
  return async (...args: TArgs) => {
    try {
      return await handler(...args)
    } catch (error) {
      return handleApiError(error, context, fallbackMessage)
    }
  }
}
