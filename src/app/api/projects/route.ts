import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isProductCompatibleWithProjectColor } from '@/lib/project-color'
import { runProjectAutomation } from '@/lib/project-automation'
import { normalizeDateRange } from '@/lib/project-phases'
import * as XLSX from 'xlsx'

type ProjectCreateBody = {
  name?: string
  poNumber?: string
  projectType?: string
  clientId?: string
  contractorId?: string
  projectDate?: string
  startDate?: string
  endDate?: string
  status?: string
  budget?: number
  color?: string
  materialListFile?: File | null
  phases?: Array<{ phaseTypeId: string; startDate?: string; endDate?: string; sortOrder?: number }>
}

type ImportedMaterialRow = {
  name: string
  quantity: number
  section: string
  sortOrder: number
}

function normalizeTemplateKey(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function groupTemplateItemsByProduct(
  items: {
    productId: string
    plannedQuantity: number
    section?: string | null
    sortOrder?: number | null
  }[]
) {
  const grouped = new Map<
    string,
    { productId: string; plannedQuantity: number; section: string; sortOrder: number }
  >()

  items.forEach((item, index) => {
    const productId = String(item.productId || '').trim()
    const plannedQuantity = Number(item.plannedQuantity)
    if (!productId || !Number.isFinite(plannedQuantity) || plannedQuantity <= 0) return

    const current = grouped.get(productId)
    if (!current) {
      grouped.set(productId, {
        productId,
        plannedQuantity,
        section: item.section || '',
        sortOrder: item.sortOrder ?? index,
      })
      return
    }

    grouped.set(productId, {
      productId,
      plannedQuantity: current.plannedQuantity + plannedQuantity,
      section: current.section || item.section || '',
      sortOrder: Math.min(current.sortOrder, item.sortOrder ?? index),
    })
  })

  return [...grouped.values()].sort((a, b) => a.sortOrder - b.sortOrder)
}

function normalizeLookupKey(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseQuantity(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const cleaned = String(value ?? '')
    .replace(/,/g, '')
    .trim()
  const quantity = Number(cleaned)
  return Number.isFinite(quantity) ? quantity : 0
}

function inferProductColor(name: string) {
  const normalized = ` ${name.toUpperCase().replace(/\s+/g, ' ')} `
  if (/\b(BRZ|BRONZE|BRONCE)\b/.test(normalized)) return 'Bronze'
  if (/\b(WHT|WHITE|BLANCO|WHIT)\b/.test(normalized)) return 'Blanco'
  if (/\bALM\b/.test(normalized)) return 'Aluminio'
  if (/\bZINC\b/.test(normalized)) return 'Zinc'
  if (/\bBLUE|AZUL\b/.test(normalized)) return 'Azul'
  if (/\bBLK|BLACK|NEGRO\b/.test(normalized)) return 'Negro'
  return ''
}

function buildImportProductCode(name: string, usedCodes: Set<string>) {
  const base =
    normalizeLookupKey(name)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'MATERIAL'

  let code = `IMP-${base}`
  let suffix = 2
  while (usedCodes.has(code)) {
    code = `IMP-${base.slice(0, Math.max(1, 32 - String(suffix).length - 1))}-${suffix}`
    suffix++
  }
  usedCodes.add(code)
  return code
}

async function parseProjectMaterialList(file?: File | null) {
  if (!file || file.size === 0) return []

  const bytes = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(bytes, { type: 'buffer' })
  const rows: ImportedMaterialRow[] = []

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      raw: false,
    })

    let section = ''

    rawRows.forEach((row) => {
      const first = String(row[0] ?? '').replace(/\s+/g, ' ').trim()
      const second = row[1]
      const quantity = parseQuantity(second)

      if (!first) return

      if (quantity <= 0) {
        section = first
        return
      }

      rows.push({
        name: first,
        quantity: Math.ceil(quantity),
        section,
        sortOrder: rows.length,
      })
    })
  })

  return rows
}

