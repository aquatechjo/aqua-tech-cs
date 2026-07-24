export const MONEY_SCALE = 2
export const QUANTITY_SCALE = 2

export type InvoiceLineInput = {
  description: string
  quantity: string | number
  unitPrice: string | number
}

function normalizedDecimal(value: string | number) {
  const normalized = String(value).trim()

  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error("INVALID_DECIMAL")
  }

  return normalized
}

export function parseScaledDecimal(
  value: string | number,
  scale = MONEY_SCALE,
  maximum = 999_999_999_999,
) {
  const normalized = normalizedDecimal(value)
  const [wholePart, fractionPart = ""] = normalized.split(".")

  if (fractionPart.length > scale) {
    throw new Error("TOO_MANY_DECIMALS")
  }

  const factor = 10 ** scale
  const whole = Number(wholePart)
  const fraction = Number(fractionPart.padEnd(scale, "0") || "0")
  const result = whole * factor + fraction

  if (!Number.isSafeInteger(result) || result < 0 || result > maximum * factor) {
    throw new Error("DECIMAL_OUT_OF_RANGE")
  }

  return result
}

export function minorToMoney(value: number) {
  if (!Number.isSafeInteger(value)) {
    throw new Error("INVALID_MINOR_AMOUNT")
  }

  const sign = value < 0 ? "-" : ""
  const absolute = Math.abs(value)
  const whole = Math.floor(absolute / 100)
  const fraction = String(absolute % 100).padStart(2, "0")
  return `${sign}${whole}.${fraction}`
}

export function calculateLineTotalMinor(
  quantity: string | number,
  unitPrice: string | number,
) {
  const quantityHundredths = parseScaledDecimal(quantity, QUANTITY_SCALE, 1_000_000)
  const unitPriceMinor = parseScaledDecimal(unitPrice, MONEY_SCALE)

  if (quantityHundredths <= 0) {
    throw new Error("QUANTITY_MUST_BE_POSITIVE")
  }

  return Math.round((quantityHundredths * unitPriceMinor) / 100)
}

export function calculateInvoiceTotals({
  items,
  discountAmount = "0",
  taxAmount = "0",
}: {
  items: InvoiceLineInput[]
  discountAmount?: string | number
  taxAmount?: string | number
}) {
  if (items.length === 0) {
    throw new Error("INVOICE_ITEMS_REQUIRED")
  }

  const normalizedItems = items.map((item, index) => {
    const description = item.description.trim()

    if (!description) {
      throw new Error("ITEM_DESCRIPTION_REQUIRED")
    }

    const lineTotalMinor = calculateLineTotalMinor(item.quantity, item.unitPrice)

    return {
      description,
      quantity: String(item.quantity).trim(),
      unitPrice: minorToMoney(parseScaledDecimal(item.unitPrice)),
      lineTotal: minorToMoney(lineTotalMinor),
      lineTotalMinor,
      sortOrder: index,
    }
  })

  const subtotalMinor = normalizedItems.reduce(
    (total, item) => total + item.lineTotalMinor,
    0,
  )
  const discountMinor = parseScaledDecimal(discountAmount)
  const taxMinor = parseScaledDecimal(taxAmount)

  if (discountMinor > subtotalMinor) {
    throw new Error("DISCOUNT_EXCEEDS_SUBTOTAL")
  }

  const totalMinor = subtotalMinor - discountMinor + taxMinor

  if (totalMinor <= 0) {
    throw new Error("INVOICE_TOTAL_MUST_BE_POSITIVE")
  }

  return {
    items: normalizedItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      sortOrder: item.sortOrder,
    })),
    subtotalMinor,
    discountMinor,
    taxMinor,
    totalMinor,
    subtotal: minorToMoney(subtotalMinor),
    discountAmount: minorToMoney(discountMinor),
    taxAmount: minorToMoney(taxMinor),
    totalAmount: minorToMoney(totalMinor),
  }
}


export function localDateKey(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value)

  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value

  if (!year || !month || !day) {
    throw new Error("DATE_FORMAT_ERROR")
  }

  return `${year}-${month}-${day}`
}


export function businessDate(value: Date, timeZone: string) {
  return new Date(`${localDateKey(value, timeZone)}T00:00:00.000Z`)
}

export type StoredInvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CANCELLED"

export type DisplayInvoiceStatus = StoredInvoiceStatus | "OVERDUE"

export function paymentAdjustedInvoiceStatus({
  currentStatus,
  totalMinor,
  amountPaidMinor,
}: {
  currentStatus: StoredInvoiceStatus
  totalMinor: number
  amountPaidMinor: number
}): StoredInvoiceStatus {
  if (currentStatus === "DRAFT" || currentStatus === "CANCELLED") {
    return currentStatus
  }

  if (amountPaidMinor >= totalMinor) return "PAID"
  if (amountPaidMinor > 0) return "PARTIALLY_PAID"
  return "ISSUED"
}

export function displayInvoiceStatus({
  status,
  dueDate,
  totalMinor,
  amountPaidMinor,
  now = new Date(),
  timeZone = "Asia/Amman",
}: {
  status: StoredInvoiceStatus
  dueDate: Date | string | null
  totalMinor: number
  amountPaidMinor: number
  now?: Date
  timeZone?: string
}): DisplayInvoiceStatus {
  if (
    (status === "ISSUED" || status === "PARTIALLY_PAID") &&
    dueDate &&
    localDateKey(new Date(dueDate), timeZone) < localDateKey(now, timeZone) &&
    amountPaidMinor < totalMinor
  ) {
    return "OVERDUE"
  }

  return status
}

export type ExpenseStatusValue =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "PAID"
  | "CANCELLED"

const expenseTransitions: Record<ExpenseStatusValue, readonly ExpenseStatusValue[]> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["PAID", "CANCELLED"],
  REJECTED: ["DRAFT", "CANCELLED"],
  PAID: [],
  CANCELLED: [],
}

export function canTransitionExpense(
  currentStatus: ExpenseStatusValue,
  nextStatus: ExpenseStatusValue,
) {
  return expenseTransitions[currentStatus].includes(nextStatus)
}

export function documentNumber(prefix: string, year: number, sequence: number) {
  if (!/^[A-Z]{2,5}$/.test(prefix) || !Number.isInteger(sequence) || sequence < 1) {
    throw new Error("INVALID_DOCUMENT_NUMBER_INPUT")
  }

  return `${prefix}-${year}-${String(sequence).padStart(4, "0")}`
}
