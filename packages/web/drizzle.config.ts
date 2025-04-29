import 'dotenv'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dbCredentials: {
    url: process.env['DRIZZLE_DATABASE_URL']!,
  },
  dialect: 'postgresql',
  out: './drizzle',
  schema: './src/repositories/drizzle/schemas',
})
