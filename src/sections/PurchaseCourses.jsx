import { useState, useEffect, useRef } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
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

const SUBJECT_NAMES = {
  'GS-1': 'GS-1: Culture, History, Geography, Society',
  'GS-2': 'GS-2: Governance, Constitution, Polity, Social Justice',
  'GS-3': 'GS-3: Science & Tech, Economic Dev, Bio-diversity, Security',
  'GS-4': 'GS-4: Ethics, Integrity & Aptitude',
};

const OPTIONAL_NAMES = {
  OptionalSubjectAgriculture: 'Optional: Agriculture',
  OptionalSubjectAnimalHusbandryAndVeterinaryScience: 'Optional: Animal Husbandry & Veterinary Science',
  OptionalSubjectAnthropology: 'Optional: Anthropology',
  OptionalSubjectBotany: 'Optional: Botany',
  OptionalSubjectChemistry: 'Optional: Chemistry',
  OptionalSubjectCivilEngineering: 'Optional: Civil Engineering',
  OptionalSubjectCommerceAndAccountancy: 'Optional: Commerce & Accountancy',
  OptionalSubjectEconomics: 'Optional: Economics',
  OptionalSubjectElectricalEngineering: 'Optional: Electrical Engineering',
  OptionalSubjectGeography: 'Optional: Geography',
  OptionalSubjectGeology: 'Optional: Geology',
  OptionalSubjectHistory: 'Optional: History',
  OptionalSubjectLaw: 'Optional: Law',
  OptionalSubjectMangement: 'Optional: Management',
  OptionalSubjectMathematics: 'Optional: Mathematics',
  OptionalSubjectMechanicalEngineering: 'Optional: Mechanical Engineering',
  OptionalSubjectMedicalScience: 'Optional: Medical Science',
  OptionalSubjectPhilosophy: 'Optional: Philosophy',
  OptionalSubjectPhysics: 'Optional: Physics',
  OptionalSubjectPoliticalScienceAndInternationalRelations: 'Optional: Political Science & International Relations',
  OptionalSubjectPsychology: 'Optional: Psychology',
  OptionalSubjectPublicAdministration: 'Optional: Public Administration',
  OptionalSubjectSociology: 'Optional: Sociology',
  OptionalSubjectStatistics: 'Optional: Statistics',
  OptionalSubjectZoology: 'Optional: Zoology'
};

