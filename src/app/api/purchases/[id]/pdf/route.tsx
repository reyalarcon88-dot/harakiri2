import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import path from 'path'
import { readFileSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
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

const ORDER_GENERATED_BY = process.env.RMC_ORDER_GENERATED_BY?.trim() || 'Reynaldo'
const ORDER_CONTACT_PHONE = process.env.RMC_ORDER_CONTACT_PHONE?.trim() || 'Telefono no configurado'

function breakLongCode(code: string) {
  return code.length > 18 ? code.replace(/-/g, '- ') : code
}

function generatedByText() {
  return `${ORDER_GENERATED_BY} | ${ORDER_CONTACT_PHONE}`
}

function safeDocumentPart(value: string | null | undefined, fallback: string) {
  const normalized = String(value || fallback)
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return normalized || fallback
}

function buildDocumentReference(type: string, poNumber: string | undefined, code: string) {
  return ['RMC', type, poNumber ? `PO ${poNumber}` : '', code].filter(Boolean).join(' | ')
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

async function archivePurchasePdf(purchaseId: string, fileName: string, buffer: Buffer) {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'purchases')
  await mkdir(uploadDir, { recursive: true })

  const uniqueFilename = `${Date.now()}-auto-purchase-order.pdf`
  const fileUrl = `/uploads/purchases/${uniqueFilename}`
  await writeFile(path.join(uploadDir, uniqueFilename), buffer)

  await db.purchaseDocuments.deleteMany({
    where: {
      purchaseId,
      fileUrl: { contains: 'auto-purchase-order' },
    },
  })

  await db.purchaseDocuments.create({
    data: {
      purchaseId,
      fileName,
      fileUrl,
      fileSize: buffer.length,
      fileType: 'application/pdf',
    },
  })

  return { fileUrl, fileSize: buffer.length }
}

async function archiveProjectOrderPdf(
  projectId: string | null | undefined,
  fileName: string,
  fileUrl: string,
  fileSize: number,
) {
  if (!projectId) return null

  const existing = await db.projectDocuments.findFirst({
    where: {
      projectId,
      fileName,
      category: 'sales_order',
    },
  })

  if (existing) {
    return db.projectDocuments.update({
      where: { id: existing.id },
      data: {
        fileUrl,
        fileSize,
        fileType: 'application/pdf',
        category: 'sales_order',
      },
    })
  }

  return db.projectDocuments.create({
    data: {
      projectId,
      fileName,
      fileUrl,
      fileSize,
      fileType: 'application/pdf',
      category: 'sales_order',
    },
  })
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
    borderColor: '#1e40af',
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
  pedidoTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#1e40af',
    textAlign: 'center',
    marginBottom: 4,
  },
  pedidoCode: {
    fontSize: 11,
    textAlign: 'center',
    color: '#6b7280',
    marginBottom: 20,
  },
  ordenTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#1f2937',
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  infoLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    width: 60,
  },
  infoValue: {
    fontSize: 9,
    color: '#374151',
    width: 170,
  },
  supplierLine: {
    fontSize: 9,
    color: '#374151',
    marginBottom: 16,
  },
  deliveryBox: {
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    padding: 8,
    marginBottom: 14,
  },
  deliveryLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#1e40af',
    marginBottom: 3,
  },
  deliveryValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    lineHeight: 1.35,
  },
  notesSection: {
    marginTop: 16,
    fontSize: 9,
    color: '#374151',
    lineHeight: 1.35,
  },
})

function BrandHeader({ accent = '#1e40af' }: { accent?: string }) {
  return (
    <View style={[styles.brandHeader, { borderColor: accent }]}>
      <Image src={RMC_LOGO_SRC} style={styles.brandLogo} />
      <View style={styles.brandTextBlock}>
        <Text style={styles.brandName}>RMC</Text>
        <Text style={styles.brandMeta}>Inventory & Project Materials</Text>
      </View>
    </View>
  )
}

// ─── Status Labels ───────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  pedido: 'Ordered',
  approved: 'Approved',
  received: 'Received',
  cancelled: 'Cancelled',
}

// ─── Pedido PDF ──────────────────────────────────────────────────────────────

