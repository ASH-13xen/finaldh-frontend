import { useState, useEffect, useRef } from 'react';

const getFileEntries = (course) => {
  if (course.fileUrls && course.fileUrls.length > 0) {
    return course.fileUrls.map((url, idx) => ({ index: idx, name: course.fileNames?.[idx] || `Part ${idx + 1}` }));
  }
  return [{ index: 0, name: course.fileName || course.name }];
};

const authedFetch = (url, opts = {}) => {
  const token = localStorage.getItem('token');
  return fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
};

const inputClass = 'w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-accent-500 text-slate-100 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all';
const labelClass = 'block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2';

function UploadSummary({ summary }) {
  if (!summary) return null;
  return (
    <div className="mt-5 space-y-3">
      <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-xl text-emerald-400 text-xs font-semibold">{summary.message}</div>
      {summary.skippedRows?.length > 0 && (
        <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-xl text-rose-400 text-xs space-y-1">
          <p className="font-bold uppercase text-[10px] tracking-wide">Skipped Rows ({summary.skippedRows.length})</p>
          <ul className="space-y-0.5 max-h-32 overflow-y-auto">
            {summary.skippedRows.map((s, idx) => <li key={idx}>Row {s.row}: {s.reason}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function CourseFileSelect({ courses, loadingCourses, courseId, setCourseId, fileIndex, setFileIndex, allowedFileIndexes }) {
  const selectedCourse = courses.find(c => c._id === courseId);
  const fileEntries = selectedCourse ? getFileEntries(selectedCourse) : [];
  const filteredEntries = allowedFileIndexes ? fileEntries.filter((f) => allowedFileIndexes.includes(f.index)) : fileEntries;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className={labelClass}>Course</label>
        <select
          value={courseId}
          onChange={(e) => { setCourseId(e.target.value); setFileIndex(0); }}
          disabled={loadingCourses}
          className={inputClass}
        >
          <option value="">{loadingCourses ? 'Loading courses...' : 'Select course...'}</option>
          {courses.map((c) => <option key={c._id} value={c._id}>{c.name} ({c.subject})</option>)}
        </select>
      </div>
      {filteredEntries.length > 1 && (
        <div>
          <label className={labelClass}>PDF File</label>
          <select value={fileIndex} onChange={(e) => setFileIndex(Number(e.target.value))} className={inputClass}>
            {filteredEntries.map((f) => <option key={f.index} value={f.index}>{f.name}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

function UploadTopicQuestionsTab({ courses, loadingCourses }) {
  const [courseId, setCourseId] = useState('');
  const [fileIndex, setFileIndex] = useState(0);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!courseId || !file) {
      setError('Please select a course and a CSV file.');
      return;
    }
    setUploading(true);
    setError('');
    setSummary(null);

    const formData = new FormData();
    formData.append('courseId', courseId);
    formData.append('fileIndex', String(fileIndex));
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/progress/admin/topic-questions/upload-csv', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setSummary(data);
      setFile(null);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to upload CSV.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
      <h2 className="text-sm font-extrabold text-slate-100 mb-1">Upload Topic/Question CSV</h2>
      <p className="text-xs text-slate-400 mb-1">
        CSV columns required: <span className="font-bold text-slate-300">topic name</span>, <span className="font-bold text-slate-300">question text</span>, <span className="font-bold text-slate-300">page number</span>. Optional: <span className="font-bold text-slate-300">tag</span> (semicolon-separated; matched against PYQ "section" values to surface related PYQs).
      </p>
      <p className="text-[11px] text-accent-400 font-semibold mb-5">
        This upload is additive: it never deletes existing topics/questions or resets student progress. Re-uploading a CSV with the same topic names reuses those topics and only adds new questions.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <CourseFileSelect courses={courses} loadingCourses={loadingCourses} courseId={courseId} setCourseId={setCourseId} fileIndex={fileIndex} setFileIndex={setFileIndex} />

        <div>
          <label className={labelClass}>CSV File</label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-accent-600 file:text-white file:text-xs file:font-bold file:cursor-pointer"
          />
        </div>

        {error && <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-xl text-rose-400 text-xs font-semibold">{error}</div>}

        <button
          type="submit"
          disabled={uploading}
          className="px-5 py-2.5 bg-accent-600 hover:bg-accent-500 disabled:bg-accent-900 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </form>

      <UploadSummary summary={summary} />
    </div>
  );
}

function QuestionEditorRow({ question, isFirst, isLast, onUpdate, onMove, onDelete }) {
  const [questionText, setQuestionText] = useState(question.questionText);
  const [tag, setTag] = useState(question.tag);
  const [pageNumber, setPageNumber] = useState(question.pageNumber);
  const dirty = questionText !== question.questionText || tag !== question.tag || Number(pageNumber) !== question.pageNumber;

  return (
    <div className="px-5 py-3.5 flex flex-col md:flex-row gap-2 md:items-center">
      <textarea
        value={questionText}
        onChange={(e) => setQuestionText(e.target.value)}
        rows={1}
        className="flex-1 bg-slate-950 border border-slate-800 focus:border-accent-500 text-slate-200 rounded-lg px-3 py-1.5 text-xs resize-none"
      />
      <input
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        placeholder="tag(s)"
        className="w-full md:w-48 bg-slate-950 border border-slate-800 focus:border-accent-500 text-slate-200 rounded-lg px-3 py-1.5 text-xs"
      />
      <input
        type="number"
        value={pageNumber}
        onChange={(e) => setPageNumber(e.target.value)}
        className="w-full md:w-20 bg-slate-950 border border-slate-800 focus:border-accent-500 text-slate-200 rounded-lg px-3 py-1.5 text-xs"
      />
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {dirty && (
          <button
            onClick={() => onUpdate(question._id, { questionText, tag, pageNumber: Number(pageNumber) })}
            className="px-2.5 py-1 bg-accent-600 hover:bg-accent-500 text-white rounded-lg text-[10px] font-bold cursor-pointer"
          >
            Save
          </button>
        )}
        <button disabled={isFirst} onClick={() => onMove(question._id, 'up')} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer">↑</button>
        <button disabled={isLast} onClick={() => onMove(question._id, 'down')} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer">↓</button>
        <button onClick={() => onDelete(question._id)} className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/50 text-rose-400 border border-rose-900/40 rounded-lg text-[10px] font-bold cursor-pointer">Delete</button>
      </div>
    </div>
  );
}

function TopicEditorCard({ topic, isFirst, isLast, onRename, onMove, onDelete, onUpdateQuestion, onMoveQuestion, onDeleteQuestion }) {
  const [name, setName] = useState(topic.name);
  const dirty = name !== topic.name;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-800 focus:border-accent-500 text-slate-100 rounded-lg px-3 py-1.5 text-sm font-bold"
        />
        {dirty && (
          <button onClick={() => onRename(topic._id, name)} className="px-2.5 py-1 bg-accent-600 hover:bg-accent-500 text-white rounded-lg text-[10px] font-bold cursor-pointer">Save</button>
        )}
        <button disabled={isFirst} onClick={() => onMove(topic._id, 'up')} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer">↑</button>
        <button disabled={isLast} onClick={() => onMove(topic._id, 'down')} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer">↓</button>
        <button onClick={() => onDelete(topic._id)} className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/50 text-rose-400 border border-rose-900/40 rounded-lg text-[10px] font-bold cursor-pointer">Delete</button>
      </div>
      <div className="divide-y divide-slate-800">
        {topic.questions.map((q, qIdx) => (
          <QuestionEditorRow
            key={q._id}
            question={q}
            isFirst={qIdx === 0}
            isLast={qIdx === topic.questions.length - 1}
            onUpdate={onUpdateQuestion}
            onMove={onMoveQuestion}
            onDelete={onDeleteQuestion}
          />
        ))}
        {topic.questions.length === 0 && <p className="px-5 py-3 text-xs text-slate-500">No questions in this topic.</p>}
      </div>
    </div>
  );
}

function ManageTopicsTab({ courses, loadingCourses }) {
  const [courseId, setCourseId] = useState('');
  const [fileIndex, setFileIndex] = useState(0);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const refresh = async () => {
    if (!courseId) { setTopics([]); return; }
    setLoading(true);
    setError('');
    try {
      const res = await authedFetch(`/api/progress/topics?courseId=${courseId}&fileIndex=${fileIndex}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load topics');
      setTopics(data.topics || []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load topics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [courseId, fileIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const renameTopic = async (topicId, name) => {
    await authedFetch(`/api/progress/admin/topics/${topicId}`, { method: 'PATCH', body: JSON.stringify({ name }) });
    await refresh();
  };

  const moveTopic = async (topicId, direction) => {
    await authedFetch(`/api/progress/admin/topics/${topicId}/move`, { method: 'PATCH', body: JSON.stringify({ direction }) });
    await refresh();
  };

  const deleteTopic = async (topicId) => {
    if (!window.confirm('Delete this topic and all its questions? This also deletes any student progress on those questions.')) return;
    const res = await authedFetch(`/api/progress/admin/topics/${topicId}`, { method: 'DELETE' });
    const data = await res.json();
    setToast(data.message || 'Deleted.');
    await refresh();
  };

  const updateQuestion = async (questionId, updates) => {
    await authedFetch(`/api/progress/admin/questions/${questionId}`, { method: 'PATCH', body: JSON.stringify(updates) });
    await refresh();
  };

  const moveQuestion = async (questionId, direction) => {
    await authedFetch(`/api/progress/admin/questions/${questionId}/move`, { method: 'PATCH', body: JSON.stringify({ direction }) });
    await refresh();
  };

  const deleteQuestion = async (questionId) => {
    if (!window.confirm('Delete this question? This also deletes any student progress on it.')) return;
    const res = await authedFetch(`/api/progress/admin/questions/${questionId}`, { method: 'DELETE' });
    const data = await res.json();
    setToast(data.message || 'Deleted.');
    await refresh();
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-extrabold text-slate-100 mb-4">Select Course & File</h2>
        <CourseFileSelect courses={courses} loadingCourses={loadingCourses} courseId={courseId} setCourseId={setCourseId} fileIndex={fileIndex} setFileIndex={setFileIndex} />
      </div>

      {toast && <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-xl text-emerald-400 text-xs font-semibold">{toast}</div>}
      {error && <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-xl text-rose-400 text-xs font-semibold">{error}</div>}
      {loading && <p className="text-xs text-slate-500">Loading...</p>}

      {!loading && courseId && topics.length === 0 && (
        <p className="text-xs text-slate-500">No topics yet for this file. Use "Upload Topic/Question CSV" first.</p>
      )}

      {!loading && topics.map((topic, tIdx) => (
        <TopicEditorCard
          key={topic._id}
          topic={topic}
          isFirst={tIdx === 0}
          isLast={tIdx === topics.length - 1}
          onRename={renameTopic}
          onMove={moveTopic}
          onDelete={deleteTopic}
          onUpdateQuestion={updateQuestion}
          onMoveQuestion={moveQuestion}
          onDeleteQuestion={deleteQuestion}
        />
      ))}
    </div>
  );
}

function ExtractQuestionsTab({ courses, loadingCourses }) {
  const [courseId, setCourseId] = useState('');
  const [fileIndex, setFileIndex] = useState(0);
  const [pdfFile, setPdfFile] = useState(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [job, setJob] = useState(null);
  const [existingTopics, setExistingTopics] = useState([]);
  const [reviewRows, setReviewRows] = useState([]);
  const [bulkTopic, setBulkTopic] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSummary, setSaveSummary] = useState(null);
  const pollRef = useRef(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => stopPolling, []); // clear interval on unmount

  const fetchExistingTopics = async () => {
    try {
      const res = await authedFetch(`/api/progress/topics?courseId=${courseId}&fileIndex=${fileIndex}`);
      const data = await res.json();
      if (res.ok) setExistingTopics((data.topics || []).map((t) => t.name));
    } catch (err) {
      console.error(err);
    }
  };

  const poll = async (jobId) => {
    try {
      const res = await authedFetch(`/api/progress/admin/extract-questions/${jobId}/status`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch extraction status');
      setJob(data);

      if (data.status === 'done') {
        stopPolling();
        await fetchExistingTopics();
        setReviewRows((data.extractedQuestions || []).map((q) => ({
          pageNumber: q.pageNumber,
          questionText: q.questionText,
          topicName: q.suggestedTopicName || '',
          isNewTopic: false,
          newTopicName: '',
          discarded: false
        })));
      } else if (data.status === 'error') {
        stopPolling();
      }
    } catch (err) {
      console.error(err);
      stopPolling();
      setError(err.message || 'Failed to fetch extraction status.');
    }
  };

  const handleStart = async (e) => {
    e.preventDefault();
    if (!courseId || !pdfFile) {
      setError('Please select a course and a source PDF.');
      return;
    }
    setStarting(true);
    setError('');
    setSaveSummary(null);
    setReviewRows([]);

    const formData = new FormData();
    formData.append('courseId', courseId);
    formData.append('fileIndex', String(fileIndex));
    formData.append('pdf', pdfFile);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/progress/admin/extract-questions/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start extraction');
      setJob({ status: 'pending' });
      pollRef.current = setInterval(() => poll(data.jobId), 2500);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to start extraction.');
    } finally {
      setStarting(false);
    }
  };

  const handleStartOver = () => {
    stopPolling();
    setJob(null);
    setReviewRows([]);
    setError('');
    setPdfFile(null);
  };

  const updateRow = (idx, updates) => {
    setReviewRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...updates } : r)));
  };

  const applyBulkTopic = () => {
    if (!bulkTopic) return;
    setReviewRows((prev) => prev.map((r) =>
      (!r.topicName && !r.isNewTopic && !r.discarded) ? { ...r, topicName: bulkTopic } : r
    ));
  };

  const handleSave = async () => {
    const activeRows = reviewRows.filter((r) => !r.discarded);
    if (activeRows.length === 0) {
      setError('No questions to save (all rows discarded).');
      return;
    }
    if (activeRows.some((r) => !(r.isNewTopic ? r.newTopicName.trim() : r.topicName))) {
      setError('Every row needs a topic assigned before saving.');
      return;
    }
    if (activeRows.some((r) => !r.questionText.trim())) {
      setError('Every row needs non-empty question text.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const questions = activeRows.map((r) => ({
        topicName: r.isNewTopic ? r.newTopicName.trim() : r.topicName,
        questionText: r.questionText.trim(),
        pageNumber: r.pageNumber
      }));
      const res = await authedFetch('/api/progress/admin/topic-questions/bulk-create', {
        method: 'POST',
        body: JSON.stringify({ courseId, fileIndex, questions })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save questions');
      setSaveSummary(data);
      setReviewRows([]);
      setJob(null);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to save questions.');
    } finally {
      setSaving(false);
    }
  };

  const activeCount = reviewRows.filter((r) => !r.discarded).length;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-extrabold text-slate-100 mb-1">Extract Questions from PDF</h2>
        <p className="text-xs text-slate-400 mb-5">
          Upload a compiled answer-copy PDF (handwritten answers, with a typed question header at the top of the page where each question starts). Gemini extracts the question text + page number for every question — ignoring handwriting and multi-page continuation pages — and suggests a topic per question using the PDF's own index page. Nothing is saved until you review and confirm below.
        </p>

        {!job && (
          <form onSubmit={handleStart} className="space-y-4">
            <CourseFileSelect courses={courses} loadingCourses={loadingCourses} courseId={courseId} setCourseId={setCourseId} fileIndex={fileIndex} setFileIndex={setFileIndex} />
            <div>
              <label className={labelClass}>Source PDF</label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-accent-600 file:text-white file:text-xs file:font-bold file:cursor-pointer"
              />
            </div>
            {error && <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-xl text-rose-400 text-xs font-semibold">{error}</div>}
            <button
              type="submit"
              disabled={starting}
              className="px-5 py-2.5 bg-accent-600 hover:bg-accent-500 disabled:bg-accent-900 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
            >
              {starting ? 'Starting...' : 'Start Extraction'}
            </button>
          </form>
        )}

        {job && job.status !== 'done' && (
          <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl space-y-2">
            {job.status === 'pending' && <p className="text-xs text-slate-300 font-semibold">Starting extraction...</p>}
            {job.status === 'extracting_index' && <p className="text-xs text-slate-300 font-semibold">Extracting topic index from the first pages...</p>}
            {job.status === 'extracting_questions' && (
              <div className="space-y-1.5">
                <p className="text-xs text-slate-300 font-semibold">
                  Processing chunk {job.chunksCompleted + 1} of {job.totalChunks} ({job.currentChunkRange})...
                </p>
                <p className="text-[11px] text-accent-400 font-bold">Questions found so far: {job.questionsFoundSoFar}</p>
                {job.chunksFailed > 0 && (
                  <p className="text-[11px] text-rose-400 font-bold">{job.chunksFailed} chunk(s) failed so far: {(job.failedChunkRanges || []).join(', ')}</p>
                )}
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800 mt-2">
                  <div
                    className="bg-accent-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (job.chunksCompleted / Math.max(job.totalChunks, 1)) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            {job.status === 'error' && (
              <div className="space-y-2">
                <p className="text-xs text-rose-400 font-semibold">{job.error || 'Extraction failed.'}</p>
                <button onClick={handleStartOver} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold cursor-pointer">Start Over</button>
              </div>
            )}
          </div>
        )}

        <UploadSummary summary={saveSummary} />
      </div>

      {job && job.status === 'done' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-sm font-extrabold text-slate-100">Review Extracted Questions ({reviewRows.length})</h2>
            <button onClick={handleStartOver} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer">Start New Extraction</button>
          </div>

          {job.chunksFailed > 0 && (
            <div className="p-3 bg-amber-950/20 border border-amber-900/40 rounded-xl text-amber-400 text-xs font-semibold">
              {job.chunksFailed} of {job.totalChunks} chunk(s) failed and were NOT analyzed: {(job.failedChunkRanges || []).join(', ')}. The results below are incomplete for those page ranges — fix the underlying issue (often API quota) and re-run extraction once resolved.
            </div>
          )}

          {reviewRows.length === 0 ? (
            <p className="text-xs text-slate-500">No questions were extracted from this PDF. Try a different file, or check that question headers are typed/printed text rather than handwritten.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap p-3 bg-slate-950/40 border border-slate-800 rounded-xl">
                <span className="text-[11px] text-slate-400 font-semibold">Assign all unassigned rows to:</span>
                <select value={bulkTopic} onChange={(e) => setBulkTopic(e.target.value)} className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                  <option value="">Select topic...</option>
                  {existingTopics.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button onClick={applyBulkTopic} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold cursor-pointer">Apply</button>
              </div>

              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden max-h-[32rem] overflow-y-auto">
                {reviewRows.map((row, idx) => (
                  <div key={idx} className={`px-4 py-3 flex flex-col md:flex-row gap-2 md:items-start ${row.discarded ? 'opacity-40' : ''}`}>
                    <span className="text-[11px] text-slate-500 font-bold w-14 shrink-0 pt-1.5">Pg. {row.pageNumber}</span>
                    <textarea
                      value={row.questionText}
                      onChange={(e) => updateRow(idx, { questionText: e.target.value })}
                      disabled={row.discarded}
                      rows={2}
                      className="flex-1 bg-slate-950 border border-slate-800 focus:border-accent-500 text-slate-200 rounded-lg px-3 py-1.5 text-xs resize-none"
                    />
                    {row.isNewTopic ? (
                      <input
                        value={row.newTopicName}
                        onChange={(e) => updateRow(idx, { newTopicName: e.target.value })}
                        placeholder="New topic name"
                        disabled={row.discarded}
                        className="w-full md:w-44 bg-slate-950 border border-accent-700 text-slate-200 rounded-lg px-3 py-1.5 text-xs shrink-0"
                      />
                    ) : (
                      <select
                        value={row.topicName}
                        onChange={(e) => {
                          if (e.target.value === '__new__') updateRow(idx, { isNewTopic: true, newTopicName: '' });
                          else updateRow(idx, { topicName: e.target.value });
                        }}
                        disabled={row.discarded}
                        className="w-full md:w-44 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-1.5 text-xs shrink-0"
                      >
                        <option value="">Select topic...</option>
                        {existingTopics.map((t) => <option key={t} value={t}>{t}</option>)}
                        <option value="__new__">+ Create new topic...</option>
                      </select>
                    )}
                    <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold shrink-0 pt-2 cursor-pointer">
                      <input type="checkbox" checked={row.discarded} onChange={(e) => updateRow(idx, { discarded: e.target.checked })} />
                      Discard
                    </label>
                  </div>
                ))}
              </div>

              {error && <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-xl text-rose-400 text-xs font-semibold">{error}</div>}

              <button
                onClick={handleSave}
                disabled={saving || activeCount === 0}
                className="px-5 py-2.5 bg-accent-600 hover:bg-accent-500 disabled:bg-accent-900 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                {saving ? 'Saving...' : `Save ${activeCount} Question${activeCount === 1 ? '' : 's'}`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ExtractPyqsTab() {
  // Fetches its OWN filtered course list (only course+file combos that already have
  // Topics/ProgressQuestions, i.e. "progress data uploaded") rather than using the
  // unfiltered /api/courses/list fetch passed down from AdminProgressData.
  const [enabledCourses, setEnabledCourses] = useState([]);
  const [loadingEnabledCourses, setLoadingEnabledCourses] = useState(true);
  const [courseId, setCourseId] = useState('');
  const [fileIndex, setFileIndex] = useState(0);
  const [pdfFile, setPdfFile] = useState(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [job, setJob] = useState(null);
  const [existingTopics, setExistingTopics] = useState([]);
  const [reviewRows, setReviewRows] = useState([]);
  const [bulkTag, setBulkTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSummary, setSaveSummary] = useState(null);
  const [existingPyqs, setExistingPyqs] = useState([]);
  const [loadingExistingPyqs, setLoadingExistingPyqs] = useState(false);
  const pollRef = useRef(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => stopPolling, []); // clear interval on unmount

  useEffect(() => {
    const fetchEnabledCourses = async () => {
      try {
        const res = await authedFetch('/api/progress/admin/progress-enabled-courses');
        const data = await res.json();
        if (res.ok) setEnabledCourses(data.courses || []);
      } finally {
        setLoadingEnabledCourses(false);
      }
    };
    fetchEnabledCourses();
  }, []);

  const selectedCourse = enabledCourses.find((c) => c._id === courseId);

  const refreshExistingPyqs = async () => {
    if (!courseId) { setExistingPyqs([]); return; }
    setLoadingExistingPyqs(true);
    try {
      const res = await authedFetch(`/api/progress/admin/pyqs?courseId=${courseId}&fileIndex=${fileIndex}`);
      const data = await res.json();
      if (res.ok) setExistingPyqs(data.pyqs || []);
    } finally {
      setLoadingExistingPyqs(false);
    }
  };

  useEffect(() => { refreshExistingPyqs(); }, [courseId, fileIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchExistingTopics = async () => {
    try {
      const res = await authedFetch(`/api/progress/topics?courseId=${courseId}&fileIndex=${fileIndex}`);
      const data = await res.json();
      if (res.ok) setExistingTopics((data.topics || []).map((t) => t.name));
    } catch (err) {
      console.error(err);
    }
  };

  const poll = async (jobId) => {
    try {
      const res = await authedFetch(`/api/progress/admin/extract-pyqs/${jobId}/status`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch extraction status');
      setJob(data);

      if (data.status === 'done') {
        stopPolling();
        await fetchExistingTopics();
        setReviewRows((data.extractedPyqs || []).map((q) => ({
          pageNumber: q.pageNumber,
          year: q.year,
          questionText: q.questionText,
          tag: q.suggestedTag || '',
          discarded: false
        })));
      } else if (data.status === 'error') {
        stopPolling();
      }
    } catch (err) {
      console.error(err);
      stopPolling();
      setError(err.message || 'Failed to fetch extraction status.');
    }
  };

  const handleStart = async (e) => {
    e.preventDefault();
    if (!courseId || !pdfFile) {
      setError('Please select a course and a source PDF.');
      return;
    }
    setStarting(true);
    setError('');
    setSaveSummary(null);
    setReviewRows([]);

    const formData = new FormData();
    formData.append('courseId', courseId);
    formData.append('fileIndex', String(fileIndex));
    formData.append('pdf', pdfFile);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/progress/admin/extract-pyqs/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start extraction');
      setJob({ status: 'pending' });
      pollRef.current = setInterval(() => poll(data.jobId), 2500);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to start extraction.');
    } finally {
      setStarting(false);
    }
  };

  const handleStartOver = () => {
    stopPolling();
    setJob(null);
    setReviewRows([]);
    setError('');
    setPdfFile(null);
  };

  const updateRow = (idx, updates) => {
    setReviewRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...updates } : r)));
  };

  const applyBulkTag = () => {
    if (!bulkTag) return;
    setReviewRows((prev) => prev.map((r) =>
      (!r.tag && !r.discarded) ? { ...r, tag: bulkTag } : r
    ));
  };

  const handleSave = async () => {
    const activeRows = reviewRows.filter((r) => !r.discarded);
    if (activeRows.length === 0) {
      setError('No PYQs to save (all rows discarded).');
      return;
    }
    if (activeRows.some((r) => !r.tag)) {
      setError('Every row needs a tag assigned before saving.');
      return;
    }
    if (activeRows.some((r) => !r.questionText.trim())) {
      setError('Every row needs non-empty question text.');
      return;
    }
    if (activeRows.some((r) => !Number.isFinite(Number(r.year)) || Number(r.year) < 2001 || Number(r.year) > 2025)) {
      setError('Every row needs a year between 2001 and 2025.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const pyqsPayload = activeRows.map((r) => ({
        year: Number(r.year),
        questionText: r.questionText.trim(),
        pageNumber: r.pageNumber,
        section: r.tag
      }));
      const res = await authedFetch('/api/progress/admin/pyqs/bulk-create', {
        method: 'POST',
        body: JSON.stringify({ courseId, fileIndex, pyqs: pyqsPayload })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save PYQs');
      setSaveSummary(data);
      setReviewRows([]);
      setJob(null);
      await refreshExistingPyqs();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to save PYQs.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePyq = async (id) => {
    await authedFetch(`/api/progress/admin/pyqs/${id}`, { method: 'DELETE' });
    await refreshExistingPyqs();
  };

  const activeCount = reviewRows.filter((r) => !r.discarded).length;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-extrabold text-slate-100 mb-1">Extract PYQs from PDF</h2>
        <p className="text-xs text-slate-400 mb-5">
          Only courses/files that already have Topics & Questions uploaded are selectable below (their topics become the tag vocabulary for extracted PYQs). Upload a compiled "Previous Year Questions" PDF spanning many exam years — Gemini extracts every distinct question, keeps only years 2001-2025, and suggests a tag from the course's existing topics. Nothing is saved until you review and confirm below. Saving is additive — it never deletes existing PYQs for this course/file.
        </p>

        {!job && (
          <form onSubmit={handleStart} className="space-y-4">
            <CourseFileSelect
              courses={enabledCourses}
              loadingCourses={loadingEnabledCourses}
              courseId={courseId}
              setCourseId={setCourseId}
              fileIndex={fileIndex}
              setFileIndex={setFileIndex}
              allowedFileIndexes={selectedCourse?.progressFileIndexes}
            />
            {!loadingEnabledCourses && enabledCourses.length === 0 && (
              <p className="text-xs text-amber-400 font-semibold">No courses have Topics/Questions uploaded yet. Use "Upload Topic/Question CSV" or "Extract Questions from PDF" first.</p>
            )}
            <div>
              <label className={labelClass}>Source PDF (PYQ compilation)</label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-accent-600 file:text-white file:text-xs file:font-bold file:cursor-pointer"
              />
            </div>
            {error && <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-xl text-rose-400 text-xs font-semibold">{error}</div>}
            <button
              type="submit"
              disabled={starting || !courseId}
              className="px-5 py-2.5 bg-accent-600 hover:bg-accent-500 disabled:bg-accent-900 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
            >
              {starting ? 'Starting...' : 'Start Extraction'}
            </button>
          </form>
        )}

        {job && job.status !== 'done' && (
          <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl space-y-2">
            {job.status === 'pending' && <p className="text-xs text-slate-300 font-semibold">Starting extraction...</p>}
            {job.status === 'extracting_pyqs' && (
              <div className="space-y-1.5">
                <p className="text-xs text-slate-300 font-semibold">
                  Processing chunk {job.chunksCompleted + job.chunksFailed + 1} of {job.totalChunks} ({job.currentChunkRange})...
                </p>
                <p className="text-[11px] text-accent-400 font-bold">PYQs found so far: {job.pyqsFoundSoFar}</p>
                {job.chunksFailed > 0 && (
                  <p className="text-[11px] text-rose-400 font-bold">{job.chunksFailed} chunk(s) failed so far: {(job.failedChunkRanges || []).join(', ')}</p>
                )}
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800 mt-2">
                  <div
                    className="bg-accent-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, ((job.chunksCompleted + job.chunksFailed) / Math.max(job.totalChunks, 1)) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            {job.status === 'error' && (
              <div className="space-y-2">
                <p className="text-xs text-rose-400 font-semibold">{job.error || 'Extraction failed.'}</p>
                <button onClick={handleStartOver} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold cursor-pointer">Start Over</button>
              </div>
            )}
          </div>
        )}

        <UploadSummary summary={saveSummary} />
      </div>

      {job && job.status === 'done' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-sm font-extrabold text-slate-100">Review Extracted PYQs ({reviewRows.length})</h2>
            <button onClick={handleStartOver} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer">Start New Extraction</button>
          </div>

          {job.chunksFailed > 0 && (
            <div className="p-3 bg-amber-950/20 border border-amber-900/40 rounded-xl text-amber-400 text-xs font-semibold">
              {job.chunksFailed} of {job.totalChunks} chunk(s) failed and were NOT analyzed: {(job.failedChunkRanges || []).join(', ')}. The results below are incomplete for those page ranges — fix the underlying issue (often API quota) and re-run extraction once resolved.
            </div>
          )}

          {reviewRows.length === 0 ? (
            <p className="text-xs text-slate-500">No PYQs (within 2001-2025) were extracted from this PDF.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap p-3 bg-slate-950/40 border border-slate-800 rounded-xl">
                <span className="text-[11px] text-slate-400 font-semibold">Assign all unassigned rows to:</span>
                <select value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                  <option value="">Select tag...</option>
                  {existingTopics.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button onClick={applyBulkTag} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold cursor-pointer">Apply</button>
              </div>

              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden max-h-[32rem] overflow-y-auto">
                {reviewRows.map((row, idx) => (
                  <div key={idx} className={`px-4 py-3 flex flex-col md:flex-row gap-2 md:items-start ${row.discarded ? 'opacity-40' : ''}`}>
                    <span className="text-[11px] text-slate-500 font-bold w-14 shrink-0 pt-1.5">Pg. {row.pageNumber}</span>
                    <input
                      type="number"
                      value={row.year}
                      onChange={(e) => updateRow(idx, { year: e.target.value })}
                      disabled={row.discarded}
                      className="w-full md:w-20 bg-slate-950 border border-slate-800 focus:border-accent-500 text-slate-200 rounded-lg px-3 py-1.5 text-xs shrink-0"
                    />
                    <textarea
                      value={row.questionText}
                      onChange={(e) => updateRow(idx, { questionText: e.target.value })}
                      disabled={row.discarded}
                      rows={2}
                      className="flex-1 bg-slate-950 border border-slate-800 focus:border-accent-500 text-slate-200 rounded-lg px-3 py-1.5 text-xs resize-none"
                    />
                    <select
                      value={row.tag}
                      onChange={(e) => updateRow(idx, { tag: e.target.value })}
                      disabled={row.discarded}
                      className="w-full md:w-44 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-1.5 text-xs shrink-0"
                    >
                      <option value="">Unclassified</option>
                      {existingTopics.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold shrink-0 pt-2 cursor-pointer">
                      <input type="checkbox" checked={row.discarded} onChange={(e) => updateRow(idx, { discarded: e.target.checked })} />
                      Discard
                    </label>
                  </div>
                ))}
              </div>

              {error && <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-xl text-rose-400 text-xs font-semibold">{error}</div>}

              <button
                onClick={handleSave}
                disabled={saving || activeCount === 0}
                className="px-5 py-2.5 bg-accent-600 hover:bg-accent-500 disabled:bg-accent-900 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                {saving ? 'Saving...' : `Save ${activeCount} PYQ${activeCount === 1 ? '' : 's'}`}
              </button>
            </>
          )}
        </div>
      )}

      {courseId && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-100 mb-4">Existing PYQs for this Course/File</h2>
          {loadingExistingPyqs ? (
            <p className="text-xs text-slate-500">Loading...</p>
          ) : existingPyqs.length === 0 ? (
            <p className="text-xs text-slate-500">No PYQs yet.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {existingPyqs.map((p) => (
                <div key={p._id} className="flex items-center justify-between gap-3 p-3 bg-slate-950/40 border border-slate-800 rounded-xl">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-200 truncate">{p.questionText}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{p.section} · {p.year}</p>
                  </div>
                  <button onClick={() => handleDeletePyq(p._id)} className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/50 text-rose-400 border border-rose-900/40 rounded-lg text-[10px] font-bold cursor-pointer flex-shrink-0">Delete</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminProgressData() {
  const [activeSubTab, setActiveSubTab] = useState('upload');
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await fetch('/api/courses/list');
        const data = await res.json();
        if (res.ok) setCourses(data.courses || []);
      } catch (err) {
        console.error('Error fetching courses:', err);
      } finally {
        setLoadingCourses(false);
      }
    };
    fetchCourses();
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-10 md:py-14">
      <div className="mb-8 border-b border-slate-800 pb-5">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-100 tracking-tight">Progress Data</h1>
        <p className="text-slate-400 text-sm mt-1.5 font-medium">Manage per-PDF topics/questions and the PYQ bank used by the student Progress checklist.</p>
      </div>

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setActiveSubTab('upload')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeSubTab === 'upload' ? 'bg-accent-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
        >
          Upload Topic/Question CSV
        </button>
        <button
          onClick={() => setActiveSubTab('manage')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeSubTab === 'manage' ? 'bg-accent-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
        >
          Manage Topics & Questions
        </button>
        <button
          onClick={() => setActiveSubTab('pyqs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeSubTab === 'pyqs' ? 'bg-accent-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
        >
          Extract PYQs from PDF
        </button>
        <button
          onClick={() => setActiveSubTab('extract')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeSubTab === 'extract' ? 'bg-accent-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
        >
          Extract Questions from PDF
        </button>
      </div>

      {activeSubTab === 'upload' && <UploadTopicQuestionsTab courses={courses} loadingCourses={loadingCourses} />}
      {activeSubTab === 'manage' && <ManageTopicsTab courses={courses} loadingCourses={loadingCourses} />}
      {activeSubTab === 'pyqs' && <ExtractPyqsTab />}
      {activeSubTab === 'extract' && <ExtractQuestionsTab courses={courses} loadingCourses={loadingCourses} />}
    </div>
  );
}
