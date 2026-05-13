import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

type ExpenseRow = {
  id: string
  project_id: string
  category_id: string | null
  description: string
  amount: number
  expense_date: string
  notes: string
  cat_id: string | null
  cat_name: string | null
  cat_color: string | null
}

function formatExpense(r: ExpenseRow) {
  return {
    id: r.id,
    projectId: r.project_id,
    categoryId: r.category_id,
    description: r.description,
    amount: Number(r.amount),
    expenseDate: r.expense_date,
    notes: r.notes,
    category: r.cat_id ? { id: r.cat_id, name: r.cat_name!, color: r.cat_color! } : null,
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const { expenseId } = await params
    const body = await request.json()

    const description = String(body.description ?? '').trim()
    const amount = Number(body.amount ?? 0)
    const expenseDate = String(body.expenseDate ?? '').trim()
    const categoryId = body.categoryId ? String(body.categoryId).trim() : null
    const notes = String(body.notes ?? '').trim()

    if (amount <= 0) return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 })

    await db.$executeRaw`
      UPDATE project_expenses
      SET description = ${description}, amount = ${amount}, expense_date = ${expenseDate},
          category_id = ${categoryId}, notes = ${notes}
      WHERE id = ${expenseId}
    `

    const rows = await db.$queryRaw<ExpenseRow[]>`
      SELECT e.id, e.project_id, e.category_id, e.description, e.amount, e.expense_date, e.notes,
        c.id AS cat_id, c.name AS cat_name, c.color AS cat_color
      FROM project_expenses e
      LEFT JOIN expense_categories c ON e.category_id = c.id
      WHERE e.id = ${expenseId}
    `
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(formatExpense(rows[0]))
  } catch (error) {
    console.error('[project expenses PUT]', error)
    return NextResponse.json({ error: 'Error updating expense' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const { expenseId } = await params
    await db.$executeRaw`DELETE FROM project_expenses WHERE id = ${expenseId}`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[project expenses DELETE]', error)
    return NextResponse.json({ error: 'Error deleting expense' }, { status: 500 })
  }
}
