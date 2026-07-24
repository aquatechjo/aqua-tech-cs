import ResetPasswordForm from "./ResetPasswordForm"

export const metadata = {
  title: "تعيين كلمة مرور جديدة",
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>
}) {
  const params = await searchParams
  const token = Array.isArray(params.token) ? params.token[0] : params.token

  return <ResetPasswordForm token={token || ""} />
}
