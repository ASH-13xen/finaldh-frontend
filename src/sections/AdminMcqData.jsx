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
      <div className="p-3 bg-status-success-bg border border-status-success-text/30 rounded-xl text-status-success-text text-xs font-semibold">
        {summary.message}
      </div>
      {summary.skippedRows?.length > 0 && (
        <div className="p-3 bg-status-danger-bg border border-status-danger-text/30 rounded-xl text-status-danger-text text-xs space-y-1">
          <p className="font-bold uppercase text-[10px] tracking-wide">Skipped Rows ({summary.skippedRows.length})</p>
          <ul className="space-y-0.5 max-h-32 overflow-y-auto">
            {summary.skippedRows.map((s, idx) => (
              <li key={idx}>Row {s.row}: {s.reason}</li>
            ))}
          </ul>
        </div>
      )}
      {summary.unmatchedTags?.length > 0 && (
        <div className="p-3 bg-status-warning-bg border border-status-warning-text/30 rounded-xl text-status-warning-text text-xs space-y-1">
          <p className="font-bold uppercase text-[10px] tracking-wide">Unmatched Tags ({summary.unmatchedTags.length})</p>
          <p className="text-[11px] opacity-80">These tags didn't match any syllabus topic/section and were stored under "General". Fix spelling in the CSV and re-upload if needed.</p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {summary.unmatchedTags.map((t, idx) => (
              <span key={idx} className="bg-surface border border-status-warning-text/30 rounded px-1.5 py-0.5">{t}</span>
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
  const [requiresPurchase, setRequiresPurchase] = useState(false);
  const [price, setPrice] = useState('499');
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
          negativeMarkingRatio: Number(negativeMarkingRatio),
          requiresPurchase,
          price: Number(price)
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

  const togglePurchaseRequired = async (test) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/mcq/admin/tests/${test._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requiresPurchase: !test.requiresPurchase, price: test.price || 499 })
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
      <div className="bg-surface border border-border-default rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-extrabold text-text-primary mb-1">Create New Test</h2>
        <p className="text-xs text-text-tertiary mb-5">Set up the test's metadata here, then upload its questions in the "Upload Questions" tab.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sociology Mock Test 1"
                className="w-full bg-sunken border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-xl px-4 py-2.5 text-xs font-semibold transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-sunken border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-xl px-4 py-2.5 text-xs font-semibold transition-all"
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
            <label className="block text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-sunken border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-xl px-4 py-2.5 text-xs font-semibold transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2">Duration (minutes)</label>
              <input
                type="number"
                min="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full bg-sunken border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-xl px-4 py-2.5 text-xs font-semibold transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2">Marks per Question</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={marksPerQuestion}
                onChange={(e) => setMarksPerQuestion(e.target.value)}
                className="w-full bg-sunken border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-xl px-4 py-2.5 text-xs font-semibold transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2">Negative Marking Ratio</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={negativeMarkingRatio}
                onChange={(e) => setNegativeMarkingRatio(e.target.value)}
                className="w-full bg-sunken border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-xl px-4 py-2.5 text-xs font-semibold transition-all"
              />
              <p className="text-[10px] text-text-tertiary mt-1">0 disables negative marking. UPSC standard is 0.33.</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-3.5 bg-sunken border border-border-subtle rounded-xl">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={requiresPurchase} onChange={(e) => setRequiresPurchase(e.target.checked)} className="w-4 h-4 accent-brand cursor-pointer" />
              <span className="text-xs font-bold text-text-secondary">Requires purchase</span>
            </label>
            {requiresPurchase && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-tertiary">₹</span>
                <input
                  type="number"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-24 bg-page border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                />
              </div>
            )}
          </div>

          {error && <div className="p-3 bg-status-danger-bg border border-status-danger-text/30 rounded-xl text-status-danger-text text-xs font-semibold">{error}</div>}
          {successMsg && <div className="p-3 bg-status-success-bg border border-status-success-text/30 rounded-xl text-status-success-text text-xs font-semibold">{successMsg}</div>}

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-brand hover:bg-brand-hover disabled:opacity-50 text-text-on-accent rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            {saving ? 'Creating...' : 'Create Test'}
          </button>
        </form>
      </div>

      <div className="bg-surface border border-border-default rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-extrabold text-text-primary mb-4">Existing Tests</h2>
        {loadingTests ? (
          <p className="text-xs text-text-tertiary">Loading...</p>
        ) : tests.length === 0 ? (
          <p className="text-xs text-text-tertiary">No tests created yet.</p>
        ) : (
          <div className="space-y-2">
            {tests.map((t) => (
              <div key={t._id} className="flex items-center justify-between gap-3 p-3 bg-sunken border border-border-default rounded-xl">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-text-primary truncate">{t.title}</p>
                  <p className="text-[10px] text-text-tertiary mt-0.5">{t.subject} · {t.questionCount} question(s) · {t.totalMarks} marks · {t.durationMinutes} min</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${t.isPublished ? 'bg-status-success-bg text-status-success-text border border-status-success-text/30' : 'bg-surface-raised text-text-tertiary border border-border-default'}`}>
                    {t.isPublished ? 'Published' : 'Unpublished'}
                  </span>
                  <button
                    onClick={() => togglePurchaseRequired(t)}
                    className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border cursor-pointer ${t.requiresPurchase ? 'bg-status-warning-bg text-status-warning-text border-status-warning-text/30' : 'bg-surface-raised text-text-tertiary border-border-default'}`}
                    title={t.requiresPurchase ? 'Purchase price is set at the subject level in the "Subject Pricing" tab' : 'This test is free regardless of subject pricing'}
                  >
                    {t.requiresPurchase ? '🔒 Locked' : 'Free'}
                  </button>
                  <button onClick={() => togglePublish(t)} className="px-2.5 py-1 bg-surface-raised hover:bg-sunken text-text-secondary rounded-lg text-[10px] font-bold cursor-pointer">
                    {t.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                  <button onClick={() => handleDelete(t)} className="px-2.5 py-1 bg-status-danger-bg hover:opacity-90 text-status-danger-text border border-status-danger-text/30 rounded-lg text-[10px] font-bold cursor-pointer">
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
    <div className="bg-surface border border-border-default rounded-2xl p-6 shadow-sm">
      <h2 className="text-sm font-extrabold text-text-primary mb-1">Upload Questions (CSV)</h2>
      <p className="text-xs text-text-tertiary mb-1">
        CSV columns required: <span className="font-bold text-text-secondary">order</span>, <span className="font-bold text-text-secondary">question text</span>, <span className="font-bold text-text-secondary">option a-d</span>, <span className="font-bold text-text-secondary">correct option</span> (A-D). Optional: <span className="font-bold text-text-secondary">explanation</span>, <span className="font-bold text-text-secondary">difficulty</span> (Easy/Medium/Hard), <span className="font-bold text-text-secondary">marks</span>, <span className="font-bold text-text-secondary">tags</span> (syllabus section/topic names, semicolon-separated).
      </p>
      <p className="text-[11px] text-status-warning-text font-semibold mb-5">Uploading replaces all existing questions for the selected test.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2">Test</label>
          <select
            value={testId}
            onChange={(e) => setTestId(e.target.value)}
            disabled={loadingTests}
            className="w-full bg-sunken border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-xl px-4 py-2.5 text-xs font-semibold transition-all"
          >
            <option value="">{loadingTests ? 'Loading tests...' : 'Select test...'}</option>
            {tests.map((t) => (
              <option key={t._id} value={t._id}>{t.title} ({t.subject})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2">CSV File</label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-xs text-text-secondary bg-sunken border border-border-default rounded-xl px-4 py-2.5 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-brand file:text-text-on-accent file:text-xs file:font-bold file:cursor-pointer"
          />
        </div>

        {error && <div className="p-3 bg-status-danger-bg border border-status-danger-text/30 rounded-xl text-status-danger-text text-xs font-semibold">{error}</div>}

        <button
          type="submit"
          disabled={uploading}
          className="px-5 py-2.5 bg-brand hover:bg-brand-hover disabled:opacity-50 text-text-on-accent rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
        >
          {uploading ? 'Uploading...' : 'Upload Questions'}
        </button>
      </form>

      <UploadSummary summary={summary} />
    </div>
  );
}

function BuildQuestionsTab({ tests, loadingTests, refreshTests }) {
  const [testId, setTestId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');

  const [questionText, setQuestionText] = useState('');
  const [optionTexts, setOptionTexts] = useState(['', '', '', '']);
  const [correctOption, setCorrectOption] = useState('A');
  const [difficulty, setDifficulty] = useState('Medium');
  const [marks, setMarks] = useState('');
  const [explanation, setExplanation] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const selectedTest = tests.find((t) => t._id === testId);

  const loadQuestions = async (id) => {
    setLoadingQuestions(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/mcq/admin/tests/${id}/questions`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setQuestions(data.questions || []);
    } catch (err) {
      console.error('Error loading questions:', err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  useEffect(() => {
    if (testId) loadQuestions(testId);
    else setQuestions([]);
    setPublishError('');
  }, [testId]);

  const resetForm = () => {
    setQuestionText('');
    setOptionTexts(['', '', '', '']);
    setCorrectOption('A');
    setDifficulty('Medium');
    setMarks('');
    setExplanation('');
    setTags('');
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!questionText.trim()) { setFormError('Question text is required.'); return; }
    if (optionTexts.some((t) => !t.trim())) { setFormError('All 4 options are required.'); return; }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/mcq/admin/tests/${testId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          questionText: questionText.trim(),
          options: ['A', 'B', 'C', 'D'].map((label, i) => ({ label, text: optionTexts[i].trim() })),
          correctOption,
          difficulty,
          marks: marks === '' ? null : Number(marks),
          explanation: explanation.trim(),
          tags
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add question');
      setQuestions((prev) => [...prev, data.question]);
      resetForm();
      await refreshTests();
    } catch (err) {
      setFormError(err.message || 'Failed to add question.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/mcq/admin/tests/${testId}/questions/${questionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      await loadQuestions(testId);
      await refreshTests();
    } catch (err) {
      alert('Failed to delete question.');
    }
  };

  const handlePublishToggle = async () => {
    setPublishing(true);
    setPublishError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/mcq/admin/tests/${testId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isPublished: !selectedTest.isPublished })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update publish status');
      await refreshTests();
    } catch (err) {
      setPublishError(err.message || 'Failed to update publish status.');
    } finally {
      setPublishing(false);
    }
  };

  const totalMarksSoFar = questions.reduce((sum, q) => sum + (q.marks ?? (selectedTest?.marksPerQuestion || 0)), 0);

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border-default rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-extrabold text-text-primary mb-1">Build a Test</h2>
        <p className="text-xs text-text-tertiary mb-4">
          Pick a test and add its questions one at a time. Nothing here is visible to students until you publish — come back anytime to keep adding questions to a draft.
        </p>
        <select
          value={testId}
          onChange={(e) => setTestId(e.target.value)}
          disabled={loadingTests}
          className="w-full bg-sunken border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-xl px-4 py-2.5 text-xs font-semibold transition-all"
        >
          <option value="">{loadingTests ? 'Loading tests...' : 'Select a test to build...'}</option>
          {tests.map((t) => (
            <option key={t._id} value={t._id}>{t.title} ({t.subject}) {t.isPublished ? '' : '— Draft'} · {t.questionCount} Qs</option>
          ))}
        </select>
      </div>

      {selectedTest && (
        <>
          <div className="bg-surface border border-border-default rounded-2xl p-6 shadow-sm flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-bold text-text-primary">{selectedTest.title}</p>
              <p className="text-[11px] text-text-tertiary mt-0.5">{questions.length} question(s) added · {totalMarksSoFar} marks</p>
            </div>
            <div className="flex items-center gap-2">
              {publishError && <span className="text-[11px] text-status-danger-text font-semibold">{publishError}</span>}
              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${selectedTest.isPublished ? 'bg-status-success-bg text-status-success-text border border-status-success-text/30' : 'bg-surface-raised text-text-tertiary border border-border-default'}`}>
                {selectedTest.isPublished ? 'Published' : 'Draft'}
              </span>
              <button onClick={handlePublishToggle} disabled={publishing} className="px-4 py-1.5 bg-brand hover:bg-brand-hover disabled:opacity-50 text-text-on-accent rounded-xl text-xs font-bold cursor-pointer">
                {publishing ? 'Saving...' : selectedTest.isPublished ? 'Unpublish' : 'Publish Test'}
              </button>
            </div>
          </div>

          <div className="bg-surface border border-border-default rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-extrabold text-text-primary mb-4">Add a Question</h3>
            <form onSubmit={handleAddQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2">Question</label>
                <textarea
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  rows={2}
                  placeholder="Type the question..."
                  className="w-full bg-sunken border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-xl px-4 py-2.5 text-xs font-semibold transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {['A', 'B', 'C', 'D'].map((label, i) => (
                  <div key={label} className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer">
                      <input type="radio" name="correctOption" checked={correctOption === label} onChange={() => setCorrectOption(label)} className="w-4 h-4 accent-brand cursor-pointer" />
                      <span className="text-xs font-bold text-text-tertiary w-4">{label}</span>
                    </label>
                    <input
                      type="text"
                      value={optionTexts[i]}
                      onChange={(e) => setOptionTexts((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                      placeholder={`Option ${label}`}
                      className="flex-1 bg-sunken border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-xl px-3 py-2 text-xs font-semibold transition-all"
                    />
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-text-tertiary -mt-2">Select the radio button next to the correct option.</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2">Difficulty</label>
                  <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full bg-sunken border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-xl px-3 py-2 text-xs font-semibold transition-all">
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2">Marks (optional override)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={marks}
                    onChange={(e) => setMarks(e.target.value)}
                    placeholder={`Default: ${selectedTest.marksPerQuestion}`}
                    className="w-full bg-sunken border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-xl px-3 py-2 text-xs font-semibold transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2">Tags (optional)</label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="Topic1; Topic2"
                    className="w-full bg-sunken border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-xl px-3 py-2 text-xs font-semibold transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-tertiary uppercase tracking-wider mb-2">Explanation (optional)</label>
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  rows={2}
                  className="w-full bg-sunken border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-xl px-4 py-2.5 text-xs font-semibold transition-all"
                />
              </div>

              {formError && <div className="p-3 bg-status-danger-bg border border-status-danger-text/30 rounded-xl text-status-danger-text text-xs font-semibold">{formError}</div>}

              <button type="submit" disabled={saving} className="px-5 py-2.5 bg-brand hover:bg-brand-hover disabled:opacity-50 text-text-on-accent rounded-xl text-xs font-bold transition shadow-sm cursor-pointer">
                {saving ? 'Adding...' : 'Add Question'}
              </button>
            </form>
          </div>

          <div className="bg-surface border border-border-default rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-extrabold text-text-primary mb-4">Questions in this Test ({questions.length})</h3>
            {loadingQuestions ? (
              <p className="text-xs text-text-tertiary">Loading...</p>
            ) : questions.length === 0 ? (
              <p className="text-xs text-text-tertiary">No questions added yet — use the form above.</p>
            ) : (
              <div className="space-y-2">
                {questions.map((q) => (
                  <div key={q._id} className="flex items-start justify-between gap-3 p-3 bg-sunken border border-border-default rounded-xl">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-text-primary">Q{q.order}. {q.questionText}</p>
                      <p className="text-[10px] text-text-tertiary mt-1">Correct: {q.correctOption} · {q.difficulty} · {q.marks ?? selectedTest.marksPerQuestion} marks</p>
                    </div>
                    <button onClick={() => handleDeleteQuestion(q._id)} className="flex-shrink-0 px-2.5 py-1 bg-status-danger-bg hover:opacity-90 text-status-danger-text border border-status-danger-text/30 rounded-lg text-[10px] font-bold cursor-pointer">
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function displaySubjectName(subject) {
  return SUBJECT_NAMES[subject] || OPTIONAL_NAMES[subject] || subject;
}

function SubjectPricingTab() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState({});
  const [savingSubject, setSavingSubject] = useState(null);
  const [savedSubject, setSavedSubject] = useState(null);

  const fetchPricing = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/mcq/admin/subject-pricing', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load subject pricing');
      setSubjects(data.subjects || []);
      const initialDrafts = {};
      (data.subjects || []).forEach(s => {
        initialDrafts[s.subject] = { price: String(s.price), discountedPrice: String(s.discountedPrice || ''), useDiscount: s.useDiscount };
      });
      setDrafts(initialDrafts);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load subject pricing.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPricing(); }, []);

  const updateDraft = (subject, field, value) => {
    setDrafts(prev => ({ ...prev, [subject]: { ...prev[subject], [field]: value } }));
  };

  const handleSave = async (subject) => {
    setSavingSubject(subject);
    setSavedSubject(null);
    try {
      const token = localStorage.getItem('token');
      const draft = drafts[subject];
      const res = await fetch(`/api/mcq/admin/subject-pricing/${encodeURIComponent(subject)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          price: Number(draft.price),
          discountedPrice: Number(draft.discountedPrice) || 0,
          useDiscount: draft.useDiscount
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save price');
      setSavedSubject(subject);
      await fetchPricing();
      setTimeout(() => setSavedSubject(null), 2000);
    } catch (err) {
      alert(err.message || 'Failed to save price.');
    } finally {
      setSavingSubject(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-accent-soft-bg border border-accent-soft-border rounded-2xl p-4 text-xs text-text-secondary">
        Students buy access one subject at a time. Set one flat price per subject here — buying it unlocks every locked test in that subject, including ones you add later. Free tests (toggled per-test in "Create / Manage Tests") stay free regardless of this price.
      </div>

      {loading ? (
        <p className="text-xs text-text-tertiary">Loading...</p>
      ) : error ? (
        <div className="p-3 bg-status-danger-bg border border-status-danger-text/30 rounded-xl text-status-danger-text text-xs font-semibold">{error}</div>
      ) : subjects.length === 0 ? (
        <p className="text-xs text-text-tertiary">No subjects with MCQ tests yet.</p>
      ) : (
        <div className="space-y-2">
          {subjects.map((s) => {
            const draft = drafts[s.subject] || { price: '', discountedPrice: '', useDiscount: false };
            return (
              <div key={s.subject} className="p-4 bg-sunken border border-border-default rounded-xl">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-text-primary truncate">{displaySubjectName(s.subject)}</p>
                    <p className="text-[10px] text-text-tertiary mt-0.5 font-mono">{s.subject}</p>
                  </div>
                  {!s.configured && (
                    <span className="flex-shrink-0 text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-status-warning-bg border border-status-warning-text/30 text-status-warning-text">Not set</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-text-tertiary font-bold">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={draft.price}
                      onChange={(e) => updateDraft(s.subject, 'price', e.target.value)}
                      className="w-24 bg-page border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={draft.useDiscount} onChange={(e) => updateDraft(s.subject, 'useDiscount', e.target.checked)} className="w-3.5 h-3.5 accent-brand cursor-pointer" />
                    <span className="text-[10px] font-bold text-text-secondary">Discount</span>
                  </label>
                  {draft.useDiscount && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-text-tertiary font-bold">₹</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="discounted"
                        value={draft.discountedPrice}
                        onChange={(e) => updateDraft(s.subject, 'discountedPrice', e.target.value)}
                        className="w-24 bg-page border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                      />
                    </div>
                  )}
                  <button
                    onClick={() => handleSave(s.subject)}
                    disabled={savingSubject === s.subject}
                    className="ml-auto px-4 py-1.5 bg-brand hover:bg-brand-hover disabled:opacity-50 text-text-on-accent rounded-lg text-[10px] font-bold transition cursor-pointer"
                  >
                    {savingSubject === s.subject ? 'Saving...' : savedSubject === s.subject ? 'Saved ✓' : 'Save'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdminMcqPurchasesTab() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [filterTab, setFilterTab] = useState('pending');
  const [lightboxImage, setLightboxImage] = useState(null);

  const getImageUrl = (path) => {
    if (!path) return '';
    const token = localStorage.getItem('token');
    return token ? `${path}${path.includes('?') ? '&' : '?'}token=${token}` : path;
  };

  const fetchRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/mcq/admin/purchase-requests', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch purchase requests');
      setRequests(data || []);
    } catch (err) {
      console.error('Error fetching admin MCQ purchase requests:', err);
      setError(err.message || 'Failed to load purchase requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAction = async (requestId, action) => {
    setProcessingId(requestId);
    try {
      const res = await fetch(`/api/mcq/admin/purchase-requests/${requestId}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action} request`);
      setRequests(prev => prev.map(r => r._id === requestId ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' } : r));
    } catch (err) {
      alert(err.message || `Error executing action ${action}`);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = requests.filter(r => filterTab === 'all' ? true : r.status === filterTab);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-xs text-text-tertiary">Review manual UPI payments for MCQ tests and unlock access for students.</p>
        <button onClick={fetchRequests} className="px-3 py-1.5 bg-accent-soft-bg border border-accent-soft-border hover:bg-accent-soft-border/50 text-brand rounded-xl text-xs font-bold transition cursor-pointer">
          Refresh
        </button>
      </div>

      <div className="flex border-b border-border-default mb-6 gap-4">
        {['pending', 'approved', 'rejected', 'all'].map((tab) => {
          const count = requests.filter(r => tab === 'all' ? true : r.status === tab).length;
          return (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 cursor-pointer transition-all ${filterTab === tab ? 'border-brand text-brand font-extrabold' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
            >
              {tab} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-xs text-text-tertiary">Loading...</p>
      ) : error ? (
        <div className="p-3 bg-status-danger-bg border border-status-danger-text/30 rounded-xl text-status-danger-text text-xs font-semibold">{error}</div>
      ) : filteredRequests.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border-default rounded-xl bg-surface-raised">
          <p className="text-sm text-text-tertiary font-semibold">No {filterTab !== 'all' ? filterTab : ''} requests found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredRequests.map((req) => (
            <div key={req._id} className="bg-surface border border-border-default rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-brand/40 transition-all">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-text-primary text-sm leading-snug">{req.userName}</h3>
                    <p className="text-[11px] text-text-secondary font-mono">{req.userEmail}</p>
                  </div>
                  <span className="text-[9px] text-text-tertiary font-bold whitespace-nowrap">
                    {new Date(req.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="p-3 bg-sunken border border-border-subtle rounded-xl space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-text-secondary font-medium">{req.purchaseType === 'subject' ? 'Subject:' : 'Test:'}</span>
                    <span className="text-text-primary font-bold text-right truncate max-w-xs">
                      {req.purchaseType === 'subject' ? `${displaySubjectName(req.subject)} (full subject)` : req.mcqTestTitle}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-text-secondary font-medium">Price:</span>
                    <span className="text-brand font-extrabold">₹{req.price}</span>
                  </div>
                  {req.upiTxnId && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-text-secondary font-medium">UPI Ref:</span>
                      <span className="font-mono text-text-primary font-bold select-all">{req.upiTxnId}</span>
                    </div>
                  )}
                </div>

                <div
                  onClick={() => setLightboxImage(req.screenshotUrl)}
                  className="relative group overflow-hidden border border-border-default hover:border-brand/40 rounded-xl aspect-[16/9] bg-page flex items-center justify-center cursor-zoom-in"
                >
                  <img
                    src={getImageUrl(req.screenshotUrl)}
                    alt="Payment Screenshot Receipt"
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/600x400/18181b/a1a1aa?text=Image+Unavailable'; }}
                  />
                </div>
              </div>

              <div className="border-t border-border-default pt-4 mt-4 flex items-center justify-between gap-4">
                <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Status</span>
                {req.status === 'pending' ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(req._id, 'reject')}
                      disabled={processingId === req._id}
                      className="px-3 py-1.5 border border-border-default hover:border-status-danger-text/60 hover:bg-status-danger-bg text-text-secondary hover:text-status-danger-text rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleAction(req._id, 'approve')}
                      disabled={processingId === req._id}
                      className="px-4 py-1.5 bg-brand hover:bg-brand-hover disabled:opacity-50 text-text-on-accent rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      {processingId === req._id ? 'Processing...' : 'Approve'}
                    </button>
                  </div>
                ) : req.status === 'approved' ? (
                  <span className="px-3 py-1 bg-status-success-bg border border-status-success-text/25 text-status-success-text rounded-xl text-xs font-extrabold uppercase">Approved</span>
                ) : (
                  <span className="px-3 py-1 bg-status-danger-bg border border-status-danger-text/20 text-status-danger-text rounded-xl text-xs font-extrabold uppercase">Rejected</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {lightboxImage && (
        <div className="fixed inset-0 z-[150] bg-ink-950/95 flex flex-col items-center justify-center p-4" onClick={() => setLightboxImage(null)}>
          <button onClick={() => setLightboxImage(null)} className="absolute top-4 right-4 text-text-secondary hover:text-text-primary p-2 bg-surface/85 border border-border-default rounded-full hover:bg-sunken transition cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <img
            src={getImageUrl(lightboxImage)}
            alt="Expanded Receipt Zoom"
            className="max-w-full max-h-[85vh] object-contain rounded-lg border border-border-default shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/600x400/18181b/a1a1aa?text=Image+Unavailable'; }}
          />
        </div>
      )}
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
      <div className="mb-8 border-b border-border-default pb-5">
        <h1 className="text-2xl md:text-3xl font-display font-extrabold text-text-primary tracking-tight">MCQ Test Data</h1>
        <p className="text-text-tertiary text-sm mt-1.5 font-medium">Create MCQ tests and bulk-upload their questions via CSV.</p>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setActiveSubTab('manage')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeSubTab === 'manage' ? 'bg-brand text-text-on-accent' : 'bg-sunken text-text-secondary hover:bg-surface-raised'}`}
        >
          Create / Manage Tests
        </button>
        <button
          onClick={() => setActiveSubTab('upload')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeSubTab === 'upload' ? 'bg-brand text-text-on-accent' : 'bg-sunken text-text-secondary hover:bg-surface-raised'}`}
        >
          Upload Questions
        </button>
        <button
          onClick={() => setActiveSubTab('build')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeSubTab === 'build' ? 'bg-brand text-text-on-accent' : 'bg-sunken text-text-secondary hover:bg-surface-raised'}`}
        >
          Build Questions
        </button>
        <button
          onClick={() => setActiveSubTab('pricing')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeSubTab === 'pricing' ? 'bg-brand text-text-on-accent' : 'bg-sunken text-text-secondary hover:bg-surface-raised'}`}
        >
          Subject Pricing
        </button>
        <button
          onClick={() => setActiveSubTab('purchases')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeSubTab === 'purchases' ? 'bg-brand text-text-on-accent' : 'bg-sunken text-text-secondary hover:bg-surface-raised'}`}
        >
          Purchase Requests
        </button>
      </div>

      {activeSubTab === 'manage' ? (
        <ManageTestsTab tests={tests} loadingTests={loadingTests} refreshTests={refreshTests} />
      ) : activeSubTab === 'upload' ? (
        <UploadQuestionsTab tests={tests} loadingTests={loadingTests} />
      ) : activeSubTab === 'build' ? (
        <BuildQuestionsTab tests={tests} loadingTests={loadingTests} refreshTests={refreshTests} />
      ) : activeSubTab === 'pricing' ? (
        <SubjectPricingTab />
      ) : (
        <AdminMcqPurchasesTab />
      )}
    </div>
  );
}
