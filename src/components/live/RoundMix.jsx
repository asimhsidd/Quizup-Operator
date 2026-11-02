// An arena event's round mix: a weight (0–10) per round type. One type with weight makes a
// single-type event; several make a Mixed one whose rounds follow the weights, spread out
// (backend lib/liveMix.js, which this preview mirrors). A type that runs short of content
// hands its turns to Classic.
import { useEffect, useState } from 'react';
import { Btn } from '../../lib/adminUtils.jsx';

export const MIX_TYPES = [
  ['classic', 'Classic'],
  ['true_false', 'True or False'],
  ['odd_one_out', 'Odd One Out'],
  ['word_rush', 'Word Rush'],
  ['higher_lower', 'Higher or Lower'],
];
const label = m => MIX_TYPES.find(([v]) => v === m)?.[1] ?? m;

/** An event's weights: its own, or what its mode means (old events). */
export function weightsOfEvent(e) {
  if (e.mode_weights) return e.mode_weights;
  if (e.mode === 'mixed') return Object.fromEntries(MIX_TYPES.map(([m]) => [m, 1]));
  return { [e.mode ?? 'classic']: 1 };
}

/** Rounds per type for n rounds, as the backend plans them (largest remainder, ≥1 each). */
export function roundCounts(weights, n) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((a, [, w]) => a + w, 0);
  if (!total || n <= 0) return [];
  const xs = entries.map(([m, w]) => ({ m, exact: (n * w) / total, c: Math.floor((n * w) / total) }));
  for (const x of xs) if (x.c === 0 && xs.reduce((a, y) => a + y.c, 0) < n) x.c = 1;
  let left = n - xs.reduce((a, x) => a + x.c, 0);
  for (const x of [...xs].sort((a, b) => (b.exact - b.c) - (a.exact - a.c))) { if (left <= 0) break; x.c++; left--; }
  while (left < 0) { const big = xs.reduce((a, b) => (b.c > a.c ? b : a)); big.c--; left++; }
  return xs.filter(x => x.c > 0).map(x => [x.m, x.c]);
}

export const mixSummary = (weights, n) =>
  roundCounts(weights, n).map(([m, c]) => `${c} ${label(m)}`).join(' · ') || 'No rounds';

/** The weight inputs and a preview of the rounds they give. */
export function RoundMix({ weights, onChange, rounds, compact = false }) {
  const set = (m, v) => onChange({ ...weights, [m]: Math.max(0, Math.min(10, Math.round(Number(v) || 0))) });
  if (compact) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex flex-col gap-0.5">
          {MIX_TYPES.map(([m, l]) => (
            <label key={m} className="flex items-center justify-between gap-2 text-[11px] font-semibold text-gray-600 max-w-[190px]">
              {l}
              <input type="number" min="0" max="10" value={weights[m] ?? 0} aria-label={`${l} weight`}
                     onChange={e => set(m, e.target.value)}
                     className="border border-gray-300 rounded px-1 py-0.5 w-12 text-xs text-gray-900 tabular-nums" />
            </label>
          ))}
        </div>
        <p className="text-[11px] text-gray-500">{mixSummary(weights, rounds)}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {MIX_TYPES.map(([m, l]) => (
          <label key={m} className="flex flex-col gap-0.5 text-xs font-semibold text-gray-600">
            {l}
            <input type="number" min="0" max="10" value={weights[m] ?? 0} aria-label={`${l} weight`}
                   onChange={e => set(m, e.target.value)}
                   className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 tabular-nums" />
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        {rounds} rounds: {mixSummary(weights, rounds)}. Weight 0 leaves a type out; a type short of content hands its turns to Classic.
      </p>
    </div>
  );
}

/** A scheduled event's mix, edited in place and saved on demand. */
export function EventMix({ event, rounds, disabled, onSave }) {
  const [w, setW] = useState(() => weightsOfEvent(event));
  useEffect(() => { setW(weightsOfEvent(event)); }, [event.id, event.mode, JSON.stringify(event.mode_weights)]);
  const changed = JSON.stringify(Object.entries(w).filter(([, v]) => v > 0).sort())
    !== JSON.stringify(Object.entries(weightsOfEvent(event)).filter(([, v]) => v > 0).sort());
  const none = !Object.values(w).some(v => v > 0);
  return (
    <div className="flex flex-col gap-1 mt-1">
      <RoundMix weights={w} onChange={setW} rounds={rounds} compact />
      {changed && (
        <div className="flex gap-2">
          <Btn variant="primary" disabled={disabled || none} onClick={() => onSave(w)}>Save mix</Btn>
          <Btn onClick={() => setW(weightsOfEvent(event))}>Undo</Btn>
        </div>
      )}
    </div>
  );
}
