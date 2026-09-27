const SPACE = 'https://deadlyghost5090-fs-intelligence-whatsapp.hf.space'
const TOKEN = process.env.T
const BODY = JSON.stringify({ message: 'Reply with the single word: ready' })

const shapes = [
  ['Authorization: Bearer <tok>', { Authorization: `Bearer ${TOKEN}` }],
  ['Authorization: <tok>', { Authorization: TOKEN }],
  ['X-API-Key: <tok>', { 'X-API-Key': TOKEN }],
  ['api-key: <tok>', { 'api-key': TOKEN }],
  ['X-Auth-Token: <tok>', { 'X-Auth-Token': TOKEN }],
  ['Authorization: Token <tok>', { Authorization: `Token ${TOKEN}` }],
  ['no auth header at all', {}],
]

for (const [label, headers] of shapes) {
  const t0 = Date.now()
  try {
    const res = await fetch(`${SPACE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: BODY,
    })
    const text = (await res.text()).slice(0, 90).replace(/\n/g, ' ')
    const ok = res.ok ? '\x1b[32mOK\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m'
    console.log(`${ok} ${String(res.status).padEnd(4)} ${label.padEnd(30)} ${Date.now() - t0}ms  ${text}`)
  } catch (e) {
    console.log(`\x1b[31mERR\x1b[0m      ${label.padEnd(30)} ${e.message}`)
  }
}
