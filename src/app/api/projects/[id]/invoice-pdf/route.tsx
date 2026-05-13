import { NextRequest, NextResponse } from 'next/server'
import { archiveProjectInvoicePdf, renderProjectInvoicePdf } from '@/lib/project-invoice'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { buffer, fileName } = await renderProjectInvoicePdf(id)
    await archiveProjectInvoicePdf(id, fileName, buffer)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error('Error al generar factura del proyecto:', error)
    return NextResponse.json({ error: 'Error al generar factura' }, { status: 500 })
  }
}
