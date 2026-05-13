import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function genId() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
}

type CategoryRow = { id: string; name: string; color: string; expense_count: bigint }

export async function GET() {
  try {
    const rows = await db.$queryRaw<CategoryRow[]>`
      SELECT id, name, color,
        (SELECT COUNT(*) FROM project_expenses WHERE category_id = expense_categories.id) AS expense_count
      FROM expense_categories
      ORDER BY name ASC
    `
    const categories = rows.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      _count: { expenses: Number(r.expense_count) },
    }))
    return NextResponse.json(categories)
  } catch (error) {
    console.error('[expense-categories GET]', error)
    return NextResponse.json({ error: 'Error fetching categories' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const name = String(body.name ?? '').trim()
    const color = String(body.color ?? 'slate').trim()

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const id = genId()
    await db.$executeRaw`
      INSERT INTO expense_categories (id, name, color, created_at)
      VALUES (${id}, ${name}, ${color}, datetime('now'))
    `
    const rows = await db.$queryRaw<{ id: string; name: string; color: string }[]>`
      SELECT id, name, color FROM expense_categories WHERE id = ${id}
    `
    return NextResponse.json(rows[0], { status: 201 })
  } catch (error) {
    console.error('[expense-categories POST]', error)
    return NextResponse.json({ error: 'Error creating category' }, { status: 500 })
  }
}