export default function PurchaseCourses({ user, onUserUpdate }) {
  const [courses, setCourses] = useState([]);
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Modal State
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [upiTxnId, setUpiTxnId] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState('');
  const [modalError, setModalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [zoomQr, setZoomQr] = useState(false);
  const [lastSubmittedRequest, setLastSubmittedRequest] = useState(null);

  // Profile Gate Modal State
  const [pendingPurchaseCourse, setPendingPurchaseCourse] = useState(null);
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

  // Fetch all courses and purchase requests
  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      
      // Fetch all courses
      const courseRes = await fetch('/api/courses/list');
      let courseData = { courses: [] };
      if (courseRes.ok) {
        courseData = await courseRes.json();
      }

      // Fetch user's purchase requests
      let requestsData = [];
      if (token) {
        const reqRes = await fetch('/api/courses/purchase-requests', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (reqRes.ok) {
          requestsData = await reqRes.json();
        }
      }

      setCourses(courseData.courses || []);
      setPurchaseRequests(requestsData || []);
    } catch (err) {
      console.error('Error fetching purchase course details:', err);
      setError('Failed to retrieve course details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const pollingIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  // Validation checks
  const nameParts = (user?.fullName || user?.name || '').trim().split(/\s+/);
  const isNameValid = nameParts.length >= 2 && nameParts[0] && nameParts[1];
  const isTelegramValid = !!(user?.telegramUsername && user.telegramUsername.trim());
  const isPhoneValid = !!(user?.mobileNumber && user.mobileNumber.trim());

  const handleOpenPurchaseModal = (course) => {
    if (!isNameValid || !isTelegramValid || !isPhoneValid) {
      setPendingPurchaseCourse(course);
      setFirstName(nameParts[0] || '');
      setLastName(nameParts[1] || '');
      setTelegramUsername(user?.telegramUsername || '');
      setMobileNumber(user?.mobileNumber || '');
      setPhoneVerified(isPhoneValid);
      setOtpSent(false);
      setOtpError('');
      setProfileError('');
      setProfileModalOpen(true);
      return;
    }

    setSelectedCourse(course);
    setLastSubmittedRequest(null);
    setUpiTxnId('');
    setScreenshot(null);
    setScreenshotPreview('');
    setModalError('');
    setSuccessMessage('');
  };

  const handleClosePurchaseModal = () => {
    setSelectedCourse(null);
  };

  const handleCloseProfileModal = () => {
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (e) {}
    }
    setProfileModalOpen(false);
    setPendingPurchaseCourse(null);
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
      setOtpError('Please enter a valid phone number (e.g. +918253085278).');
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
      const payload = {};
      
      if (!isNameValid) {
        if (!firstName.trim() || !lastName.trim()) {
          throw new Error('Both First Name and Last Name must be provided.');
        }
        payload.firstName = firstName.trim();
        payload.lastName = lastName.trim();
      }
      
      if (!isTelegramValid) {
        if (!telegramUsername.trim()) {
          throw new Error('Telegram Username is required.');
        }
        payload.telegramUsername = telegramUsername.trim();
      }

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

      if (onUserUpdate && data.user) {
        onUserUpdate(data.user);
      }

      // Close profile modal and trigger checkout modal immediately
      setProfileModalOpen(false);
      setSelectedCourse(pendingPurchaseCourse);
      setLastSubmittedRequest(null);
      setUpiTxnId('');
      setScreenshot(null);
      setScreenshotPreview('');
      setModalError('');
      setSuccessMessage('');
      setPendingPurchaseCourse(null);
    } catch (err) {
      console.error('Error saving profile details:', err);
      setProfileError(err.message || 'Error occurred while saving profile.');
    } finally {
      setProfileSubmitting(false);
    }
  };

  const handleScreenshotChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setModalError('Please upload an image file (PNG, JPG, JPEG).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB Limit
      setModalError('Screenshot size must be under 10MB.');
      return;
    }

    setModalError('');
    setScreenshot(file);
    
    // Generate visual preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshotPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    setSuccessMessage('');

    if (!screenshot) {
      setModalError('Please upload the screenshot of your payment.');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('courseId', selectedCourse.courseId);
      formData.append('upiTxnId', upiTxnId.trim());
      formData.append('screenshot', screenshot);

      const res = await fetch('/api/courses/purchase-request', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit request');
      }

      setLastSubmittedRequest(data.request);
      setSuccessMessage('Payment submitted! Admin will verify and activate your course within 6-8 hours.');
      
      // Refresh requests list in background
      const reqRes = await fetch('/api/courses/purchase-requests', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        setPurchaseRequests(reqData);
      }
    } catch (err) {
      console.error('Error submitting checkout:', err);
      setModalError(err.message || 'Error occurred while processing request.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle opening Telegram with pre-filled message to tdhadmin
  const handleTelegramNotify = async (request, course, e) => {
    if (e) e.stopPropagation();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/courses/purchase-requests/${request._id}/notify-telegram`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to notify on Telegram');
      }

      // 1. Update list of requests to synchronize counts
      const updatedRequests = purchaseRequests.map((r) => 
        r._id === request._id ? { ...r, telegramNotificationCount: data.telegramNotificationCount } : r
      );
      setPurchaseRequests(updatedRequests);

      // 2. Update lastSubmittedRequest if that is the one
      if (lastSubmittedRequest && lastSubmittedRequest._id === request._id) {
        setLastSubmittedRequest({
          ...lastSubmittedRequest,
          telegramNotificationCount: data.telegramNotificationCount
        });
      }

      // 3. Trigger redirect to Telegram
      const studentName = user?.fullName || user?.name || 'Student';
      const courseName = course?.name || request?.courseName || 'Course';
      const text = `I am ${studentName} enrolled in ${courseName}, requesting for confirmation and group link`;
      const telegramUrl = `https://t.me/tdhadmin?text=${encodeURIComponent(text)}`;
      window.open(telegramUrl, '_blank');
    } catch (err) {
      console.error('Telegram redirect notify error:', err);
      alert(err.message || 'Error redirecting to Telegram.');
    }
  };

  // Determine course purchase status
  const getCourseStatus = (course) => {
    // 1. Check if course is already in user's interestedCourses
    const interestedList = Array.isArray(user?.interestedCourses) ? user.interestedCourses : [];
    const hasPurchased = interestedList.some(
      (cId) => cId.toLowerCase() === course.courseId.toLowerCase()
    );
    if (hasPurchased) return { type: 'purchased', label: 'Purchased' };

    // 2. Check if user has a pending request
    const pendingRequest = purchaseRequests.find(
      (r) => r.courseId === course.courseId && r.status === 'pending'
    );
    if (pendingRequest) return { type: 'pending', label: 'Pending Verification' };

    // 3. Check if user has a rejected request
    const rejectedRequest = purchaseRequests.find(
      (r) => r.courseId === course.courseId && r.status === 'rejected'
    );
    if (rejectedRequest) return { type: 'rejected', label: 'Rejected (Try Again)' };

    return { type: 'available', label: 'Available' };
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-14">
      {/* Header */}
      <div className="mb-8 md:mb-12 border-b border-slate-800 pb-4 md:pb-6">
        <h1 className="text-xl md:text-3xl font-extrabold text-white tracking-tight">
          Purchase Courses
        </h1>
        <p className="text-slate-400 text-xs md:text-sm mt-1.5 font-medium">
          Unlock standard study packages and syllabus guides directly. Simply make a UPI payment and upload your receipt for immediate access.
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <LoadingSpinner text="Loading courses..." />
        </div>
      ) : error ? (
        <div className="py-12 text-center bg-rose-950/20 border border-rose-900/50 rounded-2xl p-6">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8 text-rose-500 mx-auto mb-3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <h3 className="font-bold text-white">Failed to load courses</h3>
          <p className="text-xs text-slate-400 mt-1">{error}</p>
        </div>
      ) : courses.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
          <p className="text-sm text-slate-400 font-semibold">No courses are currently available for purchase.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => {
            const isGS = course.subject.startsWith('GS-');
            const subjectDisplay = isGS ? course.subject : OPTIONAL_NAMES[course.subject]?.replace('Optional: ', '') || course.subject;
            const status = getCourseStatus(course);
            const pendingRequest = purchaseRequests.find(
              (r) => r.courseId === course.courseId && r.status === 'pending'
            );

            return (
              <div 
                key={course._id} 
                className="bg-slate-900/40 backdrop-blur-md border border-slate-800 hover:border-slate-700 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-xl flex flex-col justify-between hover:shadow-indigo-950/10 hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group"
              >
                <div className="space-y-2.5 md:space-y-4">
                  {/* Category Badge */}
                  <span className="text-[8px] md:text-[9px] font-extrabold text-indigo-400 bg-indigo-950/40 border border-indigo-900/60 rounded px-1.5 py-0.5 uppercase tracking-wider w-fit block">
                    {subjectDisplay}
                  </span>
                  
                  {/* Course Name */}
                  <h3 className="text-xs md:text-base font-bold text-slate-100 group-hover:text-white line-clamp-2 leading-relaxed transition-colors">
                    {course.name || course.fileName}
                  </h3>
                </div>

                <div className="border-t border-slate-800 pt-3 mt-4 md:pt-4 md:mt-6 flex items-center justify-between">
                  <div>
                    <span className="text-[8px] md:text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Price</span>
                    {course.useDiscount ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm md:text-lg font-extrabold text-indigo-400">₹{course.discountedPrice}</span>
                        <span className="text-[9px] md:text-xs text-slate-500 line-through">₹{course.price}</span>
                      </div>
                    ) : (
                      <span className="text-sm md:text-lg font-extrabold text-slate-100">₹{course.price || 499}</span>
                    )}
                  </div>

                  {/* Status Render */}
                  {status.type === 'purchased' ? (
                    <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-xl text-xs font-bold shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12"/></svg>
                      Purchased
                    </div>
                  ) : status.type === 'pending' ? (
                    <div className="flex items-center gap-1 px-2 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg md:rounded-xl text-[9px] md:text-xs font-bold animate-pulse">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      <span className="hidden min-[350px]:inline">Pending Verification</span>
                      <span className="min-[350px]:hidden">Pending</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleOpenPurchaseModal(course)}
                      className="px-2.5 py-1.5 md:px-4 md:py-2 bg-indigo-600 hover:bg-indigo-550 text-white rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold transition-all shadow-md hover:shadow-indigo-950/20 cursor-pointer flex items-center gap-1 md:gap-1.5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3 md:w-3.5 md:h-3.5"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
                      {status.type === 'rejected' ? (
                        <>
                          <span className="hidden sm:inline">Retry Purchase</span>
                          <span className="sm:hidden">Retry</span>
                        </>
                      ) : (
                        <>
                          <span className="hidden sm:inline">Purchase Now</span>
                          <span className="sm:hidden">Purchase</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Telegram Notify button if pending & notify count < 2 */}
                {status.type === 'pending' && pendingRequest && pendingRequest.telegramNotificationCount < 2 && (
                  <button
                    onClick={(e) => handleTelegramNotify(pendingRequest, course, e)}
                    className="w-full mt-3 px-3 py-2 bg-indigo-600 hover:bg-indigo-550 text-white rounded-xl text-[10px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4 10-10S17.52 2 12 2zm4.64 6.8c-.15.75-.85 3.79-1.2 5.68-.15.8-.45 1.07-.73 1.1-.63.06-1.11-.42-1.72-.82-.96-.63-1.51-1.02-2.44-1.63-1.08-.71-.38-1.1.24-1.74.16-.17 3.01-2.76 3.07-3.01.01-.03.01-.14-.05-.2-.06-.06-.15-.04-.21-.03-.1.02-1.61 1.02-4.56 3.02-.43.3-.82.45-1.17.44-.39-.01-1.15-.22-1.71-.41-.69-.23-1.24-.35-1.19-.74.03-.2.3-.41.82-.63 3.2-1.39 5.34-2.31 6.42-2.75 3.07-1.28 3.7-1.5 4.12-1.5.09 0 .3.02.43.13.11.09.14.22.15.31-.01.07.01.21-.01.29z"/></svg>
                    Notify Admin on Telegram
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}      {/* Checkout Modal Form */}
      {selectedCourse && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 md:p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[95vh] overflow-y-auto">
            
            {/* Header info */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-[9px] font-bold text-indigo-400 bg-indigo-950 border border-indigo-900 rounded px-1.5 py-0.5 uppercase tracking-wide">
                  UPI Payment Checkout
                </span>
                <h3 className="text-base md:text-lg font-extrabold text-white mt-1.5 leading-snug">
                  Unlock: {selectedCourse.name}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">
                  Complete standard payment verification for access.
                </p>
              </div>
              <button 
                onClick={handleClosePurchaseModal}
                className="text-slate-450 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {successMessage ? (
              // Success Pending Screen
              <div className="py-8 text-center flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 bg-indigo-950/40 border border-indigo-500/30 text-indigo-400 rounded-full flex items-center justify-center shadow-lg relative animate-bounce">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <h4 className="text-base font-extrabold text-white">Purchase Request Pending</h4>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed font-medium">
                  {successMessage}
                </p>
                {lastSubmittedRequest && lastSubmittedRequest.telegramNotificationCount < 2 && (
                  <div className="w-full max-w-xs pt-2">
                    <button
                      type="button"
                      onClick={(e) => handleTelegramNotify(lastSubmittedRequest, selectedCourse, e)}
                      className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-550 text-white rounded-xl text-xs font-bold transition shadow-md hover:shadow-indigo-950/20 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4 10-10S17.52 2 12 2zm4.64 6.8c-.15.75-.85 3.79-1.2 5.68-.15.8-.45 1.07-.73 1.1-.63.06-1.11-.42-1.72-.82-.96-.63-1.51-1.02-2.44-1.63-1.08-.71-.38-1.1.24-1.74.16-.17 3.01-2.76 3.07-3.01.01-.03.01-.14-.05-.2-.06-.06-.15-.04-.21-.03-.1.02-1.61 1.02-4.56 3.02-.43.3-.82.45-1.17.44-.39-.01-1.15-.22-1.71-.41-.69-.23-1.24-.35-1.19-.74.03-.2.3-.41.82-.63 3.2-1.39 5.34-2.31 6.42-2.75 3.07-1.28 3.7-1.5 4.12-1.5.09 0 .3.02.43.13.11.09.14.22.15.31-.01.07.01.21-.01.29z"/></svg>
                      Notify Admin on Telegram
                    </button>
                    <p className="text-[10px] text-slate-500 mt-2 text-center font-medium leading-relaxed">
                      Notify us personally or request for the Telegram group link.
                    </p>
                  </div>
                )}
                <button
                  onClick={handleClosePurchaseModal}
                  className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer mt-4"
                >
                  Close Window
                </button>
              </div>
            ) : (
              // Payment Form
              <form onSubmit={handleFormSubmit} className="space-y-5">
                
                {/* Temporary Payment System Notice Banner */}
                <div className="bg-indigo-950/25 border border-indigo-900/40 rounded-xl p-3 text-[10px] md:text-xs text-indigo-300 leading-relaxed font-medium flex gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="9" x2="12.01" y2="9"/></svg>
                  <div>
                    <span className="font-bold text-indigo-200 block mb-0.5">Notice:</span>
                    This is a temporary payment option. We are actively working on improving the payment experience. For queries or support, please message us on Telegram or contact us via Email.
                  </div>
                </div>

                {modalError && (
                  <div className="p-3 bg-rose-950/20 border border-rose-900/40 text-rose-500 rounded-xl text-xs font-bold leading-normal">
                    {modalError}
                  </div>
                )}

                {/* QR Display Area */}
                <div className="bg-slate-950/80 border border-slate-850 rounded-2xl p-4 md:p-5 flex flex-col items-center text-center space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent animate-pulse"></div>
                  
                  <p className="text-xs text-slate-300 font-semibold leading-relaxed">
                    Scan the QR code below using GPay, PhonePe, Paytm, or any UPI app to transfer <span className="text-indigo-400 font-extrabold text-sm">₹{selectedCourse.useDiscount ? selectedCourse.discountedPrice : selectedCourse.price}</span>. Click the QR code to view it full size.
                  </p>

                  {/* QR Image Box with scanning-line effect */}
                  <div 
                    onClick={() => setZoomQr(true)}
                    className="relative p-2.5 bg-white rounded-xl shadow-xl group border border-slate-250 w-40 h-40 md:w-44 md:h-44 flex items-center justify-center cursor-zoom-in hover:border-indigo-500/50 transition-colors"
                  >
                    <img 
                      src="/qr/payment_qr.jpg" 
                      alt="UPI Payment QR Code" 
                      className="w-36 h-36 md:w-40 md:h-40 object-contain"
                    />
                    {/* Visual scan line animation */}
                    <div className="absolute inset-x-2.5 h-[2px] bg-indigo-500/80 animate-[scan_2s_ease-in-out_infinite] pointer-events-none shadow-[0_0_10px_#6366f1]"></div>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  {/* UPI Txn ID */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">
                      UPI Transaction ID / Ref No. (12-Digit) (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={24}
                      className="w-full bg-slate-950 border border-slate-850 hover:border-slate-750 focus:border-indigo-500 text-slate-100 rounded-xl px-4 py-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
                      placeholder="e.g. 123456789012"
                      value={upiTxnId}
                      onChange={(e) => {
                        setUpiTxnId(e.target.value.replace(/[^0-9a-zA-Z]/g, ''));
                        if (e.target.value.trim()) setModalError('');
                      }}
                    />
                  </div>

                  {/* Screenshot Uploader */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider block">
                      Upload Payment Screenshot
                    </label>
                    
                    {screenshotPreview ? (
                      <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-2 flex items-center gap-3">
                        <img 
                          src={screenshotPreview} 
                          alt="Screenshot preview" 
                          className="w-12 h-12 rounded object-cover border border-slate-800"
                        />
                        <div className="flex-grow min-w-0">
                          <p className="text-[11px] text-slate-350 font-bold truncate">{screenshot.name}</p>
                          <p className="text-[9px] text-slate-500 font-medium">{(screenshot.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setScreenshot(null);
                            setScreenshotPreview('');
                          }}
                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-rose-500 rounded-lg transition"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    ) : (
                      <div className="relative border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-xl bg-slate-950 transition cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={handleScreenshotChange}
                        />
                        <div className="py-6 text-center space-y-1">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-8 h-8 text-slate-500 mx-auto mb-1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                          <p className="text-[11px] text-indigo-400 font-bold">Click to upload or drag payment receipt</p>
                          <p className="text-[9px] text-slate-500 font-medium">Supports PNG, JPG, JPEG (Max 10MB)</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleClosePurchaseModal}
                    className="px-4 py-2 text-slate-400 hover:text-white text-xs font-bold transition cursor-pointer"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold transition shadow-md hover:shadow-indigo-950/20 cursor-pointer flex items-center justify-center gap-1.5"
                    disabled={submitting}
                  >
                    {submitting ? 'Uploading Receipt...' : 'Submit Payment Info'}
                  </button>
                </div>
              </form>
            )}
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
              {!isNameValid && (
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
              )}

              {/* Telegram Username */}
              {!isTelegramValid && (
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
              )}

              {/* Phone Verification Section */}
              {!isPhoneValid && (
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
                    (!isNameValid && (!firstName.trim() || !lastName.trim())) ||
                    (!isTelegramValid && !telegramUsername.trim()) ||
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

      {/* QR Lightbox Zoom Modal */}
      {zoomQr && (
        <div 
          className="fixed inset-0 z-[150] bg-slate-950/95 flex flex-col items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomQr(false)}
        >
          <button 
            onClick={() => setZoomQr(false)}
            className="absolute top-4 right-4 text-slate-350 hover:text-white p-2 bg-slate-900/80 border border-slate-800 rounded-full hover:bg-slate-800 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          
          <img 
            src="/qr/payment_qr.jpg" 
            alt="UPI Payment QR Code Zoomed" 
            className="max-w-full max-h-[80vh] object-contain rounded-2xl border border-slate-850 shadow-2xl p-4 bg-white"
            onClick={(e) => e.stopPropagation()} 
          />
          
          <div className="text-slate-400 text-xs mt-4 font-bold uppercase tracking-wider select-none bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-xl">
            Click outside QR code to close
          </div>
        </div>
      )}

      {/* Add custom CSS scan animation */}
      <style>{`
        @keyframes scan {
          0%, 100% { top: 10px; }
          50% { top: calc(100% - 12px); }
        }
      `}</style>
    </div>
  );
}
