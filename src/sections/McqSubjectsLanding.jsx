import { useState, useEffect } from 'react';
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

export default function McqSubjectsLanding({ onSelectSubject }) {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/mcq/subjects', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load subjects');
        setSubjects(data.subjects || []);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Failed to load subjects.');
      } finally {
        setLoading(false);
      }
    };
    fetchSubjects();
  }, []);

  const displayName = (subject) => SUBJECT_NAMES[subject] || OPTIONAL_NAMES[subject] || subject;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] bg-slate-950">
        <LoadingSpinner text="Loading subjects..." />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-10 md:py-14 flex flex-col gap-8">
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-6 h-6 text-accent-400"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          MCQ Tests
        </h1>
        <p className="text-slate-400 text-sm mt-1.5 font-medium">Pick a subject to see its available timed mock tests.</p>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/20 border border-rose-900/40 rounded-xl text-rose-400 text-sm font-semibold">{error}</div>
      )}

      {!error && subjects.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center text-slate-500">
          No MCQ tests have been published yet. Check back soon.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subjects.map(({ subject, testCount }) => (
          <div
            key={subject}
            onClick={() => onSelectSubject(subject)}
            className="bg-slate-900/50 border border-slate-800 hover:border-accent-500 rounded-2xl p-6 flex flex-col justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group cursor-pointer"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-accent-400 bg-accent-950/50 border border-accent-900/50 rounded px-2.5 py-0.5 uppercase tracking-wide">
                  {subject}
                </span>
                <div className="w-8 h-8 rounded-lg bg-accent-950/50 border border-accent-900/50 flex items-center justify-center text-accent-400 group-hover:bg-accent-600 group-hover:text-white transition-all duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                </div>
              </div>
              <h3 className="font-bold text-slate-100 text-sm group-hover:text-accent-400 transition-colors leading-relaxed">
                {displayName(subject)}
              </h3>
            </div>
            <div className="pt-6 mt-6 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-semibold uppercase">{testCount} Test{testCount !== 1 ? 's' : ''}</span>
              <span className="text-xs font-bold text-accent-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                View Tests
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
