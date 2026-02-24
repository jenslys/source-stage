export function getNextIndex(current: number, total: number): number {
  if (total <= 0) return 0
  return (current + 1) % total
}

export function getPreviousIndex(current: number, total: number): number {
  if (total <= 0) return 0
  return (current - 1 + total) % total
}

export function clampSelectionIndex(current: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(Math.max(current, 0), total - 1)
}
