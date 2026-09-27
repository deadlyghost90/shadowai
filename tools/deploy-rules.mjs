#!/usr/bin/env node
/**
 * Publish database.rules.json to Realtime Database.
 *
 * Why this exists: the Firebase **web** API key in src/lib/firebase.ts is an
 * identifier, not an admin credential — anyone can read it, and it cannot
 * change security rules. Publishing rules needs a credential that can prove
 * "I administer this project": a **service account**.
 *
 * A service account is just a JSON file holding a robot login (an email plus a
 * private key). There is no clicking and no browser — the script authenticates
 * with it and writes the rules.
 *
 * One-time setup, in the Firebase console:
 *   1. Project settings (gear) → Service accounts
 *   2. "Generate new private key" → download the JSON
 *   3. drop it in this folder as `service-account.json`  (already gitignored)
 *
 * Then:
 *   node tools/deploy-rules.mjs
 *
 * It prints the rules it is about to publish, asks for confirmation, and
 * verifies by reading them back.
 */

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { createInterface } from 'node:readline/promises'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const require = createRequire(import.meta.url)

const CRED = process.env.GOOGLE_APPLICATION_CREDENTIALS || join(root, 'service-account.json')
const RULES = join(root, 'database.rules.json')
const DB_URL =
  process.env.SHADOWAI_DB_URL || 'https://shadowai-by-shadowmotion-default-rtdb.firebaseio.com'

const c = { g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m`, y: (s) => `\x1b[33m${s}\x1b[0m`, d: (s) => `\x1b[2m${s}\x1b[0m` }

async function main() {
  console.log('\n  ShadowAI — publish database rules\n')

  if (!existsSync(RULES)) {
    console.log(c.r('  database.rules.json is missing. Nothing to do.'))
    process.exit(1)
  }
  if (!existsSync(CRED)) {
    console.log(c.r('  No service account found.'))
    console.log(`  Looked for: ${CRED.replace(root, '<project>')}`)
    console.log()
    console.log('  How to get one (about a minute):')
    console.log(c.d('    Firebase console → your project → ⚙ Project settings → Service accounts'))
    console.log(c.d('    → "Generate new private key" → it downloads a JSON file'))
    console.log(c.d('    → rename it to service-account.json and drop it in the project root'))
    console.log()
    console.log('  Or point at an existing one:')
    console.log(c.d('    GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node tools/deploy-rules.mjs'))
    console.log()
    console.log('  Then re-run this command. The key is gitignored and never leaves your machine.')
    process.exit(1)
  }

  const key = JSON.parse(readFileSync(CRED, 'utf8'))
  console.log(c.g('  ✓') + c.d(`  service account  ${key.project_id || key.client_email || 'loaded'}`))
  console.log(c.d(`  project          ${key.project_id || '—'}`))
  console.log(c.d(`  database         ${DB_URL}`))

  const rulesText = readFileSync(RULES, 'utf8')
  const rules = JSON.parse(rulesText).rules

  console.log('\n' + c.d('  rules to publish:'))
  console.log(c.d(rulesText.split('\n').map((l) => '    ' + l).join('\n')))

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = (await rl.question(`\n  ${c.y('Publish these rules?')} [y/N] `)).trim().toLowerCase()
  rl.close()
  if (answer !== 'y' && answer !== 'yes') {
    console.log(c.d('\n  Cancelled. Nothing was changed.\n'))
    process.exit(0)
  }

  let admin
  try {
    admin = require('firebase-admin')
  } catch {
    console.log(c.r('\n  firebase-admin is not installed. Run: npm install\n'))
    process.exit(1)
  }

  admin.initializeApp({ credential: admin.credential.cert(key), databaseURL: DB_URL })

  try {
    await admin.database().ref('.settings/rules').set(rules)
    console.log(c.g('\n  ✓ rules published'))
  } catch (e) {
    console.log(c.r(`\n  ✗ publish failed: ${e.message}`))
    console.log(c.d('    The service account needs the "Firebase Database Admin" role.'))
    process.exit(1)
  }

  // verify by reading them back
  try {
    const read = await admin.database().ref('.settings/rules').get()
    const live = JSON.stringify(read.val())
    const same = live === JSON.stringify(rules)
    console.log(same ? c.g('  ✓ verified — live rules match the file') : c.y('  ! live rules differ from the file; check the console'))
  } catch (e) {
    console.log(c.d(`  (could not read back: ${e.message})`))
  }

  console.log(c.d('\n  From now on every conversation under /users/<uid> is readable only by that user.\n'))
}

main().catch((e) => {
  console.error(c.r(`\n  crashed: ${e.message}\n`))
  process.exit(1)
})
