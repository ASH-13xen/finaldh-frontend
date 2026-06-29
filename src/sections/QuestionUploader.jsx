import { useState, useEffect } from 'react';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';

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

export default function QuestionUploader({ syllabusData }) {
  const [subject, setSubject] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch previously parsed questions on mount
  const fetchQuestions = async () => {
    try {
      const res = await fetch('/api/questions/list');
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || []);
      }
    } catch (err) {
      console.error('Error fetching questions:', err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  // Compile list of all available subjects (GS-1 to GS-4 and all optionals)
  const availableSubjects = [
    ...Object.entries(SUBJECT_NAMES).map(([id, name]) => ({ id, name })),
    ...Object.entries(OPTIONAL_NAMES).map(([id, name]) => ({ id, name }))
  ];

  // Handle PDF upload and extraction
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!subject || !year || !file) {
      setError('Please select a subject, enter a year, and select a PDF file.');
      return;
    }

    setUploading(true);
    setError('');
    setSuccessMsg('');

    const formData = new FormData();
    formData.append('subject', subject);
    formData.append('year', year);
    formData.append('file', file);

    try {
      const res = await fetch('/api/questions/upload', {
        method: 'POST',
        body: formData
      });

      let data = {};
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        throw new Error(`Server error: status code ${res.status}`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to process file');
      }

      setSuccessMsg(data.message || 'Successfully parsed question paper!');
      setFile(null);
      
      // Reset file input in HTML DOM
      const fileInput = document.getElementById('paper-file');
      if (fileInput) fileInput.value = '';
      
      // Refresh the question list
      await fetchQuestions();
    } catch (err) {
      console.error('Error uploading paper:', err);
      setError(err.message || 'Error occurred while uploading and parsing file.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-10 md:py-14">
      {/* Header Info */}
      <div className="mb-10">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Question Paper Parser</h1>
        <p className="text-slate-500 text-sm mt-1.5 font-medium">Upload previous years' question paper PDFs to automatically extract and semantically tag questions.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Upload Form (Left Column) */}
        <div className="lg:col-span-1 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-wider">Upload New Paper</h2>
          
          <form onSubmit={handleUpload} className="space-y-4">
            {/* Subject Select */}
            <div>
              <label htmlFor="subject-select" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Subject</label>
              <select
                id="subject-select"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-705 focus:outline-none focus:border-accent-500 transition-all font-semibold"
              >
                <option value="">Select subject...</option>
                {availableSubjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
            </div>

            {/* Year Input */}
            <div>
              <label htmlFor="year-input" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Year</label>
              <input
                id="year-input"
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                min="1990"
                max="2030"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-accent-500 transition-all font-semibold"
              />
            </div>

            {/* File Picker */}
            <div>
              <label htmlFor="paper-file" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Select Question Paper (PDF)</label>
              <input
                id="paper-file"
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files[0])}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-accent-50 file:text-accent-700 hover:file:bg-accent-100 cursor-pointer"
              />
            </div>

            {/* Message states */}
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-750 text-[11px] font-medium rounded-xl leading-relaxed animate-shake">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-705 text-[11px] font-medium rounded-xl leading-relaxed">
                {successMsg}
              </div>
            )}

            <Button onClick={handleUpload} variant="primary" fullWidth disabled={uploading || !subject || !file}>
              {uploading ? 'Processing File...' : 'Upload & Parse PDF'}
            </Button>
          </form>

          {uploading && (
            <div className="mt-6 border-t border-slate-100 pt-6">
              <LoadingSpinner text="Extracting questions using Gemini AI..." />
            </div>
          )}
        </div>

        {/* Questions Listing (Right Column - Spans 2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Parsed Questions History ({questions.length})</h2>

          {loadingList ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-sm">
              <LoadingSpinner text="Retrieving parsed questions..." />
            </div>
          ) : questions.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center text-slate-400 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-10 h-10 mx-auto mb-4 text-slate-300"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
              <p className="text-sm font-semibold text-slate-650">No questions parsed yet</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Upload a past exam paper in PDF format using the left-hand form to start extracting questions.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[620px] overflow-y-auto pr-2">
              {questions.map((q) => {
                const isGS = q.subject.startsWith('GS-');
                const displayName = isGS ? q.subject : OPTIONAL_NAMES[q.subject]?.replace('Optional: ', '') || q.subject;
                return (
                  <div key={q._id} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4 hover:border-slate-300 transition-all">
                    {/* Header tags */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[9px] font-bold text-accent-650 bg-accent-50 border border-accent-100 rounded px-1.5 py-0.5 uppercase tracking-wide">
                        {displayName}
                      </span>
                      <span className="text-[9px] font-bold text-slate-500 bg-slate-50 border border-slate-150 rounded px-1.5 py-0.5 uppercase tracking-wide">
                        Year {q.year}
                      </span>
                      <span className="text-[9px] font-bold text-accent-500 bg-accent-50/40 border border-accent-100/60 rounded px-1.5 py-0.5 tracking-wide">
                        Section: {q.tags?.section || 'General'}
                      </span>
                      <span className="text-[9px] font-bold text-slate-600 bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 tracking-wide truncate max-w-[200px]">
                        Topic: {q.tags?.title || 'General'}
                      </span>
                    </div>

                    {/* Question text */}
                    <p className="text-xs md:text-sm text-slate-800 leading-relaxed font-medium whitespace-pre-wrap">
                      {q.text}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
