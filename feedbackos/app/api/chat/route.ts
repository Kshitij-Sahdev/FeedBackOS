import { prisma } from '@/lib/prisma'
import { buildSystemPrompt, determineNextState, AgentState } from '@/lib/agents'
import { classifyMessage } from '@/lib/classifier'
import { streamChatResponse } from '@/lib/anthropic'
import { NextRequest } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const schema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1),
  agentState: z.string(),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })),
})

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json())

    const session = await prisma.session.findUnique({
      where: { id: body.sessionId },
      include: { location: { include: { org: true } } },
    })

    if (!session) return new Response('Session not found', { status: 404 })

    // Save user message
    await prisma.message.create({
      data: { sessionId: session.id, role: 'user', content: body.message, agentState: body.agentState },
    })

    // Classify for sensitive content
    const classification = await classifyMessage(body.message)
    let currentState = body.agentState as AgentState

    if (classification.isSensitive) {
      await prisma.session.update({ where: { id: session.id }, data: { isSensitive: true } })
      currentState = 'SENSITIVE_HANDLER'
    }

    const msgCount = await prisma.message.count({ where: { sessionId: session.id } })
    const nextState = determineNextState(currentState, msgCount, classification.isSensitive)

    const systemPrompt = buildSystemPrompt({
      orgName: session.location.org.name,
      locationName: session.location.name,
      locationType: session.location.locationType,
      sessionId: session.id,
      agentState: currentState,
      extractionStatus: `${msgCount} messages so far`,
      messageCount: msgCount,
    })

    const stream = await streamChatResponse(systemPrompt, body.history)

    let fullResponse = ''

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              const token = chunk.delta.text
              fullResponse += token
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ token, done: false })}\n\n`))
            }
          }

          // Save assistant message
          await prisma.message.create({
            data: { sessionId: session.id, role: 'assistant', content: fullResponse, agentState: currentState },
          })

          if (nextState === 'ENDED') {
            await prisma.session.update({ where: { id: session.id }, data: { status: 'COMPLETED', endedAt: new Date() } })
          }

          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ token: '', done: true, nextState })}\n\n`))
          controller.close()
        } catch (e) {
          controller.error(e)
        }
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
}
