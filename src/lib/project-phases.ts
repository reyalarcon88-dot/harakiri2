export const PROJECT_PHASE_STATUS = ['pending', 'in_progress', 'completed'] as const

export type ProjectPhaseStatus = (typeof PROJECT_PHASE_STATUS)[number]

export const DEFAULT_PROJECT_PHASE_TYPES = [
  { name: 'Removal', color: 'rose', sortOrder: 10 },
  { name: 'Concrete', color: 'amber', sortOrder: 20 },
  { name: 'Prefab', color: 'sky', sortOrder: 30 },
  { name: 'Install', color: 'emerald', sortOrder: 40 },
  { name: 'Build', color: 'violet', sortOrder: 50 },
] as const

export const PROJECT_PHASE_PRESETS = [
  { key: 'full-cage', name: 'Full cage', phaseNames: ['Removal', 'Concrete', 'Prefab', 'Install'] },
  { key: 'build-only', name: 'Build only', phaseNames: ['Build'] },
  { key: 'prefab-install', name: 'Prefab + Install', phaseNames: ['Prefab', 'Install'] },
  { key: 'concrete-build', name: 'Concrete + Build', phaseNames: ['Concrete', 'Build'] },
] as const

export const PROJECT_PHASE_COLOR_CLASS: Record<string, { dot: string; border: string; bg: string; text: string }> = {
  rose: { dot: 'bg-rose-500', border: 'border-l-rose-500', bg: 'rgba(244,63,94,0.1)', text: '#e11d48' },
  amber: { dot: 'bg-amber-500', border: 'border-l-amber-500', bg: 'rgba(245,158,11,0.12)', text: '#d97706' },
  sky: { dot: 'bg-sky-500', border: 'border-l-sky-500', bg: 'rgba(14,165,233,0.12)', text: '#0284c7' },
  emerald: { dot: 'bg-emerald-500', border: 'border-l-emerald-500', bg: 'rgba(16,185,129,0.12)', text: '#059669' },
  violet: { dot: 'bg-violet-500', border: 'border-l-violet-500', bg: 'rgba(139,92,246,0.12)', text: '#7c3aed' },
  teal: { dot: 'bg-teal-500', border: 'border-l-teal-500', bg: 'rgba(20,184,166,0.12)', text: '#0f766e' },
  slate: { dot: 'bg-slate-500', border: 'border-l-slate-500', bg: 'rgba(100,116,139,0.12)', text: '#475569' },
}

export function normalizeDateRange(startDate?: string | null, endDate?: string | null) {
  const start = startDate || endDate || new Date().toISOString().slice(0, 10)
  let end = endDate || start
  if (end < start) end = start
  return { startDate: start, endDate: end }
}

export function todayDateKey() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export function normalizePhaseStatus(value: unknown): ProjectPhaseStatus {
  return PROJECT_PHASE_STATUS.includes(value as ProjectPhaseStatus)
    ? (value as ProjectPhaseStatus)
    : 'pending'
}
