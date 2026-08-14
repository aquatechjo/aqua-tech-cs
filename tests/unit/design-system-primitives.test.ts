import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  aquaAlertVariants,
  aquaBadgeVariants,
  aquaButtonSizes,
  aquaButtonVariants,
  aquaCardPaddings,
  aquaCardVariants,
  aquaFieldSizes,
  aquaSkeletonShapes,
  aquaSpinnerSizes,
} from "../../src/design-system"

const primitiveFiles = [
  "AquaAlert.tsx",
  "AquaBackground.tsx",
  "AquaBadge.tsx",
  "AquaButton.tsx",
  "AquaCard.tsx",
  "AquaEmptyState.tsx",
  "AquaInput.tsx",
  "AquaMark.tsx",
  "AquaSelect.tsx",
  "AquaSkeleton.tsx",
  "AquaSpinner.tsx",
  "AquaTechPattern.tsx",
  "AquaTextarea.tsx",
]

const prohibitedTailwindFragments = [
  "bg-gradient-to-",
  "bg-slate-",
  "border-white/",
  "from-cyan-",
  "rounded-2xl",
  "rounded-[",
  "shadow-cyan-",
  "text-slate-",
  "to-blue-",
  "w-full",
]

test("DS-02 exposes constrained primitive contracts", () => {
  assert.deepEqual(aquaButtonVariants, [
    "primary",
    "secondary",
    "ghost",
    "danger",
  ])
  assert.deepEqual(aquaButtonSizes, ["sm", "md", "lg"])
  assert.deepEqual(aquaFieldSizes, ["sm", "md", "lg"])
  assert.deepEqual(aquaCardVariants, ["surface", "soft", "outlined"])
  assert.deepEqual(aquaCardPaddings, ["none", "sm", "md", "lg"])
  assert.deepEqual(aquaBadgeVariants, [
    "aqua",
    "blue",
    "success",
    "warning",
    "danger",
    "muted",
  ])
  assert.deepEqual(aquaAlertVariants, [
    "info",
    "success",
    "warning",
    "danger",
    "neutral",
  ])
  assert.deepEqual(aquaSpinnerSizes, ["sm", "md", "lg"])
  assert.deepEqual(aquaSkeletonShapes, ["text", "circle", "card"])
})

test("shared DS-02 primitives use semantic classes instead of Tailwind recipes", () => {
  for (const fileName of primitiveFiles) {
    const source = readFileSync(
      join(process.cwd(), "src", "components", "aqua", fileName),
      "utf8"
    )

    assert.match(source, /aqua-/u, `${fileName} must use Aqua semantic classes`)

    for (const fragment of prohibitedTailwindFragments) {
      assert.equal(
        source.includes(fragment),
        false,
        `${fileName} contains prohibited Tailwind fragment: ${fragment}`
      )
    }
  }
})

test("primitive CSS covers focus, disabled, RTL, loading, and reduced motion", () => {
  const css = readFileSync(
    join(process.cwd(), "src", "styles", "aqua-primitives.css"),
    "utf8"
  )

  assert.match(css, /:focus-visible/u)
  assert.match(css, /:disabled/u)
  assert.match(css, /html\[dir="rtl"\]/u)
  assert.match(css, /aqua-button__spinner/u)
  assert.match(css, /prefers-reduced-motion/u)
  assert.match(css, /padding-inline/u)
  assert.match(css, /inset-inline/u)
})

test("UI-04 keeps button and field density on the operational size scale", () => {
  const primitivesCss = readFileSync(
    join(process.cwd(), "src", "styles", "aqua-primitives.css"),
    "utf8"
  )
  const bootstrapCss = readFileSync(
    join(process.cwd(), "src", "styles", "aqua-bootstrap.css"),
    "utf8"
  )

  for (const token of [
    ".aqua-button--sm",
    "min-block-size: 36px",
    ".aqua-button--md",
    "min-block-size: 42px",
    ".aqua-control--lg",
    "min-block-size: 48px",
  ]) {
    assert.match(primitivesCss, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }

  for (const token of [
    "UI-04 operational compatibility",
    ".btn-outline-info",
    ".form-control, .form-select",
    ":focus-visible",
    ":disabled",
  ]) {
    assert.match(bootstrapCss, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
})

test("UI-05 keeps cards, badges, skeletons, and empty states compact", () => {
  const primitivesCss = readFileSync(
    join(process.cwd(), "src", "styles", "aqua-primitives.css"),
    "utf8"
  )
  const bootstrapCss = readFileSync(
    join(process.cwd(), "src", "styles", "aqua-bootstrap.css"),
    "utf8"
  )

  for (const token of [
    ".aqua-card--padding-md",
    "padding: var(--at-space-4)",
    ".aqua-badge--md",
    "min-block-size: 26px",
    ".aqua-skeleton--card",
    "block-size: 140px",
    ".aqua-empty-state__icon",
  ]) {
    assert.match(primitivesCss, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }

  for (const token of [
    "UI-05 operational compatibility",
    ".badge:not(.aqua-badge)",
    ".aqua-card-soft.text-center",
    "border-style: dashed",
  ]) {
    assert.match(bootstrapCss, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
})
