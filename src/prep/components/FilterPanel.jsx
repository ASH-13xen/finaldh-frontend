// The bank's filters in plain words, each option with the number of questions it would leave.
import { useState } from 'react';
import Icon from '../../components/mcq/Icon';
import { useT, fmt } from '../lib/i18n';

const YEARS = [2025, 2024, 2023, 2022, 2021, 2020];
const OFTEN = ['hot', 'frequent', 'repeated', 'once'];
const QTYPES = ['personal', 'situational', 'opinion', 'factual'];
const ABOUT = ['intro', 'motivation', 'home', 'education', 'work', 'optional', 'hobby', 'eca', 'service', 'family', 'language', 'name'];

function Group({ title, children }) {
  return (
    <fieldset className="py-5 border-b border-border-subtle last:border-b-0">
      <legend className="prep-eyebrow text-text-tertiary mb-3">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Opt({ active, count, onClick, children }) {
  const empty = !active && count === 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={empty}
      aria-pressed={active}
      className={`prep-focus inline-flex items-center gap-2 min-h-9 px-3.5 py-1.5 rounded-full text-sm font-semibold border text-left transition-colors cursor-pointer disabled:cursor-default disabled:opacity-40 ${active ? 'bg-text-primary text-page border-text-primary' : 'bg-surface text-text-secondary border-border-default hover:border-text-primary hover:text-text-primary'}`}
    >
      <span>{children}</span>
      {count !== undefined && <span className={`prep-num text-xs ${active ? 'text-page/70' : 'text-text-tertiary'}`}>{fmt(count)}</span>}
    </button>
  );
}

export default function FilterPanel({ filters, setFilter, facets }) {
  const { t } = useT();
  const [boardQ, setBoardQ] = useState('');
  const fc = facets || {};
  const toggle = (k, v) => setFilter(k, filters[k] === v ? '' : v);
  const boards = Object.entries(fc.board || {}).sort((a, b) => b[1] - a[1]).filter(([b]) => !boardQ || b.toLowerCase().includes(boardQ.toLowerCase()));
  const topics = Object.entries(fc.topic || {}).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <Group title={t('bank.f.often')}>
        {OFTEN.map((o) => <Opt key={o} active={filters.often === o} count={fc.often?.[o] || 0} onClick={() => toggle('often', o)}>{t(`bank.often.${o}`)}</Opt>)}
      </Group>
      <Group title={t('bank.f.about')}>
        {ABOUT.filter((a) => fc.hookType?.[a] || filters.hookType === a).map((a) => <Opt key={a} active={filters.hookType === a} count={fc.hookType?.[a] || 0} onClick={() => toggle('hookType', a)}>{t(`area.${a}`)}</Opt>)}
      </Group>
      <Group title={t('bank.f.type')}>
        {QTYPES.map((q) => <Opt key={q} active={filters.qtype === q} count={fc.qtype?.[q] || 0} onClick={() => toggle('qtype', q)}>{t(`qtype.${q}`)}</Opt>)}
      </Group>
      <Group title={t('bank.f.topic')}>
        {topics.map(([k, n]) => <Opt key={k} active={filters.topic === k} count={n} onClick={() => toggle('topic', k)}>{t(`topic.${k}`)}</Opt>)}
      </Group>
      <Group title={t('bank.f.year')}>
        {YEARS.map((y) => <Opt key={y} active={String(filters.year) === String(y)} count={fc.year?.[y] || 0} onClick={() => toggle('year', String(y))}>{y}</Opt>)}
      </Group>
      <Group title={t('bank.f.asker')}>
        {['chairman', 'members'].map((a) => <Opt key={a} active={filters.asker === a} count={fc.asker?.[a] || 0} onClick={() => toggle('asker', a)}>{t(`bank.asker.${a}`)}</Opt>)}
      </Group>
      <Group title={t('bank.f.board')}>
        <div className="w-full relative mb-1">
          <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input value={boardQ} onChange={(e) => setBoardQ(e.target.value)} placeholder={t('bank.boardSearch')} aria-label={t('bank.boardSearch')}
            className="prep-focus w-full h-10 rounded-full border border-border-default bg-surface pl-9 pr-3 text-sm outline-none focus:border-text-primary" />
        </div>
        {boards.slice(0, 20).map(([b, n]) => <Opt key={b} active={filters.board === b} count={n} onClick={() => toggle('board', b)}>{b}</Opt>)}
      </Group>
      <div className="pt-5">
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <span className="text-sm font-semibold text-text-secondary">{t('bank.f.relevant')}</span>
          <input type="checkbox" className="sr-only peer" checked={filters.shelfLife === 'evergreen'} onChange={(e) => setFilter('shelfLife', e.target.checked ? 'evergreen' : '')} />
          <span className="relative w-12 h-7 rounded-full bg-border-default peer-checked:bg-brand transition-colors after:absolute after:top-1 after:left-1 after:w-5 after:h-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-brand" aria-hidden="true" />
        </label>
      </div>
    </div>
  );
}
