import { prisma } from '@/lib/prisma'
import { runBatchAnalysis } from '@/lib/anthropic'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json()

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' } }, location: { include: { org: true } }, insight: true },
    })

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    if (session.isSensitive) return NextResponse.json({ skipped: true, reason: 'sensitive' })
    if (session.insight) return NextResponse.json({ skipped: true, reason: 'already analyzed' })

    const transcript = session.messages
      .filter(m => m.role !== 'system')
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n')

    const analysis = await runBatchAnalysis(
      transcript,
      session.location.name,
      session.location.locationType,
      session.startedAt.toISOString().split('T')[0]
    )

    const insight = await prisma.insightRecord.create({
      data: {
        sessionId: session.id,
        locationId: session.locationId,
        orgId: session.location.orgId,
        categories: analysis.categories,
        primaryCategory: analysis.primaryCategory,
        sentimentPolarity: analysis.sentimentPolarity,
        severityScore: analysis.severityScore,
        frequency: analysis.frequency,
        keywords: analysis.keywords,
        summary: analysis.summary,
        actionable: analysis.actionable,
      },
    })

    await prisma.session.update({ where: { id: session.id }, data: { status: 'ANALYZED' } })

    return NextResponse.json({ success: true, insightId: insight.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
