import { aquaTechCsTheme } from "@/design-system"
import { PASSWORD_RESET_TTL_MINUTES } from "@/lib/password-reset"

export type TransactionalEmail = {
  subject: string
  text: string
  html: string
}

export function buildPaymentReceiptEmail({ recipientName, receiptReference, invoiceNumber, projectName, amount, currency, paymentMethod, paidAt, paymentReference, companyEmail }: { recipientName: string; receiptReference: string; invoiceNumber: string; projectName: string; amount: string; currency: string; paymentMethod: string; paidAt: string; paymentReference: string | null; companyEmail: string }): TransactionalEmail {
  const safe = { name: escapeHtml(recipientName), receipt: escapeHtml(receiptReference), invoice: escapeHtml(invoiceNumber), project: escapeHtml(projectName), amount: escapeHtml(amount), currency: escapeHtml(currency), method: escapeHtml(paymentMethod), date: escapeHtml(paidAt), reference: escapeHtml(paymentReference ?? "—"), email: escapeHtml(companyEmail) }
  const subject = `إيصال دفعة ${receiptReference} — ${invoiceNumber}`
  return {
    subject,
    text: [`مرحبًا ${recipientName}،`, "", `تم استلام دفعة بقيمة ${amount} ${currency} على الفاتورة ${invoiceNumber}.`, `المشروع: ${projectName}`, `مرجع الإيصال: ${receiptReference}`, `طريقة الدفع: ${paymentMethod}`, `تاريخ الدفع: ${paidAt}`, `مرجع الدفعة: ${paymentReference ?? "—"}`, "", `للاستفسار: ${companyEmail}`].join("\n"),
    html: `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#f1f5f9;color:#0f172a;font-family:Arial,'Segoe UI',Tahoma,sans-serif"><table role="presentation" width="100%"><tr><td align="center" style="padding:32px 14px"><table role="presentation" width="620" style="width:100%;max-width:620px;background:#fff;border:1px solid #dbe4ee;border-radius:22px;overflow:hidden"><tr><td style="height:5px;background:#059669"></td></tr><tr><td style="padding:30px 34px;text-align:right"><div style="font-size:13px;font-weight:800;color:#0e7490" dir="ltr">Aqua.Tech · ${safe.receipt}</div><h1 style="margin:12px 0 18px;font-size:26px">تم استلام الدفعة</h1><p style="font-size:16px;line-height:1.9">مرحبًا ${safe.name}،</p><p style="font-size:15px;line-height:1.9;color:#475569">نؤكد استلام دفعة على فاتورة مشروع <strong>${safe.project}</strong>.</p><table role="presentation" width="100%" style="background:#f8fafc;border-radius:14px;padding:16px"><tr><td>المبلغ</td><td align="left"><strong dir="ltr">${safe.amount} ${safe.currency}</strong></td></tr><tr><td>الفاتورة</td><td align="left" dir="ltr">${safe.invoice}</td></tr><tr><td>طريقة الدفع</td><td align="left">${safe.method}</td></tr><tr><td>تاريخ الدفع</td><td align="left" dir="ltr">${safe.date}</td></tr><tr><td>مرجع الدفعة</td><td align="left" dir="ltr">${safe.reference}</td></tr></table><p style="font-size:13px;color:#64748b;margin-top:22px">للاستفسار: <span dir="ltr">${safe.email}</span></p></td></tr></table></td></tr></table></body></html>`,
  }
}

