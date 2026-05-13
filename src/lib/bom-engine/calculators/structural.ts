import type { StructureInput, LinearRequirement, CountRequirement } from '../types'

export interface StructuralRequirements {
  linear: LinearRequirement[]
  count: CountRequirement[]
}

export function calcStructural(input: StructureInput): StructuralRequirements {
  const { widthFt, depthFt, wallHeightFt, roofType, bayCount } = input

  const longSide = Math.max(widthFt, depthFt)
  const shortSide = Math.min(widthFt, depthFt)
  const perimeter = 2 * (widthFt + depthFt)
  const bayWidthFt = longSide / bayCount
  const baysShortSide = Math.ceil(shortSide / bayWidthFt)
  const totalPosts = 4 + (bayCount - 1) * 2 + (baysShortSide - 1) * 2
  // Trusses span the shortSide, one per bay division along the longSide (incl. ends)
  const trussCount = bayCount + 1
  // Front wall posts (along longSide) including corners
  const frontWallPosts = bayCount + 1

  const linear: LinearRequirement[] = []
  const count: CountRequirement[] = []

  // ── GUTTER ───────────────────────────────────────────────────────────────────
  // Bottom perimeter aluminum beam. Available lengths: 24', 30', 36', 40'.
  // Separate from the wall top beam — gutter is the base channel only.
  linear.push({
    family: 'GUTTER',
    section: 'Structural Frame',
    totalFt: perimeter,
    note: `Gutter base: perímetro 2×(${widthFt}+${depthFt}) = ${perimeter} ft`,
  })

  // End caps: one on each open end of the gutter run (typically 4 for a standard cage)
  count.push({
    family: 'END CAP',
    section: 'Structural Frame',
    count: 4,
    note: '4 end caps (ambos extremos del gutter perimetral)',
  })

  // ── WALL TOP BEAM ────────────────────────────────────────────────────────────
  // Upper perimeter beam connecting tops of posts. Can be SMB or 2x10/3x9/3x10/3x11.
  // Using SMB as default; swappable to the actual profile family used on this project.
  linear.push({
    family: 'SMB',
    section: 'Structural Frame',
    totalFt: perimeter,
    note: `Beam pared superior (SMB/2x..): perímetro ${perimeter} ft`,
  })

  // ── POSTS ────────────────────────────────────────────────────────────────────
  // Vertical aluminum posts. Cuts multiple posts from one piece to minimize waste.
  // Linear total = totalPosts × wallHeight; matcher picks best piece length (24'/30').
  linear.push({
    family: 'POST',
    section: 'Structural Frame',
    totalFt: totalPosts * wallHeightFt,
    note: `${totalPosts} postes × ${wallHeightFt} ft altura = ${totalPosts * wallHeightFt} ft lineal`,
  })

  // Insert boot at base of each post (anchored to concrete slab)
  count.push({
    family: 'INSERT BOOT',
    section: 'Structural Frame',
    count: totalPosts,
    note: `${totalPosts} postes → ${totalPosts} insert boots`,
  })

  // ── ROOF SMB (Trusses) ───────────────────────────────────────────────────────
  // Self-mating beam: each member visible in plan = 2 SMB pieces joined.
  // Trusses run perpendicular to longSide, spanning shortSide each.
  // Standard mansard: center + 2 down-legs (3 members per truss × 2 self-mating = 6 pieces).
  // Simplified here: span = shortSide per truss × 2 (self-mating) × trussCount.
  const roofSmbFt = trussCount * shortSide * 2
  linear.push({
    family: 'SMB',
    section: 'Structural Frame',
    totalFt: roofSmbFt,
    note: `Techo SMB: ${trussCount} trusses × ${shortSide} ft span × 2 (self-mating) = ${roofSmbFt} ft`,
  })

  // Gusset plates at truss connections: mansard=4 per truss, hip=2, flat=0
  const gussetsPerTruss = roofType === 'flat' ? 0 : roofType === 'hip' ? 2 : 4
  if (gussetsPerTruss > 0) {
    count.push({
      family: 'GUSSET PLATE',
      section: 'Structural Frame',
      count: trussCount * gussetsPerTruss,
      note: `${trussCount} trusses × ${gussetsPerTruss} gusset plates (techo ${roofType})`,
    })
  }

  // ── 2X2 ROOF CONNECTORS ──────────────────────────────────────────────────────
  // Horizontal profiles connecting adjacent trusses along the longSide.
  // Standard mansard with 1 division → 2 rows of 2x2 along the longSide.
  // Available lengths: 24', 30'. Corner japs (angled cuts at corners) included in footage.
  const roofDivisions = 1
  const rows2x2 = roofDivisions + 1
  linear.push({
    family: '2X2',
    section: 'Structural Frame',
    totalFt: rows2x2 * longSide,
    note: `2x2 techo: ${rows2x2} filas × ${longSide} ft lado largo = ${rows2x2 * longSide} ft`,
  })

  // ── BOTTOM TRIM (1x2) ────────────────────────────────────────────────────────
  // 1x2 profile running at floor level around the perimeter (incl. sides against house).
  linear.push({
    family: '1X2',
    section: 'Structural Frame',
    totalFt: perimeter,
    note: `1x2 base: perímetro completo ${perimeter} ft`,
  })

  // ── CABLES ──────────────────────────────────────────────────────────────────
  // 2 cables per front-wall post (one each direction). Front wall has bayCount+1 posts.
  count.push({
    family: 'CABLE',
    section: 'Structural Frame',
    count: frontWallPosts * 2,
    note: `${frontWallPosts} postes front wall × 2 cables c/u`,
  })

  // ── DOORS ───────────────────────────────────────────────────────────────────
  // Default: 1 door. Each door = 1 Z-bar + 1 door kit (includes 2 hinges + 2 bug sweeps).
  count.push({
    family: 'Z BAR',
    section: 'Structural Frame',
    count: 1,
    note: '1 puerta → 1 Z-bar',
  })
  count.push({
    family: 'DOOR KIT',
    section: 'Structural Frame',
    count: 1,
    note: '1 puerta → 1 door kit (2 hinges + 2 bug sweeps)',
  })

  // ── ACCESSORIES ──────────────────────────────────────────────────────────────
  count.push({ family: 'CAULKING', section: 'Structural Frame', count: 1, note: '1 tubo caulking acabado' })
  count.push({ family: 'SPRAY PAINT', section: 'Structural Frame', count: 1, note: '1 spray paint (color proyecto)' })
  // Elbows for gutter drainage — 3A and 3B per project
  count.push({ family: 'ELBOW A', section: 'Structural Frame', count: 3, note: '3 codos A (gutter)' })
  count.push({ family: 'ELBOW B', section: 'Structural Frame', count: 3, note: '3 codos B (gutter)' })
  // Downspouts and drop-outs — 2 each (one per gutter side)
  count.push({ family: 'DROP OUT', section: 'Structural Frame', count: 2, note: '2 drop outs (gutter)' })
  count.push({ family: 'DOWNSPOUT', section: 'Structural Frame', count: 2, note: '2 downspouts (gutter)' })

  return { linear, count }
}
