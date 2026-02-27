const SENSITIVE_KEYWORDS: Record<string, string[]> = {
  crisis: ['suicide', 'kill myself', 'end my life', 'want to die', 'self harm', 'self-harm', 'dont want to live', "don't want to live"],
  harassment: ['harassed', 'touched me', 'groped', 'followed me', 'stalked', 'threatened me', 'assaulted', 'molested'],
  violence: ['stabbed', 'gun', 'weapon', 'attacked me', 'hurt me'],
  abuse: ['abused', 'beaten', 'hit me', 'forced me', 'domestic violence'],
}

export async function classifyMessage(text: string): Promise<{
  isSensitive: boolean
  category: string
  confidence: number
}> {
  const lower = text.toLowerCase()

  for (const [category, keywords] of Object.entries(SENSITIVE_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return { isSensitive: true, category, confidence: 0.95 }
    }
  }

  return { isSensitive: false, category: 'none', confidence: 0.9 }
}