export function buildAmendmentInvoicePaymentReminderEmail({ recipientName, invoiceNumber, projectName, outstandingAmount, currency, dueDate, portalUrl, validUntilLabel }: { recipientName: string; invoiceNumber: string; projectName: string; outstandingAmount: string; currency: string; dueDate: string; portalUrl: string; validUntilLabel: string }): TransactionalEmail {
  const url = requireSafeWebUrl(portalUrl)
  const safe = { name: escapeHtml(recipientName), invoice: escapeHtml(invoiceNumber), project: escapeHtml(projectName), amount: escapeHtml(outstandingAmount), currency: escapeHtml(currency), due: escapeHtml(dueDate), url: escapeHtml(url), expiry: escapeHtml(validUntilLabel) }
  const subject = `تذكير دفع الفاتورة ${invoiceNumber} من Aqua Tech`
  return {
    subject,
    text: [`مرحبًا ${recipientName}،`, "", `نذكّرك بوجود مبلغ مستحق على الفاتورة ${invoiceNumber} للمشروع ${projectName}.`, `المبلغ المتبقي: ${outstandingAmount} ${currency}`, `تاريخ الاستحقاق: ${dueDate}`, `راجع الفاتورة عبر الرابط الآمن: ${url}`, `صلاحية الرابط حتى: ${validUntilLabel}`].join("\n"),
    html: `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#f1f5f9;color:#0f172a;font-family:Arial,'Segoe UI',Tahoma,sans-serif"><table role="presentation" width="100%"><tr><td align="center" style="padding:32px 14px"><table role="presentation" width="620" style="width:100%;max-width:620px;background:#fff;border:1px solid #dbe4ee;border-radius:22px;overflow:hidden"><tr><td style="height:5px;background:#0e7490"></td></tr><tr><td style="padding:30px 34px;text-align:right"><div style="font-size:13px;font-weight:800;color:#0e7490" dir="ltr">Aqua.Tech · ${safe.invoice}</div><h1 style="margin:12px 0 18px;font-size:26px">تذكير بدفع الفاتورة</h1><p style="font-size:16px;line-height:1.9">مرحبًا ${safe.name}،</p><p style="font-size:15px;line-height:1.9;color:#475569">نذكّرك بوجود مبلغ مستحق على فاتورة مشروع <strong>${safe.project}</strong>.</p><p style="font-size:15px;color:#475569">المتبقي: <strong dir="ltr">${safe.amount} ${safe.currency}</strong><br/>الاستحقاق: <span dir="ltr">${safe.due}</span></p><p style="margin:24px 0"><a href="${safe.url}" style="display:inline-block;padding:13px 22px;border-radius:12px;background:#0e7490;color:#fff;font-weight:800;text-decoration:none">مراجعة الفاتورة</a></p><p style="font-size:13px;color:#64748b">صلاحية الرابط حتى: ${safe.expiry}. لا تشارك هذا الرابط.</p></td></tr></table></td></tr></table></body></html>`,
  }
}

