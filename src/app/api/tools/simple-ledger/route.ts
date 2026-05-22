import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const toolInclude = {
  currentShelf: { include: { rack: { include: { warehouse: true } } } },
  currentContractor: true,
  currentInstaller: true,
  assignments: { include: { contractor: true, installer: true }, orderBy: { updatedAt: 'desc' as const } },
  kitItems: { include: { kit: true } },
  movements: {
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

type LedgerTool = Awaited<ReturnType<typeof db.inventoryTools.findMany<{ include: typeof toolInclude }>>>[number]
type LedgerHolderType = 'warehouse' | 'installer' | 'contractor'

function isMovementToHolder(movement: LedgerTool['movements'][number], holderType: LedgerHolderType, holderId: string) {
  if (holderType === 'warehouse') return movement.toType === 'warehouse' || Boolean(movement.toShelfId)
  if (holderType === 'installer') return movement.toInstallerId === holderId
  return movement.toContractorId === holderId
}

function isMovementFromHolder(movement: LedgerTool['movements'][number], holderType: LedgerHolderType, holderId: string) {
  if (holderType === 'warehouse') return movement.fromType === 'warehouse' || Boolean(movement.fromShelfId)
  if (holderType === 'installer') return movement.fromInstallerId === holderId
  return movement.fromContractorId === holderId
}

function latestMovement(
  tool: LedgerTool,
  predicate: (movement: LedgerTool['movements'][number]) => boolean
) {
  return tool.movements.find(predicate) || null
}

function canIssueFromWarehouse(tool: LedgerTool) {
  if (tool.status === 'lost' || tool.status === 'retired') return false
  if ((tool.availableQuantity || 0) <= 0) return false
  if (tool.trackingType === 'quantity') return true
  return tool.currentLocationType === 'warehouse'
}

function rowFor(
  tool: LedgerTool,
  holderName: string,
  options: {
    holderType: LedgerHolderType
    holderId: string
    currentState: 'in_possession' | 'warehouse'
    quantity?: number
  }
) {
  const kit = tool.kitItems[0]?.kit || null
  const lastInMovement = latestMovement(tool, (movement) =>
    isMovementToHolder(movement, options.holderType, options.holderId) &&
    ['created', 'issue', 'transfer', 'return'].includes(movement.movementType)
  )
  const lastOutMovement =
    options.currentState === 'in_possession'
      ? null
      : latestMovement(tool, (movement) =>
          isMovementFromHolder(movement, options.holderType, options.holderId) &&
          ['issue', 'transfer', 'return'].includes(movement.movementType)
        )
  const lastInDate = lastInMovement?.movementDate || ''
  const lastOutDate = lastOutMovement?.movementDate || ''

  return {
    tool,
    holderName,
    currentHolderName: holderName,
    currentState: options.currentState,
    toolDescription: tool.name,
    brandModel: [tool.brand, tool.model].filter(Boolean).join(' / '),
    serialNumber: tool.serial,
    condition: tool.condition,
    quantity: tool.trackingType === 'quantity' ? Math.max(options.quantity || 0, 1) : 1,
    qty: tool.trackingType === 'quantity' ? Math.max(options.quantity || 0, 1) : 1,
    lastInDate,
    lastOutDate,
    lastInMovementType: lastInMovement?.movementType || '',
    dateIssued: lastInDate,
    dateReturned: options.currentState === 'warehouse' && lastInMovement?.movementType === 'return' ? lastInDate : '',
    employeeSignature: '',
    companySignature: '',
    notes: tool.notes,
    kit: kit ? { id: kit.id, code: kit.code, name: kit.name } : null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    const [tools, installers, contractors, assignments] = await Promise.all([
      db.inventoryTools.findMany({
        include: toolInclude,
        orderBy: [{ currentLocationType: 'asc' }, { name: 'asc' }],
      }),
      db.toolInstallers.findMany({ orderBy: { name: 'asc' } }),
      db.contractors.findMany({ orderBy: { name: 'asc' } }),
      db.toolAssignments.findMany({
        where: { quantity: { gt: 0 } },
        include: {
          contractor: true,
          installer: true,
          tool: { include: toolInclude },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ])

    const matches = (row: ReturnType<typeof rowFor>) => {
      if (!search) return true
      const haystack = [
        row.holderName,
        row.toolDescription,
        row.brandModel,
        row.serialNumber,
        row.condition,
        row.notes,
        row.kit?.name,
        row.kit?.code,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(search.toLowerCase())
    }

    const groups = [
      {
        groupType: 'warehouse',
        groupId: 'warehouse',
        name: 'WH',
        label: 'Warehouse',
        phone: '',
        email: '',
        rows: tools
          .filter(canIssueFromWarehouse)
          .map((tool) =>
            rowFor(tool, 'WH', {
              holderType: 'warehouse',
              holderId: 'warehouse',
              currentState: 'warehouse',
              quantity: tool.availableQuantity,
            })
          )
          .filter(matches),
      },
      ...installers.map((installer) => ({
        groupType: 'installer',
        groupId: installer.id,
        name: installer.name,
        label: 'Instalador',
        phone: installer.phone,
        email: installer.email,
        rows: tools
          .filter((tool) => tool.currentInstallerId === installer.id && tool.assignments.length === 0)
          .map((tool) =>
            rowFor(tool, installer.name, {
              holderType: 'installer',
              holderId: installer.id,
              currentState: 'in_possession',
              quantity: tool.assignedQuantity,
            })
          )
          .filter(matches)
          .concat(
            assignments
              .filter((assignment) => assignment.holderType === 'installer' && assignment.installerId === installer.id)
              .map((assignment) =>
                rowFor(assignment.tool, installer.name, {
                  holderType: 'installer',
                  holderId: installer.id,
                  currentState: 'in_possession',
                  quantity: assignment.quantity,
                })
              )
              .filter(matches)
          ),
      })),
      ...contractors.map((contractor) => ({
        groupType: 'contractor',
        groupId: contractor.id,
        name: contractor.name,
        label: 'Contratista',
        phone: contractor.phone,
        email: contractor.email,
        rows: tools
          .filter((tool) => tool.currentContractorId === contractor.id && tool.assignments.length === 0)
          .map((tool) =>
            rowFor(tool, contractor.name, {
              holderType: 'contractor',
              holderId: contractor.id,
              currentState: 'in_possession',
              quantity: tool.assignedQuantity,
            })
          )
          .filter(matches)
          .concat(
            assignments
              .filter((assignment) => assignment.holderType === 'contractor' && assignment.contractorId === contractor.id)
              .map((assignment) =>
                rowFor(assignment.tool, contractor.name, {
                  holderType: 'contractor',
                  holderId: contractor.id,
                  currentState: 'in_possession',
                  quantity: assignment.quantity,
                })
              )
              .filter(matches)
          ),
      })),
    ].map((group) => ({
      ...group,
      toolCount: group.rows.length,
      kitCount: new Set(group.rows.map((row) => row.kit?.id).filter(Boolean)).size,
    }))

    return NextResponse.json(groups)
  } catch (error) {
    console.error('GET /api/tools/simple-ledger error:', error)
    return NextResponse.json({ error: 'Failed to fetch simple tool ledger' }, { status: 500 })
  }
}
