// Tiny in-memory stand-in for the supabase-js query builder. Supports exactly what
// faqSynthesis / salesTrajectory use: select, eq, neq, gte, in, order, limit, single, insert, update.
type Row = Record<string, any>
type Filter = (r: Row) => boolean

export class FakeSupabase {
  tables: Record<string, Row[]>
  /** every insert, in order: { table, rows } */
  inserts: Array<{ table: string; rows: Row[] }> = []
  /** table name -> error message: makes the next read/insert on that table fail */
  failOn: Record<string, string> = {}
  private seq = 0

  constructor(tables: Record<string, Row[]> = {}) {
    this.tables = {}
    for (const [k, v] of Object.entries(tables)) this.tables[k] = v.map((r) => ({ ...r }))
  }

  from(table: string) {
    this.tables[table] ||= []
    return new Query(this, table)
  }
  nextId() {
    return `fake-id-${++this.seq}`
  }
}

class Query implements PromiseLike<{ data: any; error: any }> {
  private filters: Filter[] = []
  private orderBy: { col: string; asc: boolean } | null = null
  private max: number | null = null
  private op: 'select' | 'insert' | 'update' = 'select'
  private payload: any = null
  private wantSingle = false
  private countMode = false
  private headOnly = false

  private db: FakeSupabase
  private table: string
  constructor(db: FakeSupabase, table: string) {
    this.db = db
    this.table = table
  }

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.count) this.countMode = true
    if (opts?.head) this.headOnly = true
    return this
  }
  insert(rows: Row | Row[]) {
    this.op = 'insert'
    this.payload = Array.isArray(rows) ? rows : [rows]
    return this
  }
  update(values: Row) {
    this.op = 'update'
    this.payload = values
    return this
  }
  eq(col: string, val: any) {
    this.filters.push((r) => r[col] === val)
    return this
  }
  neq(col: string, val: any) {
    this.filters.push((r) => r[col] !== val)
    return this
  }
  gte(col: string, val: any) {
    this.filters.push((r) => r[col] >= val)
    return this
  }
  in(col: string, vals: any[]) {
    this.filters.push((r) => vals.includes(r[col]))
    return this
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = { col, asc: opts?.ascending !== false }
    return this
  }
  limit(n: number) {
    this.max = n
    return this
  }
  single() {
    this.wantSingle = true
    return this
  }

  private run(): { data: any; error: any; count?: number } {
    const fail = this.db.failOn[this.table]
    if (fail) return { data: null, error: { message: fail } }
    const rows = this.db.tables[this.table]

    if (this.op === 'insert') {
      const added = this.payload.map((r: Row) => ({ id: this.db.nextId(), created_at: new Date().toISOString(), ...r }))
      rows.push(...added)
      this.db.inserts.push({ table: this.table, rows: added })
      return { data: this.wantSingle ? added[0] : added, error: null }
    }
    if (this.op === 'update') {
      const hit = rows.filter((r) => this.filters.every((f) => f(r)))
      hit.forEach((r) => Object.assign(r, this.payload))
      return { data: hit, error: null }
    }

    let out = rows.filter((r) => this.filters.every((f) => f(r)))
    if (this.orderBy) {
      const { col, asc } = this.orderBy
      out = [...out].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1))
    }
    const count = out.length
    if (this.max != null) out = out.slice(0, this.max)
    if (this.headOnly) return { data: null, error: null, count }
    const data = this.wantSingle ? out[0] ?? null : out.map((r) => ({ ...r }))
    return { data, error: null, ...(this.countMode ? { count } : {}) }
  }

  then<T1 = any, T2 = never>(
    onfulfilled?: ((v: { data: any; error: any }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((e: any) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected)
  }
}
