'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { isPackagedUnit, packagesToBase, baseToPackages } from '@/lib/stock-units'

interface Props {
  unitOfMeasure: string
  unitQuantity: number
  value: number
  baseValue?: number
  onChange: (packages: number, base: number) => void
  baseUnitLabel?: string
  min?: number
  max?: number
  disabled?: boolean
  className?: string
  id?: string
}

export function DualQuantityInput({
  unitOfMeasure,
  unitQuantity,
  value,
  baseValue,
  onChange,
  baseUnitLabel = 'ud',
  min = 0,
  max,
  disabled,
  className,
  id,
}: Props) {
  const factor = isPackagedUnit(unitOfMeasure) && unitQuantity > 1 ? unitQuantity : 1
  const dual = factor > 1
  const [mode, setMode] = useState<'package' | 'base'>('package')
  const baseShown = baseValue ?? packagesToBase(value, factor)

  if (!dual) {
    return (
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        className={className}
        onChange={(e) => {
          const n = parseFloat(e.target.value) || 0
          onChange(n, n)
        }}
      />
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setMode('package')}
          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${mode === 'package' ? 'bg-foreground text-background border-foreground' : 'bg-background text-muted-foreground'}`}
          disabled={disabled}
        >
          {unitOfMeasure}
        </button>
        <button
          type="button"
          onClick={() => setMode('base')}
          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${mode === 'base' ? 'bg-foreground text-background border-foreground' : 'bg-background text-muted-foreground'}`}
          disabled={disabled}
        >
          {baseUnitLabel}
        </button>
      </div>
      <div className="flex items-center gap-2">
        {mode === 'package' ? (
          <>
            <Input
              id={id}
              type="number"
              min={min}
              max={max}
              step="0.01"
              value={value}
              disabled={disabled}
              className={className}
              onChange={(e) => {
                const pkg = parseFloat(e.target.value) || 0
                onChange(pkg, packagesToBase(pkg, factor))
              }}
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              = {packagesToBase(value, factor)} {baseUnitLabel}
            </span>
          </>
        ) : (
          <>
            <Input
              id={id}
              type="number"
              min={min}
              max={max != null ? max * factor : undefined}
              value={baseShown}
              disabled={disabled}
              className={className}
              onChange={(e) => {
                const base = parseFloat(e.target.value) || 0
                onChange(baseToPackages(base, factor), base)
              }}
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              ≈ {baseToPackages(baseShown, factor)} {unitOfMeasure}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
