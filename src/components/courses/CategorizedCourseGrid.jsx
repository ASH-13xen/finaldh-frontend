import { useState, useEffect, useRef } from 'react';
import CourseCard from './CourseCard';
import { categorizeCourses, OPTIONAL_NAMES } from './courseHelpers';
import { gsap, prefersReducedMotion } from '../../lib/gsapSetup';

const PullQuote = ({ children }) => (
  <div className="mb-6 border-l-2 border-brand/40 pl-4 md:pl-6 py-1">
    <p className="font-display italic text-sm md:text-base text-text-secondary leading-relaxed whitespace-pre-line">
      {children}
    </p>
  </div>
);

const useGridReveal = (deps) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !ref.current.children.length || prefersReducedMotion()) return;
    // fromTo (not from) — this effect can legitimately re-run more than once as course
    // data loads (dependency array changes) and under React StrictMode's dev-only
    // double-invoke. gsap.from() captures the element's CURRENT value as its implicit
    // end-state; if an earlier run already left opacity at 0, a later .from({opacity:0})
    // call would animate 0 -> 0 (progressing fully, but visually static). Explicit
    // fromTo has no such ambiguity regardless of how many times this runs.
    const tween = gsap.fromTo(
      ref.current.children,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.06,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: ref.current,
          start: 'top 90%',
          toggleActions: 'play none none none',
        },
      },
    );
    return () => tween.kill();
  }, deps);
  return ref;
};

export default function CategorizedCourseGrid({ courses, excludedCourseIds, getCourseStatus, getPendingRequest, onPurchase, onTelegramNotify, onSeeSample }) {
  const [optionalSearch, setOptionalSearch] = useState('');
  const [optionalDescription, setOptionalDescription] = useState('');
  const [gsCoreDescription, setGsCoreDescription] = useState('');

  useEffect(() => {
    fetch('/api/courses/site-content/optional_subjects_description')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setOptionalDescription(data?.value || ''))
      .catch(() => {});

    fetch('/api/courses/site-content/gs_core_description')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setGsCoreDescription(data?.value || ''))
      .catch(() => {});
  }, []);

  const excluded = excludedCourseIds || [];
  const { optional: optionalCourses, gsCore: gsCoreCourses, other: otherCourses } = categorizeCourses(courses, excluded);

  const optionalSearchTerm = optionalSearch.trim().toLowerCase();
  const filteredOptionalCourses = optionalSearchTerm
    ? optionalCourses.filter((c) => {
        const display = (OPTIONAL_NAMES[c.subject]?.replace('Optional: ', '') || c.subject).toLowerCase();
        return (c.name || '').toLowerCase().includes(optionalSearchTerm) || display.includes(optionalSearchTerm);
      })
    : optionalCourses;

  const optionalGridRef = useGridReveal([filteredOptionalCourses.length]);
  const gsCoreGridRef = useGridReveal([gsCoreCourses.length]);
  const otherGridRef = useGridReveal([otherCourses.length]);

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
        <div id="category-optional" className="scroll-mt-20 md:scroll-mt-24">
          <div className="mb-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h2 className="text-xl md:text-2xl font-display font-semibold text-text-primary tracking-tight">
                Optional Subjects
              </h2>
              <p className="text-text-secondary text-xs md:text-sm mt-1 font-medium">
                Choose your optional from {optionalCourses.length} available subjects.
              </p>
            </div>
            <input
              type="text"
              value={optionalSearch}
              onChange={(e) => setOptionalSearch(e.target.value)}
              placeholder="Search optional subjects..."
              className="w-full sm:w-64 px-3.5 py-2 bg-surface border border-border-default rounded-xl text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand transition-all font-medium"
            />
          </div>

          {optionalDescription && <PullQuote>{optionalDescription}</PullQuote>}

          {filteredOptionalCourses.length === 0 ? (
            <p className="text-sm text-text-tertiary font-semibold text-center py-8 border border-dashed border-border-default rounded-2xl bg-surface-raised">
              No optional subjects match your search.
            </p>
          ) : (
            <div ref={optionalGridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOptionalCourses.map(renderCard)}
            </div>
          )}
        </div>
      )}

      {gsCoreCourses.length > 0 && (
        <div id="category-gscore" className="scroll-mt-20 md:scroll-mt-24">
          <div className="mb-5">
            <h2 className="text-xl md:text-2xl font-display font-semibold text-text-primary tracking-tight">
              GS Core Papers
            </h2>
            <p className="text-text-secondary text-xs md:text-sm mt-1 font-medium">
              GS-1 through GS-4, Essay, and the all-in-one Mains Master File.
            </p>
          </div>

          {gsCoreDescription && <PullQuote>{gsCoreDescription}</PullQuote>}

          <div ref={gsCoreGridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gsCoreCourses.map(renderCard)}
          </div>
        </div>
      )}

      {otherCourses.length > 0 && (
        <div>
          <div className="mb-5">
            <h2 className="text-xl md:text-2xl font-display font-semibold text-text-primary tracking-tight">
              Other Courses
            </h2>
          </div>
          <div ref={otherGridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {otherCourses.map(renderCard)}
          </div>
        </div>
      )}
    </div>
  );
}
