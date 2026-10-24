// Small building blocks shared by the read-only report tabs (Economy, Game world, Comms).

export function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white border border-[#E0E0E0] shadow-sm rounded-xl p-4">
      <div className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">{label}</div>
      <div className="font-extrabold text-2xl text-[#1A1A2E]">{value ?? '—'}</div>
      {sub && <div className="text-gray-400 text-xs mt-0.5">{sub}</div>}
    </div>
  );
}

export function SectionHeading({ children, right }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2 border-t border-[#E8E8E8] pt-2">
      <h3 className="text-[#1A1A2E] font-bold text-base">{children}</h3>
      {right}
    </div>
  );
}

export function Table({ cols, rows, empty }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#E0E0E0] bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#E0E0E0] bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
            {cols.map(c => <th key={c} className="px-4 py-2.5">{c}</th>)}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
      {(!rows || rows.length === 0) && <p className="py-6 text-center text-sm text-gray-400">{empty}</p>}
    </div>
  );
}

/** A row of pill buttons: options are [value, label] pairs. */
export function Pills({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <button key={String(v)} type="button" onClick={() => onChange(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${value === v ? 'bg-[#E8453C] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{label}</button>
      ))}
    </div>
  );
}

export const n = v => Number(v ?? 0).toLocaleString();
