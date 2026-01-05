# Safari Xcode Module

A WXT module that automatically converts Safari extensions to Xcode projects and configures related settings after the build is complete.

## Features

- Automatically runs `xcrun safari-web-extension-converter` to convert the extension to an Xcode project
- Updates Xcode project configuration (version number, app category, development team, etc.)
- Updates all Info.plist files

## Usage

### 1. Enable the module in wxt.config.ts

```typescript
import { defineConfig } from 'wxt'

export default defineConfig({
  modules: ['wxt-module-safari-xcode'],
  safariXcode: {
    projectName: 'Your Project Name',
    appCategory: 'public.app-category.productivity',
    bundleIdentifier: 'com.example.your-extension',
    developmentTeam: 'ABC1234567',
  },
  // ... other configurations
})
```

### 2. Build Safari Extension

```bash
pnpm wxt build -b safari
```

The module will automatically convert the extension to an Xcode project after the build completes.

## Configuration Options

| Option             | Type     | Required | Description                                                                                   |
| ------------------ | -------- | -------- | --------------------------------------------------------------------------------------------- |
| `projectName`      | `string` | ❌       | Safari project name. Defaults to `manifest.name` if not provided                              |
| `appCategory`      | `string` | ✅       | App category, e.g., `'public.app-category.productivity'`                                      |
| `bundleIdentifier` | `string` | ✅       | Bundle identifier, e.g., `'com.example.app'`                                                  |
| `developmentTeam`  | `string` | ❌       | Apple Developer Team ID, e.g., `'ABC1234567'`. If not provided, must be set manually in Xcode |

## How It Works

This module uses WXT's `build:done` hook to perform the following steps after the build completes:

1. Run `xcrun safari-web-extension-converter` to convert the extension to a Safari Xcode project
2. Read the version number from `package.json`
3. Update the Xcode project configuration file (`.xcodeproj/project.pbxproj`)
   - Set `MARKETING_VERSION` to the version from package.json
   - Set `CURRENT_PROJECT_VERSION` to numeric version (major _ 10000 + minor _ 100 + patch)
   - Configure app category
   - Configure development team (if provided)
4. Update all Info.plist files and add `CFBundleVersion`

## Notes

- This module only executes when building for Safari browser (`wxt build -b safari`)
- Requires macOS and Xcode Command Line Tools
- If you want to read configuration from environment variables, ensure `.env.local` is added to `.gitignore`

## Examples

### Complete Configuration Example

```typescript
import { defineConfig } from 'wxt'

export default defineConfig({
  modules: ['@wxt-dev/module-react', 'wxt-module-safari-xcode'],
  safariXcode: {
    projectName: 'My Awesome Extension',
    appCategory: 'public.app-category.productivity',
    bundleIdentifier: 'com.mycompany.awesome-extension',
    developmentTeam: 'ABC1234567',
  },
  manifest: {
    name: 'My Awesome Extension',
    version: '0.1.0',
  },
})
```

Generate the Xcode project will be located at: `.output/<projectName>/<projectName>.xcodeproj`
