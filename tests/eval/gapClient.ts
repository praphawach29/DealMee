/** Minimal Supabase stand-in for knowledge_gaps writes during offline eval. */

export interface GapClient {
  gaps: Record<string, unknown>[]
  from: (table: string) => GapQuery
}

interface GapQuery {
  select: () => GapQuery
  eq: () => GapQuery
  insert: (row: Record<string, unknown>) => Promise<{ data: Record<string, unknown>; error: null }>
  update: () => GapQuery
  maybeSingle: () => Promise<{ data: null; error: null }>
  then: (onFulfilled: (value: { data: null; error: null }) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
}

export function createGapClient(): GapClient {
  const gaps: Record<string, unknown>[] = []
  function query(table: string): GapQuery {
    const q: GapQuery = {
      select() { return q },
      eq() { return q },
      update() { return q },
      insert(row) {
        if (table === 'knowledge_gaps') gaps.push(row)
        return Promise.resolve({ data: row, error: null })
      },
      maybeSingle() {
        return Promise.resolve({ data: null, error: null })
      },
      then(onFulfilled, onRejected) {
        return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected)
      },
    }
    return q
  }
  return { gaps, from: query }
}