async function readCreateBody(request: NextRequest): Promise<ProjectCreateBody> {
  const contentType = request.headers.get('content-type') || ''

  if (!contentType.includes('multipart/form-data')) {
    return request.json()
  }

  const formData = await request.formData()
  const body: ProjectCreateBody = {}

  for (const key of [
    'name',
    'poNumber',
    'projectType',
    'clientId',
    'contractorId',
    'projectDate',
    'startDate',
    'endDate',
    'status',
    'color',
  ] as const) {
    const value = formData.get(key)
    if (typeof value === 'string' && value.trim()) body[key] = value
  }

  const budget = formData.get('budget')
  if (typeof budget === 'string' && budget.trim()) body.budget = Number(budget)

  const materialListFile = formData.get('materialListFile')
  if (materialListFile instanceof File) body.materialListFile = materialListFile

  const phases = formData.get('phases')
  if (typeof phases === 'string' && phases.trim()) {
    try {
      body.phases = JSON.parse(phases)
    } catch {
      body.phases = []
    }
  }

  return body
}

export async function GET(request: NextRequest) {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const projects = await db.projects.findMany({
      include: {
        client: true,
        contractor: true,
        materials: {
          include: { product: true },
        },
        purchases: {
          orderBy: { purchaseDate: 'desc' },
          select: {
            id: true,
            status: true,
            supplierId: true,
            purchaseCode: true,
            poNumber: true,
            purchaseDate: true,
            supplier: { select: { id: true, name: true } },
            items: {
              select: {
                id: true,
                productId: true,
                quantity: true,
                product: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
        _count: {
          select: { dispatches: true, returns: true },
        },
        tasks: {
          where: {
            status: 'pending',
            OR: [
              { dueDate: null },
              { dueDate: { lte: today } },
            ],
          },
          orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
          take: 1,
          select: {
            id: true,
            title: true,
            dueDate: true,
            priority: true,
            autoGenerated: true,
            automationKey: true,
          },
        },
        phases: {
          include: { phaseType: true },
          orderBy: [{ startDate: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error('Error al listar proyectos:', error)
    return NextResponse.json({ error: 'Error al listar proyectos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readCreateBody(request)
    const { name, poNumber, projectType, clientId, contractorId, projectDate, startDate, endDate, status, budget, color, materialListFile, phases } = body

    if (!name || !clientId) {
      return NextResponse.json(
        { error: 'El nombre y el cliente son obligatorios' },
        { status: 400 }
      )
    }

    const importedMaterialRows = await parseProjectMaterialList(materialListFile)
    const normalizedProjectType = normalizeTemplateKey(projectType)
    const matchingTemplate = normalizedProjectType && importedMaterialRows.length === 0
      ? (
          await db.materialTemplates.findMany({
            where: {
              projectType: {
                not: '',
              },
            },
            include: {
              items: {
                include: {
                  product: {
                    select: {
                      id: true,
                      color: true,
                    },
                  },
                },
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
              },
            },
            orderBy: { createdAt: 'desc' },
          })
        ).find((template) => normalizeTemplateKey(template.projectType) === normalizedProjectType) || null
      : null

    const result = await db.$transaction(async (tx) => {
      const project = await tx.projects.create({
        data: {
          name,
          poNumber: poNumber || '',
          projectType: projectType || '',
          clientId,
          contractorId: contractorId || null,
          projectDate: projectDate || '',
          startDate: startDate || null,
          endDate: endDate || null,
          status: status || 'planned',
          budget: budget ?? 0,
          color: color || '',
        },
      })

      let autoTemplate:
        | {
            id: string
            name: string
            createdCount: number
            skippedIncompatibleCount: number
          }
        | undefined
      let materialListImport:
        | {
            fileName: string
            createdCount: number
            createdProductsCount: number
            skippedIncompatibleCount: number
          }
        | undefined

      if (matchingTemplate) {
        const compatibleItems = matchingTemplate.items.filter((item) =>
          isProductCompatibleWithProjectColor(color, item.product.color)
        )
        const skippedIncompatibleCount = matchingTemplate.items.length - compatibleItems.length
        const groupedItems = groupTemplateItemsByProduct(
          compatibleItems.map((item) => ({
            productId: item.productId,
            plannedQuantity: item.plannedQuantity,
            section: item.section,
            sortOrder: item.sortOrder,
          }))
        )

        for (const [index, item] of groupedItems.entries()) {
          await tx.projectMaterials.create({
            data: {
              projectId: project.id,
              productId: item.productId,
              plannedQuantity: item.plannedQuantity,
              engineeringSection: item.section,
              sortOrder: item.sortOrder ?? index,
            },
          })
        }

        autoTemplate = {
          id: matchingTemplate.id,
          name: matchingTemplate.name,
          createdCount: groupedItems.length,
          skippedIncompatibleCount,
        }
      }

      if (importedMaterialRows.length > 0) {
        const products = await tx.products.findMany()
        const productsByName = new Map(products.map((product) => [normalizeLookupKey(product.name), product]))
        const productsByCode = new Map(products.map((product) => [normalizeLookupKey(product.code), product]))
        const usedCodes = new Set(products.map((product) => product.code))
        const groupedRows = new Map<
          string,
          { name: string; quantity: number; section: string; sortOrder: number }
        >()

        importedMaterialRows.forEach((item) => {
          const key = normalizeLookupKey(item.name)
          const current = groupedRows.get(key)
          if (!current) {
            groupedRows.set(key, {
              name: item.name,
              quantity: item.quantity,
              section: item.section,
              sortOrder: item.sortOrder,
            })
            return
          }

          groupedRows.set(key, {
            ...current,
            quantity: current.quantity + item.quantity,
            section: current.section || item.section,
            sortOrder: Math.min(current.sortOrder, item.sortOrder),
          })
        })

        let createdCount = 0
        let createdProductsCount = 0
        const skippedIncompatibleCount = 0

        for (const item of [...groupedRows.values()].sort((a, b) => a.sortOrder - b.sortOrder)) {
          const key = normalizeLookupKey(item.name)
          let product = productsByCode.get(key) || productsByName.get(key) || null

          if (!product) {
            product = await tx.products.create({
              data: {
                code: buildImportProductCode(item.name, usedCodes),
                name: item.name,
                family: item.section || 'Importado de proyecto',
                color: inferProductColor(item.name),
                unitOfMeasure: 'unidad',
                unitQuantity: '',
                minStock: 0,
                currentStock: 0,
                referencePrice: 0,
              },
            })
            productsByName.set(key, product)
            productsByCode.set(normalizeLookupKey(product.code), product)
            createdProductsCount++
          }

          await tx.projectMaterials.create({
            data: {
              projectId: project.id,
              productId: product.id,
              plannedQuantity: item.quantity,
              engineeringSection: item.section,
              sortOrder: item.sortOrder,
            },
          })
          createdCount++
        }

        materialListImport = {
          fileName: materialListFile?.name || '',
          createdCount,
          createdProductsCount,
          skippedIncompatibleCount,
        }
      }

      if (Array.isArray(phases) && phases.length > 0) {
        for (const [index, phase] of phases.entries()) {
          const phaseTypeId = String(phase.phaseTypeId || '').trim()
          if (!phaseTypeId) continue
          const range = normalizeDateRange(
            phase.startDate || startDate || projectDate,
            phase.endDate || endDate || phase.startDate || startDate || projectDate
          )
          await tx.projectPhases.create({
            data: {
              projectId: project.id,
              phaseTypeId,
              startDate: range.startDate,
              endDate: range.endDate,
              status: 'pending',
              sortOrder: Number.isFinite(Number(phase.sortOrder)) ? Number(phase.sortOrder) : index,
            },
          })
        }
      }

      const shouldAutoSchedule =
        !status &&
        Boolean(startDate) &&
        ((autoTemplate?.createdCount || 0) > 0 || (materialListImport?.createdCount || 0) > 0)

      if (shouldAutoSchedule) {
        await tx.projects.update({
          where: { id: project.id },
          data: { status: 'scheduled' },
        })
      }

      const hydratedProject = await tx.projects.findUnique({
        where: { id: project.id },
        include: {
          client: true,
          contractor: true,
          materials: {
            include: { product: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
          phases: {
            include: { phaseType: true },
            orderBy: [{ startDate: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
      })

      return {
        ...hydratedProject,
        autoTemplate,
        materialListImport,
      }
    }, { timeout: 30000 })

    if (result?.id) {
      runProjectAutomation(result.id).catch(console.error)
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error al crear proyecto:', error)
    return NextResponse.json({ error: 'Error al crear proyecto' }, { status: 500 })
  }
}
