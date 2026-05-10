import uni from '@uni-helper/eslint-config'

export default uni(
  {
    unocss: false,
    rules: {
      'no-console': 'off',
      'eslint-comments/no-unlimited-disable': 'off',
    },
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.vscode/**',
      '**/internal/*/dist/**',
    ],
  },
)
