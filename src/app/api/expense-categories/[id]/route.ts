import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const name = String(body.name ?? '').trim()
    const color = String(body.color ?? 'slate').trim()

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    await db.$executeRaw`
      UPDATE expense_categories SET name = ${name}, color = ${color} WHERE id = ${id}
    `
    const rows = await db.$queryRaw<{ id: string; name: string; color: string }[]>`
      SELECT id, name, color FROM expense_categories WHERE id = ${id}
    `
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(rows[0])
  } catch (error) {
    console.error('[expense-categories PUT]', error)
    return NextResponse.json({ error: 'Error updating category' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Unlink expenses before deleting (in case FK constraints aren't enabled)
    await db.$executeRaw`UPDATE project_expenses SET category_id = NULL WHERE category_id = ${id}`
    await db.$executeRaw`DELETE FROM expense_categories WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[expense-categories DELETE]', error)
    return NextResponse.json({ error: 'Error deleting category' }, { status: 500 })
  }
}
