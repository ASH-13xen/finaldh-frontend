import { useState, useEffect, useRef } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import MmfHeroBanner from '../components/courses/MmfHeroBanner';
import ComboOffersSection from '../components/courses/ComboOffersSection';
import CategorizedCourseGrid from '../components/courses/CategorizedCourseGrid';
import SamplePreviewSection from '../components/courses/SamplePreviewSection';
import CourseCategoryNav from '../components/courses/CourseCategoryNav';
import { CAC_FEATURES, categorizeCourses } from '../components/courses/courseHelpers';

const GUEST_STATUS = { type: 'guest', label: 'Sign In to Purchase' };

export default function BuyCourses({ onRedirectToLogin }) {
  const [courses, setCourses] = useState([]);
  const [comboOffers, setComboOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeSampleCourse, setActiveSampleCourse] = useState(null);
  const sampleSectionRef = useRef(null);

  const handleSeeSample = (course) => {
    setActiveSampleCourse(course);
    setTimeout(() => {
      sampleSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const courseRes = await fetch('/api/courses/list');
        if (courseRes.ok) {
          const data = await courseRes.json();
          setCourses(data.courses || []);
        }

        const comboRes = await fetch('/api/courses/combo-offers/active');
        if (comboRes.ok) {
          const data = await comboRes.json();
          setComboOffers(data.comboOffers || []);
        }
      } catch (err) {
        console.error('Error fetching course details:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // API returns courses newest-first. The OLDEST All GS course is the original Mains Master File;
  // the second-oldest (if present) is the Current Affairs Compass featured below it.
  // Any further All GS courses fall through to the regular grid.
  const allGsCourses = courses.filter((c) => c.subject === 'All GS');
  const mmfCourse = allGsCourses.at(-1);
  const cacCourse = allGsCourses.length >= 2 ? allGsCourses.at(-2) : null;
  const featuredIds = [mmfCourse?._id, cacCourse?._id].filter(Boolean);
  const { optional, gsCore } = categorizeCourses(courses, featuredIds);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-16 relative">
      {/* Background watermark */}
      <img
        src="/logodh1.jpg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute inset-0 w-full h-full object-contain opacity-[0.04] z-0"
      />
      <div className="mb-12 md:mb-20 border-b border-border-default pb-6 md:pb-10">
        <span className="text-[11px] font-sans font-bold uppercase tracking-widest text-brand block mb-2">Study Material</span>
        <h1 className="text-3xl md:text-5xl font-display font-semibold text-text-primary tracking-tight leading-tight">
          Choose your papers.
        </h1>
        <p className="text-text-secondary text-sm md:text-base mt-3 font-medium max-w-xl">
          Unlock standard study packages and syllabus guides directly. Sign in to make a UPI payment and upload your receipt for immediate access.
        </p>
      </div>

      {/* How it works - the payment flow isn't visible until after sign-in, so spell it
          out up front for anyone landing here for the first time. */}
      <div className="mb-10 md:mb-14 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { step: '1', label: 'Sign in with Google' },
          { step: '2', label: 'Pick your paper(s)' },
          { step: '3', label: 'Pay via UPI & upload receipt' },
          { step: '4', label: 'Get instant access' },
        ].map(({ step, label }) => (
          <div key={step} className="flex items-center gap-2.5 p-3 bg-surface-raised border border-border-default rounded-xl">
            <span className="flex items-center justify-center w-6 h-6 shrink-0 bg-accent-soft-bg border border-accent-soft-border text-brand rounded-full text-[11px] font-sans font-extrabold">
              {step}
            </span>
            <span className="text-xs font-sans font-semibold text-text-secondary leading-snug">{label}</span>
          </div>
        ))}
      </div>

      <CourseCategoryNav
        hasMmf={!loading && !!mmfCourse}
        hasCac={!loading && !!cacCourse}
        optionalCount={optional.length}
        gsCoreCount={gsCore.length}
      />

      {!loading && mmfCourse && (
        <div id="category-mmf" className="scroll-mt-20 md:scroll-mt-24">
          <MmfHeroBanner
            course={mmfCourse}
            status={GUEST_STATUS}
            pendingRequest={null}
            onPurchase={onRedirectToLogin}
            onTelegramNotify={onRedirectToLogin}
            onSeeSample={handleSeeSample}
          />
        </div>
      )}

      {!loading && cacCourse && (
        <div id="category-cac" className="scroll-mt-20 md:scroll-mt-24">
          <MmfHeroBanner
            course={cacCourse}
            status={GUEST_STATUS}
            pendingRequest={null}
            onPurchase={onRedirectToLogin}
            onTelegramNotify={onRedirectToLogin}
            onSeeSample={handleSeeSample}
            features={CAC_FEATURES}
            badge="Current Affairs"
            subtitle="Comprehensive current affairs coverage built for Mains — bridging news to syllabus."
          />
        </div>
      )}

      {!loading && comboOffers.length > 0 && (
        <ComboOffersSection
          comboOffers={comboOffers}
          getComboStatus={() => GUEST_STATUS}
          onSelectCombo={onRedirectToLogin}
        />
      )}

      {loading ? (
        <div className="py-16 text-center bg-surface-raised border border-border-default rounded-2xl">
          <LoadingSpinner text="Loading courses..." />
        </div>
      ) : courses.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border-default rounded-2xl bg-surface-raised">
          <p className="text-sm text-text-secondary font-semibold">
            No courses are currently available for purchase.
          </p>
        </div>
      ) : (
        <CategorizedCourseGrid
          courses={courses}
          excludedCourseIds={featuredIds}
          getCourseStatus={() => GUEST_STATUS}
          getPendingRequest={() => null}
          onPurchase={onRedirectToLogin}
          onTelegramNotify={onRedirectToLogin}
          onSeeSample={handleSeeSample}
        />
      )}

      <SamplePreviewSection
        activeSampleCourse={activeSampleCourse}
        sectionRef={sampleSectionRef}
        status={GUEST_STATUS}
        pendingRequest={null}
        onPurchase={onRedirectToLogin}
        onTelegramNotify={onRedirectToLogin}
      />

      {/* Footer */}
      <div className="mt-10 pt-6 border-t border-border-default text-center">
        <p className="text-sm text-text-primary font-sans font-extrabold tracking-wide flex flex-col sm:flex-row items-center justify-center gap-2">
          <span>In case of any issue, contact us on Telegram:</span>
          <span className="flex items-center gap-2">
            <a
              href="https://t.me/tdhadmin"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent-soft-bg border border-accent-soft-border text-brand hover:text-brand-hover rounded-lg text-xs font-black shadow transition-all hover:scale-[1.02] cursor-pointer"
            >
              Telegram App (Mobile)
            </a>
            <span className="text-text-tertiary font-medium hidden sm:inline">|</span>
            <a
              href="https://web.telegram.org/k/#@tdhadmin"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent-soft-bg border border-accent-soft-border text-brand hover:text-brand-hover rounded-lg text-xs font-black shadow transition-all hover:scale-[1.02] cursor-pointer"
            >
              Telegram Web
            </a>
          </span>
        </p>
      </div>
    </div>
  );
}
