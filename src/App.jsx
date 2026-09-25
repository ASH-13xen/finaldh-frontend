/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef } from "react";
import LoginSection from "./sections/LoginSection";
import DashboardSection from "./sections/DashboardSection";
import Navbar from "./components/Navbar";
import QuestionUploader from "./sections/QuestionUploader";
import DisplayPYQ from "./sections/DisplayPYQ";
import DisplayUPSCQuestions from "./sections/DisplayUPSCQuestions";
import BuyCourses from "./sections/BuyCourses";
import UploadCourse from "./sections/UploadCourse";
import SessionWatermark from "./components/SessionWatermark";
import { readTabFromHash } from "./lib/tabRouting";
import { getDeviceId, SESSION_ENDED_EVENT, describeLoginBlock } from "./lib/session";

const HEARTBEAT_MS = 5 * 60 * 1000;

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [loading, setLoading] = useState(true);
  const [googleClientId, setGoogleClientId] = useState(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState(() => readTabFromHash());
  const googleButtonRef = useRef(null);

  // Wraps setActiveTab with a URL hash sync so refresh and browser back/forward preserve
  // navigation state (there's no react-router in this app - activeTab IS the routing).
  // Guarded against pushing a duplicate history entry when the hash is already correct,
  // which matters under StrictMode's dev-only double-invoke of effects that call this.
  const navigate = (tab) => {
    setActiveTab(tab);
    const hash = "#" + tab;
    if (window.location.hash !== hash) {
      window.history.pushState({ tab }, "", hash);
    }
  };

  // Keep activeTab in sync when the user presses back/forward.
  useEffect(() => {
    const onPopState = () => setActiveTab(readTabFromHash());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Automatically switch tabs when logging in
  useEffect(() => {
    if (user && (activeTab === "login" || activeTab === "buy_pdfs")) {
      navigate(user.isAdmin ? "manage_courses" : "student");
    }
  }, [user]);

  // Unified Boot Sequence: Load configs & verify session
  useEffect(() => {
    const initializePortal = async () => {
      try {
        // 1. Load Google Client ID config (holds loading page while backend wakes up / cold-starts)
        const configRes = await fetch("/api/auth/config");
        if (!configRes.ok)
          throw new Error("Failed to load portal configuration");
        const config = await configRes.json();
        setGoogleClientId(config.googleClientId);

        // 2. Load profile info if token exists
        if (token) {
          const profileRes = await fetch("/api/user/profile", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            setUser(profileData);
          } else if (profileRes.status === 401 || profileRes.status === 403) {
            // Token is actually invalid/expired — clear the session
            localStorage.removeItem("token");
            setToken(null);
          } else {
            // Transient server error (e.g. backend restarting) — the token may
            // still be valid, so don't log the user out over it. Surface the
            // error and let them retry once the server is back.
            setError("Connection to server failed. Please reload the page.");
          }
        }
      } catch (err) {
        console.error("Initialization error:", err);
        setError("Connection to server failed. Please reload the page.");
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
      setError("");
      try {
        const authRes = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: response.credential, deviceId: getDeviceId() }),
        });

        if (!authRes.ok) {
          const errData = await authRes.json();
          throw new Error(
            errData.code === "SESSION_ACTIVE" ? describeLoginBlock(errData) : errData.error || "Authentication failed",
          );
        }

        const data = await authRes.json();
        localStorage.setItem("token", data.token);
        setToken(data.token);
        setUser(data.user);
      } catch (err) {
        console.error("Google Auth callback error:", err);
        setError(err.message || "Verification failed. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    const checkGoogleLoaded = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(checkGoogleLoaded);
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleCredentialResponse,
        });
      }
    }, 100);

    return () => clearInterval(checkGoogleLoaded);
  }, [token, loading, googleClientId]);

  // Render the Google button every time the login tab becomes visible.
  // This runs after LoginSection mounts so googleButtonRef.current is valid.
  useEffect(() => {
    if (activeTab !== "login" || loading || token || !googleClientId) return;

    const timer = setTimeout(() => {
      if (window.google?.accounts?.id && googleButtonRef.current) {
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "outline",
          size: "large",
          width: "100%",
          shape: "rectangular",
          text: "signin_with",
        });
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [activeTab, loading, token, googleClientId]);

  // The backend signed this device out (idle timeout, signed in again, ...): drop the
  // local session and show why on the login screen.
  useEffect(() => {
    const onSessionEnded = (e) => {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
      setError(e.detail?.error || "You were signed out. Please sign in again.");
      navigate("login");
    };
    window.addEventListener(SESSION_ENDED_EVENT, onSessionEnded);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, onSessionEnded);
  }, []);

  // Keep the session alive while the portal is actually on screen, and re-check it the
  // moment the tab comes back (a 401 there signs out through the listener above).
  useEffect(() => {
    if (!user || user.isAdmin) return;
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/auth/session", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      }).catch(() => {});
    };
    const id = setInterval(ping, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", ping);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [user]);

  const handleLogout = () => {
    // Fire-and-forget: ending the session server-side starts the device-switch lock.
    const currentToken = localStorage.getItem("token");
    if (currentToken) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${currentToken}` },
      }).catch(() => {});
    }
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    navigate("buy_pdfs");
  };

  const handleDevLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: getDeviceId() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.code === "SESSION_ACTIVE" ? describeLoginBlock(data) : data.error || "Mock login failed");
      }

      localStorage.setItem("token", data.token);
      setToken(data.token);
      setUser(data.user);
      navigate(data.user.isAdmin ? "manage_courses" : "student");
    } catch (err) {
      console.error(err);
      setError(err.message || "Mock login failed");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-page text-text-primary gap-6">
        <div className="flex flex-col items-center gap-2">
          <span className="text-xl font-display font-semibold tracking-tight">
            The Dark Horse UPSC
          </span>
          <span className="text-[11px] font-sans font-semibold text-text-tertiary uppercase tracking-widest">
            Study Portal
          </span>
        </div>
        <div className="w-10 h-10 border-4 border-border-default border-t-brand rounded-full animate-spin" />
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-sans font-semibold text-text-secondary animate-pulse">
            Verifying user...
          </p>
          <p className="text-[11px] text-text-tertiary font-medium">
            This may take up to 30 seconds on first load
          </p>
        </div>
      </div>
    );
  }

  // Dashboard / Home View
  if (user) {
    return (
      <>
        <DashboardSection
          user={user}
          onLogout={handleLogout}
          activeTab={activeTab}
          setActiveTab={navigate}
          onUserUpdate={setUser}
        />
        {!user.isAdmin && <SessionWatermark user={user} />}
      </>
    );
  }

  // Guest Access: View Public Question Parser / Display PYQs / Display UPSC Questions / Buy PDFs / Upload Course
  if (
    activeTab === "uploader" ||
    activeTab === "pyqs" ||
    activeTab === "upsc_questions" ||
    activeTab === "buy_pdfs" ||
    activeTab === "upload_course"
  ) {
    return (
      <div className="min-h-screen bg-page text-text-primary flex flex-col">
        <Navbar
          user={null}
          onLogout={handleLogout}
          activeTab={activeTab}
          setActiveTab={navigate}
        />
        <main className="grow">
          {activeTab === "uploader" ? (
            <QuestionUploader syllabusData={null} />
          ) : activeTab === "pyqs" ? (
            <DisplayPYQ />
          ) : activeTab === "upsc_questions" ? (
            <DisplayUPSCQuestions />
          ) : activeTab === "buy_pdfs" ? (
            <BuyCourses onRedirectToLogin={() => navigate("login")} />
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
      onGuestAccess={() => navigate("uploader")}
      onDevLogin={handleDevLogin}
    />
  );
}

export default App;
