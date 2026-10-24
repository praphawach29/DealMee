import { register } from 'node:module'

await register('./resolver-hook.mjs', import.meta.url)
