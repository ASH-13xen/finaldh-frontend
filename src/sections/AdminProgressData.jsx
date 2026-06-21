import { useState, useEffect } from 'react';

const SUBJECT_NAMES = {
  'GS-1': 'GS-1: Culture, History, Geography, Society',
  'GS-2': 'GS-2: Governance, Constitution, Polity, Social Justice',
  'GS-3': 'GS-3: Science & Tech, Economic Dev, Bio-diversity, Security',
  'GS-4': 'GS-4: Ethics, Integrity & Aptitude',
};

const OPTIONAL_NAMES = {
  OptionalSubjectAgriculture: 'Optional: Agriculture',
  OptionalSubjectAnimalHusbandryAndVeterinaryScience: 'Optional: Animal Husbandry & Veterinary Science',
  OptionalSubjectAnthropology: 'Optional: Anthropology',
  OptionalSubjectBotany: 'Optional: Botany',
  OptionalSubjectChemistry: 'Optional: Chemistry',
  OptionalSubjectCivilEngineering: 'Optional: Civil Engineering',
  OptionalSubjectCommerceAndAccountancy: 'Optional: Commerce & Accountancy',
  OptionalSubjectEconomics: 'Optional: Economics',
  OptionalSubjectElectricalEngineering: 'Optional: Electrical Engineering',
  OptionalSubjectGeography: 'Optional: Geography',
  OptionalSubjectGeology: 'Optional: Geology',
  OptionalSubjectHistory: 'Optional: History',
  OptionalSubjectLaw: 'Optional: Law',
  OptionalSubjectMangement: 'Optional: Management',
  OptionalSubjectMathematics: 'Optional: Mathematics',
  OptionalSubjectMechanicalEngineering: 'Optional: Mechanical Engineering',
  OptionalSubjectMedicalScience: 'Optional: Medical Science',
  OptionalSubjectPhilosophy: 'Optional: Philosophy',
  OptionalSubjectPhysics: 'Optional: Physics',
  OptionalSubjectPoliticalScienceAndInternationalRelations: 'Optional: Political Science & International Relations',
  OptionalSubjectPsychology: 'Optional: Psychology',
  OptionalSubjectPublicAdministration: 'Optional: Public Administration',
  OptionalSubjectSociology: 'Optional: Sociology',
  OptionalSubjectStatistics: 'Optional: Statistics',
  OptionalSubjectZoology: 'Optional: Zoology'
};

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

function CourseFileSelect({ courses, loadingCourses, courseId, setCourseId, fileIndex, setFileIndex }) {
  const selectedCourse = courses.find(c => c._id === courseId);
  const fileEntries = selectedCourse ? getFileEntries(selectedCourse) : [];
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
      {fileEntries.length > 1 && (
        <div>
          <label className={labelClass}>PDF File</label>
          <select value={fileIndex} onChange={(e) => setFileIndex(Number(e.target.value))} className={inputClass}>
            {fileEntries.map((f) => <option key={f.index} value={f.index}>{f.name}</option>)}
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

function UploadPyqsTab() {
  const [subject, setSubject] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const [pyqs, setPyqs] = useState([]);
  const [loadingPyqs, setLoadingPyqs] = useState(false);

  const refreshPyqs = async (subj) => {
    if (!subj) { setPyqs([]); return; }
    setLoadingPyqs(true);
    try {
      const res = await authedFetch(`/api/progress/admin/pyqs?subject=${encodeURIComponent(subj)}`);
      const data = await res.json();
      if (res.ok) setPyqs(data.pyqs || []);
    } finally {
      setLoadingPyqs(false);
    }
  };

  useEffect(() => { refreshPyqs(subject); }, [subject]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject || !file) {
      setError('Please select a subject and a CSV file.');
      return;
    }
    setUploading(true);
    setError('');
    setSummary(null);

    const formData = new FormData();
    formData.append('subject', subject);
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/progress/admin/pyqs/upload-csv', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setSummary(data);
      setFile(null);
      await refreshPyqs(subject);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to upload CSV.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePyq = async (id) => {
    await authedFetch(`/api/progress/admin/pyqs/${id}`, { method: 'DELETE' });
    await refreshPyqs(subject);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-extrabold text-slate-100 mb-1">Upload PYQs (CSV)</h2>
        <p className="text-xs text-slate-400 mb-1">
          CSV columns required: <span className="font-bold text-slate-300">question text</span>, <span className="font-bold text-slate-300">section</span>, <span className="font-bold text-slate-300">year</span>.
        </p>
        <p className="text-[11px] text-amber-400 font-semibold mb-5">Uploading replaces all existing PYQs for the selected subject.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Subject</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass}>
              <option value="">Select subject...</option>
              <optgroup label="General Studies Modules">
                {Object.entries(SUBJECT_NAMES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </optgroup>
              <optgroup label="Optional Subjects">
                {Object.entries(OPTIONAL_NAMES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </optgroup>
            </select>
          </div>

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

      {subject && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-100 mb-4">Existing PYQs for {OPTIONAL_NAMES[subject] || SUBJECT_NAMES[subject] || subject}</h2>
          {loadingPyqs ? (
            <p className="text-xs text-slate-500">Loading...</p>
          ) : pyqs.length === 0 ? (
            <p className="text-xs text-slate-500">No PYQs yet.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {pyqs.map((p) => (
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
          Upload PYQs CSV
        </button>
      </div>

      {activeSubTab === 'upload' && <UploadTopicQuestionsTab courses={courses} loadingCourses={loadingCourses} />}
      {activeSubTab === 'manage' && <ManageTopicsTab courses={courses} loadingCourses={loadingCourses} />}
      {activeSubTab === 'pyqs' && <UploadPyqsTab />}
    </div>
  );
}
