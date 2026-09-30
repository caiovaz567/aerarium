import { ok, table, type FinanceOp } from './financeOps'

export const settingsOps = {
  /**
   * Fase 13.3: who else uses the cards ("Pai"), or null to turn it off. With
   * someone set, "outros" of every invoice is theirs.
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

  /**
   * Fase 14.3: the daily email. Turning it on goes through the server first
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
