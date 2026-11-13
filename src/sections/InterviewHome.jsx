import { useEffect, useState } from 'react';
import Icon from '../components/mcq/Icon';
import { ActionButton } from '../components/mcq/ui';
import { Shell, PageHeader, Panel, StatTile, AiBadge, SeatAvatar, TimesAsked, SourcesCredit, Skeleton, YearBars } from '../components/interview/ui';
import FamilyDrawer from '../components/interview/FamilyDrawer';
import { iv, formatDate, yearsRange } from '../lib/interviewApi';
import { isPhone } from '../lib/interviewPresence';

const fmt = (n) => (n ?? 0).toLocaleString('en-IN');

function StepCard({ n, icon, title, text, status, action, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group text-left rounded-3xl border border-border-default bg-surface p-5 flex flex-col gap-4 hover:border-brand hover:-translate-y-0.5 hover:shadow-lg transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:hover:border-border-default focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <div className="w-full flex items-center justify-between">
        <span className="w-11 h-11 rounded-2xl bg-accent-soft-bg border border-accent-soft-border text-brand flex items-center justify-center">
          <Icon name={icon} className="w-5 h-5" />
        </span>
        <span className="text-xs font-bold text-text-tertiary">Step {n}</span>
      </div>
      <div>
        <h3 className="text-lg font-bold text-text-primary group-hover:text-brand transition-colors">{title}</h3>
        <p className="text-sm text-text-tertiary mt-1 leading-relaxed">{text}</p>
      </div>
      <div className="w-full mt-auto flex items-center justify-between gap-2">
        {status}
        <span className="inline-flex items-center gap-1 text-sm font-bold text-brand group-hover:gap-2 transition-all">{action} <Icon name="arrowRight" className="w-4 h-4" /></span>
      </div>
    </button>
  );
}

