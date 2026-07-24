import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import ForgotPasswordForm from "./ForgotPasswordForm"

export const metadata = {
  title: "استعادة كلمة المرور",
}

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser()

  if (user) {
    redirect("/dashboard")
  }

  return <ForgotPasswordForm />
}
