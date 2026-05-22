import uni from '@uni-helper/eslint-config'

export default uni({
  vue: true,
  typescript: true,
  unocss: false,
  ignores: [
    '**/dist/**',
    '**/__tests__/**',
    '**/node_modules/**',
    '**/.vscode/**',
    '**/.astro/**',
    '**/src-tauri/**',
    '**/internal/*/dist/**',
    '**/*.md',
  ],
  rules: {
    'no-console': 'off',
    'eslint-comments/no-unlimited-disable': 'off',
  },
})
