import { readdir, readFile, rm, mkdir, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import process from "node:process"

const root = process.cwd()
const packageRoot = path.join(root, "packages", "aqua-design-system")
const checkOnly = process.argv.includes("--check")

const componentSource = path.join(root, "src", "components", "aqua")
const contractSource = path.join(root, "src", "design-system")
const styleSource = path.join(root, "src", "styles")

const styleFiles = [
  "aqua-tokens.css",
  "aqua-bootstrap.css",
  "aqua-primitives.css",
  "aqua-shell.css",
  "aqua-patterns.css",
  "aqua-public.css",
]

function normalize(text) {
  return text.replace(/\r\n/gu, "\n")
}

async function listSourceFiles(directory, extensions) {
  const entries = await readdir(directory, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext)))
    .map((entry) => entry.name)
    .sort()
}

function parsePackageContract(source) {
  const packageName = source.match(/aquaDesignSystemPackageName = "([^"]+)"/u)?.[1]
  const version = source.match(/aquaDesignSystemVersion = "([^"]+)"/u)?.[1]

  if (!packageName || !version) {
    throw new Error("Unable to parse Design System package name or version")
  }

  return { packageName, version }
}

function rewriteComponentSource(source) {
  return source.replaceAll('from "@/design-system"', 'from "../design-system"')
}

async function buildExpectedFiles() {
  const expected = new Map()
  const componentFiles = await listSourceFiles(componentSource, [".ts", ".tsx"])
  const contractFiles = await listSourceFiles(contractSource, [".ts"])
  const packageContracts = await readFile(
    path.join(contractSource, "package-contracts.ts"),
    "utf8"
  )
  const { packageName, version } = parsePackageContract(packageContracts)

  for (const file of componentFiles) {
    const source = await readFile(path.join(componentSource, file), "utf8")
    expected.set(
      path.join("src", "components", file),
      normalize(rewriteComponentSource(source))
    )
  }

  for (const file of contractFiles) {
    const source = await readFile(path.join(contractSource, file), "utf8")
    expected.set(path.join("src", "design-system", file), normalize(source))
  }

  expected.set(
    path.join("src", "index.ts"),
    'export * from "./components"\nexport * from "./design-system"\n'
  )

  for (const file of styleFiles) {
    const source = await readFile(path.join(styleSource, file), "utf8")
    expected.set(path.join("styles", file), normalize(source))
  }

  expected.set(
    path.join("styles", "index.css"),
    styleFiles.map((file) => `@import "./${file}";`).join("\n") + "\n"
  )

  const manifest = {
    schemaVersion: 1,
    packageName,
    version,
    source: "Aqua Tech CS",
    cssImportOrder: styleFiles,
    componentEntry: "./src/index.ts",
    generatedDirectories: ["src/components", "src/design-system", "styles"],
  }

  expected.set("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`)

  const packageJson = {
    name: packageName,
    version,
    description:
      "Aqua.Tech Design DNA components, contracts, product themes, and Bootstrap CSS layers.",
    private: true,
    type: "module",
    main: "./src/index.ts",
    types: "./src/index.ts",
    files: ["src", "styles", "manifest.json", "README.md"],
    sideEffects: ["./styles/*.css"],
    exports: {
      ".": {
        types: "./src/index.ts",
        default: "./src/index.ts",
      },
      "./styles.css": "./styles/index.css",
      "./styles/tokens.css": "./styles/aqua-tokens.css",
      "./styles/bootstrap.css": "./styles/aqua-bootstrap.css",
      "./styles/primitives.css": "./styles/aqua-primitives.css",
      "./styles/shell.css": "./styles/aqua-shell.css",
      "./styles/patterns.css": "./styles/aqua-patterns.css",
      "./styles/public.css": "./styles/aqua-public.css",
      "./manifest": "./manifest.json",
      "./package.json": "./package.json",
    },
    peerDependencies: {
      bootstrap: ">=5.3.0",
      next: ">=16.0.0",
      react: ">=19.0.0",
      "react-dom": ">=19.0.0",
    },
    dependencies: {
      clsx: "^2.1.1",
      flatpickr: "^4.6.13",
      "lucide-react": "^1.21.0",
      sonner: "^2.0.7",
    },
  }

  expected.set("package.json", `${JSON.stringify(packageJson, null, 2)}\n`)

  expected.set(
    "README.md",
    `# ${packageName}\n\nInternal Aqua.Tech Design System package generated from Aqua Tech CS.\n\n## Version\n\n${version}\n\n## Next.js usage\n\nAdd the package to \`transpilePackages\`, import Bootstrap first, then import the ordered Design System CSS bundle:\n\n\`\`\`ts\n// next.config.ts\nconst nextConfig = {\n  transpilePackages: ["${packageName}"],\n}\n\nexport default nextConfig\n\`\`\`\n\n\`\`\`tsx\nimport "bootstrap/dist/css/bootstrap.min.css"\nimport "${packageName}/styles.css"\n\nimport { AquaButton, AquaCard } from "${packageName}"\n\`\`\`\n\n## Governance\n\nDo not edit generated package source directly. Edit Aqua Tech CS canonical sources and run \`npm run ds:sync\`.\n`
  )

  return expected
}

async function listGeneratedFiles(directory, prefix = "") {
  if (!existsSync(directory)) return []

  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const relative = path.join(prefix, entry.name)
    const absolute = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await listGeneratedFiles(absolute, relative)))
    } else {
      files.push(relative)
    }
  }

  return files.sort()
}

async function checkPackage(expected) {
  const actualFiles = await listGeneratedFiles(packageRoot)
  const expectedFiles = [...expected.keys()].sort()
  const missing = expectedFiles.filter((file) => !actualFiles.includes(file))
  const extra = actualFiles.filter((file) => !expectedFiles.includes(file))
  const changed = []

  for (const [relative, expectedContent] of expected) {
    const absolute = path.join(packageRoot, relative)
    if (!existsSync(absolute)) continue
    const actual = normalize(await readFile(absolute, "utf8"))
    if (actual !== expectedContent) changed.push(relative)
  }

  if (missing.length || extra.length || changed.length) {
    const details = [
      missing.length ? `Missing: ${missing.join(", ")}` : "",
      extra.length ? `Extra: ${extra.join(", ")}` : "",
      changed.length ? `Changed: ${changed.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n")

    throw new Error(
      `Aqua Design System package is out of sync. Run npm run ds:sync.\n${details}`
    )
  }
}

async function syncPackage(expected) {
  await rm(packageRoot, { recursive: true, force: true })

  for (const [relative, content] of expected) {
    const absolute = path.join(packageRoot, relative)
    await mkdir(path.dirname(absolute), { recursive: true })
    await writeFile(absolute, content, "utf8")
  }
}

const expected = await buildExpectedFiles()

if (checkOnly) {
  await checkPackage(expected)
  console.log("Aqua Design System package is synchronized")
} else {
  await syncPackage(expected)
  console.log(`Synchronized ${expected.size} Design System package files`)
}
