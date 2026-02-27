'use client'
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-center p-6">
      <div>
        <h2 className="text-white text-xl font-bold mb-2">Something went wrong</h2>
        <button onClick={reset} className="px-4 py-2 bg-emerald-600 text-white rounded-lg">Try again</button>
      </div>
    </div>
  )
}
