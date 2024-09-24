import configs from '../../eslint.config.js'

export default [
  ...configs,
  {
    ignores: ['src/repositories/prisma/generated/*'],
  },
]
