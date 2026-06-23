import { useState, useEffect, useRef } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import MmfHeroBanner from '../components/courses/MmfHeroBanner';
import ComboOffersSection from '../components/courses/ComboOffersSection';
import CategorizedCourseGrid from '../components/courses/CategorizedCourseGrid';
import SamplePreviewSection from '../components/courses/SamplePreviewSection';

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

  const mmfCourse = courses.find((c) => c.subject === 'All GS');

  return (
    <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-14">
      <div className="mb-8 md:mb-12 border-b border-slate-800 pb-4 md:pb-6">
        <h1 className="text-xl md:text-3xl font-extrabold text-white tracking-tight">
          Purchase Courses
        </h1>
        <p className="text-slate-400 text-xs md:text-sm mt-1.5 font-medium">
          Unlock standard study packages and syllabus guides directly. Sign in to make a UPI payment and upload your receipt for immediate access.
        </p>
      </div>

      {!loading && mmfCourse && (
        <MmfHeroBanner
          course={mmfCourse}
          status={GUEST_STATUS}
          pendingRequest={null}
          onPurchase={onRedirectToLogin}
          onTelegramNotify={onRedirectToLogin}
        />
      )}

      {!loading && comboOffers.length > 0 && (
        <ComboOffersSection
          comboOffers={comboOffers}
          getComboStatus={() => GUEST_STATUS}
          onSelectCombo={onRedirectToLogin}
        />
      )}

      {loading ? (
        <div className="py-16 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <LoadingSpinner text="Loading courses..." />
        </div>
      ) : courses.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
          <p className="text-sm text-slate-400 font-semibold">
            No courses are currently available for purchase.
          </p>
        </div>
      ) : (
        <CategorizedCourseGrid
          courses={courses}
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
      <div className="mt-10 pt-6 border-t border-slate-800/60 text-center">
        <p className="text-sm text-slate-200 font-extrabold tracking-wide flex flex-col sm:flex-row items-center justify-center gap-2">
          <span>In case of any issue, contact us on Telegram:</span>
          <span className="flex items-center gap-2">
            <a
              href="https://t.me/tdhadmin"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent-950/45 border border-accent-900/60 text-accent-400 hover:text-accent-300 rounded-lg text-xs font-black shadow transition-all hover:scale-[1.02] cursor-pointer"
            >
              Telegram App (Mobile)
            </a>
            <span className="text-slate-700 font-medium hidden sm:inline">|</span>
            <a
              href="https://web.telegram.org/k/#@tdhadmin"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent-950/45 border border-accent-900/60 text-accent-400 hover:text-accent-300 rounded-lg text-xs font-black shadow transition-all hover:scale-[1.02] cursor-pointer"
            >
              Telegram Web
            </a>
          </span>
        </p>
      </div>
    </div>
  );
}
