'use client'

import { useState, useEffect, useRef } from 'react'
import { use } from 'react'

interface Message { id: string; role: 'user' | 'assistant'; content: string }

export default function ScanPage({ params }: { params: Promise<{ locationId: string }> }) {
  const { locationId } = use(params)
  const [sessionId, setSessionId] = useState('')
  const [locationName, setLocationName] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [agentState, setAgentState] = useState('GREETER')
  const [questionCount, setQuestionCount] = useState(0)
  const [isEnded, setIsEnded] = useState(false)
  const [isSensitive, setIsSensitive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setSessionId(data.sessionId)
        setLocationName(data.locationName)
        setIsLoading(false)
        // Kick off the greeting
        sendMessage('', data.sessionId, 'GREETER', [])
      })
      .catch(() => setError('Could not connect. Please scan the QR code again.'))
  }, [locationId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function sendMessage(
    userMessage: string,
    sid = sessionId,
    state = agentState,
    history: Message[] = messages
  ) {
    if (isStreaming) return

    const newMessages = userMessage
      ? [...history, { id: Date.now().toString(), role: 'user' as const, content: userMessage }]
      : history

    if (userMessage) setMessages(newMessages)
    setInput('')
    setIsStreaming(true)

    const assistantId = (Date.now() + 1).toString()
    setMessages(prev => [...(userMessage ? prev : history), { id: assistantId, role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sid,
          message: userMessage || '__init__',
          agentState: state,
          history: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value).split('\n\n').filter(Boolean)
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6))
          if (data.token) {
            setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: m.content + data.token } : m))
          }
          if (data.done) {
            setAgentState(data.nextState)
            setQuestionCount(q => q + 1)
            if (data.nextState === 'SENSITIVE_HANDLER') setIsSensitive(true)
            if (data.nextState === 'ENDED') {
              setIsEnded(true)
              fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: sid }) })
            }
          }
        }
      }
    } catch {
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: "I'm having a moment. Could you try again?" } : m))
    } finally {
      setIsStreaming(false)
    }
  }

  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-white/10 rounded-lg text-white">Try again</button>
      </div>
    </div>
  )

  if (isEnded && !isSensitive) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="text-center animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Thank you! 🙌</h2>
        <p className="text-gray-400">Your feedback reaches the {locationName} team directly.</p>
      </div>
    </div>
  )

  return (
    <div className={`min-h-screen flex flex-col ${isSensitive ? 'bg-indigo-950' : 'bg-gray-950'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-white font-semibold text-sm">{locationName || '...'}</span>
        {!isSensitive && (
          <span className="text-gray-400 text-xs">Question {Math.min(questionCount, 5)} of 5</span>
        )}
      </div>

      {/* Progress bar */}
      {!isSensitive && (
        <div className="h-1 bg-white/5">
          <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${(questionCount / 5) * 100}%` }} />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading && (
          <div className="flex gap-2 items-center">
            <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
            <div className="h-10 w-48 rounded-2xl bg-white/10 animate-pulse" />
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}>
            {m.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs flex-shrink-0">
                {isSensitive ? '❤️' : '🤖'}
              </div>
            )}
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
              m.role === 'user'
                ? 'bg-emerald-600 text-white rounded-br-sm'
                : 'bg-white/10 text-gray-100 rounded-bl-sm'
            }`}>
              {m.content || <span className="flex gap-1">{[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!isEnded && (
        <div className="px-4 py-3 border-t border-white/10">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !isStreaming && input.trim() && sendMessage(input)}
              placeholder="Type your response..."
              className="flex-1 bg-white/10 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-base outline-none focus:ring-1 focus:ring-emerald-500"
              style={{ fontSize: '16px' }}
              disabled={isStreaming}
            />
            <button
              onClick={() => input.trim() && sendMessage(input)}
              disabled={isStreaming || !input.trim()}
              className="w-12 h-12 bg-emerald-600 disabled:opacity-40 rounded-xl flex items-center justify-center"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className="text-center text-gray-600 text-xs mt-2">Powered by AI · Anonymous</p>
        </div>
      )}
    </div>
  )
}
