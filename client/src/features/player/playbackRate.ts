/** The speeds of the menu (Figma « Menu du lecteur » 102:101), slowest first. */
export const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const

/** 1 → « 1,0× », 1.25 → « 1,25× ». */
export function formatRate(rate: number) {
  return `${(Number.isInteger(rate) ? rate.toFixed(1) : String(rate)).replace('.', ',')}×`
}

/** The next speed of the menu up (+1) or down (-1), kept within it (a speed set from YouTube's own menu may sit between two). */
export function stepRate(rate: number, direction: 1 | -1) {
  if (direction === 1) return RATES.find((r) => r > rate) ?? RATES[RATES.length - 1]
  return [...RATES].reverse().find((r) => r < rate) ?? RATES[0]
}
