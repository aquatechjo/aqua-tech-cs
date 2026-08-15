import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  aquaAuthJourneyStates,
  aquaCommunicationKinds,
  aquaDocumentDensities,
  aquaPublicSurfaceKinds,
} from "../../src/design-system/public-contracts"
import { buildPasswordResetEmail } from "../../src/lib/email-templates"

const publicCss = readFileSync("src/styles/aqua-public.css", "utf8")
const authNotificationsCss = readFileSync(
  "src/styles/aqua-auth-notifications.css",
  "utf8",
)
const rootLayout = readFileSync("src/app/layout.tsx", "utf8")
const notificationsPage = readFileSync(
  "src/app/dashboard/notifications/page.tsx",
  "utf8",
)
const notificationsClient = readFileSync(
  "src/app/dashboard/notifications/NotificationsClient.tsx",
  "utf8",
)
const authShell = readFileSync("src/components/auth/AuthShell.tsx", "utf8")
const passwordInput = readFileSync(
  "src/components/auth/PasswordInput.tsx",
  "utf8"
)
const loginForm = readFileSync("src/app/login/LoginForm.tsx", "utf8")
const forgotPasswordForm = readFileSync(
  "src/app/forgot-password/ForgotPasswordForm.tsx",
  "utf8"
)
const resetPasswordForm = readFileSync(
  "src/app/reset-password/ResetPasswordForm.tsx",
  "utf8"
)
const emailTransport = readFileSync("src/lib/email.ts", "utf8")
const systemDocument = readFileSync(
  "src/components/aqua/AquaSystemDocument.tsx",
  "utf8"
)

test("DS-05 exposes constrained public and communication contracts", () => {
  assert.deepEqual(aquaPublicSurfaceKinds, [
    "auth",
    "public",
    "system-document",
  ])
  assert.deepEqual(aquaAuthJourneyStates, [
    "idle",
    "submitting",
    "success",
    "error",
    "invalid-link",
  ])
  assert.deepEqual(aquaCommunicationKinds, [
    "transactional-email",
    "system-document",
  ])
  assert.deepEqual(aquaDocumentDensities, ["comfortable", "compact"])
})

test("authentication routes use the canonical DS-05 shell and DS-02 primitives", () => {
  for (const source of [loginForm, forgotPasswordForm, resetPasswordForm]) {
    assert.match(source, /AuthShell/u)
    assert.match(source, /AquaAlert/u)
    assert.equal(source.includes("alert alert-"), false)
    assert.equal(source.includes("aqua-btn-primary"), false)
  }

  assert.match(loginForm, /AquaInput/u)
  assert.match(loginForm, /AquaButton/u)
  assert.match(forgotPasswordForm, /AquaInput/u)
  assert.match(forgotPasswordForm, /AquaButton/u)
  assert.match(resetPasswordForm, /AquaLinkButton/u)
  assert.match(authShell, /aqua-public-skip-link/u)
  assert.match(authShell, /AquaMark/u)
  assert.match(passwordInput, /aria-pressed/u)
  assert.match(passwordInput, /aqua-field__label-row/u)
})

test("public CSS covers responsive auth, focus, logical layout, print, and reduced motion", () => {
  for (const token of [
    "inset-inline-start",
    "inset-inline-end",
    ":focus-visible",
    "@media (max-width: 991.98px)",
    "@media print",
    "print-color-adjust",
    "prefers-reduced-motion",
    'data-aqua-density="compact"',
    "aqua-system-document",
  ]) {
    assert.match(
      publicCss,
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    )
  }
})

test("transactional email composition is provider-independent and escaped", () => {
  assert.match(emailTransport, /buildPasswordResetEmail/u)
  assert.equal(emailTransport.includes("<!doctype html>"), false)

  const email = buildPasswordResetEmail({
    recipientName: '<script>alert("x")</script>',
    resetUrl: "https://example.com/reset-password?token=a&next=b",
    ttlMinutes: 20,
  })

  assert.match(email.subject, /Aqua tech CS/u)
  assert.match(email.text, /20 دقيقة/u)
  assert.match(email.html, /dir="rtl"/u)
  assert.match(email.html, /role="presentation"/u)
  assert.match(email.html, /&lt;script&gt;/u)
  assert.match(email.html, /token=a&amp;next=b/u)
  assert.equal(email.html.includes('<script>alert("x")</script>'), false)

  assert.throws(
    () =>
      buildPasswordResetEmail({
        recipientName: "User",
        resetUrl: "javascript:alert(1)",
      }),
    /http or https/u
  )
})

test("system documents use the shared brand and approved density contract", () => {
  assert.match(systemDocument, /AquaDocumentDensity/u)
  assert.match(systemDocument, /data-aqua-density/u)
  assert.match(systemDocument, /AquaMark/u)
  assert.match(systemDocument, /aqua-system-document__header/u)
  assert.match(systemDocument, /aqua-system-document__footer/u)
})

test("UI-16 aligns notifications and authentication with the compact public contract", () => {
  assert.match(rootLayout, /aqua-auth-notifications\.css/u)
  assert.match(authShell, /aqua-auth-workspace/u)
  assert.match(loginForm, /aqua-auth-form--login/u)
  assert.match(forgotPasswordForm, /aqua-auth-form--recovery/u)
  assert.match(resetPasswordForm, /aqua-auth-form--reset/u)
  assert.match(notificationsPage, /aqua-notification-metrics/u)
  assert.doesNotMatch(
    notificationsPage,
    /Page \{currentPage\} \/ \{totalPages\}/u,
  )
  assert.match(notificationsClient, /غير مقروء/u)
  assert.match(notificationsClient, /وقت الإنشاء/u)
  assert.match(authNotificationsCss, /inset-inline-end: 0/u)
  assert.match(authNotificationsCss, /prefers-reduced-motion: reduce/u)
})
