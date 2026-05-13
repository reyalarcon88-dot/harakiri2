import type { StructureInput, CountRequirement } from '../types'

export function calcFasteners(
  input: StructureInput,
  derived: { totalPosts: number; totalBays: number; perimeter: number },
): CountRequirement[] {
  const { widthFt, depthFt, bayCount } = input
  const { totalPosts, perimeter } = derived

  const longSide = Math.max(widthFt, depthFt)
  const shortSide = Math.min(widthFt, depthFt)
  const trussCount = bayCount + 1

  const count: CountRequirement[] = []

  // ── TEX SCREW 14x3" SS ───────────────────────────────────────────────────────
  // Used for: fastening gutter sections to each other and to posts, every 16".
  const gutterInches = perimeter * 12
  const tex14x3Count = Math.ceil(gutterInches / 16)
  count.push({
    family: 'TEX 14X3',
    section: 'Fasteners & Hardware',
    count: tex14x3Count,
    note: `TEX 14x3": gutter ${perimeter} ft × 12/16" = ${tex14x3Count} pzas`,
  })

  // ── TEX SCREW 14x1" ─────────────────────────────────────────────────────────
  // Used for: (a) joining wall top beam (SMB) — top and bottom every 16"
  //           (b) roof SMB truss connections — ~230 per 25-ft truss, scaled by span
  const wallBeamPerSide = Math.ceil((perimeter * 12) / 16)
  const wallBeamTex = wallBeamPerSide * 2  // top + bottom flanges
  const roofTexPerTruss = Math.ceil(230 * (shortSide / 25))
  const roofTex = trussCount * roofTexPerTruss
  const totalTex14x1 = wallBeamTex + roofTex
  count.push({
    family: 'TEX 14X1',
    section: 'Fasteners & Hardware',
    count: totalTex14x1,
    note: `TEX 14x1": pared ${wallBeamTex} (top+bot) + techo ${roofTex} (${trussCount}×${roofTexPerTruss}) = ${totalTex14x1}`,
  })

  // ── SMS SCREW 10x2" ──────────────────────────────────────────────────────────
  // Used for: fastening 2x2 roof connectors inside SMB (internal connection).
  // ~4 screws per 2x2-to-SMB joint; 2 rows × (trussCount+1) joints per row.
  const smsPerRow = trussCount + 1
  const rows2x2 = 2
  const smsCount = rows2x2 * smsPerRow * 4
  count.push({
    family: 'SMS 10X2',
    section: 'Fasteners & Hardware',
    count: smsCount,
    note: `SMS 10x2": ${rows2x2} filas × ${smsPerRow} puntos × 4 screws = ${smsCount}`,
  })

  // ── LDT CONCRETE ANCHOR 3/8 x 5" ────────────────────────────────────────────
  // Used for: anchoring insert boots to concrete slab — 6 per post.
  const concreteCount = totalPosts * 6
  count.push({
    family: 'CONCRETE',
    section: 'Fasteners & Hardware',
    count: concreteCount,
    note: `LDT concreto 3/8×5": ${totalPosts} postes × 6 = ${concreteCount}`,
  })

  // ── HEX BOLT ────────────────────────────────────────────────────────────────
  // Used for: post-to-beam connections.
  // 4x4 post: 4 above + 2 below = 6 per post, bolt length 4-1/2".
  // 8x8 post: 4 above + 6 below = 10 per post, bolt length 8-1/2".
  // Default: 4x4 assumption (most common residential).
  const hexBoltCount = totalPosts * 6
  count.push({
    family: 'HEX BOLT',
    section: 'Fasteners & Hardware',
    count: hexBoltCount,
    note: `Hex bolt 4-1/2": ${totalPosts} postes × 6 (4x4 std) = ${hexBoltCount}`,
  })

  // Washer 3/8 — 2 per hex bolt (one each side of the connection)
  count.push({
    family: 'WASHER 3/8',
    section: 'Fasteners & Hardware',
    count: hexBoltCount * 2,
    note: `Washer 3/8: ${hexBoltCount} hex bolts × 2 = ${hexBoltCount * 2}`,
  })

  // Hex bolt cap — 2 per bolt (covers each end for finished look)
  count.push({
    family: 'HEX CAP',
    section: 'Fasteners & Hardware',
    count: hexBoltCount * 2,
    note: `Hex cap: ${hexBoltCount} bolts × 2 = ${hexBoltCount * 2}`,
  })

  // ── BLUE TAP SCREWS ──────────────────────────────────────────────────────────
  // Floor attachment (6"): 1x2 and gutter to concrete slab at 16" o.c.
  // House-wall attachment (3"): side against building at 16" o.c.
  // One long side assumed against house; remaining 3 sides on floor slab.
  const houseSideFt = longSide
  const floorSideFt = perimeter - houseSideFt  // 3 sides
  const blueTap6 = Math.ceil((floorSideFt * 12) / 16)
  const blueTap3 = Math.ceil((houseSideFt * 12) / 16)
  const totalBlueTaps = blueTap6 + blueTap3
  count.push({
    family: 'BLUE TAP',
    section: 'Fasteners & Hardware',
    count: totalBlueTaps,
    note: `Blue tap: piso 6" (${blueTap6}) + contra-pared 3" (${blueTap3}) = ${totalBlueTaps} total`,
  })

  // Washer 1/4 — 1 per blue tap (finish washer under head)
  count.push({
    family: 'WASHER 1/4',
    section: 'Fasteners & Hardware',
    count: totalBlueTaps,
    note: `Washer 1/4: 1 por blue tap = ${totalBlueTaps}`,
  })

  // Cap 1/4 — 1 per blue tap (covers head for finished look)
  count.push({
    family: 'CAP 1/4',
    section: 'Fasteners & Hardware',
    count: totalBlueTaps,
    note: `Cap 1/4: 1 por blue tap = ${totalBlueTaps}`,
  })

  return count
}
