import { beforeEach } from 'vitest'

// Clear module cache before each test to ensure environment variables are re-read
beforeEach(() => {
  // Clear the module cache for config module
  const configPath = require.resolve('../src/core/config.js')
  delete require.cache[configPath]
})
