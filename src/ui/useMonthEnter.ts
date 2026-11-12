import { useState } from 'react'

/**
 * The class that slides a month's content in from the side it came from: a
 * later month from the right, an earlier one from the left. None on the first
 * month shown. Two names take turns, so each change plays it again.
 */
export function useMonthEnter(month: string) {
  const [state, setState] = useState({ month, dir: '', turn: 0 })
  if (state.month !== month)
    setState({
      month,
      dir: month > state.month ? 'next' : 'prev',
      turn: 1 - state.turn,
    })
  return state.dir ? `enter-${state.dir}-${state.turn}` : ''
}
