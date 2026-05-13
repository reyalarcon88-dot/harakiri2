import type { StructureInput, LinearRequirement, CountRequirement } from '../types'

export interface ScreenRequirements {
  linear: LinearRequirement[]
  count: CountRequirement[]
}

export function calcScreen(
  input: StructureInput,
  derived: { totalBays: number; perimeter: number; bayWidthFt: number },
): ScreenRequirements {
  const { widthFt, depthFt, bayCount } = input

  const longSide = Math.max(widthFt, depthFt)
  const shortSide = Math.min(widthFt, depthFt)

  const linear: LinearRequirement[] = []
  const count: CountRequirement[] = []

  // ── WALL SCREEN — NFL Super Screen 17x14 ────────────────────────────────────
  // Walls are screened on 3 sides (back side attaches to house).
  // Roll: 100 ft long. Width must cover wall height — user picks correct width (84/96/120/132/144/160").
  // Linear footage = 3-sided perimeter; matcher calculates rolls = ceil(ft / 100).
  const wallScreenFt = 2 * shortSide + longSide
  linear.push({
    family: 'NFL SUPER SCREEN',
    section: 'Screen',
    totalFt: wallScreenFt,
    note: `Wall screen 17x14: 2×${shortSide}+${longSide} = ${wallScreenFt} ft (3 lados)`,
  })

  // ── ROOF SCREEN — NFL Screen Regular 18x14 ───────────────────────────────────
  // Each bay panel: bayWidthFt wide × shortSide deep.
  // Roll: 100 ft long; width must cover bayWidthFt — pick 96"/120"/etc. as needed.
  // Total roll footage: bayCount panels × shortSide ft depth each.
  const roofScreenFt = bayCount * shortSide
  linear.push({
    family: 'NFL SCREEN REGULAR',
    section: 'Screen',
    totalFt: roofScreenFt,
    note: `Roof screen 18x14: ${bayCount} bays × ${shortSide} ft profundidad = ${roofScreenFt} ft`,
  })

  // ── SPLINE — American V ──────────────────────────────────────────────────────
  // 1 roll of 1000 ft per project (covers all wall and roof screen panels).
  count.push({
    family: 'SPLINE AMERICAN V',
    section: 'Screen',
    count: 1,
    note: '1 rollo 1000 ft American V spline (paredes + techo)',
  })

  return { linear, count }
}
