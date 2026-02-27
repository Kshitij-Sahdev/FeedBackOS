import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function streamChatResponse(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
) {
  return anthropic.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: systemPrompt,
    messages,
  })
}

export async function runBatchAnalysis(
  transcript: string,
  locationName: string,
  locationType: string,
  sessionDate: string
) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    system: 'You are a feedback analysis engine. Return ONLY valid JSON. No markdown, no explanation, no code blocks.',
    messages: [{
      role: 'user',
      content: `Analyze this feedback conversation.
Location: ${locationName}. Type: ${locationType}. Date: ${sessionDate}.

TRANSCRIPT:
${transcript}

Return this exact JSON:
{
  "categories": ["array from: wait_time, cleanliness, staff_behavior, pricing, safety, infrastructure, accessibility, positive_experience"],
  "primaryCategory": "string",
  "sentimentPolarity": -1.0,
  "severityScore": 5,
  "frequency": "one_off",
  "keywords": ["3-6 words"],
  "summary": "Exactly 2 sentences.",
  "actionable": false
}`
    }]
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  const clean = raw.replace(/```json|```/g, '').trim()

  try {
    return JSON.parse(clean)
  } catch {
    const match = clean.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    // Fallback if Claude returns garbage
    return {
      categories: ['general'],
      primaryCategory: 'general',
      sentimentPolarity: -0.3,
      severityScore: 5,
      frequency: 'one_off',
      keywords: [],
      summary: 'Feedback received but could not be fully analyzed.',
      actionable: false,
    }
  }
}
