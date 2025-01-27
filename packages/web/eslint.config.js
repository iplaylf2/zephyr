import configs from '@zephyr/config/eslint.config.js'

export default [
  ...configs,
  {
    ignores: ['src/repositories/prisma/generated/*'],
  },
]
