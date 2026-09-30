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
  // What reads of a table answer (an empty list otherwise).
  const tableResults: Record<string, unknown[]> = {}
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
        // Reads answer what a test set; they are not writes, so they are
        // not recorded and never take a failure meant for a write.
        if (call.op === 'select')
          return Promise.resolve({
            data: tableResults[table] ?? [],
            error: null,
          }).then(resolve)
        calls.push(call)
        const error = failNext ? { message: 'offline' } : null
        failNext = false
        return Promise.resolve({ data: [], error }).then(resolve)
      },
    }
    return chain
  }
  // Edge Functions answer what a test sets (null otherwise).
  const functionResults: Record<string, unknown> = {}
  const functionCalls: { name: string; body: unknown }[] = []
  const functions = {
    invoke(name: string, options?: { body?: unknown }) {
      functionCalls.push({ name, body: options?.body })
      return Promise.resolve({
        data: functionResults[name] ?? null,
        error: null,
      })
    },
  }
  return {
    client: { from, functions },
    tableResults,
    functionResults,
    functionCalls,
    calls,
    failNext: () => {
      failNext = true
    },
  }
}
