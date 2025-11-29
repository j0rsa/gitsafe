import type { StorybookConfig } from '@storybook/react-vite'
import path from 'path'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  core: {
    builder: '@storybook/builder-vite',
  },
  viteFinal: async (config) => {
    // Use a separate cache directory for Storybook to avoid conflicts
    config.cacheDir = path.join(__dirname, '../node_modules/.vite-storybook')
    // Force esbuild to use wasm to avoid platform issues
    if (config.optimizeDeps) {
      config.optimizeDeps.esbuildOptions = {
        ...config.optimizeDeps.esbuildOptions,
        // This will make Vite use esbuild-wasm if available
      }
    }
    return config
  },
}

export default config

