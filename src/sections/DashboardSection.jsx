import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import ErrorBoundary from '../components/ErrorBoundary';
import StudentDashboard from './StudentDashboard';
import ProgressUpdater from './ProgressUpdater';
import QuestionUploader from './QuestionUploader';
import DisplayPYQ from './DisplayPYQ';
import DisplayUPSCQuestions from './DisplayUPSCQuestions';
import LoadingSpinner from '../components/LoadingSpinner';
import BuyCourses from './BuyCourses';
import UploadCourse from './UploadCourse';
import PYQRecommender from './PYQRecommender';
import PDFEditor from './PDFEditor';
import PurchaseCourses from './PurchaseCourses';
import AdminPurchases from './AdminPurchases';
import AdminProgressData from './AdminProgressData';
import ProgressSection from './ProgressSection';
import ComingSoon from './ComingSoon';
import AdminMcqData from './AdminMcqData';
import AdminView from './AdminView';
import AdminContactUsers from './AdminContactUsers';

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

  return (
    <div className="min-h-screen bg-page text-text-primary flex flex-col">
      {/* Navbar Header */}
      <Navbar user={user} onLogout={onLogout} activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Page Workspace Content */}
      <main className="flex-grow">
      {/* key={activeTab} remounts the boundary on tab switch, so navigating away from a
          crashed section clears the error instead of leaving it stuck forever. */}
      <ErrorBoundary key={activeTab}>
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
          <PurchaseCourses user={user} onUserUpdate={onUserUpdate} />
        )}

        {activeTab === 'admin_purchases' && (
          <AdminPurchases />
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

        {activeTab?.startsWith('mcq_') && (
          <ComingSoon title="MCQ Tests" onBack={() => setActiveTab(user?.isAdmin ? 'manage_courses' : 'student')} />
        )}

        {activeTab === 'admin_mcq_data' && (
          <AdminMcqData />
        )}
      </ErrorBoundary>
      </main>
    </div>
  );
}
