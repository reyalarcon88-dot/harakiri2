export const ENGINEERING_SECTIONS = [
  'Structural Frame',
  'Fasteners & Hardware',
  'Doors',
  'Miscellaneous',
  'Screen',
] as const

export type EngineeringSection = (typeof ENGINEERING_SECTIONS)[number]

export function getSectionOrder(section: string): number {
  const idx = ENGINEERING_SECTIONS.indexOf(section as EngineeringSection)
  return idx === -1 ? ENGINEERING_SECTIONS.length : idx
}
