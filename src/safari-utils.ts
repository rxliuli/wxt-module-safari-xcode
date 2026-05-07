import { globby } from 'zx'
import path from 'node:path'
import fs from 'node:fs/promises'

export interface SafariPostBuildOptions {
  projectName: string
  appCategory: string
  bundleIdentifier: string
  developmentTeam?: string
  outputPath: string
  rootPath: string
}

export async function updateProjectConfig(options: SafariPostBuildOptions) {
  const projectConfigPath = path.resolve(
    options.rootPath,
    `${options.outputPath}/${options.projectName}.xcodeproj/project.pbxproj`,
  )
  const packageJsonModule = await import(path.resolve(options.rootPath, 'package.json'), {
    with: { type: 'json' },
  })
  const packageJson = packageJsonModule.default as { version: string }
  const content = await fs.readFile(projectConfigPath, 'utf-8')
  const newContent = content
    // Apple's safari-web-extension-converter rewrites the parent app's bundle id
    // by replacing the last segment with the (capitalised) project name — e.g.
    // `com.acme.foo` becomes `com.acme.FooApp` — while leaving the extension at
    // `com.acme.foo.Extension`. Xcode then rejects the build because the embedded
    // extension id no longer prefixes the parent. Force the parent back to the
    // user-supplied bundleIdentifier so the prefix invariant holds. Values may
    // be emitted quoted (e.g. when they contain a hyphen), so strip surrounding
    // quotes before checking the suffix.
    .replace(
      /PRODUCT_BUNDLE_IDENTIFIER = ("[^"]*"|[^;]+);/g,
      (match, raw: string) => {
        const id =
          raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw
        return id.endsWith('.Extension')
          ? match
          : `PRODUCT_BUNDLE_IDENTIFIER = ${options.bundleIdentifier};`
      },
    )
    .replaceAll(
      'MARKETING_VERSION = 1.0;',
      `MARKETING_VERSION = ${packageJson.version};`,
    )
    .replace(
      new RegExp(
        `INFOPLIST_KEY_CFBundleDisplayName = ("?${options.projectName}"?);`,
        'g',
      ),
      `INFOPLIST_KEY_CFBundleDisplayName = $1;\n\t\t\t\tINFOPLIST_KEY_LSApplicationCategoryType = "${options.appCategory}";`,
    )
    .replace(
      new RegExp(`GCC_WARN_UNUSED_VARIABLE = YES;`, 'g'),
      `GCC_WARN_UNUSED_VARIABLE = YES;\n\t\t\t\tINFOPLIST_KEY_LSApplicationCategoryType = "${options.appCategory}";`,
    )
    .replace(
      new RegExp(
        `INFOPLIST_KEY_CFBundleDisplayName = ("?${options.projectName}"?);`,
        'g',
      ),
      `INFOPLIST_KEY_CFBundleDisplayName = $1;\n\t\t\t\tINFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO;`,
    )
    .replaceAll(
      `COPY_PHASE_STRIP = NO;`,
      options.developmentTeam
        ? `COPY_PHASE_STRIP = NO;\n\t\t\t\tDEVELOPMENT_TEAM = ${options.developmentTeam};`
        : 'COPY_PHASE_STRIP = NO;',
    )
    .replace(
      /CURRENT_PROJECT_VERSION = \d+;/g,
      `CURRENT_PROJECT_VERSION = ${parseProjectVersion(packageJson.version)};`,
    )
  await fs.writeFile(projectConfigPath, newContent)
}

export async function updateInfoPlist(options: SafariPostBuildOptions) {
  const projectPath = path.resolve(options.rootPath, options.outputPath)
  const files = await globby('**/*.plist', {
    cwd: projectPath,
  })
  for (const file of files) {
    const content = await fs.readFile(path.resolve(projectPath, file), 'utf-8')
    await fs.writeFile(
      path.resolve(projectPath, file),
      content.replaceAll(
        '</dict>\n</plist>',
        '\t<key>CFBundleVersion</key>\n\t<string>$(CURRENT_PROJECT_VERSION)</string>\n</dict>\n</plist>',
      ),
    )
  }
}

function parseProjectVersion(version: string) {
  const [major, minor, patch] = version.split('.').map(Number)
  return major * 10000 + minor * 100 + patch
}
