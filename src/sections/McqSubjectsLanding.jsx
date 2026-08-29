import { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';

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

export default function McqSubjectsLanding({ onSelectSubject, onSelectBank, onViewHistory }) {
  const [subjects, setSubjects] = useState([]);
  const [banks, setBanks] = useState([]); // published Question Banks from /api/question-banks
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const fetchSubjects = async () => {
      try {
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
    // Published Question Banks — optional; the rest of the page still renders if this fails.
    const fetchBanks = async () => {
      try {
        const res = await fetch('/api/question-banks', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        setBanks(data.banks || []);
      } catch { /* ignore */ }
    };
    fetchSubjects();
    if (onSelectBank) fetchBanks();
  }, [onSelectBank]);

  const displayName = (subject) => SUBJECT_NAMES[subject] || OPTIONAL_NAMES[subject] || subject;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] bg-page">
        <LoadingSpinner text="Loading subjects..." />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-10 md:py-14 flex flex-col gap-8">
      <div className="flex items-center justify-between border-b border-border-default pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-extrabold text-text-primary tracking-tight flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-6 h-6 text-brand"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            MCQ Tests
          </h1>
          <p className="text-text-tertiary text-sm mt-1.5 font-medium">Pick a subject to see its available timed mock tests.</p>
        </div>
        {onViewHistory && (
          <Button variant="secondary" size="sm" onClick={onViewHistory}>My History</Button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-status-danger-bg border border-status-danger-text/30 rounded-xl text-status-danger-text text-sm font-semibold">{error}</div>
      )}

      {onSelectBank && banks.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Question banks · practice, untimed</p>
          {banks.map((bank) => (
            <button
              key={bank.subject}
              onClick={() => onSelectBank(bank.subject)}
              className="w-full text-left bg-accent-soft-bg border border-accent-soft-border rounded-2xl p-6 flex items-center justify-between gap-4 hover:border-brand transition-colors cursor-pointer group"
            >
              <div>
                <span className="text-[9px] font-bold text-brand uppercase tracking-wide">Practice · untimed</span>
                <h3 className="font-bold text-lg text-text-primary mt-1">{bank.title}</h3>
                <p className="text-xs text-text-secondary mt-1">
                  {bank.total.toLocaleString()} questions · {bank.topicCount} topics · learn by topic, random test, or all
                </p>
              </div>
              <span className="w-9 h-9 rounded-lg bg-surface border border-accent-soft-border flex items-center justify-center text-brand group-hover:bg-brand group-hover:text-text-on-accent transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </span>
            </button>
          ))}
        </div>
      )}

      {!error && subjects.length === 0 && banks.length === 0 && (
        <div className="bg-surface border border-border-default rounded-2xl p-16 text-center text-text-tertiary">
          No MCQ tests have been published yet. Check back soon.
        </div>
      )}

      {subjects.length > 0 && (
        <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Timed mock tests</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subjects.map(({ subject, testCount }) => (
          <div
            key={subject}
            onClick={() => onSelectSubject(subject)}
            className="bg-surface border border-border-default hover:border-brand rounded-2xl p-6 flex flex-col justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group cursor-pointer"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-brand bg-accent-soft-bg border border-accent-soft-border rounded px-2.5 py-0.5 uppercase tracking-wide">
                  {subject}
                </span>
                <div className="w-8 h-8 rounded-lg bg-accent-soft-bg border border-accent-soft-border flex items-center justify-center text-brand group-hover:bg-brand group-hover:text-text-on-accent transition-all duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                </div>
              </div>
              <h3 className="font-bold text-text-primary text-sm group-hover:text-brand transition-colors leading-relaxed">
                {displayName(subject)}
              </h3>
            </div>
            <div className="pt-6 mt-6 border-t border-border-default flex items-center justify-between">
              <span className="text-[10px] text-text-tertiary font-semibold uppercase">{testCount} Test{testCount !== 1 ? 's' : ''}</span>
              <span className="text-xs font-bold text-brand flex items-center gap-1 group-hover:translate-x-1 transition-transform">
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
