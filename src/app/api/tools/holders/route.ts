import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const currentToolInclude = {
  currentShelf: { include: { rack: { include: { warehouse: true } } } },
  currentContractor: true,
  currentInstaller: true,
  assignments: { include: { contractor: true, installer: true } },
  kitItems: { include: { kit: true } },
  movements: {
    take: 5,
    orderBy: { createdAt: 'desc' as const },
    include: {
      fromShelf: { include: { rack: { include: { warehouse: true } } } },
      toShelf: { include: { rack: { include: { warehouse: true } } } },
      fromContractor: true,
      toContractor: true,
      fromInstaller: true,
      toInstaller: true,
    },
  },
}

function kitCount(tools: { kitItems?: { kitId?: string; kit?: { id: string } }[] }[]) {
  return new Set(
    tools
      .flatMap((tool) => tool.kitItems || [])
      .map((item) => item.kit?.id || item.kitId)
      .filter(Boolean)
  ).size
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    const [installers, contractors, assignments] = await Promise.all([
      db.toolInstallers.findMany({
        where: search
          ? {
              OR: [
                { name: { contains: search } },
                { phone: { contains: search } },
                { email: { contains: search } },
                { company: { contains: search } },
              ],
            }
          : undefined,
        include: {
          currentTools: {
            include: currentToolInclude,
            orderBy: { name: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      }),
      db.contractors.findMany({
        where: search
          ? {
              OR: [
                { name: { contains: search } },
                { contactName: { contains: search } },
                { email: { contains: search } },
                { specialty: { contains: search } },
              ],
            }
          : undefined,
        include: {
          currentTools: {
            include: currentToolInclude,
            orderBy: { name: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      }),
      db.toolAssignments.findMany({
        where: { quantity: { gt: 0 } },
        include: {
          contractor: true,
          installer: true,
          tool: { include: currentToolInclude },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ])

    const assignmentTools = (holderType: 'installer' | 'contractor', holderId: string) =>
      assignments
        .filter((assignment) =>
          holderType === 'installer'
            ? assignment.holderType === 'installer' && assignment.installerId === holderId
            : assignment.holderType === 'contractor' && assignment.contractorId === holderId
        )
        .map((assignment) => ({
          ...assignment.tool,
          assignedQuantity: assignment.quantity,
          availableQuantity: 0,
          currentLocationType: holderType,
          currentContractor: holderType === 'contractor' ? assignment.contractor : null,
          currentInstaller: holderType === 'installer' ? assignment.installer : null,
          assignments: [assignment],
        }))

    const holderTools = (holderType: 'installer' | 'contractor', holderId: string, currentTools: typeof installers[number]['currentTools']) => {
      const assigned = assignmentTools(holderType, holderId)
      const assignedIds = new Set(assigned.map((tool) => tool.id))
      return [...assigned, ...currentTools.filter((tool) => !assignedIds.has(tool.id))]
    }

    const holders = [
      ...installers.map((installer) => {
        const tools = holderTools('installer', installer.id, installer.currentTools)
        return {
        holderType: 'installer',
        holderId: installer.id,
        name: installer.name,
        phone: installer.phone,
        email: installer.email,
        note: installer.company,
        tools,
        toolCount: tools.length,
        kitCount: kitCount(tools),
      }}),
      ...contractors.map((contractor) => {
        const tools = holderTools('contractor', contractor.id, contractor.currentTools)
        return {
        holderType: 'contractor',
        holderId: contractor.id,
        name: contractor.name,
        phone: contractor.phone,
        email: contractor.email,
        note: contractor.specialty || contractor.contactName,
        tools,
        toolCount: tools.length,
        kitCount: kitCount(tools),
      }}),
    ].sort((a, b) => b.toolCount - a.toolCount || a.name.localeCompare(b.name))

    return NextResponse.json(holders)
  } catch (error) {
    console.error('GET /api/tools/holders error:', error)
    return NextResponse.json({ error: 'Failed to fetch tool holders' }, { status: 500 })
  }
}
