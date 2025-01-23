import { cwd } from 'process'
import eslint from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import typescript from 'typescript-eslint'

export default [
  stylistic.configs['recommended-flat'],
  eslint.configs.recommended,
  {
    rules: {
      'curly': 'error',
      'sort-imports': 'error',
      'sort-keys': 'error',
    },
  },
  ...typescript.config(
    ...typescript.configs.strictTypeChecked,
    {
      languageOptions: {
        parser: typescript.parser,
        parserOptions: {
          projectService: { allowDefaultProject: ['eslint.config.js'], defaultProject: 'tsconfig.json' },
          tsconfigRootDir: cwd(),
        },
      },
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-member-accessibility': 'error',
        '@typescript-eslint/member-ordering': ['error', { default: { order: 'alphabetically' } }],
        '@typescript-eslint/no-empty-object-type': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-extraneous-class': 'off',
        '@typescript-eslint/no-namespace': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-unnecessary-condition': ['error', { allowConstantLoopConditions: true }],
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/prefer-readonly': 'error',
        '@typescript-eslint/sort-type-constituents': 'error',
        '@typescript-eslint/strict-boolean-expressions': ['error', { allowNumber: false, allowString: false }],
      },
    },
  ),
]
