import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { PageKey } from '@/stores/navigation'

type SearchItem = {
  id: string
  type: 'project' | 'product' | 'purchase' | 'client' | 'supplier' | 'task'
  title: string
  subtitle: string
  page: PageKey
  code?: string
}

function cleanQuery(value: string | null) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function group(label: string, items: SearchItem[]) {
  return items.length ? { label, items } : null
}

export async function GET(request: NextRequest) {
  try {
    const query = cleanQuery(request.nextUrl.searchParams.get('q'))

    if (query.length < 2) {
      return NextResponse.json({ query, groups: [] })
    }

    const take = 6
    const [
      projects,
      products,
      purchases,
      clients,
      suppliers,
      tasks,
    ] = await Promise.all([
      db.projects.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { poNumber: { contains: query } },
            { projectType: { contains: query } },
            { notes: { contains: query } },
          ],
        },
        select: {
          id: true,
          name: true,
          poNumber: true,
          status: true,
          client: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
      }),
      db.products.findMany({
        where: {
          OR: [
            { code: { contains: query } },
            { name: { contains: query } },
            { family: { contains: query } },
            { engineeringSection: { contains: query } },
          ],
        },
        select: {
          id: true,
          code: true,
          name: true,
          family: true,
          engineeringSection: true,
        },
        orderBy: { name: 'asc' },
        take,
      }),
      db.purchases.findMany({
        where: {
          OR: [
            { purchaseCode: { contains: query } },
            { poNumber: { contains: query } },
            { notes: { contains: query } },
          ],
        },
        select: {
          id: true,
          purchaseCode: true,
          poNumber: true,
          status: true,
          supplier: { select: { name: true } },
          project: { select: { name: true, poNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
      }),
      db.clients.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { contactName: { contains: query } },
            { email: { contains: query } },
            { phone: { contains: query } },
          ],
        },
        select: {
          id: true,
          name: true,
          contactName: true,
          email: true,
          phone: true,
        },
        orderBy: { name: 'asc' },
        take,
      }),
      db.suppliers.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { contactName: { contains: query } },
            { email: { contains: query } },
            { phone: { contains: query } },
          ],
        },
        select: {
          id: true,
          name: true,
          contactName: true,
          email: true,
          phone: true,
        },
        orderBy: { name: 'asc' },
        take,
      }),
      db.tasks.findMany({
        where: {
          OR: [
            { title: { contains: query } },
            { description: { contains: query } },
          ],
        },
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          project: { select: { name: true, poNumber: true } },
        },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        take,
      }),
    ])

    const groups = [
      group('Projects', projects.map((project) => ({
        id: project.id,
        type: 'project',
        title: project.name,
        subtitle: [project.client.name, project.status].filter(Boolean).join(' | '),
        page: 'projects',
        code: project.poNumber || undefined,
      }))),
      group('Products', products.map((product) => ({
        id: product.id,
        type: 'product',
        title: product.name,
        subtitle: [product.family, product.engineeringSection].filter(Boolean).join(' | '),
        page: 'products',
        code: product.code,
      }))),
      group('Purchases', purchases.map((purchase) => ({
        id: purchase.id,
        type: 'purchase',
        title: purchase.purchaseCode,
        subtitle: [
          purchase.project?.name,
          purchase.supplier.name,
          purchase.status,
        ].filter(Boolean).join(' | '),
        page: 'purchases',
        code: purchase.poNumber || purchase.project?.poNumber || undefined,
      }))),
      group('Clients', clients.map((client) => ({
        id: client.id,
        type: 'client',
        title: client.name,
        subtitle: [client.contactName, client.phone, client.email].filter(Boolean).join(' | '),
        page: 'clients',
      }))),
      group('Suppliers', suppliers.map((supplier) => ({
        id: supplier.id,
        type: 'supplier',
        title: supplier.name,
        subtitle: [supplier.contactName, supplier.phone, supplier.email].filter(Boolean).join(' | '),
        page: 'suppliers',
      }))),
      group('Tasks', tasks.map((task) => ({
        id: task.id,
        type: 'task',
        title: task.title,
        subtitle: [
          task.project?.name,
          task.dueDate ? `Due ${task.dueDate}` : '',
          task.status,
        ].filter(Boolean).join(' | '),
        page: 'tasks',
        code: task.project?.poNumber || undefined,
      }))),
    ].filter(Boolean)

    return NextResponse.json({ query, groups })
  } catch (error) {
    console.error('Error searching:', error)
    return NextResponse.json({ error: 'Error searching' }, { status: 500 })
  }
}
