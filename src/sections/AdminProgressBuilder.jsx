import { useState, useEffect, useRef } from 'react';

const authedFetch = (url, opts = {}) => {
  const token = localStorage.getItem('token');
  return fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
};

const inputClass = 'w-full bg-sunken border border-border-default hover:border-border-default/80 focus:border-brand text-text-primary rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand transition-all';
const labelClass = 'block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2';
const primaryBtn = 'px-5 py-2.5 bg-brand hover:bg-brand-hover disabled:bg-surface-raised disabled:cursor-not-allowed text-text-on-accent rounded-xl text-xs font-bold transition shadow-sm cursor-pointer';
const smallBtn = 'px-3 py-1.5 bg-surface border border-border-default hover:bg-sunken text-text-secondary rounded-lg text-[10px] font-bold cursor-pointer';
const smallDangerBtn = 'px-2.5 py-1 bg-status-danger-bg hover:bg-status-danger-bg/85 text-status-danger-text border border-status-danger-text/20 rounded-lg text-[10px] font-bold cursor-pointer';
const arrowBtn = 'px-2 py-1 bg-surface border border-border-default hover:bg-sunken disabled:opacity-30 text-text-secondary rounded-lg text-[10px] font-bold cursor-pointer';

const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const resolveFileName = (course, fileIndex) => {
  if (course.fileUrls?.length > 0) return course.fileNames?.[fileIndex] || `Part ${fileIndex + 1}`;
  return course.fileName || course.name;
};

// ================= Overview: picker for un/partially-covered course PDFs =================

