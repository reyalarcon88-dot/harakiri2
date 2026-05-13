import { db } from '@/lib/db'
import path from 'path'
import { readFileSync } from 'fs'
import {
  Document,
  Image,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'

const RMC_LOGO_SRC = `data:image/png;base64,${readFileSync(
  path.join(process.cwd(), 'public', 'rmc-logo.png')
).toString('base64')}`

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 36,
    color: '#1f2937',
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderColor: '#b45309',
    paddingBottom: 10,
    marginBottom: 16,
  },
  brandLogo: {
    width: 82,
    height: 42,
    objectFit: 'contain',
  },
  brandTextBlock: {
    textAlign: 'right',
  },
  brandName: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#1f2937',
  },
  brandMeta: {
    fontSize: 8,
    color: '#6b7280',
    marginTop: 2,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#b45309',
    textAlign: 'center',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    textAlign: 'center',
    color: '#6b7280',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1f2937',
    marginTop: 10,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  infoLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    width: 65,
  },
  infoValue: {
    fontSize: 9,
    color: '#374151',
    width: 180,
  },
  notesSection: {
    marginTop: 14,
    fontSize: 9,
    color: '#374151',
  },
})

function BrandHeader() {
  return (
    <View style={styles.brandHeader}>
      <Image src={RMC_LOGO_SRC} style={styles.brandLogo} />
      <View style={styles.brandTextBlock}>
        <Text style={styles.brandName}>RMC</Text>
        <Text style={styles.brandMeta}>Inventory & Project Materials</Text>
      </View>
    </View>
  )
}

export function safeDocumentPart(value: string | null | undefined, fallback: string) {
  const normalized = String(value || fallback)
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return normalized || fallback
}

function buildDocumentReference(type: string, poNumber: string | undefined, name: string) {
  return ['RMC', type, poNumber ? `PO ${poNumber}` : '', name].filter(Boolean).join(' | ')
}

function toNumber(value: unknown) {
  const numberValue = Number(value ?? 0)
  return Number.isFinite(numberValue) ? numberValue : 0
}

