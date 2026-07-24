import { ApiError } from "@/lib/api-response"

const MAX_ORGANIZATION_CODE_LENGTH = 30

export function normalizeOrganizationCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_ORGANIZATION_CODE_LENGTH)
}

export function allocationTotal(allocations: readonly number[]) {
  return allocations.reduce((total, value) => total + value, 0)
}

export function assertAllocationCapacity(
  existingAllocations: readonly number[],
  nextAllocation: number
) {
  const nextTotal = allocationTotal(existingAllocations) + nextAllocation

  if (nextTotal > 100) {
    throw new ApiError(
      `مجموع توزيع وقت الموظف لا يمكن أن يتجاوز 100% (المجموع المطلوب ${nextTotal}%)`,
      400,
      "ALLOCATION_EXCEEDS_CAPACITY"
    )
  }

  return nextTotal
}