export default function InterviewHome({ status, user, go }) {
  const [profile, setProfile] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [trends, setTrends] = useState(null);
  const [familyId, setFamilyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([iv('/profile'), iv('/sessions'), iv('/bank/trends')]).then(([p, s, t]) => {
      if (cancelled) return;
      setProfile(p.status === 'fulfilled' ? p.value : { empty: true, items: [] });
      setSessions(s.status === 'fulfilled' ? s.value.sessions : []);
      if (t.status === 'fulfilled') setTrends(t.value);
    });
    return () => { cancelled = true; };
  }, []);

  const c = status.corpus;
  const hasDaf = profile && !profile.empty;
  const dafItems = (profile?.items || []).filter((i) => !['intro', 'motivation'].includes(i.type));
  const inProgress = sessions?.find((s) => s.status === 'in-progress');
  const phone = isPhone();

  return (
    <Shell wide>
      <PageHeader
        eyebrow="UPSC Personality Test"
        title="Mock Interview"
        subtitle={`Face a five-member board that asks what real boards asked. Built from ${fmt(c.transcripts)} interview transcripts, CSE ${yearsRange(c.years)}.`}
        actions={
          <>
            <AiBadge ai={status.ai} />
            {user?.isAdmin && <ActionButton icon="edit" size="sm" onClick={() => { window.location.hash = 'admin_interview_data'; }} hint="Review the transcript library">Interview data</ActionButton>}
            <ActionButton icon="history" size="sm" onClick={() => go({ screen: 'history' })}>My interviews</ActionButton>
          </>
        }
      />

      {/* Corpus at a glance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatTile icon="book" label="Transcripts" value={fmt(c.transcripts)} hint={`CSE ${yearsRange(c.years)}`} />
        <StatTile icon="message" label="Questions" value={fmt(c.questions)} hint="with who asked them" />
        <StatTile icon="repeat" label="Asked again" value={fmt(c.repeatedFamilies)} hint="asked in 2+ interviews" />
        <StatTile icon="users" label="Boards" value={fmt(c.boards)} hint="chairpersons covered" />
      </div>

      {/* Start / resume */}
      <Panel className="overflow-hidden mb-8">
        <div className="grid lg:grid-cols-[1.2fr_1fr]">
          <div className="p-6 md:p-8 flex flex-col justify-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand mb-2">The interview room</p>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-text-primary leading-tight">Answer out loud, like the real thing.</h2>
            <p className="text-text-secondary mt-3 leading-relaxed">
              The Chairperson opens, then each member takes a part of your DAF — home state, education and work, hobbies, current affairs. Speak your answers or type them; every question shows where it came from.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              {phone ? (
                <p className="w-full rounded-2xl border border-border-default bg-sunken/60 px-4 py-3 text-sm text-text-secondary flex items-start gap-2">
                  <Icon name="video" className="w-4 h-4 mt-0.5 shrink-0" /> Mock interviews open on a laptop or tablet with a camera. Prepare your DAF and predicted questions here.
                </p>
              ) : inProgress ? (
                <ActionButton tone="primary" size="lg" icon="play" onClick={() => go({ screen: 'room', sessionId: inProgress.id })}>Resume interview</ActionButton>
              ) : (
                <ActionButton tone="primary" size="lg" icon="mic" onClick={() => go({ screen: 'setup' })}>Start a mock interview</ActionButton>
              )}
              {!hasDaf && profile && <ActionButton size="lg" icon="edit" onClick={() => go({ screen: 'profile' })}>Add your DAF first</ActionButton>}
            </div>
            {!hasDaf && profile && <p className="text-xs text-text-tertiary mt-3">Without a DAF the board asks general questions. With one, it asks about you.</p>}
          </div>
          <div className="iv-stage relative min-h-60 flex flex-col items-center justify-center gap-6 p-6">
            <div className="flex items-end gap-3 sm:gap-5">
              {['m1', 'm2', 'chairman', 'm3', 'm4'].map((a) => (
                <div key={a} className={a === 'chairman' ? '-translate-y-3' : ''}>
                  <SeatAvatar asker={a} size={a === 'chairman' ? 'md' : 'sm'} speaking={a === 'chairman'} />
                </div>
              ))}
            </div>
            <div className="max-w-sm rounded-2xl bg-white/8 border border-white/10 px-4 py-3 text-center">
              <p className="text-white/90 font-display text-lg leading-snug">“So, what have you been doing since graduation?”</p>
              <p className="text-white/50 text-xs mt-1.5">Asked in {fmt(trends?.mostAsked?.find((f) => /graduation/i.test(f.text))?.timesAsked || 27)} past interviews</p>
            </div>
          </div>
        </div>
      </Panel>

      {/* The path */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        <StepCard
          n={1}
          icon="edit"
          title="Your DAF"
          text="Home state, education, work, optional, hobbies, achievements — what the board reads before you walk in."
          status={profile ? (hasDaf ? <span className="text-xs font-semibold text-status-success-text inline-flex items-center gap-1"><Icon name="check" className="w-3.5 h-3.5" />{dafItems.length} items added</span> : <span className="text-xs font-semibold text-text-tertiary">Not added yet</span>) : <Skeleton className="h-4 w-24" />}
          action={hasDaf ? 'Edit' : 'Add'}
          onClick={() => go({ screen: 'profile' })}
        />
        <StepCard
          n={2}
          icon="sparkles"
          title="Predicted questions"
          text="For every DAF item: what boards asked candidates with the same item, with how often and when."
          status={<span className="text-xs font-semibold text-text-tertiary">{hasDaf ? 'Ready' : 'Needs your DAF'}</span>}
          action="Open"
          onClick={() => go({ screen: hasDaf ? 'predictions' : 'profile' })}
        />
        <StepCard
          n={3}
          icon="search"
          title="Question bank"
          text="Search every question by topic, board, year and DAF area. Read the full interviews they came from."
          status={<span className="text-xs font-semibold text-text-tertiary">{fmt(c.families)} questions</span>}
          action="Search"
          onClick={() => go({ screen: 'bank' })}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Panel className="p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-text-primary">Most asked questions</h2>
            <button onClick={() => go({ screen: 'bank' })} className="text-sm font-bold text-brand hover:underline cursor-pointer">See all</button>
          </div>
          {!trends ? (
            <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <ol className="divide-y divide-border-subtle">
              {trends.mostAsked.slice(0, 7).map((f, i) => (
                <li key={f.id}>
                  <button onClick={() => setFamilyId(f.id)} className="w-full text-left flex items-center gap-3 py-3 group cursor-pointer">
                    <span className="w-6 text-sm font-bold text-text-tertiary tabular-nums">{i + 1}</span>
                    <span className="flex-1 text-sm text-text-primary group-hover:text-brand leading-snug">{f.text}</span>
                    <YearBars yearCounts={f.yearCounts} allYears={c.years} />
                    <TimesAsked n={f.timesAsked} />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel className="p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-text-primary">Your recent interviews</h2>
            {sessions?.length > 0 && <button onClick={() => go({ screen: 'history' })} className="text-sm font-bold text-brand hover:underline cursor-pointer">All</button>}
          </div>
          {!sessions ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-default p-8 text-center">
              <Icon name="mic" className="w-7 h-7 mx-auto text-text-tertiary" />
              <p className="text-sm font-semibold text-text-primary mt-3">No interviews yet</p>
              <p className="text-sm text-text-tertiary mt-1">A Quick drill in practice mode is a good first step.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {sessions.slice(0, 4).map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => go(s.status === 'in-progress' ? { screen: 'room', sessionId: s.id } : { screen: 'report', sessionId: s.id })}
                    className="w-full text-left flex items-center gap-4 rounded-2xl border border-border-subtle bg-surface hover:border-brand px-4 py-3 cursor-pointer"
                  >
                    <span className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm ${s.marks != null || s.overall != null ? 'bg-accent-soft-bg text-brand' : 'bg-sunken text-text-tertiary'}`} title={s.marks != null ? `${s.marks} of ${s.marksOutOf} marks` : undefined}>
                      {s.marks != null ? s.marks : s.overall != null ? s.overall.toFixed(1) : <Icon name={s.inputMode === 'voice' ? 'mic' : 'keyboard'} className="w-5 h-5" />}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-bold text-text-primary">{s.formatLabel || `${s.durationMinutes} min`} · {s.mode === 'real' ? 'Real interview' : 'Practice'} · {s.inputMode === 'voice' ? 'Voice' : 'Text'}</span>
                      <span className="block text-xs text-text-tertiary mt-0.5">{formatDate(s.startedAt)} · {s.status === 'in-progress' ? 'In progress — tap to resume' : `${s.answered ?? 0} of ${s.questions} answered`}</span>
                    </span>
                    <Icon name="chevronRight" className="w-4 h-4 text-text-tertiary" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <SourcesCredit sources={status.sources} />
      {familyId && <FamilyDrawer key={familyId} familyId={familyId} onClose={() => setFamilyId(null)} />}
    </Shell>
  );
}
