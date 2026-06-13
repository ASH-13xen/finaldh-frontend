import { useState, useEffect, useRef } from 'react';
import LoadingSpinner from './components/LoadingSpinner';
import LoginSection from './sections/LoginSection';
import DashboardSection from './sections/DashboardSection';
import Navbar from './components/Navbar';
import QuestionUploader from './sections/QuestionUploader';
import DisplayPYQ from './sections/DisplayPYQ';
import DisplayUPSCQuestions from './sections/DisplayUPSCQuestions';
import BuyCourses from './sections/BuyCourses';
import UploadCourse from './sections/UploadCourse';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [googleClientId, setGoogleClientId] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('buy_pdfs');
  const googleButtonRef = useRef(null);

  // Automatically switch tabs when logging in
  useEffect(() => {
    if (user && (activeTab === 'login' || activeTab === 'buy_pdfs')) {
      setActiveTab(user.isAdmin ? 'manage_courses' : 'student');
    }
  }, [user]);

  // Unified Boot Sequence: Load configs & verify session
  useEffect(() => {
    const initializePortal = async () => {
      try {
        // 1. Load Google Client ID config (holds loading page while backend wakes up / cold-starts)
        const configRes = await fetch('/api/auth/config');
        if (!configRes.ok) throw new Error('Failed to load portal configuration');
        const config = await configRes.json();
        setGoogleClientId(config.googleClientId);

        // 2. Load profile info if token exists
        if (token) {
          const profileRes = await fetch('/api/user/profile', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            setUser(profileData);
          } else {
            // Clear invalid token session
            localStorage.removeItem('token');
            setToken(null);
          }
        }
      } catch (err) {
        console.error('Initialization error:', err);
        setError('Connection to server failed. Please reload the page.');
      } finally {
        setLoading(false);
      }
    };

    initializePortal();
  }, [token]);

  // Initialize Google Sign-In once configs are ready (no button rendering here —
  // LoginSection may not be mounted yet since the default tab is buy_pdfs)
  useEffect(() => {
    if (token || loading || !googleClientId) return;

    const handleCredentialResponse = async (response) => {
      setLoading(true);
      setError('');
      try {
        const authRes = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: response.credential })
        });

        if (!authRes.ok) {
          const errData = await authRes.json();
          throw new Error(errData.error || 'Authentication failed');
        }

        const data = await authRes.json();
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
      } catch (err) {
        console.error('Google Auth callback error:', err);
        setError(err.message || 'Verification failed. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    const checkGoogleLoaded = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(checkGoogleLoaded);
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleCredentialResponse
        });
      }
    }, 100);

    return () => clearInterval(checkGoogleLoaded);
  }, [token, loading, googleClientId]);

  // Render the Google button every time the login tab becomes visible.
  // This runs after LoginSection mounts so googleButtonRef.current is valid.
  useEffect(() => {
    if (activeTab !== 'login' || loading || token || !googleClientId) return;

    const timer = setTimeout(() => {
      if (window.google?.accounts?.id && googleButtonRef.current) {
        window.google.accounts.id.renderButton(
          googleButtonRef.current,
          { theme: 'outline', size: 'large', width: '100%', shape: 'rectangular', text: 'signin_with' }
        );
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [activeTab, loading, token, googleClientId]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setActiveTab('buy_pdfs');
  };

  const handleDevLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/mock', {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Mock login failed');
      
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      setActiveTab(data.user.isAdmin ? 'manage_courses' : 'student');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Mock login failed');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 gap-6">
        <div className="flex flex-col items-center gap-2">
          <span className="text-xl font-black text-white tracking-tight">The Dark Horse UPSC</span>
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Study Portal</span>
        </div>
        <div className="w-10 h-10 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin" />
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-semibold text-slate-300 animate-pulse">Verifying user...</p>
          <p className="text-[11px] text-slate-600 font-medium">This may take up to 30 seconds on first load</p>
        </div>
      </div>
    );
  }

  // Dashboard / Home View
  if (user) {
    return (
      <DashboardSection 
        user={user} 
        onLogout={handleLogout} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onUserUpdate={setUser}
      />
    );
  }

  // Guest Access: View Public Question Parser / Display PYQs / Display UPSC Questions / Buy PDFs / Upload Course
  if (activeTab === 'uploader' || activeTab === 'pyqs' || activeTab === 'upsc_questions' || activeTab === 'buy_pdfs' || activeTab === 'upload_course') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <Navbar 
          user={null} 
          onLogout={handleLogout} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
        />
        <main className="flex-grow">
          {activeTab === 'uploader' ? (
            <QuestionUploader syllabusData={null} />
          ) : activeTab === 'pyqs' ? (
            <DisplayPYQ />
          ) : activeTab === 'upsc_questions' ? (
            <DisplayUPSCQuestions />
          ) : activeTab === 'buy_pdfs' ? (
            <BuyCourses onRedirectToLogin={() => setActiveTab('login')} />
          ) : (
            <UploadCourse />
          )}
        </main>
      </div>
    );
  }

  // Sign In / Login View
  return (
    <LoginSection 
      error={error} 
      googleButtonRef={googleButtonRef} 
      onGuestAccess={() => setActiveTab('uploader')} 
      onDevLogin={handleDevLogin}
    />
  );
}

export default App;
