import { db } from '@/lib/db'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import nodemailer from 'nodemailer'

type AutomationResult = {
  pdfSaved: boolean
  emailSent: boolean
  documentId?: string
  projectDocumentId?: string
  skippedEmailReason?: string
  error?: string
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim()
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  const from = process.env.PURCHASE_EMAIL_FROM?.trim() || user

  if (!host || !user || !pass || !from) return null

  return {
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    from,
  }
}

async function generateWarehousePdf(origin: string, purchaseId: string) {
  const response = await fetch(`${origin}/api/purchases/${purchaseId}/pdf?deliverTo=warehouse`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`PDF generation failed with status ${response.status}`)
  }

  return Buffer.from(await response.arrayBuffer())
}

function safeDocumentPart(value: string | null | undefined, fallback: string) {
  const normalized = String(value || fallback)
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return normalized || fallback
}

function buildPurchasePdfFileName(purchaseCode: string, poNumber?: string | null) {
  return `RMC-${safeDocumentPart(poNumber, 'No-PO')}-Materials-Order-${safeDocumentPart(purchaseCode, 'Purchase')}.pdf`
}

async function savePdfDocument(purchaseId: string, purchaseCode: string, poNumber: string | null | undefined, pdfBuffer: Buffer) {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'purchases', 'order-pdfs')
  await mkdir(uploadDir, { recursive: true })

  const fileName = buildPurchasePdfFileName(purchaseCode, poNumber)
  const filePath = path.join(uploadDir, fileName)
  const fileUrl = `/uploads/purchases/order-pdfs/${fileName}`

  await writeFile(filePath, pdfBuffer)

  const existing = await db.purchaseDocuments.findFirst({
    where: {
      purchaseId,
      fileName,
      fileUrl,
    },
  })

  if (existing) {
    return db.purchaseDocuments.update({
      where: { id: existing.id },
      data: {
        fileSize: pdfBuffer.length,
        fileType: 'application/pdf',
      },
    })
  }

  return db.purchaseDocuments.create({
    data: {
      purchaseId,
      fileName,
      fileUrl,
      fileSize: pdfBuffer.length,
      fileType: 'application/pdf',
    },
  })
}

async function saveProjectPdfDocument(
  projectId: string | null,
  purchaseCode: string,
  poNumber: string | null | undefined,
  fileUrl: string,
  fileSize: number,
) {
  if (!projectId) return null

  const fileName = buildPurchasePdfFileName(purchaseCode, poNumber)

  const existing = await db.projectDocuments.findFirst({
    where: {
      projectId,
      fileName,
      fileUrl,
    },
  })

  if (existing) {
    return db.projectDocuments.update({
      where: { id: existing.id },
      data: {
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

async function sendPurchaseEmail(
  purchase: {
    purchaseCode: string
    poNumber?: string | null
    supplier: { name: string; email: string }
    project?: { name: string } | null
  },
  pdfBuffer: Buffer,
) {
  const smtp = getSmtpConfig()
  if (!smtp) return { sent: false, reason: 'SMTP not configured' }

  const supplierEmail = purchase.supplier.email?.trim()
  if (!supplierEmail) return { sent: false, reason: 'Supplier email not configured' }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.auth,
  })

  await transporter.sendMail({
    from: smtp.from,
    to: supplierEmail,
    subject: `Purchase Order ${purchase.purchaseCode}`,
    text: [
      `Hello ${purchase.supplier.name},`,
      '',
      `Attached is purchase order ${purchase.purchaseCode}.`,
      'Please deliver this order to RMC Warehouse.',
      purchase.project?.name ? `Project: ${purchase.project.name}` : '',
      '',
      'Thank you.',
    ].filter(Boolean).join('\n'),
    attachments: [
      {
        filename: buildPurchasePdfFileName(purchase.purchaseCode, purchase.poNumber),
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  })

  return { sent: true }
}

export async function runPurchaseOrderAutomation(
  purchaseId: string,
  origin: string,
): Promise<AutomationResult> {
  const purchase = await db.purchases.findUnique({
    where: { id: purchaseId },
    include: {
      supplier: { select: { name: true, email: true } },
      project: { select: { name: true, poNumber: true } },
    },
  })

  if (!purchase || purchase.status !== 'pedido') {
    return { pdfSaved: false, emailSent: false, skippedEmailReason: 'Purchase is not ordered' }
  }

  let pdfBuffer: Buffer
  let document: { id: string; fileUrl: string; fileSize: number }
  let projectDocument: { id: string } | null = null

  try {
    pdfBuffer = await generateWarehousePdf(origin, purchaseId)
    const documentPo = purchase.project?.poNumber || purchase.poNumber
    document = await savePdfDocument(purchaseId, purchase.purchaseCode, documentPo, pdfBuffer)
    projectDocument = await saveProjectPdfDocument(
      purchase.projectId,
      purchase.purchaseCode,
      documentPo,
      document.fileUrl,
      document.fileSize,
    )
  } catch (error) {
    console.error('Purchase order PDF automation failed:', error)
    return {
      pdfSaved: false,
      emailSent: false,
      error: error instanceof Error ? error.message : 'PDF automation failed',
    }
  }

  let email: { sent: boolean; reason?: string }
  try {
    email = await sendPurchaseEmail(purchase, pdfBuffer)
  } catch (error) {
    console.error('Purchase order email automation failed:', error)
    email = {
      sent: false,
      reason: error instanceof Error ? error.message : 'Email automation failed',
    }
  }

  return {
    pdfSaved: true,
    emailSent: email.sent,
    documentId: document.id,
    projectDocumentId: projectDocument?.id,
    skippedEmailReason: email.reason,
  }
}