async function ensureBuffer(value: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(value)) return value
  if (value instanceof Uint8Array) return Buffer.from(value)
  if (value && typeof (value as { arrayBuffer?: unknown }).arrayBuffer === 'function') {
    return Buffer.from(await (value as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer())
  }
  if (value && typeof (value as AsyncIterable<Buffer | Uint8Array | string>)[Symbol.asyncIterator] === 'function') {
    const chunks: Buffer[] = []
    for await (const chunk of value as AsyncIterable<Buffer | Uint8Array | string>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }
  throw new Error('Invalid PDF buffer')
}

function addWeightedUnitPrice(
  map: Map<string, { totalQuantity: number; totalCost: number }>,
  productId: string,
  quantity: number,
  unitPrice: number
) {
  if (!productId || quantity <= 0 || unitPrice <= 0) return
  const current = map.get(productId) || { totalQuantity: 0, totalCost: 0 }
  current.totalQuantity += quantity
  current.totalCost += quantity * unitPrice
  map.set(productId, current)
}

function getAverageUnitPrice(
  map: Map<string, { totalQuantity: number; totalCost: number }>,
  productId: string
) {
  const current = map.get(productId)
  if (!current || current.totalQuantity <= 0) return 0
  return current.totalCost / current.totalQuantity
}

function InvoicePDF({
  project,
  items,
  returnItems,
  dispatchedSubtotal,
  returnsTotal,
  total,
}: {
  project: { poNumber: string; name: string; client: string; contractor: string; date: string }
  items: { num: number; code: string; name: string; quantity: number; unitPrice: number; subtotal: number; location: string; dispatchDate: string }[]
  returnItems: { num: number; code: string; name: string; quantity: number; unitPrice: number; subtotal: number; returnDate: string; location: string; status: string }[]
  dispatchedSubtotal: number
  returnsTotal: number
  total: number
}) {
  return (
    <Document>
      <Page size="letter" style={styles.page}>
        <BrandHeader />
        <Text style={styles.title}>Project Invoice</Text>
        <Text style={styles.subtitle}>
          {buildDocumentReference('Project Invoice', project.poNumber, project.name)}
        </Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Proyecto:</Text>
          <Text style={styles.infoValue}>{project.name}</Text>
          <Text style={styles.infoLabel}>Fecha:</Text>
          <Text style={styles.infoValue}>{project.date}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Cliente:</Text>
          <Text style={styles.infoValue}>{project.client}</Text>
          <Text style={styles.infoLabel}>Contratista:</Text>
          <Text style={styles.infoValue}>{project.contractor || '—'}</Text>
        </View>

        <Text style={styles.sectionTitle}>Materiales Despachados</Text>

        <View
          style={{ flexDirection: 'row', backgroundColor: '#b45309', borderBottomWidth: 0.5, borderColor: '#fcd34d' }}
          fixed
        >
          <View style={{ width: 22, paddingVertical: 5, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, color: '#ffffff', fontFamily: 'Helvetica-Bold', textAlign: 'center' }}>#</Text></View>
          <View style={{ width: 58, paddingVertical: 5, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, color: '#ffffff', fontFamily: 'Helvetica-Bold' }}>Codigo</Text></View>
          <View style={{ width: 135, paddingVertical: 5, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, color: '#ffffff', fontFamily: 'Helvetica-Bold' }}>Producto</Text></View>
          <View style={{ width: 35, paddingVertical: 5, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, color: '#ffffff', fontFamily: 'Helvetica-Bold', textAlign: 'center' }}>Cant.</Text></View>
          <View style={{ width: 55, paddingVertical: 5, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, color: '#ffffff', fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>Precio Unit.</Text></View>
          <View style={{ width: 55, paddingVertical: 5, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, color: '#ffffff', fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>Subtotal</Text></View>
          <View style={{ width: 55, paddingVertical: 5, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, color: '#ffffff', fontFamily: 'Helvetica-Bold' }}>Fecha</Text></View>
          <View style={{ width: 125, paddingVertical: 5, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, color: '#ffffff', fontFamily: 'Helvetica-Bold' }}>Ubicacion</Text></View>
        </View>

        {items.map((item, idx) => (
          <View
            key={item.num}
            style={{ flexDirection: 'row', backgroundColor: idx % 2 === 1 ? '#fffbeb' : '#ffffff', borderBottomWidth: 0.5, borderColor: '#fcd34d' }}
          >
            <View style={{ width: 22, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, textAlign: 'center' }}>{item.num}</Text></View>
            <View style={{ width: 58, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8 }}>{item.code}</Text></View>
            <View style={{ width: 135, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8 }}>{item.name}</Text></View>
            <View style={{ width: 35, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, textAlign: 'center' }}>{item.quantity}</Text></View>
            <View style={{ width: 55, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, textAlign: 'right' }}>{item.unitPrice.toFixed(2)}</Text></View>
            <View style={{ width: 55, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, textAlign: 'right' }}>{item.subtotal.toFixed(2)}</Text></View>
            <View style={{ width: 55, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8 }}>{item.dispatchDate}</Text></View>
            <View style={{ width: 125, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8 }}>{item.location}</Text></View>
          </View>
        ))}

        <View style={{ flexDirection: 'row', backgroundColor: '#fef3c7', borderTopWidth: 1, borderColor: '#f59e0b' }}>
          <View style={{ width: 305, paddingVertical: 5, paddingHorizontal: 3 }} />
          <View style={{ width: 55, paddingVertical: 5, paddingHorizontal: 3 }}><Text style={{ fontSize: 9, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>Despachado:</Text></View>
          <View style={{ width: 55, paddingVertical: 5, paddingHorizontal: 3 }}><Text style={{ fontSize: 9, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>{dispatchedSubtotal.toFixed(2)}</Text></View>
          <View style={{ width: 180, paddingVertical: 5, paddingHorizontal: 3 }} />
        </View>

        {items.length === 0 && (
          <View style={{ paddingVertical: 12 }}>
            <Text style={{ fontSize: 9, color: '#6b7280', textAlign: 'center' }}>
              Este proyecto todavia no tiene materiales despachados.
            </Text>
          </View>
        )}

        {returnItems.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Devoluciones - No cuentan como costo del proyecto</Text>
            <View
              style={{ flexDirection: 'row', backgroundColor: '#0f766e', borderBottomWidth: 0.5, borderColor: '#99f6e4' }}
              fixed
            >
              <View style={{ width: 22, paddingVertical: 5, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, color: '#ffffff', fontFamily: 'Helvetica-Bold', textAlign: 'center' }}>#</Text></View>
              <View style={{ width: 58, paddingVertical: 5, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, color: '#ffffff', fontFamily: 'Helvetica-Bold' }}>Codigo</Text></View>
              <View style={{ width: 155, paddingVertical: 5, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, color: '#ffffff', fontFamily: 'Helvetica-Bold' }}>Producto</Text></View>
              <View style={{ width: 38, paddingVertical: 5, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, color: '#ffffff', fontFamily: 'Helvetica-Bold', textAlign: 'center' }}>Cant.</Text></View>
              <View style={{ width: 55, paddingVertical: 5, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, color: '#ffffff', fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>No costo</Text></View>
              <View style={{ width: 58, paddingVertical: 5, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, color: '#ffffff', fontFamily: 'Helvetica-Bold' }}>Fecha</Text></View>
              <View style={{ width: 154, paddingVertical: 5, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, color: '#ffffff', fontFamily: 'Helvetica-Bold' }}>Ubicacion / Estado</Text></View>
            </View>

            {returnItems.map((item, idx) => (
              <View
                key={`return-${item.num}`}
                style={{ flexDirection: 'row', backgroundColor: idx % 2 === 1 ? '#f0fdfa' : '#ffffff', borderBottomWidth: 0.5, borderColor: '#99f6e4' }}
              >
                <View style={{ width: 22, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, textAlign: 'center' }}>{item.num}</Text></View>
                <View style={{ width: 58, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8 }}>{item.code}</Text></View>
                <View style={{ width: 155, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8 }}>{item.name}</Text></View>
                <View style={{ width: 38, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, textAlign: 'center' }}>{item.quantity}</Text></View>
                <View style={{ width: 55, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, textAlign: 'right' }}>{item.subtotal.toFixed(2)}</Text></View>
                <View style={{ width: 58, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8 }}>{item.returnDate}</Text></View>
                <View style={{ width: 154, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8 }}>{item.location} / {item.status}</Text></View>
              </View>
            ))}

            <View style={{ flexDirection: 'row', backgroundColor: '#ccfbf1', borderTopWidth: 1, borderColor: '#14b8a6' }}>
              <View style={{ width: 328, paddingVertical: 5, paddingHorizontal: 3 }} />
              <View style={{ width: 58, paddingVertical: 5, paddingHorizontal: 3 }}><Text style={{ fontSize: 9, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>Excluido:</Text></View>
              <View style={{ width: 55, paddingVertical: 5, paddingHorizontal: 3 }}><Text style={{ fontSize: 9, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>{returnsTotal.toFixed(2)}</Text></View>
              <View style={{ width: 154, paddingVertical: 5, paddingHorizontal: 3 }} />
            </View>
          </>
        )}

        <View style={{ flexDirection: 'row', backgroundColor: '#fef3c7', borderTopWidth: 1, borderColor: '#f59e0b', marginTop: 8 }}>
          <View style={{ width: 305, paddingVertical: 6, paddingHorizontal: 3 }} />
          <View style={{ width: 55, paddingVertical: 6, paddingHorizontal: 3 }}><Text style={{ fontSize: 10, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>TOTAL:</Text></View>
          <View style={{ width: 55, paddingVertical: 6, paddingHorizontal: 3 }}><Text style={{ fontSize: 10, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>{total.toFixed(2)}</Text></View>
          <View style={{ width: 180, paddingVertical: 6, paddingHorizontal: 3 }} />
        </View>
      </Page>
    </Document>
  )
}

async function fetchInvoiceData(projectId: string) {
  const project = await db.projects.findUnique({
    where: { id: projectId },
    include: {
      client: true,
      contractor: true,
      dispatches: {
        include: {
          items: {
            include: {
              product: true,
              shelf: { include: { rack: { include: { warehouse: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      returns: {
        include: {
          items: {
            include: {
              productDelivered: true,
              productReturned: true,
              shelfFrom: { include: { rack: { include: { warehouse: true } } } },
              shelfTo: { include: { rack: { include: { warehouse: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!project) throw new Error('Proyecto no encontrado')

  const projectProductIds = [
    ...new Set([
      ...project.dispatches.flatMap((d) => d.items.map((i) => i.productId)),
      ...project.returns.flatMap((r) =>
        r.items.flatMap((i) => [i.productIdDelivered, i.productIdReturned].filter(Boolean) as string[])
      ),
    ]),
  ]

  const purchasePrices = projectProductIds.length
    ? await db.purchaseItems.findMany({
        where: {
          productId: { in: projectProductIds },
          unitPrice: { gt: 0 },
          purchase: { status: { not: 'cancelled' } },
        },
        select: {
          productId: true,
          quantity: true,
          unitPrice: true,
          purchase: { select: { projectId: true } },
        },
      })
    : []

  const projectPriceByProduct = new Map<string, { totalQuantity: number; totalCost: number }>()
  const globalPriceByProduct = new Map<string, { totalQuantity: number; totalCost: number }>()

  for (const item of purchasePrices) {
    addWeightedUnitPrice(globalPriceByProduct, item.productId, toNumber(item.quantity), toNumber(item.unitPrice))
    if (item.purchase.projectId === projectId) {
      addWeightedUnitPrice(projectPriceByProduct, item.productId, toNumber(item.quantity), toNumber(item.unitPrice))
    }
  }

  const resolveUnitPrice = (productId: string, referencePrice: number) =>
    getAverageUnitPrice(projectPriceByProduct, productId) ||
    getAverageUnitPrice(globalPriceByProduct, productId) ||
    referencePrice ||
    0

  const flat = project.dispatches.flatMap((d) =>
    d.items.map((it) => ({
      code: it.product.code,
      name: it.product.name,
      quantity: toNumber(it.quantity),
      unitPrice: resolveUnitPrice(it.productId, it.product.referencePrice || 0),
      subtotal: toNumber(it.quantity) * resolveUnitPrice(it.productId, it.product.referencePrice || 0),
      dispatchDate: d.dispatchDate,
      location: it.shelf
        ? `${it.shelf.rack.warehouse.name} > ${it.shelf.rack.name} > ${it.shelf.name}`
        : 'Desde Recepción',
    }))
  )

  const items = flat.map((it, idx) => ({ num: idx + 1, ...it }))

  const returnFlat = project.returns.filter((returnOrder) => returnOrder.status === 'completed').flatMap((returnOrder) =>
    returnOrder.items.map((it) => {
      const unitPrice = resolveUnitPrice(it.productIdDelivered, it.productDelivered.referencePrice || 0)
      return {
        code: it.productDelivered.code,
        name: it.productDelivered.name,
        quantity: toNumber(it.quantityDelivered || it.quantityReturned),
        unitPrice,
        subtotal: toNumber(it.quantityDelivered || it.quantityReturned) * unitPrice,
        returnDate: returnOrder.returnDate,
        status: returnOrder.status,
        location: it.shelfTo
          ? `${it.shelfTo.rack.warehouse.name} > ${it.shelfTo.rack.name} > ${it.shelfTo.name}`
          : 'Recepcion',
      }
    })
  )

  const returnItems = returnFlat.map((it, idx) => ({ num: idx + 1, ...it }))
  const dispatchedSubtotal = items.reduce((sum, it) => sum + it.subtotal, 0)
  const returnsTotal = returnItems.reduce((sum, it) => sum + it.subtotal, 0)
  const total = Math.max(dispatchedSubtotal - returnsTotal, 0)

  const fileName = `RMC-${safeDocumentPart(project.poNumber, 'No-PO')}-Project-Invoice-${safeDocumentPart(project.name, 'Project')}.pdf`

  return {
    project: {
      poNumber: project.poNumber || '',
      name: project.name,
      client: project.client?.name || '',
      contractor: project.contractor?.name || '',
      date: project.projectDate || new Date().toISOString().split('T')[0],
    },
    items,
    returnItems,
    dispatchedSubtotal,
    returnsTotal,
    total,
    fileName,
  }
}

export async function renderProjectInvoicePdf(projectId: string): Promise<{ buffer: Buffer; fileName: string }> {
  const data = await fetchInvoiceData(projectId)
  const { pdf } = await import('@react-pdf/renderer')
  const pdfBuffer = await ensureBuffer(await pdf(
    <InvoicePDF
      project={data.project}
      items={data.items}
      returnItems={data.returnItems}
      dispatchedSubtotal={data.dispatchedSubtotal}
      returnsTotal={data.returnsTotal}
      total={data.total}
    />
  ).toBuffer())
  return { buffer: pdfBuffer, fileName: data.fileName }
}

export async function archiveProjectInvoicePdf(projectId: string, fileName: string, buffer: Buffer): Promise<void> {
  const { mkdir, writeFile } = await import('fs/promises')
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'projects')
  await mkdir(uploadDir, { recursive: true })

  const uniqueFilename = `${Date.now()}-auto-invoice.pdf`
  await writeFile(path.join(uploadDir, uniqueFilename), buffer)

  // Replace any previously auto-generated invoice (keep manually uploaded ones)
  await db.projectDocuments.deleteMany({
    where: { projectId, category: 'invoice', fileUrl: { contains: 'auto-invoice' } },
  })

  await db.projectDocuments.create({
    data: {
      projectId,
      fileName,
      fileUrl: `/uploads/projects/${uniqueFilename}`,
      fileSize: buffer.length,
      fileType: 'application/pdf',
      category: 'invoice',
    },
  })
}

export async function autoArchiveInvoice(projectId: string): Promise<void> {
  try {
    const { buffer, fileName } = await renderProjectInvoicePdf(projectId)
    await archiveProjectInvoicePdf(projectId, fileName, buffer)
  } catch (err) {
    console.error('[autoArchiveInvoice] non-fatal error:', err)
  }
}
