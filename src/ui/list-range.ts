export function getVisibleRange(
  total: number,
  selectedIndex: number,
  windowSize: number,
): { start: number; end: number } {
  if (total <= 0) return { start: 0, end: 0 }
  const safeSize = Math.max(windowSize, 1)
  const maxStart = Math.max(total - safeSize, 0)
  const centeredStart = Math.max(selectedIndex - Math.floor(safeSize / 2), 0)
  const start = Math.min(centeredStart, maxStart)
  return { start, end: Math.min(start + safeSize, total) }
}
