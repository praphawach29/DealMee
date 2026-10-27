import { mock } from './mockState.ts'
export async function platformSecret(name: string): Promise<string | null> {
  return mock.secrets[name] ?? null
}
