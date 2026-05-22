import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('search') || '').trim()

    const contractorWhere = search
      ? {
          OR: [
            { name: { contains: search } },
            { contactName: { contains: search } },
            { email: { contains: search } },
            { phone: { contains: search } },
            { specialty: { contains: search } },
          ],
        }
      : undefined

    const installerWhere = search
      ? {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
            { email: { contains: search } },
            { company: { contains: search } },
            { role: { contains: search } },
          ],
        }
      : undefined

    const [contractors, installers] = await Promise.all([
      db.contractors.findMany({
        where: contractorWhere,
        include: { _count: { select: { projects: true, currentTools: true } } },
      }),
      db.toolInstallers.findMany({
        where: installerWhere,
        include: { _count: { select: { currentTools: true } } },
      }),
    ])

    const personnel = [
      ...contractors.map((c) => ({
        type: 'contractor' as const,
        id: c.id,
        name: c.name,
        contactName: c.contactName || '',
        email: c.email || '',
        phone: c.phone || '',
        role: c.specialty || '',
        company: '',
        active: true,
        projectCount: c._count.projects,
        toolCount: c._count.currentTools,
        taskCount: 0,
      })),
      ...installers.map((i) => ({
        type: 'installer' as const,
        id: i.id,
        name: i.name,
        contactName: '',
        email: i.email || '',
        phone: i.phone || '',
        role: i.role || 'installer',
        company: i.company || '',
        active: i.active !== false,
        projectCount: 0,
        toolCount: i._count.currentTools,
        taskCount: 0,
      })),
    ].sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json(personnel)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch personnel'
    console.error('GET /api/personnel error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
