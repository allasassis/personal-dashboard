import { useMemo, useState } from 'react';
import { newId } from '../../../core/collection';
import { LineChart } from '../../../core/LineChart';
import { useRecords } from '../../../core/store';
import { addDays, fullDate, parseDay, toDay } from '../../../core/dates';
import { Button, ConfirmButton, ConfirmIconButton, Empty, Field, fmtNum, Icon, NumberInput, PageHead, Segmented, Sheet } from '../../../core/ui';
import { BUILTIN_METRICS, logMetric, metricDefs, metricEntries, type MetricDef } from '../data';

const ENTRIES_SHOWN = 10;

type Range = '30' | '90' | '365' | 'all';
const RANGES: { value: Range; label: string }[] = [
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
  { value: '365', label: '1y' },
  { value: 'all', label: 'All' },
];

export function useMetrics() {
  const custom = useRecords(metricDefs);
  return useMemo(() => [...BUILTIN_METRICS, ...custom], [custom]);
}

export function QuickLog({ metric, compact }: { metric: Pick<MetricDef, 'id' | 'name' | 'unit'>; compact?: boolean }) {
  const entries = useRecords(metricEntries);
  const [date, setDate] = useState(toDay());
  const existing = entries.find((e) => e.id === `${metric.id}:${date}`);
  // Follows the stored value (which sync can update at any time) until you type.
  const [draft, setDraft] = useState<number | null | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const value = draft !== undefined ? draft : (existing?.value ?? null);
  const changed = value !== null && value !== existing?.value;

  return (
    <form
      className="quick-log"
      onSubmit={(e) => {
        e.preventDefault();
        if (value === null || !changed) return;
        logMetric(metric.id, date, value);
        setDraft(undefined);
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      }}
    >
      <label className="field">
        <span className="field-label">{metric.name} ({metric.unit})</span>
        <NumberInput value={value} onChange={(n) => { setDraft(n); setSaved(false); }} placeholder="0" className="input-large" />
      </label>
      {!compact && (
        <Field label="Date">
          <input className="input" type="date" value={date} max={toDay()} onChange={(e) => { if (e.target.value) { setDate(e.target.value); setDraft(undefined); } }} />
        </Field>
      )}
      <Button variant="primary" type="submit" disabled={!changed}>
        {saved ? 'Saved' : existing ? 'Update' : 'Log'}
      </Button>
    </form>
  );
}

function NewMetric({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('cm');
  return (
    <Sheet
      title="New metric"
      onClose={onClose}
      footer={<Button variant="primary" disabled={!name.trim() || !unit.trim()} onClick={() => { const id = newId(); metricDefs.put({ id, name: name.trim(), unit: unit.trim() }); onSaved(id); }}>Create</Button>}
    >
      <div className="grid-2">
        <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Resting heart rate" autoFocus /></Field>
        <Field label="Unit"><input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="bpm" /></Field>
      </div>
    </Sheet>
  );
}

export function MetricsPage() {
  const metrics = useMetrics();
  const entries = useRecords(metricEntries);
  const [metricId, setMetricId] = useState('weight');
  const [range, setRange] = useState<Range>('90');
  const [adding, setAdding] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const metric = metrics.find((m) => m.id === metricId) ?? metrics[0];

  const all = useMemo(() => entries.filter((e) => e.metricId === metric.id).sort((a, b) => (a.date < b.date ? -1 : 1)), [entries, metric.id]);
  const visible = useMemo(() => {
    if (range === 'all') return all;
    const from = addDays(toDay(), -Number(range));
    return all.filter((e) => e.date >= from);
  }, [all, range]);

  const latest = all[all.length - 1];
  const first = visible[0];
  const change = latest && first && visible.length > 1 ? latest.value - first.value : null;
  const values = visible.map((e) => e.value);

  return (
    <>
      <PageHead title="Metrics" actions={<Button onClick={() => setAdding(true)}><Icon name="plus" size={16} /> New metric</Button>} />
      <div className="chips" role="group" aria-label="Metric">
        {metrics.map((m) => (
          <button type="button" key={m.id} className="chip" aria-pressed={m.id === metric.id} onClick={() => setMetricId(m.id)}>
            {m.name}
          </button>
        ))}
      </div>

      <section className="card"><QuickLog key={metric.id} metric={metric} /></section>

      <section className="card stack">
        <div className="row between wrap">
          <h2>{metric.name}</h2>
          <Segmented label="Time range" value={range} onChange={setRange} options={RANGES} />
        </div>
        {visible.length ? (
          <>
            <div className="stats">
              <div className="stat"><span>Latest</span><strong className="num">{fmtNum(latest.value)} {metric.unit}</strong></div>
              {change !== null && <div className="stat"><span>Change</span><strong className="num">{change > 0 ? '+' : change < 0 ? '−' : ''}{fmtNum(Math.abs(change))} {metric.unit}</strong></div>}
              {visible.length > 1 && <div className="stat"><span>Range</span><strong className="num">{fmtNum(Math.min(...values))}–{fmtNum(Math.max(...values))}</strong></div>}
            </div>
            <LineChart name={metric.name} unit={metric.unit} points={visible.map((e) => ({ x: parseDay(e.date).getTime(), y: e.value }))} />
          </>
        ) : (
          <Empty title={all.length ? 'Nothing in this time range' : `No ${metric.name.toLowerCase()} logged yet`} />
        )}
      </section>

      {all.length > 0 && (
        <section className="card stack">
          <h2>Entries</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>{metric.unit}</th><th><span className="sr">Actions</span></th></tr></thead>
              <tbody>
                {[...all].reverse().slice(0, showAll ? undefined : ENTRIES_SHOWN).map((e) => (
                  <tr key={e.id}>
                    <td>{fullDate(parseDay(e.date))}</td>
                    <td className="num">{e.value}</td>
                    <td className="right"><ConfirmIconButton label={`Delete entry from ${e.date}`} onConfirm={() => metricEntries.remove(e.id)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!showAll && all.length > ENTRIES_SHOWN && <div><Button onClick={() => setShowAll(true)}>Show all {all.length}</Button></div>}
        </section>
      )}

      {metricDefs.get(metric.id) && (
        <div>
          <ConfirmButton onConfirm={() => { metricDefs.remove(metric.id); setMetricId('weight'); }}>Delete this metric</ConfirmButton>
        </div>
      )}
      {adding && <NewMetric onClose={() => setAdding(false)} onSaved={(id) => { setMetricId(id); setAdding(false); }} />}
    </>
  );
}
