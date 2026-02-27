import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CATEGORIES = ['wait_time', 'cleanliness', 'staff_behavior', 'pricing', 'safety', 'infrastructure', 'accessibility', 'positive_experience']
const KEYWORDS = ['queue', 'elevator', 'security', 'broken', 'delayed', 'rude', 'helpful', 'confusing', 'crowded', 'smell', 'lighting', 'dirty', 'slow', 'unsafe']
const SUMMARIES = [
  "User reported long queues at the main entrance during peak hours. Issue appears to be recurring over the past two weeks.",
  "Cleanliness concerns raised about Level 2 restrooms. User noted this was not an isolated incident and has observed it multiple times.",
  "Positive feedback about staff helpfulness during a complex inquiry. Issue was resolved quickly and professionally.",
  "Pricing transparency issue at the ticket counter. User felt additional charges were unclear and not communicated upfront.",
  "Safety concern near the east exit due to poor lighting after 8pm. User described the area as feeling unsafe at night.",
  "Broken elevator on Level 2 affecting accessibility. User relies on it daily and reports it has been out of service for three days.",
  "Wait time at security checkpoint was rated as severe. User noted it has been consistently long for the past two weeks.",
  "Signage inside the facility was described as confusing and insufficient. User got lost trying to find the ticketing area.",
  "Staff member was rude and dismissive when the user asked for help. User felt unwelcome and would reconsider visiting.",
  "Overcrowding on Platform 3 during the evening rush. User expressed safety concerns about the density of the crowd.",
  "WiFi connectivity was poor throughout the facility. User was unable to complete a transaction requiring internet access.",
  "Seating area near Gate 2 was dirty and had insufficient seating. User had to stand for an extended period.",
  "A cleaner was observed doing a thorough job maintaining the main hall. User specifically praised the effort.",
  "Delayed announcement about platform changes caused confusion. User almost boarded the wrong service.",
  "Ticket machine was out of order forcing users to queue at the counter. Wait was over 20 minutes.",
]

async function main() {
  const shouldClean = process.argv.includes('--clean')

  if (shouldClean) {
    console.log('Cleaning existing data...')
    await prisma.insightRecord.deleteMany()
    await prisma.message.deleteMany()
    await prisma.session.deleteMany()
    await prisma.location.deleteMany()
    await prisma.organization.deleteMany()
    console.log('Cleaned.')
  }

  const org = await prisma.organization.create({
    data: { name: 'Metro Transit Authority', planTier: 'PRO' },
  })

  const locations = await Promise.all([
    prisma.location.create({ data: { orgId: org.id, name: 'Main Entrance Gate', locationType: 'transit' } }),
    prisma.location.create({ data: { orgId: org.id, name: 'Platform Level 2', locationType: 'transit' } }),
    prisma.location.create({ data: { orgId: org.id, name: 'Ticket Counter North', locationType: 'transit' } }),
  ])

  for (let i = 0; i < 80; i++) {
    const location = locations[Math.floor(Math.random() * locations.length)]
    // Create a spike in the last 3 days
    const isSpike = i < 15
    const daysAgo = isSpike ? Math.floor(Math.random() * 3) : Math.floor(Math.random() * 30) + 3
    const createdAt = new Date(Date.now() - daysAgo * 86400000)
    const category = isSpike ? 'wait_time' : CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]
    const isPositive = category === 'positive_experience'
    const severity = isSpike ? Math.floor(Math.random() * 3) + 6 : Math.floor(Math.random() * 7) + 2
    const numKeywords = Math.floor(Math.random() * 3) + 2
    const shuffled = [...KEYWORDS].sort(() => Math.random() - 0.5).slice(0, numKeywords)

    const session = await prisma.session.create({
      data: {
        locationId: location.id,
        source: 'CHAT',
        isSensitive: false,
        consentGiven: true,
        status: 'ANALYZED',
        startedAt: createdAt,
        endedAt: new Date(createdAt.getTime() + 180000),
      },
    })

    await prisma.insightRecord.create({
      data: {
        sessionId: session.id,
        locationId: location.id,
        orgId: org.id,
        categories: [category],
        primaryCategory: category,
        sentimentPolarity: isPositive ? Math.random() * 0.4 + 0.4 : -(Math.random() * 0.8 + 0.1),
        severityScore: severity,
        frequency: ['one_off', 'occasional', 'recurring', 'constant'][Math.floor(Math.random() * 4)],
        keywords: shuffled,
        summary: SUMMARIES[Math.floor(Math.random() * SUMMARIES.length)],
        actionable: severity >= 6,
        createdAt,
      },
    })
  }

  console.log('\n✅ Seed complete')
  console.log('Org ID:', org.id)
  console.log('Location IDs:')
  locations.forEach(l => console.log(` - ${l.name}: ${l.id}`))
  console.log('\nAdd to .env.local:')
  console.log(`NEXT_PUBLIC_DEMO_ORG_ID=${org.id}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
