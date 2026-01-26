import 'wxt'
import fs from 'node:fs/promises'
import { defineWxtModule } from 'wxt/modules'
import { $ } from 'zx'
import { updateInfoPlist, updateProjectConfig } from './safari-utils'

export interface SafariXcodeOptions {
  /**
   * Safari project name
   * Defaults to manifest.name if not provided
   */
  projectName?: string
  /**
   * App category, e.g., 'public.app-category.productivity'
   */
  appCategory: string
  /**
   * Bundle identifier
   */
  bundleIdentifier: string
  /**
   * Apple Developer Team ID (optional)
   * Example: 'ABC1234567'
   * If not provided, the generated Xcode project will need to have the development team set manually
   */
  developmentTeam?: string
  /**
   * Output path for the Xcode project
   * Defaults to '.output/{projectName}/' directory
   */
  outputPath?: string
}

export default defineWxtModule<SafariXcodeOptions>({
  name: 'safari-xcode',
  configKey: 'safariXcode',
  async setup(wxt, options) {
    // Only execute when building for Safari
    if (wxt.config.browser !== 'safari') {
      return
    }

    const { appCategory, bundleIdentifier, developmentTeam } = options ?? {}

    // Use manifest.name as default projectName
    const projectName = options?.projectName 
      ?? wxt.config.manifest.name 
      ?? await fs.readFile(`${wxt.config.root}/package.json`, 'utf-8').then((data) => JSON.parse(data).name)

    if (!projectName || !appCategory || !bundleIdentifier) {
      wxt.logger.warn(
        'Safari Xcode module is not configured properly. Please provide projectName, appCategory and bundleIdentifier.',
      )
      return
    }

    const outputPath = options?.outputPath ?? `.output/${projectName}/`

    wxt.hook('build:done', async (wxt) => {
      wxt.logger.info(`Converting ${highlight('Safari extension')} to ${highlight('Xcode project')}...`)

      if (process.platform !== 'darwin') {
        const error = new Error('Safari Xcode conversion requires macOS.')
        wxt.logger.error('Safari Xcode conversion is only supported on macOS.', error)
        throw error
      }

      try {
        // Run safari-web-extension-converter
        wxt.logger.info(`Running ${highlight('safari-web-extension-converter')}...`)
        await $`xcrun safari-web-extension-converter --bundle-identifier ${bundleIdentifier} --force --project-location ${outputPath} .output/safari-mv${wxt.config.manifestVersion}`

        // Update project configuration
        wxt.logger.info(`Updating ${highlight('Xcode project config')}...`)
        await updateProjectConfig({
          projectName,
          outputPath,
          appCategory,
          developmentTeam,
          rootPath: wxt.config.root,
        })

        // Update Info.plist
        wxt.logger.info(`Updating ${highlight('Info.plist files')}...`)
        await updateInfoPlist({
          projectName,
          outputPath,
          appCategory,
          developmentTeam,
          rootPath: wxt.config.root,
        })

        wxt.logger.success('Safari Xcode project created successfully!')
      } catch (error) {
        wxt.logger.error('Safari Xcode conversion failed:', error)
        throw error
      }
    })
  },
})

declare module 'wxt' {
  export interface InlineConfig {
    safariXcode?: SafariXcodeOptions
  }
}

function highlight(text: string): string {
  return `\x1b[36m${text}\x1b[0m`
}
