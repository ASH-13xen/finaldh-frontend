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

function UploadSummary({ summary }) {
  if (!summary) return null;
  return (
    <div className="mt-5 space-y-3">
      <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-xl text-emerald-400 text-xs font-semibold">
        {summary.message}
      </div>
      {summary.skippedRows?.length > 0 && (
        <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-xl text-rose-400 text-xs space-y-1">
          <p className="font-bold uppercase text-[10px] tracking-wide">Skipped Rows ({summary.skippedRows.length})</p>
          <ul className="space-y-0.5 max-h-32 overflow-y-auto">
            {summary.skippedRows.map((s, idx) => (
              <li key={idx}>Row {s.row}: {s.reason}</li>
            ))}
          </ul>
        </div>
      )}
      {summary.unmatchedTags?.length > 0 && (
        <div className="p-3 bg-amber-950/20 border border-amber-900/40 rounded-xl text-amber-400 text-xs space-y-1">
          <p className="font-bold uppercase text-[10px] tracking-wide">Unmatched Tags ({summary.unmatchedTags.length})</p>
          <p className="text-[11px] text-amber-300/80">These tags didn't match any syllabus topic/section and were stored under "General". Fix spelling in the CSV and re-upload if needed.</p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {summary.unmatchedTags.map((t, idx) => (
              <span key={idx} className="bg-slate-900 border border-amber-800/40 rounded px-1.5 py-0.5">{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ManageTestsTab({ tests, loadingTests, refreshTests }) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [marksPerQuestion, setMarksPerQuestion] = useState('2');
  const [negativeMarkingRatio, setNegativeMarkingRatio] = useState('0.33');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !subject || !durationMinutes) {
      setError('Title, subject and duration are required.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/mcq/admin/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title,
          subject,
          description,
          durationMinutes: Number(durationMinutes),
          marksPerQuestion: Number(marksPerQuestion),
          negativeMarkingRatio: Number(negativeMarkingRatio)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create test');
      setSuccessMsg(`Test "${data.test.title}" created. Go to "Upload Questions" to add questions.`);
      setTitle('');
      setDescription('');
      await refreshTests();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create test.');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (test) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/mcq/admin/tests/${test._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isPublished: !test.isPublished })
      });
      await refreshTests();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (test) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/mcq/admin/tests/${test._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete test');
      await refreshTests();
    } catch (err) {
      alert(err.message || 'Failed to delete test.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-extrabold text-slate-100 mb-1">Create New Test</h2>
        <p className="text-xs text-slate-400 mb-5">Set up the test's metadata here, then upload its questions in the "Upload Questions" tab.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sociology Mock Test 1"
                className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-accent-500 text-slate-100 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-accent-500 text-slate-100 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all"
              >
                <option value="">Select subject...</option>
                <optgroup label="General Studies Modules">
                  {Object.entries(SUBJECT_NAMES).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </optgroup>
                <optgroup label="Optional Subjects">
                  {Object.entries(OPTIONAL_NAMES).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-accent-500 text-slate-100 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Duration (minutes)</label>
              <input
                type="number"
                min="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-accent-500 text-slate-100 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Marks per Question</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={marksPerQuestion}
                onChange={(e) => setMarksPerQuestion(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-accent-500 text-slate-100 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Negative Marking Ratio</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={negativeMarkingRatio}
                onChange={(e) => setNegativeMarkingRatio(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-accent-500 text-slate-100 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all"
              />
              <p className="text-[10px] text-slate-500 mt-1">0 disables negative marking. UPSC standard is 0.33.</p>
            </div>
          </div>

          {error && <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-xl text-rose-400 text-xs font-semibold">{error}</div>}
          {successMsg && <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-xl text-emerald-400 text-xs font-semibold">{successMsg}</div>}

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-accent-600 hover:bg-accent-500 disabled:bg-accent-900 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            {saving ? 'Creating...' : 'Create Test'}
          </button>
        </form>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-extrabold text-slate-100 mb-4">Existing Tests</h2>
        {loadingTests ? (
          <p className="text-xs text-slate-500">Loading...</p>
        ) : tests.length === 0 ? (
          <p className="text-xs text-slate-500">No tests created yet.</p>
        ) : (
          <div className="space-y-2">
            {tests.map((t) => (
              <div key={t._id} className="flex items-center justify-between gap-3 p-3 bg-slate-950/40 border border-slate-800 rounded-xl">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-100 truncate">{t.title}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{t.subject} · {t.questionCount} question(s) · {t.totalMarks} marks · {t.durationMinutes} min</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${t.isPublished ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                    {t.isPublished ? 'Published' : 'Unpublished'}
                  </span>
                  <button onClick={() => togglePublish(t)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer">
                    {t.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                  <button onClick={() => handleDelete(t)} className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/50 text-rose-400 border border-rose-900/40 rounded-lg text-[10px] font-bold cursor-pointer">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UploadQuestionsTab({ tests, loadingTests }) {
  const [testId, setTestId] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!testId || !file) {
      setError('Please select a test and a CSV file.');
      return;
    }

    setUploading(true);
    setError('');
    setSummary(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/mcq/admin/tests/${testId}/questions/upload-csv`, {
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
      setError(err.message || 'Failed to upload question CSV.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
      <h2 className="text-sm font-extrabold text-slate-100 mb-1">Upload Questions (CSV)</h2>
      <p className="text-xs text-slate-400 mb-1">
        CSV columns required: <span className="font-bold text-slate-300">order</span>, <span className="font-bold text-slate-300">question text</span>, <span className="font-bold text-slate-300">option a-d</span>, <span className="font-bold text-slate-300">correct option</span> (A-D). Optional: <span className="font-bold text-slate-300">explanation</span>, <span className="font-bold text-slate-300">difficulty</span> (Easy/Medium/Hard), <span className="font-bold text-slate-300">marks</span>, <span className="font-bold text-slate-300">tags</span> (syllabus section/topic names, semicolon-separated).
      </p>
      <p className="text-[11px] text-amber-400 font-semibold mb-5">Uploading replaces all existing questions for the selected test.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Test</label>
          <select
            value={testId}
            onChange={(e) => setTestId(e.target.value)}
            disabled={loadingTests}
            className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-accent-500 text-slate-100 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all"
          >
            <option value="">{loadingTests ? 'Loading tests...' : 'Select test...'}</option>
            {tests.map((t) => (
              <option key={t._id} value={t._id}>{t.title} ({t.subject})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">CSV File</label>
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
          {uploading ? 'Uploading...' : 'Upload Questions'}
        </button>
      </form>

      <UploadSummary summary={summary} />
    </div>
  );
}

export default function AdminMcqData() {
  const [activeSubTab, setActiveSubTab] = useState('manage');
  const [tests, setTests] = useState([]);
  const [loadingTests, setLoadingTests] = useState(true);

  const refreshTests = async () => {
    setLoadingTests(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/mcq/admin/tests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTests(data.tests || []);
      }
    } catch (err) {
      console.error('Error fetching MCQ tests:', err);
    } finally {
      setLoadingTests(false);
    }
  };

  useEffect(() => {
    refreshTests();
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-10 md:py-14">
      <div className="mb-8 border-b border-slate-800 pb-5">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-100 tracking-tight">MCQ Test Data</h1>
        <p className="text-slate-400 text-sm mt-1.5 font-medium">Create MCQ tests and bulk-upload their questions via CSV.</p>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setActiveSubTab('manage')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeSubTab === 'manage' ? 'bg-accent-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
        >
          Create / Manage Tests
        </button>
        <button
          onClick={() => setActiveSubTab('upload')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeSubTab === 'upload' ? 'bg-accent-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
        >
          Upload Questions
        </button>
      </div>

      {activeSubTab === 'manage' ? (
        <ManageTestsTab tests={tests} loadingTests={loadingTests} refreshTests={refreshTests} />
      ) : (
        <UploadQuestionsTab tests={tests} loadingTests={loadingTests} />
      )}
    </div>
  );
}
