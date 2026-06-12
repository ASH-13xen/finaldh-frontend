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
  const [activeTab, setActiveTab] = useState('login');
  const googleButtonRef = useRef(null);

  // Automatically switch tabs when logging in
  useEffect(() => {
    if (user && activeTab === 'login') {
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

  // Initialize Google Sign-In button once configurations are fetched and loading is done
  useEffect(() => {
    if (token || loading || !googleClientId) return;

    const handleCredentialResponse = async (response) => {
      setLoading(true);
      setError('');
      try {
        const authRes = await fetch('/api/auth/google', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
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

    // Render Google button once the script is available
    const checkGoogleLoaded = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(checkGoogleLoaded);
        
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleCredentialResponse
        });

        if (googleButtonRef.current) {
          window.google.accounts.id.renderButton(
            googleButtonRef.current,
            { 
              theme: 'outline', 
              size: 'large', 
              width: '100%',
              shape: 'rectangular',
              text: 'signin_with'
            }
          );
        }
        
        window.google.accounts.id.prompt(); // prompt Google One Tap
      }
    }, 100);

    return () => clearInterval(checkGoogleLoaded);
  }, [token, loading, googleClientId]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setActiveTab('login');
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
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-100">
        <LoadingSpinner text="Verifying user... (may take up to 30 sec)" />
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
