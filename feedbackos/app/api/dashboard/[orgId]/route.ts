import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: { orgId: string } }) {
  try {
    const { orgId } = params
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [insights, locations, total] = await Promise.all([
      prisma.insightRecord.findMany({
        where: { orgId, createdAt: { gte: since } },
        include: { location: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.location.findMany({ where: { orgId } }),
      prisma.insightRecord.count({ where: { orgId, createdAt: { gte: since } } }),
    ])

    const avgSeverity = insights.length
      ? insights.reduce((a, b) => a + b.severityScore, 0) / insights.length
      : 0
    const avgSentiment = insights.length
      ? insights.reduce((a, b) => a + b.sentimentPolarity, 0) / insights.length
      : 0

    // Category counts
    const catMap: Record<string, number> = {}
    insights.forEach(i => { catMap[i.primaryCategory] = (catMap[i.primaryCategory] || 0) + 1 })
    const categoryCounts = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count, percentage: Math.round((count / insights.length) * 100) }))

    // Severity distribution
    const severityDistribution = [
      { label: 'Critical (8-10)', count: insights.filter(i => i.severityScore >= 8).length },
      { label: 'High (6-7)', count: insights.filter(i => i.severityScore >= 6 && i.severityScore < 8).length },
      { label: 'Medium (4-5)', count: insights.filter(i => i.severityScore >= 4 && i.severityScore < 6).length },
      { label: 'Low (1-3)', count: insights.filter(i => i.severityScore < 4).length },
    ]

    // Trend data (last 30 days)
    const trendMap: Record<string, { count: number; totalSeverity: number }> = {}
    insights.forEach(i => {
      const date = i.createdAt.toISOString().split('T')[0]
      if (!trendMap[date]) trendMap[date] = { count: 0, totalSeverity: 0 }
      trendMap[date].count++
      trendMap[date].totalSeverity += i.severityScore
    })
    const trendData = Object.entries(trendMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, count: v.count, avgSeverity: Math.round(v.totalSeverity / v.count * 10) / 10 }))

    // Keywords
    const kwMap: Record<string, number> = {}
    insights.forEach(i => i.keywords.forEach(kw => { kwMap[kw] = (kwMap[kw] || 0) + 1 }))
    const topKeywords = Object.entries(kwMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([keyword, count]) => ({ keyword, count }))

    // Location breakdown
    const locationBreakdown = locations.map(loc => {
      const locInsights = insights.filter(i => i.locationId === loc.id)
      return {
        locationId: loc.id,
        name: loc.name,
        sessionCount: locInsights.length,
        avgSeverity: locInsights.length
          ? Math.round(locInsights.reduce((a, b) => a + b.severityScore, 0) / locInsights.length * 10) / 10
          : 0,
      }
    })

    return NextResponse.json({
      totalSessions: total,
      avgSeverity: Math.round(avgSeverity * 10) / 10,
      avgSentiment: Math.round(avgSentiment * 100) / 100,
      categoryCounts,
      severityDistribution,
      trendData,
      topKeywords,
      locationBreakdown,
      recentInsights: insights.slice(0, 8).map(i => ({
        id: i.id,
        summary: i.summary,
        primaryCategory: i.primaryCategory,
        severityScore: i.severityScore,
        sentimentPolarity: i.sentimentPolarity,
        createdAt: i.createdAt,
        locationName: i.location.name,
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
