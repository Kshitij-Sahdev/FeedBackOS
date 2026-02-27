import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({ locationId: z.string().uuid() })

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json())

    const location = await prisma.location.findUnique({
      where: { id: body.locationId },
      include: { org: true },
    })

    if (!location) return NextResponse.json({ error: 'Location not found' }, { status: 404 })

    const session = await prisma.session.create({
      data: { locationId: location.id, status: 'ACTIVE', consentGiven: false, source: 'CHAT' },
    })

    return NextResponse.json({
      sessionId: session.id,
      locationId: location.id,
      locationName: location.name,
      orgName: location.org.name,
      orgId: location.orgId,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
