import { describe, test, expect, beforeEach } from 'vitest'
import { existsSync } from 'node:fs'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const outputDir = path.join(root, '.output')

const DEMO_BUNDLE_ID = 'com.example.safari-demo'

function extractBundleIds(pbx: string): string[] {
  return [
    ...pbx.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ("[^"]*"|[^;]+);/g),
  ].map((m) => {
    const raw = m[1].trim()
    return raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw
  })
}

function assertBundleIdsConsistent(pbx: string) {
  const ids = extractBundleIds(pbx)
  expect(ids.length).toBeGreaterThan(0)
  // Both targets must be present — otherwise a buggy fix that strips
  // `.Extension` from every id would silently pass the per-id checks below.
  expect(ids).toContain(DEMO_BUNDLE_ID)
  expect(ids).toContain(`${DEMO_BUNDLE_ID}.Extension`)
  for (const id of ids) {
    if (id.endsWith('.Extension')) {
      expect(id).toBe(`${DEMO_BUNDLE_ID}.Extension`)
    } else {
      expect(id).toBe(DEMO_BUNDLE_ID)
    }
  }
}

async function build(opts: { mv3?: boolean; env?: Record<string, string> } = {}) {
  const args = ['wxt', 'build', '-b', 'safari']
  if (opts.mv3) args.push('--mv3')
  await new Promise<void>((resolve, reject) => {
    const child = spawn('pnpm', args, {
      cwd: root,
      env: { ...process.env, ...opts.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    child.stdout?.on('data', () => {})
    child.stderr?.on('data', (d) => {
      stderr += d.toString()
    })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`wxt build exited with ${code}\n${stderr}`))
    })
    child.on('error', reject)
  })
}

beforeEach(async () => {
  await rm(outputDir, { recursive: true, force: true })
})

describe('Safari Xcode module — build scenarios', () => {
  test('default MV2 build creates a valid Xcode project', async () => {
    await build()
    expect(existsSync(path.join(outputDir, 'safari-mv2/manifest.json'))).toBe(true)
    const pbxPath = path.join(outputDir, 'Safari Demo/Safari Demo.xcodeproj/project.pbxproj')
    expect(existsSync(pbxPath)).toBe(true)
    const pbx = await readFile(pbxPath, 'utf-8')
    expect(pbx).toContain('MARKETING_VERSION = 0.1.0;')
    expect(pbx).toContain('CURRENT_PROJECT_VERSION = 100;')
    expect(pbx).toContain('INFOPLIST_KEY_LSApplicationCategoryType = "public.app-category.productivity";')
    assertBundleIdsConsistent(pbx)
  })

  test('--mv3 flag produces an MV3 build', async () => {
    await build({ mv3: true })
    expect(existsSync(path.join(outputDir, 'safari-mv3/manifest.json'))).toBe(true)
    expect(existsSync(path.join(outputDir, 'Safari Demo/Safari Demo.xcodeproj/project.pbxproj'))).toBe(true)
  })

  test('outputPath relocates the Xcode project', async () => {
    await build({ env: { DEMO_OUTPUT_PATH: '.output/custom-location' } })
    expect(existsSync(path.join(outputDir, 'custom-location/Safari Demo.xcodeproj/project.pbxproj'))).toBe(true)
    expect(existsSync(path.join(outputDir, 'Safari Demo'))).toBe(false)
  })

  test('projectType: ios produces a single-platform iOS project', async () => {
    await build({ env: { DEMO_PROJECT_TYPE: 'ios' } })
    expect(existsSync(path.join(outputDir, 'Safari Demo/Safari Demo.xcodeproj/project.pbxproj'))).toBe(true)
    expect(existsSync(path.join(outputDir, 'Safari Demo/iOS (App)'))).toBe(false)
    expect(existsSync(path.join(outputDir, 'Safari Demo/macOS (App)'))).toBe(false)
  })

  test('projectType: macos produces a single-platform macOS project', async () => {
    await build({ env: { DEMO_PROJECT_TYPE: 'macos' } })
    const pbxPath = path.join(outputDir, 'Safari Demo/Safari Demo.xcodeproj/project.pbxproj')
    expect(existsSync(pbxPath)).toBe(true)
    expect(existsSync(path.join(outputDir, 'Safari Demo/iOS (App)'))).toBe(false)
    expect(existsSync(path.join(outputDir, 'Safari Demo/macOS (App)'))).toBe(false)
    // Regression: with --macos-only, Apple's converter rewrites the parent app's
    // bundle id to use the (capitalised) project name, breaking the prefix
    // relationship with the extension's id. Module must normalise this back.
    const pbx = await readFile(pbxPath, 'utf-8')
    assertBundleIdsConsistent(pbx)
  })

  test('falls back to package.json name when manifest.name is missing', async () => {
    await build({ env: { DEMO_NO_MANIFEST_NAME: '1' } })
    expect(
      existsSync(path.join(outputDir, 'wxt-safari-demo/wxt-safari-demo.xcodeproj/project.pbxproj')),
    ).toBe(true)
  })

  test('throws a clear error when package.json has no version', async () => {
    const pkgPath = path.join(root, 'package.json')
    const original = await readFile(pkgPath, 'utf-8')
    const { version: _, ...rest } = JSON.parse(original)
    await writeFile(pkgPath, JSON.stringify(rest, null, 2) + '\n')
    try {
      await expect(build()).rejects.toThrow(/version.*field/i)
    } finally {
      await writeFile(pkgPath, original)
    }
  })
})
