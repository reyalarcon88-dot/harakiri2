import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function genId() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
}

function todayKey() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const rows = await db.$queryRaw<ExpenseRow[]>`
      SELECT e.id, e.project_id, e.category_id, e.description, e.amount, e.expense_date, e.notes,
        c.id AS cat_id, c.name AS cat_name, c.color AS cat_color
      FROM project_expenses e
      LEFT JOIN expense_categories c ON e.category_id = c.id
      WHERE e.project_id = ${id}
      ORDER BY e.expense_date DESC, e.created_at DESC
    `

    const expenses = rows.map(formatExpense)

    const byCategory: Record<string, { categoryId: string | null; name: string; color: string; total: number }> = {}
    let grandTotal = 0
    for (const exp of expenses) {
      grandTotal += exp.amount
      const key = exp.categoryId ?? '__none__'
      if (!byCategory[key]) {
        byCategory[key] = {
          categoryId: exp.categoryId,
          name: exp.category?.name ?? 'No category',
          color: exp.category?.color ?? 'slate',
          total: 0,
        }
      }
      byCategory[key].total += exp.amount
    }

    return NextResponse.json({
      expenses,
      totals: Object.values(byCategory).sort((a, b) => b.total - a.total),
      grandTotal,
    })
  } catch (error) {
    console.error('[project expenses GET]', error)
    return NextResponse.json({ error: 'Error fetching expenses' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const description = String(body.description ?? '').trim()
    const amount = Number(body.amount ?? 0)
    const expenseDate = String(body.expenseDate ?? todayKey()).trim()
    const categoryId = body.categoryId ? String(body.categoryId).trim() : null
    const notes = String(body.notes ?? '').trim()

    if (amount <= 0) return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 })

    const eid = genId()
    await db.$executeRaw`
      INSERT INTO project_expenses (id, project_id, category_id, description, amount, expense_date, notes, created_at)
      VALUES (${eid}, ${id}, ${categoryId}, ${description}, ${amount}, ${expenseDate}, ${notes}, datetime('now'))
    `

    const rows = await db.$queryRaw<ExpenseRow[]>`
      SELECT e.id, e.project_id, e.category_id, e.description, e.amount, e.expense_date, e.notes,
        c.id AS cat_id, c.name AS cat_name, c.color AS cat_color
      FROM project_expenses e
      LEFT JOIN expense_categories c ON e.category_id = c.id
      WHERE e.id = ${eid}
    `
    return NextResponse.json(formatExpense(rows[0]), { status: 201 })
  } catch (error) {
    console.error('[project expenses POST]', error)
    return NextResponse.json({ error: 'Error creating expense' }, { status: 500 })
  }
}
