import 'dotenv/config'
import bcrypt from 'bcrypt'
import { eq } from 'drizzle-orm'
import { db } from './index.js'
import { adminUsers } from './schema/admin.js'

const email = 'admin@ohrny.com'

async function main() {
  const [existing] = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1)
  if (existing) {
    console.log('Seed skipped: admin already exists.')
    process.exit(0)
  }

  const passwordHash = await bcrypt.hash('admin123', 12)
  await db.insert(adminUsers).values({
    email,
    passwordHash,
    name: 'Seed Admin',
    role: 'super_admin',
    totpEnabled: false,
  })

  console.log(`Seeded ${email} (password: admin123)`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
