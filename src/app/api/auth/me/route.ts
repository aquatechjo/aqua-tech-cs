import { err, handleApiError, ok } from "@/lib/api-response"
import { getCurrentUser } from "@/lib/auth"

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return err("غير مصرح", 401, { code: "UNAUTHORIZED" })
    }

    return ok({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: {
          id: user.company.id,
          name: user.company.name,
          slug: user.company.slug,
          email: user.company.email,
          website: user.company.website,
        },
      },
    })
  } catch (error) {
    return handleApiError(error, "AUTH_ME_ERROR")
  }
}
