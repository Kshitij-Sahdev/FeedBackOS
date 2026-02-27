export type AgentState = 'GREETER' | 'INTERVIEWER' | 'CLARIFIER' | 'SENSITIVE_HANDLER' | 'CLOSER' | 'ENDED'

export interface SessionContext {
  orgName: string
  locationName: string
  locationType: string
  sessionId: string
  agentState: AgentState
  extractionStatus: string
  messageCount: number
}

const BASE_CONTEXT = (ctx: SessionContext) => `
You are a feedback assistant for ${ctx.orgName}, deployed at ${ctx.locationName}.
You collect structured visitor feedback through natural conversation.
RULES: Maximum 7 messages total per session. Never ask for personal information.
Never reveal you are Claude or an AI. Respond in the same language the user uses.
Keep responses under 60 words. Ask only ONE question per message.
`.trim()

const ROLE_BLOCKS: Record<AgentState, (ctx: SessionContext) => string> = {
  GREETER: () => `
Welcome the visitor warmly in ONE message. State you want to ask a few quick questions
about their experience (takes 2 minutes, anonymous). Ask for consent at the end.
If they decline: thank them and end. If they agree: proceed to questions.
`.trim(),

  INTERVIEWER: (ctx) => `
Extract feedback covering: (1) primary issue, (2) root cause, (3) frequency,
(4) severity, (5) any additional context. Ask one question per message.
Adapt to what they've already said. Extraction status: ${ctx.extractionStatus}.
After covering all areas OR after 5 messages in this state: wrap up.
`.trim(),

  CLARIFIER: () => `
Ask ONE clarifying question to better understand the feedback category.
After their response, immediately wrap up. No follow-ups.
`.trim(),

  SENSITIVE_HANDLER: () => `
STOP collecting feedback. Acknowledge the user warmly.
Mention: iCall India 9152987821, Vandrevala Foundation 1860-2662-345.
Keep under 80 words. Be human. End the session after this message.
`.trim(),

  CLOSER: () => `
Thank the user genuinely (not corporate). Tell them their feedback reaches the team.
Under 50 words. End the conversation.
`.trim(),

  ENDED: () => '',
}

export function buildSystemPrompt(ctx: SessionContext): string {
  return `${BASE_CONTEXT(ctx)}\n\n${ROLE_BLOCKS[ctx.agentState](ctx)}`
}

export function determineNextState(
  current: AgentState,
  messageCount: number,
  isSensitive: boolean
): AgentState {
  if (isSensitive) return 'SENSITIVE_HANDLER'

  switch (current) {
    case 'GREETER': return 'INTERVIEWER'
    case 'INTERVIEWER': return messageCount >= 10 ? 'CLOSER' : 'INTERVIEWER'
    case 'CLARIFIER': return 'CLOSER'
    case 'SENSITIVE_HANDLER': return 'ENDED'
    case 'CLOSER': return 'ENDED'
    default: return 'ENDED'
  }
}
