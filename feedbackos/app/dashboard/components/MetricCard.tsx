export default function MetricCard({ title, value, subtitle }: { title: string; value: string | number; subtitle?: string }) {
  return <div className="bg-slate-800 rounded-xl p-4"><p className="text-slate-400 text-sm">{title}</p><p className="text-white text-3xl font-bold">{value}</p>{subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}</div>
}
