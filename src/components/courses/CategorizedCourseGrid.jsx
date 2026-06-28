import { useState, useEffect } from 'react';
import CourseCard from './CourseCard';
import { isGsCoreSubject, isOptionalSubject, OPTIONAL_NAMES } from './courseHelpers';

export default function CategorizedCourseGrid({ courses, getCourseStatus, getPendingRequest, onPurchase, onTelegramNotify, onSeeSample }) {
  const [optionalSearch, setOptionalSearch] = useState('');
  const [optionalDescription, setOptionalDescription] = useState('');

  useEffect(() => {
    fetch('/api/courses/site-content/optional_subjects_description')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setOptionalDescription(data?.value || ''))
      .catch(() => {});
  }, []);

  const gsCoreCourses = courses.filter((c) => isGsCoreSubject(c.subject) && c.subject !== 'All GS');
  const optionalCourses = courses.filter((c) => isOptionalSubject(c.subject));
  const otherCourses = courses.filter((c) => !isGsCoreSubject(c.subject) && !isOptionalSubject(c.subject));

  const optionalSearchTerm = optionalSearch.trim().toLowerCase();
  const filteredOptionalCourses = optionalSearchTerm
    ? optionalCourses.filter((c) => {
        const display = (OPTIONAL_NAMES[c.subject]?.replace('Optional: ', '') || c.subject).toLowerCase();
        return (c.name || '').toLowerCase().includes(optionalSearchTerm) || display.includes(optionalSearchTerm);
      })
    : optionalCourses;

  const renderCard = (course) => (
    <CourseCard
      key={course._id}
      course={course}
      status={getCourseStatus(course)}
      pendingRequest={getPendingRequest(course)}
      onPurchase={onPurchase}
      onTelegramNotify={onTelegramNotify}
      onSeeSample={onSeeSample}
    />
  );

  return (
    <div className="space-y-12 md:space-y-16">
      {optionalCourses.length > 0 && (
        <div>
          <div className="mb-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h2 className="text-base md:text-xl font-extrabold text-white tracking-tight">
                Optional Subjects
              </h2>
              <p className="text-slate-400 text-xs md:text-sm mt-1 font-medium">
                Choose your optional from {optionalCourses.length} available subjects.
              </p>
            </div>
            <input
              type="text"
              value={optionalSearch}
              onChange={(e) => setOptionalSearch(e.target.value)}
              placeholder="Search optional subjects..."
              className="w-full sm:w-64 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-550 focus:outline-none focus:border-accent-500 transition-all font-medium"
            />
          </div>

          {optionalDescription && (
            <div className="mb-6 bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-slate-900/40 border border-emerald-800/50 rounded-2xl p-4 md:p-6 flex items-start gap-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent"></div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              <p className="text-slate-300 text-xs md:text-sm font-medium leading-relaxed whitespace-pre-line">
                {optionalDescription}
              </p>
            </div>
          )}

          {filteredOptionalCourses.length === 0 ? (
            <p className="text-sm text-slate-500 font-semibold text-center py-8 border border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
              No optional subjects match your search.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOptionalCourses.map(renderCard)}
            </div>
          )}
        </div>
      )}

      {gsCoreCourses.length > 0 && (
        <div>
          <div className="mb-5">
            <h2 className="text-base md:text-xl font-extrabold text-white tracking-tight">
              GS Core Papers
            </h2>
            <p className="text-slate-400 text-xs md:text-sm mt-1 font-medium">
              GS-1 through GS-4, Essay, and the all-in-one Mains Master File.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gsCoreCourses.map(renderCard)}
          </div>
        </div>
      )}

      {otherCourses.length > 0 && (
        <div>
          <div className="mb-5">
            <h2 className="text-base md:text-xl font-extrabold text-white tracking-tight">
              Other Courses
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {otherCourses.map(renderCard)}
          </div>
        </div>
      )}
    </div>
  );
}