export function buildAmendmentInvoicePortalDeliveryEmail({
  recipientName,
  invoiceNumber,
  projectName,
  totalAmount,
  currency,
  dueDate,
  portalUrl,
  validUntilLabel,
}: {
  recipientName: string
  invoiceNumber: string
  projectName: string
  totalAmount: string
  currency: string
  dueDate: string
  portalUrl: string
  validUntilLabel: string
}): TransactionalEmail {
  const normalizedPortalUrl = requireSafeWebUrl(portalUrl)
  const safe = {
    name: escapeHtml(recipientName),
    invoice: escapeHtml(invoiceNumber),
    project: escapeHtml(projectName),
    total: escapeHtml(totalAmount),
    currency: escapeHtml(currency),
    due: escapeHtml(dueDate),
    url: escapeHtml(normalizedPortalUrl),
    expiry: escapeHtml(validUntilLabel),
  }
  const subject = `رابط الفاتورة ${invoiceNumber} من Aqua Tech`
  return {
    subject,
    text: [
      `مرحبًا ${recipientName}،`,
      "",
      `يمكنك مراجعة الفاتورة ${invoiceNumber} للمشروع ${projectName} عبر الرابط الآمن التالي:`,
      normalizedPortalUrl,
      `الإجمالي: ${totalAmount} ${currency}`,
      `تاريخ الاستحقاق: ${dueDate}`,
      `صلاحية الرابط حتى: ${validUntilLabel}`,
      "",
      "لا تشارك هذا الرابط؛ فهو يمنح وصولًا مباشرًا إلى نسخة الفاتورة المخصصة للعميل.",
    ].join("\n"),
    html: `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#f1f5f9;color:#0f172a;font-family:Arial,'Segoe UI',Tahoma,sans-serif"><table role="presentation" width="100%"><tr><td align="center" style="padding:32px 14px"><table role="presentation" width="620" style="width:100%;max-width:620px;background:#fff;border:1px solid #dbe4ee;border-radius:22px;overflow:hidden"><tr><td style="height:5px;background:#0e7490"></td></tr><tr><td style="padding:30px 34px;text-align:right"><div style="font-size:13px;font-weight:800;color:#0e7490" dir="ltr">Aqua.Tech · ${safe.invoice}</div><h1 style="margin:12px 0 18px;font-size:26px">بوابة الفاتورة الآمنة</h1><p style="font-size:16px;line-height:1.9">مرحبًا ${safe.name}،</p><p style="font-size:15px;line-height:1.9;color:#475569">يمكنك مراجعة فاتورة مشروع <strong>${safe.project}</strong> عبر الرابط الآمن.</p><p style="margin:24px 0"><a href="${safe.url}" style="display:inline-block;padding:13px 22px;border-radius:12px;background:#0e7490;color:#fff;font-weight:800;text-decoration:none">فتح الفاتورة</a></p><p style="font-size:14px;color:#475569">الإجمالي: <strong dir="ltr">${safe.total} ${safe.currency}</strong><br/>الاستحقاق: <span dir="ltr">${safe.due}</span><br/>صلاحية الرابط حتى: ${safe.expiry}</p><p style="font-size:13px;line-height:1.8;color:#64748b">لا تشارك هذا الرابط؛ فهو يمنح وصولًا مباشرًا إلى نسخة الفاتورة المخصصة للعميل.</p></td></tr></table></td></tr></table></body></html>`,
  }
}

