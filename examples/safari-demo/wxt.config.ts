import { defineConfig } from 'wxt'

const useManifestName = process.env.DEMO_NO_MANIFEST_NAME !== '1'

export default defineConfig({
  modules: ['wxt-module-safari-xcode'],
  manifest: useManifestName ? { name: 'Safari Demo' } : {},
  safariXcode: {
    appCategory: 'public.app-category.productivity',
    bundleIdentifier: 'com.example.safari-demo',
  },
})