function PedidoPDF({
  purchaseCode,
  date,
  poNumber,
  supplier,
  items,
  generatedBy,
  deliveryLabel,
  deliveryAddress,
}: {
  purchaseCode: string
  date: string
  poNumber?: string
  supplier: { name: string; contactName?: string; email?: string; phone?: string }
  items: { num: number; code: string; name: string; quantity: number }[]
  generatedBy: string
  deliveryLabel?: string
  deliveryAddress?: string
}) {
  const supplierParts = [supplier.name]
  if (supplier.contactName) supplierParts.push(supplier.contactName)
  if (supplier.email) supplierParts.push(supplier.email)
  if (supplier.phone) supplierParts.push(supplier.phone)

  return (
    <Document>
      <Page size="letter" style={styles.page}>
        <BrandHeader accent="#1e40af" />
        <Text style={styles.pedidoTitle}>Materials Order</Text>
        <Text style={styles.pedidoCode}>
          {buildDocumentReference('Materials Order', poNumber, purchaseCode)}
        </Text>

        {/* Info block: code, date */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Code:</Text>
          <Text style={styles.infoValue}>{purchaseCode}</Text>
          <Text style={styles.infoLabel}>Date:</Text>
          <Text style={styles.infoValue}>{date}</Text>
        </View>

        {poNumber ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Client PO:</Text>
            <Text style={styles.infoValue}>{poNumber}</Text>
          </View>
        ) : null}

        {deliveryAddress ? (
          <View style={styles.deliveryBox}>
            <Text style={styles.deliveryLabel}>{deliveryLabel || 'Delivery address'}</Text>
            <Text style={styles.deliveryValue}>{deliveryAddress}</Text>
          </View>
        ) : null}

        <Text style={styles.supplierLine}>
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>Supplier: </Text>
          {supplierParts.join(' | ')}
        </Text>

        {/* Header Row */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: '#3b82f6',
            borderBottomWidth: 0.5,
            borderColor: '#93c5fd',
          }}
          fixed
        >
          <View style={{ width: 30, paddingVertical: 6, paddingHorizontal: 4 }}><Text style={{ fontSize: 11, color: '#ffffff', fontFamily: 'Helvetica-Bold', textAlign: 'center' }}>#</Text></View>
          <View style={{ width: 145, paddingVertical: 6, paddingHorizontal: 4 }}><Text style={{ fontSize: 11, color: '#ffffff', fontFamily: 'Helvetica-Bold' }}>Code</Text></View>
          <View style={{ width: 255, paddingVertical: 6, paddingHorizontal: 4 }}><Text style={{ fontSize: 11, color: '#ffffff', fontFamily: 'Helvetica-Bold' }}>Product</Text></View>
          <View style={{ width: 60, paddingVertical: 6, paddingHorizontal: 4 }}><Text style={{ fontSize: 11, color: '#ffffff', fontFamily: 'Helvetica-Bold', textAlign: 'center' }}>Qty</Text></View>
        </View>

        {/* Data Rows */}
        {items.map((item, idx) => (
          <View
            key={item.num}
            wrap={false}
            style={{
              flexDirection: 'row',
              backgroundColor: idx % 2 === 1 ? '#eff6ff' : '#ffffff',
              borderBottomWidth: 0.5,
              borderColor: '#93c5fd',
            }}
          >
            <View style={{ width: 30, paddingVertical: 6, paddingHorizontal: 4 }}><Text style={{ fontSize: 10, textAlign: 'center' }}>{item.num}</Text></View>
            <View style={{ width: 145, paddingVertical: 6, paddingHorizontal: 4 }}><Text style={{ fontSize: 8, lineHeight: 1.2 }}>{breakLongCode(item.code)}</Text></View>
            <View style={{ width: 255, paddingVertical: 6, paddingHorizontal: 4 }}><Text style={{ fontSize: 10, lineHeight: 1.2 }}>{item.name}</Text></View>
            <View style={{ width: 60, paddingVertical: 6, paddingHorizontal: 4 }}><Text style={{ fontSize: 10, textAlign: 'center' }}>{item.quantity}</Text></View>
          </View>
        ))}

        <View style={styles.notesSection}>
          <Text>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>Generated by: </Text>
            {generatedBy}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

// ─── Orden de Compra PDF ────────────────────────────────────────────────────

function OrdenPDF({
  code,
  date,
  poNumber,
  status,
  supplier,
  items,
  total,
  generatedBy,
  deliveryLabel,
  deliveryAddress,
}: {
  code: string
  date: string
  poNumber?: string
  status: string
  supplier: { name: string; contactName?: string; email?: string; phone?: string }
  items: {
    num: number
    code: string
    name: string
    quantity: number
    unitPrice: number
    subtotal: number
    location: string
  }[]
  total: number
  generatedBy: string
  deliveryLabel?: string
  deliveryAddress?: string
}) {
  const supplierParts = [supplier.name]
  if (supplier.contactName) supplierParts.push(supplier.contactName)
  if (supplier.email) supplierParts.push(supplier.email)
  if (supplier.phone) supplierParts.push(supplier.phone)

  return (
    <Document>
      <Page size="letter" style={[styles.page, { paddingHorizontal: 54 }]}>
        <BrandHeader accent="#1f2937" />
        <Text style={styles.ordenTitle}>Purchase Order</Text>
        <Text style={[styles.pedidoCode, { textAlign: 'left', marginBottom: 10 }]}>
          {buildDocumentReference('Purchase Order', poNumber, code)}
        </Text>

        {/* Info Rows */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Code:</Text>
          <Text style={styles.infoValue}>{code}</Text>
          <Text style={styles.infoLabel}>Date:</Text>
          <Text style={styles.infoValue}>{date}</Text>
        </View>
        {poNumber ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Client PO:</Text>
            <Text style={styles.infoValue}>{poNumber}</Text>
          </View>
        ) : null}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status:</Text>
          <Text style={[styles.infoValue, { textTransform: 'uppercase' }]}>
            {STATUS_LABELS[status] || status}
          </Text>
        </View>

        {deliveryAddress ? (
          <View style={styles.deliveryBox}>
            <Text style={styles.deliveryLabel}>{deliveryLabel || 'Delivery address'}</Text>
            <Text style={styles.deliveryValue}>{deliveryAddress}</Text>
          </View>
        ) : null}

        <Text style={styles.supplierLine}>
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>Supplier: </Text>
          {supplierParts.join(' | ')}
        </Text>

        {/* Header Row */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: '#1f2937',
            borderBottomWidth: 0.5,
            borderColor: '#d1d5db',
          }}
          fixed
        >
          <View style={{ width: 25, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, color: '#ffffff', fontFamily: 'Helvetica-Bold', textAlign: 'center' }}>#</Text></View>
          <View style={{ width: 65, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, color: '#ffffff', fontFamily: 'Helvetica-Bold' }}>Code</Text></View>
          <View style={{ width: 130, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, color: '#ffffff', fontFamily: 'Helvetica-Bold' }}>Product</Text></View>
          <View style={{ width: 50, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, color: '#ffffff', fontFamily: 'Helvetica-Bold', textAlign: 'center' }}>Qty</Text></View>
          <View style={{ width: 65, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, color: '#ffffff', fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>Unit Price</Text></View>
          <View style={{ width: 60, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, color: '#ffffff', fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>Subtotal</Text></View>
          <View style={{ width: 95, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, color: '#ffffff', fontFamily: 'Helvetica-Bold' }}>Location</Text></View>
        </View>

        {/* Data Rows */}
        {items.map((item, idx) => (
          <View
            key={item.num}
            wrap={false}
            style={{
              flexDirection: 'row',
              backgroundColor: idx % 2 === 1 ? '#f9fafb' : '#ffffff',
              borderBottomWidth: 0.5,
              borderColor: '#d1d5db',
            }}
          >
            <View style={{ width: 25, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, textAlign: 'center' }}>{item.num}</Text></View>
            <View style={{ width: 65, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 7, lineHeight: 1.2 }}>{breakLongCode(item.code)}</Text></View>
            <View style={{ width: 130, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, lineHeight: 1.2 }}>{item.name}</Text></View>
            <View style={{ width: 50, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, textAlign: 'center' }}>{item.quantity}</Text></View>
            <View style={{ width: 65, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, textAlign: 'right' }}>{item.unitPrice.toFixed(2)}</Text></View>
            <View style={{ width: 60, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, textAlign: 'right' }}>{item.subtotal.toFixed(2)}</Text></View>
            <View style={{ width: 95, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8 }}>{item.location}</Text></View>
          </View>
        ))}

        {/* Total Row */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: '#f3f4f6',
            borderTopWidth: 1,
            borderColor: '#d1d5db',
          }}
        >
          <View style={{ width: 25, paddingVertical: 4, paddingHorizontal: 3 }} />
          <View style={{ width: 65, paddingVertical: 4, paddingHorizontal: 3 }} />
          <View style={{ width: 130, paddingVertical: 4, paddingHorizontal: 3 }} />
          <View style={{ width: 50, paddingVertical: 4, paddingHorizontal: 3 }} />
          <View style={{ width: 65, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>TOTAL:</Text></View>
          <View style={{ width: 60, paddingVertical: 4, paddingHorizontal: 3 }}><Text style={{ fontSize: 8, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>{total.toFixed(2)}</Text></View>
          <View style={{ width: 95, paddingVertical: 4, paddingHorizontal: 3 }} />
        </View>

        <View style={styles.notesSection}>
          <Text>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>Generated by: </Text>
            {generatedBy}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

// ─── API Route ──────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const deliverTo = url.searchParams.get('deliverTo') || 'warehouse' // 'warehouse' | 'client' | 'custom'
    const shouldArchive = url.searchParams.get('archive') !== '0'
    const customAddress = url.searchParams.get('customAddress') || ''

    const purchase = await db.purchases.findUnique({
      where: { id },
      include: {
        supplier: true,
        project: { include: { client: true } },
        items: {
          include: {
            product: true,
            shelf: {
              include: {
                rack: { include: { warehouse: true } },
              },
            },
          },
        },
      },
    })

    if (!purchase) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
    }

    // Resolve delivery address according to chosen destination
    let deliveryLabel: string | undefined
    let deliveryAddress: string | undefined
    if (deliverTo === 'client' && purchase.project?.client) {
      const c = purchase.project.client
      deliveryLabel = `Delivery address - Client (${c.name})`
      deliveryAddress = c.address || '(client address not registered)'
    } else if (deliverTo === 'warehouse') {
      // Prefer the warehouse actually used by this purchase (from item shelves);
      // fall back to the primary (oldest) warehouse if no shelf is assigned yet.
      const whFromItems = purchase.items.find((it) => it.shelf?.rack?.warehouse)?.shelf?.rack?.warehouse
      const wh = whFromItems ?? (await db.warehouse.findFirst({ orderBy: { createdAt: 'asc' } }))
      if (wh) {
        deliveryLabel = 'RMC Warehouse'
        deliveryAddress = wh.location || '(warehouse address not registered)'
      }
    } else if (deliverTo === 'custom' && customAddress.trim()) {
      deliveryLabel = 'Delivery address'
      deliveryAddress = customAddress.trim()
    }

    // Client PO: prefer the linked project's poNumber, fall back to the purchase's own.
    const clientPo = purchase.project?.poNumber || purchase.poNumber || ''

    const { pdf } = await import('@react-pdf/renderer')
    const documentType = purchase.status === 'pedido' ? 'Materials-Order' : 'Purchase-Order'
    const fileName = `RMC-${safeDocumentPart(clientPo, 'No-PO')}-${documentType}-${safeDocumentPart(purchase.purchaseCode, 'Purchase')}.pdf`

    let pdfBuffer: Buffer

    if (purchase.status === 'pedido') {
      const items = purchase.items.map((item, idx) => ({
        num: idx + 1,
        code: item.product.code,
        name: item.product.name,
        quantity: toNumber(item.quantity),
      }))

      pdfBuffer = await ensureBuffer(await pdf(
        <PedidoPDF
          purchaseCode={purchase.purchaseCode}
          date={purchase.purchaseDate}
          poNumber={clientPo || undefined}
          supplier={{
            name: purchase.supplier.name,
            contactName: purchase.supplier.contactName || undefined,
            email: purchase.supplier.email || undefined,
            phone: purchase.supplier.phone || undefined,
          }}
          items={items}
          generatedBy={generatedByText()}
          deliveryLabel={deliveryLabel}
          deliveryAddress={deliveryAddress}
        />
      ).toBuffer())
    } else {
      const items = purchase.items.map((item, idx) => ({
        num: idx + 1,
        code: item.product.code,
        name: item.product.name,
        quantity: toNumber(item.quantity),
        unitPrice: toNumber(item.unitPrice),
        subtotal: toNumber(item.quantity) * toNumber(item.unitPrice),
        location: item.shelf
          ? `${item.shelf.rack.warehouse.name} > ${item.shelf.rack.name} > ${item.shelf.name}`
          : 'Unassigned',
      }))

      const total = purchase.items.reduce(
        (sum, item) => sum + toNumber(item.quantity) * toNumber(item.unitPrice),
        0
      )

      pdfBuffer = await ensureBuffer(await pdf(
        <OrdenPDF
          code={purchase.purchaseCode}
          date={purchase.purchaseDate}
          poNumber={clientPo || undefined}
          status={purchase.status}
          supplier={{
            name: purchase.supplier.name,
            contactName: purchase.supplier.contactName || undefined,
            email: purchase.supplier.email || undefined,
            phone: purchase.supplier.phone || undefined,
          }}
          items={items}
          total={total}
          generatedBy={generatedByText()}
          deliveryLabel={deliveryLabel}
          deliveryAddress={deliveryAddress}
        />
      ).toBuffer())
    }

    if (shouldArchive) {
      const archived = await archivePurchasePdf(purchase.id, fileName, pdfBuffer)
      await archiveProjectOrderPdf(purchase.projectId, fileName, archived.fileUrl, archived.fileSize)
    }

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error('Error generating purchase PDF:', error)
    return NextResponse.json({ error: 'Error generating purchase PDF' }, { status: 500 })
  }
}
