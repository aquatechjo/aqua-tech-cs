import { PASSWORD_RESET_TTL_MINUTES } from "@/lib/password-reset"

export type TransactionalEmail = {
  subject: string
  text: string
  html: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function requireSafeWebUrl(value: string) {
  const url = new URL(value)

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Transactional email links must use http or https")
  }

  return url.toString()
}

export function buildPasswordResetEmail({
  recipientName,
  resetUrl,
  ttlMinutes = PASSWORD_RESET_TTL_MINUTES,
}: {
  recipientName: string
  resetUrl: string
  ttlMinutes?: number
}): TransactionalEmail {
  const normalizedResetUrl = requireSafeWebUrl(resetUrl)
  const safeName = escapeHtml(recipientName)
  const safeResetUrl = escapeHtml(normalizedResetUrl)
  const subject = "إعادة تعيين كلمة مرور AquaFlow"

  return {
    subject,
    text: [
      `مرحبًا ${recipientName}،`,
      "",
      "تلقينا طلبًا لإعادة تعيين كلمة مرور حسابك في AquaFlow.",
      `استخدم الرابط التالي خلال ${ttlMinutes} دقيقة:`,
      normalizedResetUrl,
      "",
      "الرابط يُستخدم مرة واحدة فقط. إذا لم تطلب هذا التغيير، تجاهل الرسالة ولن تتغير كلمة المرور.",
      "",
      "Aqua.Tech — AquaFlow Internal System",
    ].join("\n"),
    html: `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;color:#0f172a;font-family:Arial,'Segoe UI',Tahoma,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">
      رابط آمن لإعادة تعيين كلمة مرور AquaFlow، صالح لمدة ${ttlMinutes} دقيقة.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f1f5f9">
      <tr>
        <td align="center" style="padding:32px 14px">
          <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;border:1px solid #dbe4ee;border-radius:24px;background:#ffffff;box-shadow:0 18px 50px rgba(15,23,42,.10);overflow:hidden">
            <tr>
              <td style="height:5px;background:linear-gradient(90deg,#06b6d4,#2563eb)"></td>
            </tr>
            <tr>
              <td style="padding:30px 34px 20px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="vertical-align:middle">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="width:48px;height:48px;border-radius:15px;background:#0e7490;color:#ffffff;font-size:14px;font-weight:900;text-align:center;vertical-align:middle" dir="ltr">AF</td>
                          <td style="padding-right:12px;text-align:right">
                            <div style="font-size:19px;font-weight:900;color:#0f172a">AquaFlow</div>
                            <div style="margin-top:3px;font-size:11px;font-weight:700;letter-spacing:.04em;color:#64748b" dir="ltr">Growth • Software • AI</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td style="vertical-align:middle;text-align:left">
                      <span style="display:inline-block;border:1px solid #bae6fd;border-radius:999px;background:#ecfeff;color:#0e7490;padding:6px 10px;font-size:11px;font-weight:800">رسالة أمان</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 34px 34px;text-align:right">
                <h1 style="margin:0 0 16px;color:#0f172a;font-size:27px;line-height:1.35;font-weight:900">إعادة تعيين كلمة المرور</h1>
                <p style="margin:0 0 12px;color:#334155;font-size:16px;line-height:1.9">مرحبًا ${safeName}،</p>
                <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.9">تلقينا طلبًا لإعادة تعيين كلمة مرور حسابك في AquaFlow. استخدم الزر التالي لإكمال العملية بأمان.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px">
                  <tr>
                    <td style="border-radius:14px;background:#0e7490">
                      <a href="${safeResetUrl}" style="display:inline-block;padding:14px 24px;color:#ffffff;font-size:15px;font-weight:900;text-decoration:none">تعيين كلمة مرور جديدة</a>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;border:1px solid #dbeafe;border-radius:16px;background:#f8fafc">
                  <tr>
                    <td style="padding:16px 18px;color:#475569;font-size:13px;line-height:1.8">
                      <strong style="color:#0f172a">ملاحظة أمنية:</strong>
                      الرابط صالح لمدة ${ttlMinutes} دقيقة ويُستخدم مرة واحدة فقط. سيؤدي تغيير كلمة المرور إلى إنهاء الجلسات القديمة.
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;color:#64748b;font-size:12px;line-height:1.8">إذا لم يعمل الزر، انسخ الرابط التالي والصقه في المتصفح:</p>
                <p style="margin:0;direction:ltr;text-align:left;word-break:break-all;color:#0369a1;font-size:12px;line-height:1.7">${safeResetUrl}</p>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #e2e8f0;background:#f8fafc;padding:20px 34px;text-align:right">
                <p style="margin:0;color:#64748b;font-size:12px;line-height:1.8">إذا لم تطلب هذا التغيير، تجاهل الرسالة ولن تتغير كلمة المرور.</p>
                <p style="margin:8px 0 0;color:#94a3b8;font-size:11px" dir="ltr">Aqua.Tech © AquaFlow Internal System</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  }
}
