import { FakeSupabase } from './fakeSupabase.ts'

/** Shared state the stubs read. Tests reset it with resetMock(). */
export const mock: { supabase: FakeSupabase; secrets: Record<string, string> } = {
  supabase: new FakeSupabase(),
  secrets: {},
}

export function resetMock(tables: Record<string, any[]> = {}, secrets: Record<string, string> = { GEMINI_API_KEY: 'test-key' }) {
  mock.supabase = new FakeSupabase(tables)
  mock.secrets = secrets
  return mock.supabase
}
