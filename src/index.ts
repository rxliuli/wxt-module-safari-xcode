import 'wxt'
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
    const projectName = options?.projectName ?? wxt.config.manifest.name

    if (!projectName || !appCategory || !bundleIdentifier) {
      wxt.logger.warn(
        'Safari Xcode module is not configured properly. Please provide projectName, appCategory and bundleIdentifier.',
      )
      return
    }

    wxt.hook('build:done', async (wxt) => {
      wxt.logger.info('Converting Safari extension to Xcode project...')

      try {
        // Run safari-web-extension-converter
        wxt.logger.info('Running safari-web-extension-converter...')
        await $`xcrun safari-web-extension-converter --bundle-identifier ${bundleIdentifier} --force --project-location .output .output/safari-mv3`

        // Update project configuration
        wxt.logger.info('Updating Xcode project config...')
        await updateProjectConfig({
          projectName,
          appCategory,
          developmentTeam,
          rootPath: wxt.config.root,
        })

        // Update Info.plist
        wxt.logger.info('Updating Info.plist files...')
        await updateInfoPlist({
          projectName,
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
