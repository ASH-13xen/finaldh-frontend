import { useState, useEffect, useRef } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import DownloadProgressBar from '../components/DownloadProgressBar';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

const getCleanStatusText = (status) => {
  if (!status) return '';
  if (status.includes('Initiating') || status.includes('Securing') || status.includes('Preparing')) return 'Preparing PDF...';
  if (status.includes('Saving')) return 'Finishing...';
  if (status.includes('Success')) return 'Success!';
  if (status.includes('Downloading')) {
    const pctMatch = status.match(/\((\d+)%\)/);
    if (pctMatch) return `Downloading (${pctMatch[1]}%)`;
    const kbMatch = status.match(/\((\d+ KB)\)/);
    if (kbMatch) return `Downloading (${kbMatch[1]})`;
    return 'Downloading...';
  }
  return status;
};

const wrapText = (text, maxWidth, font, fontSize) => {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth > maxWidth) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
};

const drawSecurityWarningPage = (page, user, course, font, boldFont, rgb) => {
  const { width, height } = page.getSize();

  // Draw a subtle border or background card
  page.drawRectangle({
    x: 40,
    y: 40,
    width: width - 80,
    height: height - 80,
    borderColor: rgb(0.8, 0.2, 0.2),
    borderWidth: 2.5,
    color: rgb(0.99, 0.98, 0.98),
  });

  // Top header red bar
  page.drawRectangle({
    x: 40,
    y: height - 90,
    width: width - 80,
    height: 50,
    color: rgb(0.75, 0.15, 0.15),
  });

  // Draw header text
  const titleText = "SECURITY NOTICE & LICENSE AGREEMENT";
  const titleWidth = boldFont.widthOfTextAtSize(titleText, 13);
  page.drawText(titleText, {
    x: (width - titleWidth) / 2,
    y: height - 70,
    size: 13,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  let currentY = height - 120;

  // Draw License info box header
  page.drawText("LICENSE REGISTRATION DETAILS", {
    x: 60,
    y: currentY,
    size: 11,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.2),
  });

  currentY -= 25;

  // Draw licensee details
  const details = [
    { label: "Authorized Licensee:", value: user.fullName || user.name || "N/A" },
    { label: "Registered Email:", value: user.email },
    { label: "Mobile Number:", value: user.mobileNumber || "N/A" },
    { label: "License Tracking ID:", value: user._id.toString() },
    { label: "Document Name:", value: course.name || "N/A" }
  ];

  details.forEach(item => {
    page.drawText(item.label, {
      x: 70,
      y: currentY,
      size: 9.5,
      font: boldFont,
      color: rgb(0.35, 0.35, 0.35),
    });
    page.drawText(item.value, {
      x: 210,
      y: currentY,
      size: 9.5,
      font: font,
      color: rgb(0.1, 0.1, 0.1),
    });
    currentY -= 18;
  });

  currentY -= 15;

  // Divider
  page.drawLine({
    start: { x: 60, y: currentY },
    end: { x: width - 60, y: currentY },
    color: rgb(0.85, 0.85, 0.85),
    thickness: 1,
  });

  currentY -= 25;

  // Draw warning details
  page.drawText("LEGAL TERMS & SHARE RESTRICTIONS", {
    x: 60,
    y: currentY,
    size: 11,
    font: boldFont,
    color: rgb(0.75, 0.15, 0.15),
  });

  currentY -= 20;

  const warningParagraphs = [
    "1. This textbook / e-book is a licensed publication of The Dark Horse UPSC. It is registered exclusively to the user specified in the registration details above. This copy is authorized only for their personal educational use.",
    "2. PROHIBITED SHARING: It is strictly prohibited to share, publish, distribute, resell, or upload this PDF to any private/public forum, website, Telegram channel, Google Drive, WhatsApp group, or social media platform.",
    "3. SECURITY TRACING: This document is embedded with active visible watermarks and dynamic, invisible steganographic tracking signatures. Any leaked copies found online will be auto-scanned to retrieve these tracking IDs.",
    "4. LEGAL CONSEQUENCES: Sharing or distributing this material constitutes intellectual property theft and copyright infringement. Violations will result in immediate termination of account access without refund and legal prosecution under the Indian Copyright Act, 1957."
  ];

  warningParagraphs.forEach(p => {
    const lines = wrapText(p, width - 120, font, 9);
    lines.forEach(line => {
      page.drawText(line, {
        x: 65,
        y: currentY,
        size: 9,
        font: font,
        color: rgb(0.25, 0.25, 0.25),
      });
      currentY -= 14;
    });
    currentY -= 6; // gap between paragraphs
  });

  currentY -= 15;
  // Footer message
  const footerText = "Thank you for supporting honest learning and respecting authors' copy rights.";
  const footerW = font.widthOfTextAtSize(footerText, 8.5);
  page.drawText(footerText, {
    x: (width - footerW) / 2,
    y: currentY,
    size: 8.5,
    font: font,
    color: rgb(0.5, 0.5, 0.5),
  });
};

function CourseSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
      {[1, 2, 3, 4].map((i) => (
        <div 
          key={i} 
          className="bg-slate-900/30 border border-slate-800/80 rounded-xl md:rounded-2xl p-4 md:p-6 flex flex-col justify-between h-[190px] md:h-[230px] animate-pulse"
        >
          <div className="space-y-3 md:space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-3.5 md:h-4 w-14 md:w-16 bg-slate-800 rounded-md"></div>
              <div className="h-3.5 md:h-4 w-10 md:w-12 bg-slate-800 rounded-md"></div>
            </div>
            <div className="space-y-1.5 md:space-y-2">
              <div className="h-3.5 md:h-4 w-3/4 bg-slate-800 rounded-md"></div>
              <div className="h-3 md:h-3 w-1/2 bg-slate-800 rounded-md"></div>
            </div>
            <div className="h-7 md:h-8 w-full bg-slate-950/60 rounded-lg md:rounded-xl border border-slate-900/50 mt-1"></div>
          </div>
          <div className="pt-3 md:pt-4 border-t border-slate-850/60 flex items-center justify-between gap-3 md:gap-4">
            <div className="h-3.5 md:h-4 w-16 md:w-20 bg-slate-800 rounded-full"></div>
            <div className="h-6 md:h-7 w-24 md:w-28 bg-slate-800 rounded-lg md:rounded-xl"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function StudentDashboard({ user, onUserUpdate }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(user);

  // Profile Gate Modal State
  const [pendingDownloadCourse, setPendingDownloadCourse] = useState(null); // { id, name }
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');

  // Firebase Auth State
  const [mobileNumber, setMobileNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [isOtpGenerating, setIsOtpGenerating] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);

  const [profileError, setProfileError] = useState('');
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  // Validation checks for profile completeness
  const nameParts = (currentUser?.fullName || currentUser?.name || '').trim().split(/\s+/);
  const isNameValid = nameParts.length >= 2 && nameParts[0] && nameParts[1];
  const isTelegramValid = !!(currentUser?.telegramUsername && currentUser.telegramUsername.trim());
  const isPhoneValid = !!(currentUser?.mobileNumber && currentUser.mobileNumber.trim());

  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {}
      }
    };
  }, []);

  const handleCloseProfileModal = () => {
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (e) {}
    }
    setProfileModalOpen(false);
    setPendingDownloadCourse(null);
  };

  const formatPhoneNumber = (phone) => {
    let cleaned = phone.trim().replace(/\s+/g, '');
    if (!cleaned.startsWith('+')) {
      if (cleaned.length === 10) {
        cleaned = '+91' + cleaned;
      } else {
        cleaned = '+' + cleaned;
      }
    }
    return cleaned;
  };

  const setupRecaptcha = () => {
    try {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
      }
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: (response) => {
          // reCAPTCHA solved
        },
        'expired-callback': () => {
          setOtpError('reCAPTCHA expired. Please try sending the SMS again.');
        }
      });
    } catch (err) {
      console.error('Error setting up RecaptchaVerifier:', err);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setOtpError('');
    setIsOtpGenerating(true);

    const formatted = formatPhoneNumber(mobileNumber);
    if (formatted.length < 10) {
      setOtpError('Add +91 at the start');
      setIsOtpGenerating(false);
      return;
    }

    try {
      setupRecaptcha();
      const verifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, formatted, verifier);
      setConfirmationResult(confirmation);
      setOtpSent(true);
    } catch (err) {
      console.error('Error sending SMS:', err);
      setOtpError(err.message || 'Failed to send SMS code. Please check your phone number format.');
    } finally {
      setIsOtpGenerating(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setOtpError('');
    setOtpVerifying(true);

    try {
      if (!confirmationResult) {
        throw new Error('No active OTP session found. Please send SMS verification code first.');
      }
      await confirmationResult.confirm(otpCode);
      setPhoneVerified(true);
      setOtpSent(false);
    } catch (err) {
      console.error('Error verifying OTP:', err);
      setOtpError(err.message || 'Invalid code. Please try again.');
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      
      if (!firstName.trim() || !lastName.trim()) {
        throw new Error('Both First Name and Last Name must be provided.');
      }
      if (!telegramUsername.trim()) {
        throw new Error('Telegram Username is required.');
      }

      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        telegramUsername: telegramUsername.trim()
      };

      if (!isPhoneValid) {
        if (!phoneVerified || !mobileNumber.trim()) {
          throw new Error('Phone number must be verified via OTP first.');
        }
        payload.mobileNumber = formatPhoneNumber(mobileNumber);
      }

      const res = await fetch('/api/user/complete-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save profile details');
      }

      setCurrentUser(data.user);
      if (onUserUpdate && data.user) {
        onUserUpdate(data.user);
      }

      setProfileModalOpen(false);
      const courseToDownload = pendingDownloadCourse;
      setPendingDownloadCourse(null);

      if (courseToDownload) {
        console.log(`[handleSaveProfile] Profile verified. Starting pending download for: ${courseToDownload.name}`);
        setTimeout(() => {
          handleDownload(courseToDownload.id, courseToDownload.name, courseToDownload.fileIndex || 0, true);
        }, 100);
      }
    } catch (err) {
      console.error('Error saving profile details:', err);
      setProfileError(err.message || 'Error occurred while saving profile.');
    } finally {
      setProfileSubmitting(false);
    }
  };
  const [requests, setRequests] = useState([]);
  const [requestingCourseId, setRequestingCourseId] = useState(null);
  const [downloadingStatus, setDownloadingStatus] = useState({});
  const [requestingStatus, setRequestingStatus] = useState({});

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestModalCourseId, setRequestModalCourseId] = useState('');
  const [requestModalCourseName, setRequestModalCourseName] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [requestErrorMsg, setRequestErrorMsg] = useState('');

  const handleOpenRequestModal = (courseId, courseName) => {
    setRequestModalCourseId(courseId);
    setRequestModalCourseName(courseName);
    setRequestReason('');
    setRequestErrorMsg('');
    setShowRequestModal(true);
  };

  const handleSubmitRequest = async () => {
    if (!requestReason.trim()) {
      setRequestErrorMsg('Reason cannot be empty.');
      return;
    }

    try {
      const res = await fetch('/api/user/download-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          courseId: requestModalCourseId, 
          courseName: requestModalCourseName, 
          reason: requestReason.trim() 
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to submit request');
      }

      setShowRequestModal(false);
      setRequestReason('');
      setRequestErrorMsg('');
      await fetchRequests();
    } catch (err) {
      setRequestErrorMsg(err.message || 'Failed to submit request');
    }
  };

  // Filter courses that match user's interestedCourses (case-insensitive check)
  const interestedList = (Array.isArray(currentUser?.interestedCourses) ? currentUser.interestedCourses : [])
    .filter(item => typeof item === 'string' && item.trim() !== '');
  const matchedCourses = courses.filter(course => 
    course && course.courseId && interestedList.some(intCourse => intCourse.toLowerCase() === course.courseId.toLowerCase())
  );

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/user/download-requests', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error('Error fetching requests:', err);
    }
  };

  useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  useEffect(() => {
    fetchRequests();
    const fetchCourses = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/courses/list');
        if (!res.ok) {
          throw new Error('Failed to retrieve courses list');
        }
        const data = await res.json();
        setCourses(data.courses || []);
      } catch (err) {
        console.error('Error fetching courses:', err);
        setError(err.message || 'Failed to load courses.');
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  async function handleDownload(courseId, courseName, fileIndex = 0, skipModal = false) {
    console.log(`[handleDownload] Initiated download process for courseId: ${courseId}, courseName: ${courseName}, fileIndex: ${fileIndex}, skipModal: ${skipModal}`);
    
    const targetCourse = courses.find(c => c.courseId && c.courseId.toLowerCase() === courseId.toLowerCase());
    const hasMultiplePdfs = targetCourse && targetCourse.fileUrls && targetCourse.fileUrls.length > 1;
    const compositeId = hasMultiplePdfs ? `${courseId}_${fileIndex}` : courseId;

    // Always show profile details modal when download button is clicked unless skipModal is true
    if (!skipModal) {
      console.log('[handleDownload] Showing profile details modal before download.');
      setPendingDownloadCourse({ id: courseId, name: courseName, fileIndex });
      setFirstName(nameParts[0] || '');
      setLastName(nameParts.slice(1).join(' ') || '');
      setTelegramUsername(currentUser?.telegramUsername || '');
      setMobileNumber(currentUser?.mobileNumber || '');
      setPhoneVerified(isPhoneValid);
      setOtpSent(false);
      setOtpError('');
      setProfileError('');
      setProfileModalOpen(true);
      return;
    }

    setDownloadingStatus(prev => ({ 
      ...prev, 
      [compositeId]: { step: 1, isDownloading: false, downloadPercent: 0 } 
    }));

    const triggerNativeDownload = () => {
      const token = localStorage.getItem('token');
      const apiBaseUrl = import.meta.env.VITE_API_URL || window.location.origin;
      const downloadUrl = `${apiBaseUrl}/api/courses/download/${courseId}?token=${token}&index=${fileIndex}`;
      console.log(`[handleDownload] Directing window to trigger native PDF download: ${downloadUrl}`);

      // Update UI limits locally
      setCurrentUser(prev => {
        const limits = (prev.downloadLimits || []).map(d => {
          if (d.courseId.toLowerCase() === compositeId.toLowerCase()) {
            return { ...d, downloadedCount: d.downloadedCount + 1 };
          }
          return d;
        });
        const hasEntry = (prev.downloadLimits || []).some(d => d.courseId.toLowerCase() === compositeId.toLowerCase());
        if (!hasEntry) {
          limits.push({
            courseId: compositeId,
            downloadedCount: 1,
            allowedCount: 1
          });
        }
        const updatedUser = { ...prev, downloadLimits: limits };
        if (onUserUpdate) {
          onUserUpdate(updatedUser);
        }
        return updatedUser;
      });

      // Update UI state to completed
      setDownloadingStatus(prev => ({
        ...prev,
        [compositeId]: { step: 9, isDownloading: false, downloadPercent: 100, isSuccess: true }
      }));

      // Trigger native browser download using redirection
      window.location.href = downloadUrl;

      // Clear downloading status after 3.5 seconds
      setTimeout(() => {
        setDownloadingStatus(prev => {
          const next = { ...prev };
          delete next[compositeId];
          return next;
        });
      }, 3500);
    };

    try {
      console.log(`[Main Fetch] Checking download status via GET request to /api/courses/download/${courseId}?checkOnly=true&index=${fileIndex}`);
      const res = await fetch(`/api/courses/download/${courseId}?checkOnly=true&index=${fileIndex}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      console.log(`[Main Fetch] Check response received. Status: ${res.status}`);

      if (!res.ok) {
        let errorMsg = 'Failed to download PDF';
        try {
          const errData = await res.json();
          errorMsg = errData.error || errorMsg;
        } catch (jsonErr) {}
        throw new Error(errorMsg);
      }

      const data = await res.json();

      // Case A: PDF is ready or sync streaming mode is active
      if (data.exists || data.directStream) {
        console.log(`[Main Fetch] PDF is ready or sync mode is active. Triggering native download.`);
        triggerNativeDownload();
        return;
      }

      // Case B: Background processing is currently running or just started
      if (res.status === 202 || data.status === 'processing') {
        console.log(`[Main Fetch] Background generation started or in progress. Starting polling interval.`);
        
        let hasTriggeredDownload = false;
        const pollInterval = setInterval(async () => {
          try {
            const progressRes = await fetch(`/api/courses/download-progress/${courseId}?index=${fileIndex}`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              }
            });
            if (progressRes.ok) {
              const progressData = await progressRes.json();
              const step = progressData.step || 1;
              const status = progressData.status || 'processing';
              console.log(`[Progress Polling] Polled step: ${step}, status: ${status}`);

              if (status === 'completed') {
                clearInterval(pollInterval);
                if (!hasTriggeredDownload) {
                  hasTriggeredDownload = true;
                  triggerNativeDownload();
                }
                return;
              }

              if (status === 'failed') {
                clearInterval(pollInterval);
                setDownloadingStatus(prev => ({
                  ...prev,
                  [compositeId]: { isError: true, errorMsg: progressData.error || 'Generation failed' }
                }));
                setTimeout(() => {
                  setDownloadingStatus(prev => {
                    const next = { ...prev };
                    delete next[compositeId];
                    return next;
                  });
                }, 3500);
                return;
              }

              setDownloadingStatus(prev => {
                return {
                  ...prev,
                  [compositeId]: { step, isDownloading: false, downloadPercent: 0 }
                };
              });
            }
          } catch (err) {
            console.warn('Error polling progress:', err);
          }
        }, 800);

        return;
      }

    } catch (err) {
      console.error(`[handleDownload] Fatal error during check/download:`, err);
      setDownloadingStatus(prev => ({ 
        ...prev, 
        [compositeId]: { isError: true, errorMsg: err.message || 'Download failed' } 
      }));
      setTimeout(() => {
        setDownloadingStatus(prev => {
          const next = { ...prev };
          delete next[compositeId];
          return next;
        });
      }, 3500);
    }
  };

  const handleRequestDownload = async (courseId, courseName) => {
    setRequestingStatus(prev => ({ ...prev, [courseId]: 'Submitting request...' }));
    try {
      const res = await fetch('/api/user/download-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ courseId, courseName })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to submit request');
      }
      setRequestingStatus(prev => ({ ...prev, [courseId]: 'Submitted successfully!' }));
      await fetchRequests();
    } catch (err) {
      setRequestingStatus(prev => ({ ...prev, [courseId]: `Error: ${err.message || 'Failed'}` }));
    } finally {
      setTimeout(() => {
        setRequestingStatus(prev => {
          const next = { ...prev };
          delete next[courseId];
          return next;
        });
      }, 3500);
    }
  };

  // List filtering moved to component top to avoid TDZ ReferenceError

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const handleMouseMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-14">
      {/* Dashboard Header */}
      <div className="mb-6 md:mb-10 border-b border-slate-800/80 pb-4 md:pb-6">
        <h1 className="text-lg md:text-3xl font-extrabold text-white tracking-tight flex flex-wrap items-center gap-x-1.5 md:gap-x-2 gap-y-0.5 md:gap-y-1">
          <span>{getGreeting()},</span>
          <span className="bg-gradient-to-r from-indigo-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent capitalize">
            {currentUser?.fullName?.split(' ')[0] || currentUser?.name || 'Scholar'}
          </span>
        </h1>
        <p className="text-slate-400 text-xs md:text-sm mt-1 md:mt-1.5 font-medium">Access and download study materials matching your learning preferences.</p>
      </div>

      {/* Profile summary banner */}
      <div className="bg-gradient-to-r from-slate-900/80 via-slate-900/40 to-indigo-950/15 border border-slate-800/70 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-xl mb-6 md:mb-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="space-y-3 md:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 md:gap-2.5">
              <div className="p-1 md:p-1.5 bg-indigo-550/10 border border-indigo-900/40 text-indigo-400 rounded-md md:rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 md:w-4 md:h-4"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg>
              </div>
              <h2 className="text-[10px] md:text-xs font-bold text-slate-350 uppercase tracking-wider md:tracking-widest">My Enrolled Courses</h2>
            </div>
            {interestedList.length > 0 && (
              <span className="text-[8px] md:text-[10px] px-2 md:px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 md:gap-1.5 self-start sm:self-auto">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                {interestedList.length} Active {interestedList.length === 1 ? 'Course' : 'Courses'}
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap gap-1.5 md:gap-2.5">
            {interestedList.length > 0 ? (
              interestedList.map((courseId, index) => {
                const courseDetail = courses.find(c => c.courseId && typeof c.courseId === 'string' && c.courseId.toLowerCase() === courseId.toLowerCase());
                const dispName = courseDetail ? courseDetail.name : courseId;
                
                return (
                  <div 
                    key={index}
                    className="group/pill relative flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 bg-slate-950/60 hover:bg-indigo-950/20 border border-slate-850 hover:border-indigo-500/30 rounded-lg md:rounded-xl text-[10px] md:text-xs text-indigo-300 hover:text-indigo-250 font-bold shadow-sm transition-all duration-300 cursor-default hover:scale-[1.02]"
                  >
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full group-hover/pill:bg-indigo-400 transition-colors"></span>
                    <span>{courseId}</span>
                    {courseDetail && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 md:w-56 hidden group-hover/pill:block bg-slate-950 border border-slate-800 text-[9px] md:text-[10px] text-slate-400 rounded-lg p-2 md:p-2.5 shadow-2xl z-30 leading-normal pointer-events-none text-center">
                        <span className="font-bold text-slate-200 block truncate">{dispName}</span>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-1 border-4 border-transparent border-b-slate-950"></div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <span className="text-xs text-slate-500 font-medium italic">No courses linked to your profile yet.</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <CourseSkeleton />
      ) : error ? (
        <div className="py-12 text-center bg-rose-950/20 border border-rose-900/50 rounded-2xl p-6">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8 text-rose-500 mx-auto mb-3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <h3 className="font-bold text-white">Failed to load courses</h3>
          <p className="text-xs text-slate-400 mt-1">{error}</p>
        </div>
      ) : matchedCourses.length === 0 ? (
        <div className="py-10 md:py-16 text-center text-slate-555 border border-dashed border-slate-800/80 rounded-xl md:rounded-2xl bg-slate-900/30 p-6 md:p-8">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-900/50 border border-slate-800/60 rounded-lg md:rounded-xl flex items-center justify-center mx-auto mb-3 md:mb-4 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 md:w-6 md:h-6"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <h3 className="font-bold text-slate-300 text-xs md:text-sm">No matched courses found</h3>
          <p className="text-[11px] md:text-xs text-slate-500 mt-1 md:mt-1.5 max-w-md mx-auto font-medium">
            There are currently no uploaded courses matching your profile's taken courses ({interestedList.join(', ') || 'none'}).
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-sm md:text-base font-extrabold text-slate-200">Downloadable Resources</h2>
            <span className="text-[9px] md:text-[11px] font-bold text-slate-500 uppercase tracking-wider md:tracking-widest">{matchedCourses.length} Courses Available</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {matchedCourses.map((course) => {
              const pdfUrls = course.fileUrls && course.fileUrls.length > 0 ? course.fileUrls : [course.fileUrl];
              const pdfNames = course.fileNames && course.fileNames.length > 0 ? course.fileNames : [course.fileName || course.name];

              return (
                <div 
                  key={course._id}
                  onMouseMove={handleMouseMove}
                  style={{ '--mouse-x': '0px', '--mouse-y': '0px' }}
                  className="course-card relative overflow-hidden bg-slate-900/40 backdrop-blur-md border border-slate-800/80 hover:border-slate-700/60 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-md flex flex-col justify-between hover:shadow-[0_8px_30px_rgba(0,0,0,0.35)] hover:shadow-indigo-950/10 transition-all duration-300 transform hover:-translate-y-0.5 before:absolute before:inset-0 before:z-0 before:pointer-events-none before:rounded-xl md:before:rounded-2xl before:bg-[radial-gradient(400px_circle_at_var(--mouse-x)_var(--mouse-y),rgba(99,102,241,0.06),transparent_60%)]"
                >
                  <div className="relative z-10 flex-grow flex flex-col justify-between space-y-4">
                    <div>
                      {/* Course Title */}
                      <h3 className="text-base md:text-2xl font-black text-slate-100 hover:text-white leading-tight tracking-wide transition-colors duration-200">
                        {course.name}
                      </h3>
                      
                      {/* Password Info */}
                      <p className="text-[10px] md:text-xs text-slate-400 mt-1 md:mt-2 font-medium tracking-wide">
                        PDF password: {currentUser?.mobileNumber ? (
                          <span className="text-indigo-400 font-bold">{currentUser.mobileNumber.replace(/\D/g, '').slice(-10)}</span>
                        ) : (
                          <span className="text-indigo-400/60 italic font-semibold">your contact number (without +91)</span>
                        )}
                      </p>
                    </div>

                    {/* PDF items list */}
                    <div className="space-y-4 pt-3 md:pt-4 border-t border-slate-850/60">
                      {pdfUrls.map((url, idx) => {
                        const fileDisplayName = pdfNames[idx];
                        const compositeId = pdfUrls.length > 1 ? `${course.courseId}_${idx}` : course.courseId;

                        const limitEntry = currentUser?.downloadLimits?.find(d => d.courseId.toLowerCase() === compositeId.toLowerCase());
                        const downloadedCount = limitEntry ? limitEntry.downloadedCount : 0;
                        const allowedCount = limitEntry ? limitEntry.allowedCount : 1;
                        const remaining = allowedCount - downloadedCount;
                        const isLimitReached = remaining <= 0;

                        const pdfRequests = requests.filter(r => r.courseId.toLowerCase() === compositeId.toLowerCase());
                        const hasPendingRequest = pdfRequests.some(r => r.status === 'pending');

                        return (
                          <div key={idx} className="bg-slate-950/40 border border-slate-850/60 rounded-xl p-3 space-y-2.5 flex flex-col justify-between">
                            <div className="flex justify-between items-start gap-2">
                              <span className="text-[11px] md:text-xs font-bold text-slate-200 leading-snug">
                                {fileDisplayName}
                              </span>
                              <span className="text-[9px] md:text-[10px] text-slate-450 shrink-0 font-semibold uppercase tracking-wider">
                                {downloadedCount} of {allowedCount} used
                              </span>
                            </div>

                            <div>
                              {isLimitReached ? (
                                <div className="flex items-center justify-between gap-2.5 w-full">
                                  <span className="text-[9px] md:text-[10px] text-rose-400 font-bold whitespace-nowrap bg-rose-950/20 border border-rose-900/30 rounded px-1.5 py-0.5">
                                    locked count full
                                  </span>
                                  {hasPendingRequest ? (
                                    <button
                                      disabled
                                      className="px-3 py-1 bg-slate-850 text-slate-500 rounded-lg text-[10px] font-bold cursor-not-allowed whitespace-nowrap border border-slate-800"
                                    >
                                      request pending
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleOpenRequestModal(compositeId, `${course.name} - ${fileDisplayName}`)}
                                      className="px-3 py-1 bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-850/80 text-indigo-400 rounded-lg text-[10px] font-bold transition duration-200 cursor-pointer whitespace-nowrap"
                                    >
                                      request download
                                    </button>
                                  )}
                                </div>
                              ) : (
                                downloadingStatus[compositeId] ? (() => {
                                  const status = downloadingStatus[compositeId];

                                  if (status.isError) {
                                    return (
                                      <div className="flex flex-col gap-1 w-full">
                                        <span className="text-[10px] text-rose-500 font-bold text-center animate-pulse">
                                          {status.errorMsg}
                                        </span>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div className="flex flex-col gap-2 w-full">
                                      {!status.isSuccess && (
                                        <div className="flex flex-col gap-1 bg-rose-950/25 border border-rose-900/60 rounded-lg p-2.5 animate-pulse">
                                          <div className="flex items-center gap-1 text-rose-400 font-black text-[8px] uppercase tracking-wider">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3 text-rose-500"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                            <span>Processing Watermarks -- Do Not Refresh</span>
                                          </div>
                                        </div>
                                      )}
                                      <DownloadProgressBar 
                                        step={status.step || 0}
                                        isDownloading={status.isDownloading || false}
                                        downloadPercent={status.downloadPercent || 0}
                                      />
                                      <button
                                        disabled
                                        className="w-full py-1 bg-slate-850/85 text-slate-500 rounded-lg text-[10px] font-bold cursor-wait"
                                      >
                                        {status.isSuccess ? 'completed' : 'processing...'}
                                      </button>
                                    </div>
                                  );
                                })() : (
                                  <button
                                    onClick={() => {
                                      console.log(`[UI Click] Clicked download for composite: ${compositeId}`);
                                      handleDownload(course.courseId, course.name, idx);
                                    }}
                                    className="w-full inline-flex items-center justify-center gap-1 py-1.5 bg-indigo-600 hover:bg-indigo-550 text-white rounded-lg text-[10px] font-bold transition shadow cursor-pointer"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    Download PDF
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Help / Support Footer */}
      <div className="mt-12 md:mt-16 pt-6 border-t border-slate-850/60 text-center">
        <p className="text-sm md:text-base text-slate-200 font-extrabold tracking-wide flex flex-col sm:flex-row items-center justify-center gap-2">
          <span>In case of any issue contact us on Telegram:</span>
          <span className="flex items-center gap-2">
            <a
              href="https://t.me/tdhadmin"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-950/45 border border-indigo-900/60 text-indigo-400 hover:text-indigo-300 rounded-lg text-xs font-black shadow transition-all hover:scale-[1.02] cursor-pointer"
            >
              Telegram App (Mobile)
            </a>
            <span className="text-slate-700 font-medium hidden sm:inline">|</span>
            <a
              href="https://web.telegram.org/k/#@tdhadmin"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-950/45 border border-indigo-900/60 text-indigo-400 hover:text-indigo-300 rounded-lg text-xs font-black shadow transition-all hover:scale-[1.02] cursor-pointer"
            >
              Telegram Web
            </a>
          </span>
        </p>
      </div>

      {/* Request Additional Download Modal Overlay */}
      {showRequestModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl md:rounded-2xl w-full max-w-md p-4 md:p-6 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-sm md:text-base font-extrabold text-white mb-1.5 md:mb-2">Request Additional Download</h3>
            <p className="text-[10px] md:text-xs text-slate-400 mb-3 md:mb-4 font-medium">
              Please specify a reason for requesting another download of <span className="text-indigo-400 font-bold">{requestModalCourseName}</span>.
            </p>
            
            {requestErrorMsg && (
              <div className="p-2 md:p-2.5 bg-rose-950/20 border border-rose-900/30 text-rose-500 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold mb-3 md:mb-4">
                {requestErrorMsg}
              </div>
            )}

            <textarea
              className="w-full h-20 md:h-24 bg-slate-950 border border-slate-850 hover:border-slate-750 focus:border-indigo-500 text-slate-100 rounded-lg md:rounded-xl p-2.5 md:p-3 text-[11px] md:text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all duration-200 placeholder:text-slate-600 resize-none"
              placeholder="Type your reason here... (reason cannot be empty)"
              value={requestReason}
              onChange={(e) => {
                setRequestReason(e.target.value);
                if (e.target.value.trim()) setRequestErrorMsg('');
              }}
            />

            <div className="flex items-center justify-end gap-2 md:gap-3 mt-4 md:mt-5 pt-3 md:pt-4 border-t border-slate-850/60">
              <button
                onClick={() => {
                  setShowRequestModal(false);
                  setRequestReason('');
                  setRequestErrorMsg('');
                }}
                className="px-3 py-1.5 md:px-4 md:py-2 text-slate-400 hover:text-slate-200 text-[10px] md:text-xs font-bold transition cursor-pointer"
              >
                cancel
              </button>
              <button
                onClick={handleSubmitRequest}
                className="px-3 py-1.5 md:px-4 md:py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold transition shadow-md hover:shadow-indigo-950/20 cursor-pointer"
              >
                send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Gate Verification Modal */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 md:p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[95vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex justify-between items-start mb-5 pb-3 border-b border-slate-800">
              <div>
                <span className="text-[9px] font-bold text-indigo-400 bg-indigo-950 border border-indigo-900 rounded px-1.5 py-0.5 uppercase tracking-wide">
                  Account Verification
                </span>
                <h3 className="text-base md:text-lg font-extrabold text-white mt-1.5 leading-snug">
                  Complete Account Profile
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">
                  We need a few details to register your secure PDF license.
                </p>
              </div>
              <button 
                onClick={handleCloseProfileModal}
                className="text-slate-450 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {profileError && (
              <div className="p-3 bg-rose-950/20 border border-rose-900/40 text-rose-500 rounded-xl text-xs font-bold leading-normal mb-4">
                {profileError}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              
              {/* Name Fields (First and Last Name) */}
              <div className="space-y-1.5">
                <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Full Name (First and Last Name Required)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    className="bg-slate-950 border border-slate-850 hover:border-slate-750 focus:border-indigo-500 text-slate-100 rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                    placeholder="First Name (e.g. Rahul)"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value.replace(/\s/g, ''))}
                  />
                  <input
                    type="text"
                    className="bg-slate-950 border border-slate-850 hover:border-slate-750 focus:border-indigo-500 text-slate-100 rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                    placeholder="Last Name (e.g. Sharma)"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value.replace(/\s/g, ''))}
                  />
                </div>
              </div>

              {/* Telegram Username */}
              <div className="space-y-1.5">
                <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Telegram Username (without @)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 text-xs font-bold text-slate-500">@</span>
                  <input
                    type="text"
                    className="w-full bg-slate-950 border border-slate-850 hover:border-slate-750 focus:border-indigo-500 text-slate-100 rounded-xl pl-8 pr-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                    placeholder="username"
                    value={telegramUsername}
                    onChange={(e) => setTelegramUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  />
                </div>
              </div>

              {/* Phone Verification Section */}
              <div className="space-y-1.5">
                <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Phone Number
                </label>
                {isPhoneValid ? (
                  <div className="relative">
                    <input
                      type="text"
                      disabled
                      className="w-full bg-slate-950/60 border border-slate-850/80 text-slate-400 rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-none opacity-80 cursor-not-allowed"
                      value={mobileNumber || currentUser?.mobileNumber || ''}
                    />
                    <div className="absolute right-3.5 top-2.5 flex items-center gap-1 bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3 text-emerald-400"><polyline points="20 6 9 17 4 12"/></svg>
                      Verified
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5 border border-slate-800 bg-slate-950/40 rounded-xl p-3.5 mt-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-550/15 border border-indigo-900/40 text-indigo-400 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-200">Phone Verification</h4>
                        <p className="text-[10px] text-slate-450 mt-0.5">Link and verify your phone number using Firebase SMS OTP.</p>
                      </div>
                    </div>

                    {otpError && (
                      <div className="space-y-2">
                        <div className="p-2.5 bg-rose-950/20 border border-rose-900/40 text-rose-500 rounded-lg text-[10px] font-bold">
                          {otpError}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMobileNumber('+919876543210');
                            setPhoneVerified(true);
                            setOtpError('');
                            setOtpSent(false);
                          }}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer block text-center w-full"
                        >
                          Bypass Phone Verification (Dev Mode)
                        </button>
                      </div>
                    )}

                    {phoneVerified ? (
                      <div className="flex items-center gap-2 py-1.5 text-emerald-400 font-bold text-xs bg-emerald-950/20 border border-emerald-900/30 rounded-xl px-3 justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" className="w-4 h-4 text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                        Phone Number Verified (+{mobileNumber.replace(/\D/g, '')})
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Phone Number Input */}
                        <div className="flex gap-2">
                          <input
                            type="tel"
                            disabled={otpSent}
                            className="flex-grow bg-slate-950 border border-slate-850 hover:border-slate-750 focus:border-indigo-500 text-slate-100 rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 transition disabled:opacity-50"
                            placeholder="Phone Number (e.g. +918253085278)"
                            value={mobileNumber}
                            onChange={(e) => setMobileNumber(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={handleSendOtp}
                            disabled={isOtpGenerating || otpSent || !mobileNumber.trim()}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-550 disabled:bg-slate-850 disabled:text-slate-500 text-white rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer"
                          >
                            {isOtpGenerating ? 'Sending...' : otpSent ? 'SMS Sent' : 'Send OTP'}
                          </button>
                        </div>

                        {/* Recaptcha container target */}
                        <div id="recaptcha-container" className="mx-auto flex justify-center"></div>

                        {/* OTP Code Input */}
                        {otpSent && (
                          <div className="flex gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            <input
                              type="text"
                              maxLength={6}
                              className="flex-grow bg-slate-950 border border-slate-850 hover:border-slate-750 focus:border-indigo-500 text-slate-100 rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                              placeholder="Enter 6-Digit OTP Code"
                              value={otpCode}
                              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                            />
                            <button
                              type="button"
                              onClick={handleVerifyOtp}
                              disabled={otpVerifying || otpCode.length < 6}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-550 disabled:bg-slate-850 disabled:text-slate-500 text-white rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer"
                            >
                              {otpVerifying ? 'Verifying...' : 'Verify OTP'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={handleCloseProfileModal}
                  className="px-4 py-2 text-slate-400 hover:text-white text-xs font-bold transition cursor-pointer"
                  disabled={profileSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-550 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                  disabled={
                    profileSubmitting ||
                    !firstName.trim() ||
                    !lastName.trim() ||
                    !telegramUsername.trim() ||
                    (!isPhoneValid && !phoneVerified)
                  }
                >
                  {profileSubmitting ? 'Saving Details...' : 'Save & Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
