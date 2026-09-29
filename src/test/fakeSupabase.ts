/** A stand-in for the Supabase client that records writes and always succeeds (or fails on demand). */
export interface Call {
  table: string
  op: 'insert' | 'update' | 'upsert' | 'delete' | 'select'
  payload?: unknown
  filters: [string, unknown][]
}

export function fakeSupabase() {
  const calls: Call[] = []
  let failNext = false
  const from = (table: string) => {
    const call: Call = { table, op: 'select', filters: [] }
    const chain = {
      insert(payload: unknown) {
        call.op = 'insert'
        call.payload = payload
        return chain
      },
      upsert(payload: unknown) {
        call.op = 'upsert'
        call.payload = payload
        return chain
      },
      update(payload: unknown) {
        call.op = 'update'
        call.payload = payload
        return chain
      },
      delete() {
        call.op = 'delete'
        return chain
      },
      select() {
        return chain
      },
      in(column: string, value: unknown) {
        call.filters.push([column, value])
        return chain
      },
      eq(column: string, value: unknown) {
        call.filters.push([column, value])
        return chain
      },
      is(column: string, value: unknown) {
        call.filters.push([column, value])
        return chain
      },
      then<T>(
        resolve: (value: {
          data: unknown[]
          error: { message: string } | null
        }) => T,
      ) {
        calls.push(call)
        const error = failNext ? { message: 'offline' } : null
        failNext = false
        return Promise.resolve({ data: [], error }).then(resolve)
      },
    }
    return chain
  }
  return {
    client: { from },
    calls,
    failNext: () => {
      failNext = true
    },
  }
}