function OverviewView({ onStart, onJumpToPyqs }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authedFetch('/api/progress/admin/builder/overview');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load overview');
      setCourses(data.courses || []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleDeleteDraft = async (draftId) => {
    if (!window.confirm('Delete this draft? Everything manually entered in it will be lost (nothing from it has been saved to the live progress section yet).')) return;
    await authedFetch(`/api/progress/admin/builder/draft/${draftId}`, { method: 'DELETE' });
    setToast('Draft deleted.');
    await refresh();
  };

  const relevantCourses = courses
    .map((c) => ({ ...c, files: c.files.filter((f) => f.state !== 'complete') }))
    .filter((c) => c.files.length > 0);

  return (
    <div className="space-y-5">
      {toast && <div className="p-3 bg-status-success-bg border border-status-success-text/25 rounded-xl text-status-success-text text-xs font-semibold">{toast}</div>}
      {error && <div className="p-3 bg-status-danger-bg border border-status-danger-text/25 rounded-xl text-status-danger-text text-xs font-semibold">{error}</div>}
      {loading && <p className="text-xs text-text-tertiary">Loading...</p>}

      {!loading && relevantCourses.length === 0 && (
        <p className="text-xs text-text-tertiary">Every course PDF already has a complete progress section (topics, questions, and PYQs).</p>
      )}

      {!loading && relevantCourses.map((course) => (
        <div key={course._id} className="bg-surface border border-border-default rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-text-primary mb-3">
            {course.name} <span className="text-text-tertiary font-medium">({course.subject})</span>
          </h3>
          <div className="space-y-2">
            {course.files.map((f) => {
              const fName = resolveFileName(course, f.fileIndex);
              const sel = { courseId: course._id, fileIndex: f.fileIndex, courseName: course.name, fileName: fName };
              return (
                <div key={f.fileIndex} className="flex items-center justify-between gap-3 p-3 bg-sunken border border-border-default rounded-xl">
                  <div className="min-w-0">
                    <p className="text-xs text-text-primary font-semibold truncate">{fName}</p>
                    <p className="text-[10px] text-text-secondary mt-0.5">
                      {f.state === 'not_started' && 'Not started'}
                      {f.state === 'draft' && `Draft in progress — last saved ${new Date(f.draftUpdatedAt).toLocaleString()}`}
                      {f.state === 'pyqs_pending' && 'Topics/questions saved — PYQs not added yet'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {f.state === 'not_started' && (
                      <button onClick={() => onStart(sel)} className={smallBtn + ' bg-brand! text-text-on-accent! border-0!'}>Start</button>
                    )}
                    {f.state === 'draft' && (
                      <>
                        <button onClick={() => onStart(sel)} className={smallBtn + ' bg-brand! text-text-on-accent! border-0!'}>Resume</button>
                        <button onClick={() => handleDeleteDraft(f.draftId)} className={smallDangerBtn}>Delete</button>
                      </>
                    )}
                    {f.state === 'pyqs_pending' && (
                      <>
                        <button onClick={() => onStart(sel)} className={smallBtn}>Edit Topics/Questions</button>
                        <button onClick={() => onJumpToPyqs(sel)} className={smallBtn + ' bg-brand! text-text-on-accent! border-0!'}>Add PYQs</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ================= Step 1: manual topic/question authoring, autosaved as a draft =================

function DraftTopicCard({ topic, isFirst, isLast, onUpdateName, onMoveTopic, onDeleteTopic, onAddQuestion, onUpdateQuestion, onMoveQuestion, onDeleteQuestion }) {
  const [newText, setNewText] = useState('');
  const [newPage, setNewPage] = useState('');

  const handleAdd = () => {
    if (!newText.trim() || !newPage) return;
    onAddQuestion(topic.tempId, newText.trim(), Number(newPage));
    setNewText('');
    setNewPage('');
  };

  return (
    <div className="bg-surface border border-border-default rounded-2xl overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 border-b border-border-default flex items-center gap-2">
        <input
          value={topic.name}
          onChange={(e) => onUpdateName(topic.tempId, e.target.value)}
          placeholder="Topic name"
          className="flex-1 bg-sunken border border-border-default focus:border-brand text-text-primary rounded-lg px-3 py-1.5 text-sm font-bold"
        />
        <button disabled={isFirst} onClick={() => onMoveTopic(topic.tempId, 'up')} className={arrowBtn}>↑</button>
        <button disabled={isLast} onClick={() => onMoveTopic(topic.tempId, 'down')} className={arrowBtn}>↓</button>
        <button onClick={() => onDeleteTopic(topic.tempId)} className={smallDangerBtn}>Delete</button>
      </div>

      <div className="divide-y divide-border-default">
        {topic.questions.map((q, qIdx) => (
          <div key={q.tempId} className="px-5 py-3 flex flex-col md:flex-row gap-2 md:items-start">
            <span className="text-[11px] text-text-tertiary font-bold w-8 shrink-0 pt-1.5">#{qIdx + 1}</span>
            <textarea
              value={q.questionText}
              onChange={(e) => onUpdateQuestion(topic.tempId, q.tempId, { questionText: e.target.value })}
              rows={2}
              className="flex-1 bg-sunken border border-border-default focus:border-brand text-text-primary rounded-lg px-3 py-1.5 text-xs resize-none"
            />
            <input
              type="number"
              value={q.pageNumber ?? ''}
              onChange={(e) => onUpdateQuestion(topic.tempId, q.tempId, { pageNumber: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="Pg."
              className="w-full md:w-16 bg-sunken border border-border-default focus:border-brand text-text-primary rounded-lg px-3 py-1.5 text-xs shrink-0"
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <button disabled={qIdx === 0} onClick={() => onMoveQuestion(topic.tempId, q.tempId, 'up')} className={arrowBtn}>↑</button>
              <button disabled={qIdx === topic.questions.length - 1} onClick={() => onMoveQuestion(topic.tempId, q.tempId, 'down')} className={arrowBtn}>↓</button>
              <button onClick={() => onDeleteQuestion(topic.tempId, q.tempId)} className={smallDangerBtn}>Delete</button>
            </div>
          </div>
        ))}
        {topic.questions.length === 0 && <p className="px-5 py-3 text-xs text-text-tertiary">No questions yet — add one below.</p>}
      </div>

      <div className="px-5 py-3.5 bg-sunken flex flex-col md:flex-row gap-2">
        <textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Question text"
          rows={2}
          className="flex-1 bg-surface border border-border-default focus:border-brand text-text-primary rounded-lg px-3 py-1.5 text-xs resize-none"
        />
        <input
          type="number"
          value={newPage}
          onChange={(e) => setNewPage(e.target.value)}
          placeholder="Page #"
          className="w-full md:w-20 bg-surface border border-border-default focus:border-brand text-text-primary rounded-lg px-3 py-1.5 text-xs shrink-0"
        />
        <button onClick={handleAdd} disabled={!newText.trim() || !newPage} className={smallBtn + ' bg-brand! text-text-on-accent! border-0! disabled:opacity-40'}>Add Question</button>
      </div>
    </div>
  );
}

function TopicQuestionBuilderView({ courseId, fileIndex, courseName, fileName, onBack, onSaved }) {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [existingTopics, setExistingTopics] = useState([]);
  const [newTopicName, setNewTopicName] = useState('');
  const [saveState, setSaveState] = useState('idle'); // idle | pending | saving | saved | error
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState('');
  const saveTimerRef = useRef(null);
  const skipNextAutosaveRef = useRef(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await authedFetch(`/api/progress/admin/builder/draft?courseId=${courseId}&fileIndex=${fileIndex}`);
        const data = await res.json();
        if (res.ok && data.draft) {
          skipNextAutosaveRef.current = true;
          setTopics(data.draft.topics || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [courseId, fileIndex]);

  // Topics/questions already committed for this file (e.g. from an earlier session that
  // finished step 1 and moved on) - shown read-only so re-entering this step never looks
  // like prior work vanished. New additions below are still safely additive on commit.
  useEffect(() => {
    const loadExisting = async () => {
      try {
        const res = await authedFetch(`/api/progress/topics?courseId=${courseId}&fileIndex=${fileIndex}`);
        const data = await res.json();
        if (res.ok) setExistingTopics(data.topics || []);
      } catch (err) {
        console.error(err);
      }
    };
    loadExisting();
  }, [courseId, fileIndex]);

  useEffect(() => {
    if (skipNextAutosaveRef.current) { skipNextAutosaveRef.current = false; return; }
    setSaveState('pending');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveState('saving');
      try {
        const res = await authedFetch('/api/progress/admin/builder/draft', { method: 'PUT', body: JSON.stringify({ courseId, fileIndex, topics }) });
        if (!res.ok) throw new Error('save failed');
        setSaveState('saved');
      } catch (err) {
        console.error(err);
        setSaveState('error');
      }
    }, 1500);
  }, [topics]); // eslint-disable-line react-hooks/exhaustive-deps

  const addTopic = () => {
    if (!newTopicName.trim()) return;
    setTopics((prev) => [...prev, { tempId: makeId(), name: newTopicName.trim(), questions: [] }]);
    setNewTopicName('');
  };
  const updateTopicName = (topicId, name) => setTopics((prev) => prev.map((t) => (t.tempId === topicId ? { ...t, name } : t)));
  const deleteTopic = (topicId) => {
    if (!window.confirm('Delete this topic and its questions from the draft?')) return;
    setTopics((prev) => prev.filter((t) => t.tempId !== topicId));
  };
  const moveTopic = (topicId, direction) => {
    setTopics((prev) => {
      const idx = prev.findIndex((t) => t.tempId === topicId);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (idx < 0 || swapIdx < 0 || swapIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  };
  const addQuestion = (topicId, questionText, pageNumber) => {
    setTopics((prev) => prev.map((t) => (t.tempId === topicId ? { ...t, questions: [...t.questions, { tempId: makeId(), questionText, pageNumber }] } : t)));
  };
  const updateQuestion = (topicId, questionId, updates) => {
    setTopics((prev) => prev.map((t) => (t.tempId !== topicId ? t : {
      ...t,
      questions: t.questions.map((q) => (q.tempId === questionId ? { ...q, ...updates } : q))
    })));
  };
  const deleteQuestion = (topicId, questionId) => {
    setTopics((prev) => prev.map((t) => (t.tempId !== topicId ? t : { ...t, questions: t.questions.filter((q) => q.tempId !== questionId) })));
  };
  const moveQuestion = (topicId, questionId, direction) => {
    setTopics((prev) => prev.map((t) => {
      if (t.tempId !== topicId) return t;
      const idx = t.questions.findIndex((q) => q.tempId === questionId);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (idx < 0 || swapIdx < 0 || swapIdx >= t.questions.length) return t;
      const nextQuestions = [...t.questions];
      [nextQuestions[idx], nextQuestions[swapIdx]] = [nextQuestions[swapIdx], nextQuestions[idx]];
      return { ...t, questions: nextQuestions };
    }));
  };

  const handleSaveAndContinue = async () => {
    if (topics.length === 0) {
      if (existingTopics.length > 0) { onSaved(); return; } // nothing new to add, already-committed topics are enough
      setError('Add at least one topic.');
      return;
    }
    for (const t of topics) {
      if (!t.name.trim()) { setError('Every topic needs a name.'); return; }
      if (t.questions.length === 0) { setError(`Topic "${t.name}" needs at least one question.`); return; }
      for (const q of t.questions) {
        if (!q.questionText.trim()) { setError(`Topic "${t.name}" has a question with no text.`); return; }
        if (!q.pageNumber || q.pageNumber <= 0) { setError(`Topic "${t.name}" has a question with an invalid page number.`); return; }
      }
    }

    setCommitting(true);
    setError('');
    try {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const putRes = await authedFetch('/api/progress/admin/builder/draft', { method: 'PUT', body: JSON.stringify({ courseId, fileIndex, topics }) });
      const putData = await putRes.json();
      if (!putRes.ok) throw new Error(putData.error || 'Failed to save draft');

      const commitRes = await authedFetch(`/api/progress/admin/builder/draft/${putData.draftId}/commit`, { method: 'POST' });
      const commitData = await commitRes.json();
      if (!commitRes.ok) throw new Error(commitData.error || 'Failed to save topics/questions');

      onSaved();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to save.');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button onClick={onBack} className={smallBtn + ' mb-2'}>← Back to Overview</button>
          <h2 className="text-sm font-bold text-text-primary">{courseName} — {fileName}</h2>
          <p className="text-[11px] text-text-secondary mt-0.5">Step 1 of 2: add topics and questions. This autosaves as a draft — safe to leave and resume later.</p>
        </div>
        <div className="text-[10px] font-bold shrink-0">
          {saveState === 'pending' && <span className="text-text-tertiary">Unsaved changes...</span>}
          {saveState === 'saving' && <span className="text-text-tertiary animate-pulse">Saving...</span>}
          {saveState === 'saved' && <span className="text-status-success-text">Saved ✓ {new Date().toLocaleTimeString()}</span>}
          {saveState === 'error' && <span className="text-status-danger-text">Autosave failed — will retry on next change</span>}
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-text-tertiary">Loading draft...</p>
      ) : (
        <>
          {existingTopics.length > 0 && (
            <div className="bg-sunken border border-border-default rounded-2xl p-5 space-y-2">
              <h3 className="text-[11px] font-bold text-text-secondary uppercase tracking-wide">
                Already saved to this file ({existingTopics.length} topic{existingTopics.length === 1 ? '' : 's'})
              </h3>
              <div className="space-y-1">
                {existingTopics.map((t) => (
                  <p key={t._id} className="text-xs text-text-primary">
                    <span className="font-bold">{t.name}</span>{' '}
                    <span className="text-text-tertiary">— {t.questions.length} question{t.questions.length === 1 ? '' : 's'}</span>
                  </p>
                ))}
              </div>
              <p className="text-[10px] text-text-tertiary">To rename, reorder, or delete these, use Progress Data → Manage Topics & Questions. Anything you add below is appended safely alongside these.</p>
            </div>
          )}

          {topics.map((topic, idx) => (
            <DraftTopicCard
              key={topic.tempId}
              topic={topic}
              isFirst={idx === 0}
              isLast={idx === topics.length - 1}
              onUpdateName={updateTopicName}
              onMoveTopic={moveTopic}
              onDeleteTopic={deleteTopic}
              onAddQuestion={addQuestion}
              onUpdateQuestion={updateQuestion}
              onMoveQuestion={moveQuestion}
              onDeleteQuestion={deleteQuestion}
            />
          ))}

          <div className="bg-surface border border-border-default rounded-2xl p-5 shadow-sm flex flex-col md:flex-row gap-2">
            <input
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTopic(); } }}
              placeholder="New topic name"
              className={inputClass + ' flex-1'}
            />
            <button onClick={addTopic} disabled={!newTopicName.trim()} className={primaryBtn}>Add Topic</button>
          </div>

          {error && <div className="p-3 bg-status-danger-bg border border-status-danger-text/25 rounded-xl text-status-danger-text text-xs font-semibold">{error}</div>}

          <button onClick={handleSaveAndContinue} disabled={committing || (topics.length === 0 && existingTopics.length === 0)} className={primaryBtn}>
            {committing ? 'Saving...' : topics.length === 0 ? 'Continue to PYQs →' : 'Save & Continue to PYQs →'}
          </button>
        </>
      )}
    </div>
  );
}

// ================= Step 2: paste PYQs, Gemini sorts + auto-commits =================

function PyqPasteView({ courseId, fileIndex, courseName, fileName, onDone, onBack, onBackToBuilder }) {
  const [blocks, setBlocks] = useState(['']);
  const [starting, setStarting] = useState(false);
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };
  useEffect(() => stopPolling, []);

  const updateBlock = (idx, value) => setBlocks((prev) => prev.map((b, i) => (i === idx ? value : b)));
  const addBlock = () => setBlocks((prev) => [...prev, '']);
  const removeBlock = (idx) => setBlocks((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  const poll = async (jobId) => {
    try {
      const res = await authedFetch(`/api/progress/admin/builder/pyq-sort/${jobId}/status`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch job status');
      setJob(data);
      if (data.status === 'done' || data.status === 'error') stopPolling();
    } catch (err) {
      console.error(err);
      stopPolling();
      setError(err.message || 'Failed to fetch job status.');
    }
  };

  const handleStart = async (e) => {
    e.preventDefault();
    const nonEmpty = blocks.map((b) => b.trim()).filter(Boolean);
    if (nonEmpty.length === 0) { setError('Paste at least one block of PYQ text.'); return; }
    setStarting(true);
    setError('');
    try {
      const res = await authedFetch('/api/progress/admin/builder/pyq-sort/start', {
        method: 'POST',
        body: JSON.stringify({ courseId, fileIndex, textBlocks: nonEmpty })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start sorting');
      setJob({ status: 'pending' });
      pollRef.current = setInterval(() => poll(data.jobId), 2500);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to start sorting.');
    } finally {
      setStarting(false);
    }
  };

  const tagCounts = {};
  if (job?.status === 'done') {
    for (const p of job.sortedPyqs || []) tagCounts[p.suggestedTag] = (tagCounts[p.suggestedTag] || 0) + 1;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <button onClick={onBack} className={smallBtn}>← Back to Overview</button>
          <button onClick={onBackToBuilder} className={smallBtn}>← Back to Topics & Questions</button>
        </div>
        <h2 className="text-sm font-bold text-text-primary">{courseName} — {fileName}</h2>
        <p className="text-[11px] text-text-secondary mt-0.5">Step 2 of 2: paste PYQ text. Gemini extracts each question's year, classifies it against this file's topics, and saves it directly — the progress section goes live automatically once done.</p>
      </div>

      {(!job || job.status === 'error') && (
        <form onSubmit={handleStart} className="space-y-4">
          {blocks.map((b, idx) => (
            <div key={idx} className="bg-surface border border-border-default rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <label className={labelClass + ' mb-0'}>PYQ text block {idx + 1}</label>
                {blocks.length > 1 && <button type="button" onClick={() => removeBlock(idx)} className={smallDangerBtn}>Remove</button>}
              </div>
              <textarea
                value={b}
                onChange={(e) => updateBlock(idx, e.target.value)}
                rows={8}
                placeholder="Paste PYQ text here — each question should have its exam year noted somewhere near it (e.g. (2019))."
                className="w-full bg-sunken border border-border-default focus:border-brand text-text-primary rounded-lg px-3 py-2 text-xs resize-y font-mono"
              />
            </div>
          ))}
          <button type="button" onClick={addBlock} className={smallBtn}>+ Add another block</button>

          {job?.status === 'error' && (
            <div className="p-3 bg-status-danger-bg border border-status-danger-text/25 rounded-xl text-status-danger-text text-xs font-semibold">{job.error}</div>
          )}
          {error && <div className="p-3 bg-status-danger-bg border border-status-danger-text/25 rounded-xl text-status-danger-text text-xs font-semibold">{error}</div>}

          <button type="submit" disabled={starting} className={primaryBtn}>{starting ? 'Starting...' : 'Sort with Gemini'}</button>
        </form>
      )}

      {job && job.status !== 'done' && job.status !== 'error' && (
        <div className="p-4 bg-sunken border border-border-default rounded-xl space-y-2">
          {job.status === 'pending' && <p className="text-xs text-text-primary font-semibold animate-pulse">Starting...</p>}
          {job.status === 'sorting' && (
            <div className="space-y-1.5">
              <p className="text-xs text-text-primary font-semibold">
                Processing {job.currentChunkRange} of {job.totalChunks}...
              </p>
              <p className="text-[11px] text-brand font-bold">PYQs found so far: {job.pyqsFoundSoFar}</p>
              {job.chunksFailed > 0 && (
                <p className="text-[11px] text-status-danger-text font-bold">{job.chunksFailed} block(s) failed: {(job.failedChunkRanges || []).join(', ')}</p>
              )}
              <div className="w-full bg-surface rounded-full h-2 overflow-hidden border border-border-default mt-2">
                <div
                  className="bg-brand h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, ((job.chunksCompleted + job.chunksFailed) / Math.max(job.totalChunks, 1)) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {job?.status === 'done' && (
        <div className="bg-surface border border-border-default rounded-2xl p-6 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-status-success-text">Done — {job.insertedCount} PYQ{job.insertedCount === 1 ? '' : 's'} saved</h3>
          {job.chunksFailed > 0 && (
            <div className="p-3 bg-status-warning-bg border border-status-warning-text/25 rounded-xl text-status-warning-text text-xs font-semibold">
              {job.chunksFailed} of {job.totalChunks} block(s) failed and were not analyzed: {(job.failedChunkRanges || []).join(', ')}. Re-run this step with just that text if needed — it won't duplicate what's already saved.
            </div>
          )}
          {Object.keys(tagCounts).length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-text-secondary uppercase tracking-wide">By topic</p>
              {Object.entries(tagCounts).map(([tag, count]) => (
                <p key={tag} className="text-xs text-text-primary">{tag}: <span className="font-bold">{count}</span></p>
              ))}
            </div>
          )}
          <p className="text-[11px] text-text-secondary">The progress section for this file is now live. You can fine-tune topics, questions, or PYQs afterward from the "Progress Data" admin tool.</p>
          <button onClick={onDone} className={primaryBtn}>Back to Overview</button>
        </div>
      )}
    </div>
  );
}

// ================= Top-level: overview → builder → pyq paste =================

export default function AdminProgressBuilder() {
  const [view, setView] = useState('overview');
  const [selection, setSelection] = useState(null);
  const [overviewKey, setOverviewKey] = useState(0);

  const goToBuilder = (sel) => { setSelection(sel); setView('builder'); };
  const goToPyqs = (sel) => { setSelection(sel); setView('pyq'); };
  const backToOverview = () => { setSelection(null); setView('overview'); setOverviewKey((k) => k + 1); };

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-10 md:py-14 text-text-primary">
      <div className="mb-8 border-b border-border-default pb-5">
        <h1 className="text-2xl md:text-3xl font-display font-semibold text-text-primary tracking-tight">Progress Section Builder</h1>
        <p className="text-text-secondary text-sm mt-1.5 font-medium">Backfill the Progress checklist for course PDFs that don't have one yet — enter topics/questions manually, then paste PYQs for Gemini to auto-sort.</p>
      </div>

      {view === 'overview' && (
        <OverviewView key={overviewKey} onStart={goToBuilder} onJumpToPyqs={goToPyqs} />
      )}
      {view === 'builder' && selection && (
        <TopicQuestionBuilderView {...selection} onBack={backToOverview} onSaved={() => goToPyqs(selection)} />
      )}
      {view === 'pyq' && selection && (
        <PyqPasteView {...selection} onBack={backToOverview} onDone={backToOverview} onBackToBuilder={() => goToBuilder(selection)} />
      )}
    </div>
  );
}
