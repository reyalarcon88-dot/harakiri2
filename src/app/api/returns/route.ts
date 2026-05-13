import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function toNumber(value: unknown) {
  const numberValue = Number(value ?? 0)
  return Number.isFinite(numberValue) ? numberValue : 0
}

export async function GET(request: NextRequest) {
  try {
    const returns = await db.returns.findMany({
      include: {
        project: {
          select: {
            id: true,
            name: true,
            poNumber: true,
          },
        },
        items: {
          include: {
            productDelivered: {
              select: {
                id: true,
                code: true,
                name: true,
                unitOfMeasure: true,
              },
            },
            productReturned: {
              select: {
                id: true,
                code: true,
                name: true,
                unitOfMeasure: true,
              },
            },
          },
        },
      },
      orderBy: {
        returnDate: 'desc',
      },
    })

    return NextResponse.json(returns.map((returnRecord) => ({
      ...returnRecord,
      items: returnRecord.items.map((item) => ({
        ...item,
        quantityDelivered: toNumber(item.quantityDelivered),
        quantityReturned: toNumber(item.quantityReturned),
        productReturned: item.productReturned ?? item.productDelivered,
      })),
    })))
  } catch (error) {
    console.error('Error fetching returns:', error)
    return NextResponse.json(
      { error: 'Failed to fetch returns' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, returnDate, items } = body

    if (!projectId || !returnDate || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const returnRecord = await db.returns.create({
      data: {
        projectId,
        returnDate,
        status: 'pending',
        notes: body.notes || '',
        items: {
          create: items.map((item: any) => ({
            productIdDelivered: item.productIdDelivered,
            productIdReturned: item.productIdReturned || null,
            quantityDelivered: toNumber(item.quantityDelivered),
            quantityReturned: toNumber(item.quantityReturned || item.quantityDelivered),
            specificationDelivered: item.specificationDelivered || '',
            specificationReturned: item.specificationReturned || '',
            changeType: item.changeType || 'full_return',
            notes: item.notes || '',
          })),
        },
      },
      include: {
        project: true,
        items: {
          include: {
            productDelivered: true,
            productReturned: true,
          },
        },
      },
    })

    return NextResponse.json(returnRecord, { status: 201 })
  } catch (error) {
    console.error('Error creating return:', error)
    return NextResponse.json(
      { error: 'Failed to create return' },
      { status: 500 }
    )
  }
}
