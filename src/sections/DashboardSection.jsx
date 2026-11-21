import { useState, useEffect, Suspense } from 'react';
import Navbar from '../components/Navbar';
import ErrorBoundary from '../components/ErrorBoundary';
import StudentDashboard from './StudentDashboard';
import LoadingSpinner from '../components/LoadingSpinner';
import BuyCourses from './BuyCourses';
import PaymentRejectionNotice from '../components/PaymentRejectionNotice';
import ComingSoon from './ComingSoon';
import { MCQ_SECTION_LIVE, INTERVIEW_SECTION_LIVE } from '../lib/features';
import { lazyPage } from '../lib/lazyPage';

// Every other page loads only when it is opened, so a student's first download stays small.
const DisplayPYQ = lazyPage(() => import('./DisplayPYQ'));
const DisplayUPSCQuestions = lazyPage(() => import('./DisplayUPSCQuestions'));
const UploadCourse = lazyPage(() => import('./UploadCourse'));
const PYQRecommender = lazyPage(() => import('./PYQRecommender'));
const PDFEditor = lazyPage(() => import('./PDFEditor'));
const PurchaseCourses = lazyPage(() => import('./PurchaseCourses'));
const AdminPayments = lazyPage(() => import('./AdminPayments'));
const AdminProgressData = lazyPage(() => import('./AdminProgressData'));
const AdminProgressBuilder = lazyPage(() => import('./AdminProgressBuilder'));
const ProgressSection = lazyPage(() => import('./ProgressSection'));
const AdminMcqData = lazyPage(() => import('./AdminMcqData'));
const McqFlow = lazyPage(() => import('./McqFlow'));
const AdminView = lazyPage(() => import('./AdminView'));
const AdminContactUsers = lazyPage(() => import('./AdminContactUsers'));
const PrepFlow = lazyPage(() => import('../prep/PrepFlow'));
const AdminInterviewData = lazyPage(() => import('./AdminInterviewData'));
const AdminDafVerification = lazyPage(() => import('./AdminDafVerification'));

const PageLoading = () => <div className="py-24 flex justify-center"><LoadingSpinner text="Loading..." /></div>;

export default function DashboardSection({ user, onLogout, activeTab, setActiveTab, onUserUpdate }) {
  const [syllabusData, setSyllabusData] = useState(null);
  const [loadingSyllabus, setLoadingSyllabus] = useState(false);
  const [error, setError] = useState('');
  const [analysisCourseId, setAnalysisCourseId] = useState(null);

  const fetchSyllabus = async (silent = false) => {
    if (!silent) setLoadingSyllabus(true);
    setError('');
    try {
      const res = await fetch('/api/user/syllabus', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!res.ok) {
        throw new Error('Failed to retrieve syllabus details');
      }
      const data = await res.json();
      setSyllabusData(data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error loading syllabus progress');
    } finally {
      if (!silent) setLoadingSyllabus(false);
    }
  };

  useEffect(() => {
    // Load syllabus whenever we log in and access student/updater/uploader tabs
    if (activeTab === 'student' || activeTab === 'updater' || activeTab === 'uploader') {
      fetchSyllabus();
    }
  }, [activeTab]);

  useEffect(() => {
    // Reset analysis course ID when navigating away from pyq_recommender
    if (activeTab !== 'pyq_recommender') {
      setAnalysisCourseId(null);
    }
  }, [activeTab]);

  // Interview Prep is its own window with its own header (prep/components/Shell.jsx), so it renders without
  // the site navbar. Students only once INTERVIEW_SECTION_LIVE; admins always.
  if (activeTab?.startsWith('interview_') && (INTERVIEW_SECTION_LIVE || user.isAdmin)) {
    return (
      <div className="min-h-screen bg-page text-text-primary">
        {!user.isAdmin && <PaymentRejectionNotice />}
        <ErrorBoundary key="interview">
          <Suspense fallback={<PageLoading />}>
            <PrepFlow user={user} activeTab={activeTab} onLogout={onLogout} onExit={() => setActiveTab(user.isAdmin ? 'manage_courses' : 'student')} />
          </Suspense>
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page text-text-primary flex flex-col">
      {/* Navbar Header */}
      <Navbar user={user} onLogout={onLogout} activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Refund notice for any Razorpay payment the admin rejected, shown on whichever page the student lands */}
      {!user.isAdmin && <PaymentRejectionNotice />}

      {/* Main Page Workspace Content */}
      <main className="flex-grow">
      {/* key={activeTab} remounts the boundary on tab switch, so navigating away from a
          crashed section clears the error instead of leaving it stuck forever. */}
      <ErrorBoundary key={activeTab}>
      <Suspense fallback={<PageLoading />}>
        {activeTab === 'student' && (
          <StudentDashboard user={user} setActiveTab={setActiveTab} onUserUpdate={onUserUpdate} />
        )}

        {activeTab === 'manage_courses' && (
          <UploadCourse />
        )}



        {activeTab === 'pyqs' && (
          <DisplayPYQ />
        )}

        {activeTab === 'upsc_questions' && (
          <DisplayUPSCQuestions />
        )}

        {activeTab === 'buy_pdfs' && (
          <BuyCourses onRedirectToLogin={() => setActiveTab('login')} />
        )}

        {activeTab === 'upload_course' && (
          <UploadCourse />
        )}

        {activeTab === 'pyq_recommender' && (
          <PYQRecommender 
            selectedCourseId={analysisCourseId} 
            onRedirectToBuy={() => setActiveTab('buy_pdfs')} 
          />
        )}

        {activeTab === 'pdf_editor' && (
          <PDFEditor />
        )}

        {activeTab === 'purchase_courses' && (
          <PurchaseCourses user={user} />
        )}

        {activeTab === 'admin_purchases' && (
          <AdminPayments />
        )}

        {activeTab === 'admin_view' && (
          <AdminView />
        )}

        {activeTab === 'admin_contact_users' && (
          <AdminContactUsers />
        )}

        {activeTab === 'progress' && (
          <ProgressSection onRedirectToBuy={() => setActiveTab('buy_pdfs')} />
        )}

        {activeTab === 'admin_progress_data' && (
          <AdminProgressData />
        )}

        {activeTab === 'admin_progress_builder' && (
          <AdminProgressBuilder />
        )}

        {activeTab?.startsWith('mcq_') && (
          MCQ_SECTION_LIVE
            ? <McqFlow user={user} />
            : <ComingSoon title="MCQ Test Series" onBack={() => setActiveTab('student')} />
        )}

        {activeTab === 'admin_mcq_data' && (
          <AdminMcqData />
        )}

        {/* Students before INTERVIEW_SECTION_LIVE (admins never get here: see the early return above). */}
        {activeTab?.startsWith('interview_') && (
          <ComingSoon title="Abhivyakti" onBack={() => setActiveTab('student')} />
        )}

        {activeTab === 'admin_interview_data' && (
          <AdminInterviewData />
        )}

        {activeTab === 'admin_daf' && user.isAdmin && (
          <AdminDafVerification />
        )}
      </Suspense>
      </ErrorBoundary>
      </main>
    </div>
  );
}