export function buildAmendmentInvoiceDeliveryEmail({
  recipientName,
  invoiceNumber,
  amendmentNumber,
  projectName,
  totalAmount,
  currency,
  issueDate,
  dueDate,
  companyEmail,
}: {
  recipientName: string
  invoiceNumber: string
  amendmentNumber: string
  projectName: string
  totalAmount: string
  currency: string
  issueDate: string
  dueDate: string
  companyEmail: string
}): TransactionalEmail {
  const safe = {
    name: escapeHtml(recipientName),
    invoice: escapeHtml(invoiceNumber),
    amendment: escapeHtml(amendmentNumber),
    project: escapeHtml(projectName),
    total: escapeHtml(totalAmount),
    currency: escapeHtml(currency),
    issue: escapeHtml(issueDate),
    due: escapeHtml(dueDate),
    email: escapeHtml(companyEmail),
  }
  const subject = `فاتورة ${invoiceNumber} من Aqua Tech`
  const text = [
    `مرحبًا ${recipientName}،`,
    "",
    `تم إصدار الفاتورة ${invoiceNumber} المرتبطة بملحق العقد ${amendmentNumber}.`,
    `المشروع: ${projectName}`,
    `الإجمالي: ${totalAmount} ${currency}`,
    `تاريخ الإصدار: ${issueDate}`,
    `تاريخ الاستحقاق: ${dueDate}`,
    "",
    `للاستفسار أو طلب نسخة إضافية تواصل معنا عبر ${companyEmail}.`,
    "هذه الرسالة لا تحتوي رابطًا إلى النظام الداخلي.",
    "",
    `Aqua.Tech — ${aquaTechCsTheme.productName}`,
  ].join("\n")

  return {
    subject,
    text,
    html: `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#f1f5f9;color:#0f172a;font-family:Arial,'Segoe UI',Tahoma,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 14px">
<table role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;background:#fff;border:1px solid #dbe4ee;border-radius:22px;overflow:hidden">
<tr><td style="height:5px;background:#0e7490"></td></tr><tr><td style="padding:30px 34px;text-align:right">
<div style="font-size:13px;font-weight:800;color:#0e7490" dir="ltr">Aqua.Tech · ${safe.invoice}</div>
<h1 style="margin:12px 0 18px;font-size:26px">فاتورة صادرة</h1>
<p style="font-size:16px;line-height:1.9">مرحبًا ${safe.name}،</p>
<p style="font-size:15px;line-height:1.9;color:#475569">تم إصدار الفاتورة المرتبطة بملحق العقد <strong dir="ltr">${safe.amendment}</strong>.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px">
<tr><td style="padding:16px">المشروع</td><td style="padding:16px;font-weight:800">${safe.project}</td></tr>
<tr><td style="padding:16px">الإجمالي</td><td style="padding:16px;font-weight:900" dir="ltr">${safe.total} ${safe.currency}</td></tr>
<tr><td style="padding:16px">الإصدار</td><td style="padding:16px" dir="ltr">${safe.issue}</td></tr>
<tr><td style="padding:16px">الاستحقاق</td><td style="padding:16px" dir="ltr">${safe.due}</td></tr></table>
<p style="font-size:13px;line-height:1.8;color:#64748b">للاستفسار أو طلب نسخة إضافية: <span dir="ltr">${safe.email}</span></p>
</td></tr><tr><td style="padding:18px 34px;background:#f8fafc;color:#64748b;font-size:12px">هذه الرسالة لا تحتوي أي رابط إلى النظام الداخلي.</td></tr>
</table></td></tr></table></body></html>`,
  }
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
  const subject = `إعادة تعيين كلمة مرور ${aquaTechCsTheme.productName}`

  return {
    subject,
    text: [
      `مرحبًا ${recipientName}،`,
      "",
      `تلقينا طلبًا لإعادة تعيين كلمة مرور حسابك في ${aquaTechCsTheme.productName}.`,
      `استخدم الرابط التالي خلال ${ttlMinutes} دقيقة:`,
      normalizedResetUrl,
      "",
      "الرابط يُستخدم مرة واحدة فقط. إذا لم تطلب هذا التغيير، تجاهل الرسالة ولن تتغير كلمة المرور.",
      "",
      `Aqua.Tech — ${aquaTechCsTheme.productName}`,
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
      رابط آمن لإعادة تعيين كلمة مرور ${aquaTechCsTheme.productName}، صالح لمدة ${ttlMinutes} دقيقة.
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
                          <td style="width:48px;height:48px;border-radius:15px;background:#0e7490;color:#ffffff;font-size:14px;font-weight:900;text-align:center;vertical-align:middle" dir="ltr">CS</td>
                          <td style="padding-right:12px;text-align:right">
                            <div style="font-size:19px;font-weight:900;color:#0f172a">${aquaTechCsTheme.productName}</div>
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
                <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.9">تلقينا طلبًا لإعادة تعيين كلمة مرور حسابك في ${aquaTechCsTheme.productName}. استخدم الزر التالي لإكمال العملية بأمان.</p>
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
                <p style="margin:8px 0 0;color:#94a3b8;font-size:11px" dir="ltr">Aqua.Tech © ${aquaTechCsTheme.productName}</p>
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

export function buildProposalDeliveryEmail({
  recipientName,
  proposalNumber,
  proposalTitle,
  proposalUrl,
  validUntilLabel,
}: {
  recipientName: string
  proposalNumber: string
  proposalTitle: string
  proposalUrl: string
  validUntilLabel: string
}): TransactionalEmail {
  const normalizedProposalUrl = requireSafeWebUrl(proposalUrl)
  const safeName = escapeHtml(recipientName)
  const safeNumber = escapeHtml(proposalNumber)
  const safeTitle = escapeHtml(proposalTitle)
  const safeUrl = escapeHtml(normalizedProposalUrl)
  const safeValidUntil = escapeHtml(validUntilLabel)
  const subject = `عرض ${safeNumber} من Aqua Tech`

  return {
    subject: `عرض ${proposalNumber} من Aqua Tech`,
    text: [
      `مرحبًا ${recipientName}،`,
      "",
      `أصبح العرض ${proposalNumber} جاهزًا للمراجعة:`,
      proposalTitle,
      "",
      normalizedProposalUrl,
      "",
      `يبقى العرض صالحًا حتى ${validUntilLabel}.`,
      "يمكنك طلب تعديل أو قبول العرض أو رفضه من الرابط الآمن.",
      "",
      "لا تشارك هذا الرابط؛ فهو مخصص للوصول إلى نسخة عرضك.",
      "",
      `Aqua.Tech — ${aquaTechCsTheme.productName}`,
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
      العرض ${safeNumber} جاهز للمراجعة والرد عبر رابط آمن.
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
                          <td style="width:48px;height:48px;border-radius:15px;background:#0e7490;color:#ffffff;font-size:14px;font-weight:900;text-align:center;vertical-align:middle" dir="ltr">AT</td>
                          <td style="padding-right:12px;text-align:right">
                            <div style="font-size:19px;font-weight:900;color:#0f172a">Aqua Tech</div>
                            <div style="margin-top:3px;font-size:11px;font-weight:700;letter-spacing:.04em;color:#64748b" dir="ltr">Growth • Software • AI</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td style="vertical-align:middle;text-align:left">
                      <span style="display:inline-block;border:1px solid #bae6fd;border-radius:999px;background:#ecfeff;color:#0e7490;padding:6px 10px;font-size:11px;font-weight:800" dir="ltr">${safeNumber}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 34px 34px;text-align:right">
                <h1 style="margin:0 0 16px;color:#0f172a;font-size:27px;line-height:1.35;font-weight:900">العرض جاهز للمراجعة</h1>
                <p style="margin:0 0 12px;color:#334155;font-size:16px;line-height:1.9">مرحبًا ${safeName}،</p>
                <p style="margin:0 0 10px;color:#475569;font-size:15px;line-height:1.9">أعددنا لك العرض التالي:</p>
                <p style="margin:0 0 24px;color:#0f172a;font-size:17px;line-height:1.8;font-weight:800">${safeTitle}</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px">
                  <tr>
                    <td style="border-radius:14px;background:#0e7490">
                      <a href="${safeUrl}" style="display:inline-block;padding:14px 24px;color:#ffffff;font-size:15px;font-weight:900;text-decoration:none">مراجعة العرض والرد</a>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;border:1px solid #dbeafe;border-radius:16px;background:#f8fafc">
                  <tr>
                    <td style="padding:16px 18px;color:#475569;font-size:13px;line-height:1.8">
                      <strong style="color:#0f172a">صلاحية العرض:</strong>
                      حتى ${safeValidUntil}. يمكنك طلب تعديل أو قبول العرض أو رفضه من الصفحة نفسها.
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;color:#64748b;font-size:12px;line-height:1.8">إذا لم يعمل الزر، انسخ الرابط التالي والصقه في المتصفح:</p>
                <p style="margin:0;direction:ltr;text-align:left;word-break:break-all;color:#0369a1;font-size:12px;line-height:1.7">${safeUrl}</p>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #e2e8f0;background:#f8fafc;padding:20px 34px;text-align:right">
                <p style="margin:0;color:#64748b;font-size:12px;line-height:1.8">هذا رابط خاص بنسخة عرضك. لا تشاركه مع أشخاص غير مخولين.</p>
                <p style="margin:8px 0 0;color:#94a3b8;font-size:11px" dir="ltr">Aqua.Tech © ${aquaTechCsTheme.productName}</p>
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

export function buildProjectFeedbackInvitationEmail({
  recipientName,
  projectName,
  feedbackUrl,
  validUntilLabel,
}: {
  recipientName: string
  projectName: string
  feedbackUrl: string
  validUntilLabel: string
}): TransactionalEmail {
  const normalizedUrl = requireSafeWebUrl(feedbackUrl)
  const safeName = escapeHtml(recipientName)
  const safeProject = escapeHtml(projectName)
  const safeUrl = escapeHtml(normalizedUrl)
  const safeExpiry = escapeHtml(validUntilLabel)
  const subject = `نود سماع رأيك حول ${projectName}`
  return {
    subject,
    text: [`مرحبًا ${recipientName}،`, "", `شكرًا لتعاونك معنا في مشروع ${projectName}.`, "نقدّر مشاركتك تقييمًا مختصرًا يساعدنا على تحسين تجربتك.", "", normalizedUrl, "", `الرابط صالح حتى ${validUntilLabel} ويقبل إرسالًا واحدًا فقط.`, "", `Aqua.Tech — ${aquaTechCsTheme.productName}`].join("\n"),
    html: `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:0;background:#f1f5f9;color:#0f172a;font-family:Arial,'Segoe UI',Tahoma,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:32px 14px"><table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;border:1px solid #dbe4ee;border-radius:24px;background:#fff;overflow:hidden"><tr><td style="height:5px;background:linear-gradient(90deg,#06b6d4,#2563eb)"></td></tr><tr><td style="padding:30px 34px"><div style="font-size:20px;font-weight:900">Aqua Tech</div><h1 style="margin:28px 0 14px;font-size:26px">رأيك يصنع تجربة أفضل</h1><p style="font-size:16px;line-height:1.9">مرحبًا ${safeName}،</p><p style="font-size:15px;line-height:1.9">شكرًا لتعاونك معنا في مشروع <strong>${safeProject}</strong>. نرجو تخصيص دقيقة لمشاركة تقييمك.</p><p style="margin:26px 0"><a href="${safeUrl}" style="display:inline-block;border-radius:14px;background:#0e7490;color:#fff;padding:14px 24px;font-weight:900;text-decoration:none">إرسال التقييم</a></p><p style="color:#64748b;font-size:12px;line-height:1.8">الرابط صالح حتى ${safeExpiry} ويقبل إرسالًا واحدًا فقط. لا تشاركه مع الآخرين.</p><p style="direction:ltr;text-align:left;word-break:break-all;color:#0369a1;font-size:11px">${safeUrl}</p></td></tr></table></td></tr></table></body></html>`,
  }
}

export function buildProjectFeedbackReminderEmail({ recipientName, projectName, feedbackUrl, validUntilLabel }: { recipientName: string; projectName: string; feedbackUrl: string; validUntilLabel: string }): TransactionalEmail {
  const normalizedUrl = requireSafeWebUrl(feedbackUrl)
  const safeName = escapeHtml(recipientName)
  const safeProject = escapeHtml(projectName)
  const safeUrl = escapeHtml(normalizedUrl)
  const safeExpiry = escapeHtml(validUntilLabel)
  const subject = `تذكير لطيف: تقييم مشروع ${projectName}`
  return {
    subject,
    text: [`مرحبًا ${recipientName}،`, "", `هذا تذكير لطيف بمشاركة رأيك حول مشروع ${projectName}.`, "", normalizedUrl, "", `الرابط صالح حتى ${validUntilLabel} ويقبل إرسالًا واحدًا فقط.`, "", `Aqua.Tech — ${aquaTechCsTheme.productName}`].join("\n"),
    html: `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:0;background:#f1f5f9;color:#0f172a;font-family:Arial,'Segoe UI',Tahoma,sans-serif"><table role="presentation" width="100%"><tr><td align="center" style="padding:32px 14px"><table role="presentation" width="620" style="width:100%;max-width:620px;border:1px solid #dbe4ee;border-radius:24px;background:#fff"><tr><td style="padding:30px 34px"><div style="font-size:20px;font-weight:900">Aqua Tech</div><h1>تذكير لطيف بمشاركة رأيك</h1><p>مرحبًا ${safeName}،</p><p>ما زلنا نود سماع رأيك حول مشروع <strong>${safeProject}</strong>.</p><p style="margin:26px 0"><a href="${safeUrl}" style="display:inline-block;border-radius:14px;background:#0e7490;color:#fff;padding:14px 24px;font-weight:900;text-decoration:none">إرسال التقييم</a></p><p style="color:#64748b;font-size:12px">الرابط صالح حتى ${safeExpiry} ويقبل إرسالًا واحدًا فقط.</p></td></tr></table></td></tr></table></body></html>`,
  }
}
