'use client'

import { useDroppable } from '@dnd-kit/core'
import { ReactNode } from 'react'

interface DroppableProps {
  id: string
  children: ReactNode
  className?: string
}

export function Droppable({ id, children, className }: DroppableProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  })

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? 'bg-primary/10 ring-2 ring-primary/20' : ''}`}
    >
      {children}
    </div>
  )
}