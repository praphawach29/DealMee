import { mock } from './mockState.ts'
export function createAdminClient() {
  return mock.supabase
}
