import { ok, table, type FinanceOp } from './financeOps'

export const settingsOps = {
  /**
   * Who else uses the cards ("Pai"), or null to turn it off. With someone set,
   * "outros" of every invoice is theirs.
   */
  setOtherPerson(name: string | null): FinanceOp {
    return {
      run: () =>
        ok(
          table('user_settings').upsert({
            other_person: name,
            updated_at: new Date().toISOString(),
          }),
        ),
      apply: (f) => ({ ...f, otherPerson: name }),
    }
  },

  /** Bank purchases come in (true) or only the closed bills' totals. */
  setBankPurchases(on: boolean): FinanceOp {
    return {
      run: () =>
        ok(
          table('user_settings').upsert({
            bank_purchases: on,
            updated_at: new Date().toISOString(),
          }),
        ),
      apply: (f) => ({ ...f, bankPurchases: on }),
    }
  },

  /**
   * The daily email. Turning it on goes through the server first
   * (setupDailyEmail), which also saves it; this keeps the app in step.
   */
  setDailyEmail(on: boolean): FinanceOp {
    return {
      run: () =>
        ok(
          table('user_settings').upsert({
            daily_email: on,
            updated_at: new Date().toISOString(),
          }),
        ),
      apply: (f) => ({ ...f, dailyEmail: on }),
    }
  },
}
