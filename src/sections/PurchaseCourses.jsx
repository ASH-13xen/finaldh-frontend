import { useState, useEffect, useRef } from "react";
import LoadingSpinner from "../components/LoadingSpinner";
import MmfHeroBanner from "../components/courses/MmfHeroBanner";
import ComboOffersSection from "../components/courses/ComboOffersSection";
import CategorizedCourseGrid from "../components/courses/CategorizedCourseGrid";
import SamplePreviewSection from "../components/courses/SamplePreviewSection";
import { CAC_FEATURES } from "../components/courses/courseHelpers";

export default function PurchaseCourses({ user, onUserUpdate }) {
  const [courses, setCourses] = useState([]);
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [comboOffers, setComboOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Modal State
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [upiTxnId, setUpiTxnId] = useState("");
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState("");
  const [modalError, setModalError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [zoomQr, setZoomQr] = useState(false);
  const [lastSubmittedRequest, setLastSubmittedRequest] = useState(null);

  // Combo purchase flow state
  const [pickerCombo, setPickerCombo] = useState(null); // combo offer currently being configured (picker step)
  const [pickerSelectedIds, setPickerSelectedIds] = useState([]); // courseIds the student picked in the picker
  const [comboPurchaseDraft, setComboPurchaseDraft] = useState(null); // { comboOffer, selectedCourseIds } once "Continue to Payment" is clicked

  // Sample preview state (per-PDF viewer state lives inside SamplePreviewSection itself)
  const [activeSampleCourse, setActiveSampleCourse] = useState(null);
  const sampleSectionRef = useRef(null);

  const handleSeeSample = (course) => {
    setActiveSampleCourse(course);
    setTimeout(() => {
      sampleSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  // Fetch all courses, combo offers, and purchase requests
  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");

      // Fetch all courses
      const courseRes = await fetch("/api/courses/list");
      let courseData = { courses: [] };
      if (courseRes.ok) {
        courseData = await courseRes.json();
      }

      // Fetch active combo offers
      const comboRes = await fetch("/api/courses/combo-offers/active");
      let comboData = { comboOffers: [] };
      if (comboRes.ok) {
        comboData = await comboRes.json();
      }

      // Fetch user's purchase requests
      let requestsData = [];
      if (token) {
        const reqRes = await fetch("/api/courses/purchase-requests", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (reqRes.ok) {
          requestsData = await reqRes.json();
        }
      }

      setCourses(courseData.courses || []);
      setComboOffers(comboData.comboOffers || []);
      setPurchaseRequests(requestsData || []);
    } catch (err) {
      console.error("Error fetching purchase course details:", err);
      setError("Failed to retrieve course details.");
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

  const handleOpenPurchaseModal = (course) => {
    setSelectedCourse(course);
    setComboPurchaseDraft(null);
    setLastSubmittedRequest(null);
    setUpiTxnId("");
    setScreenshot(null);
    setScreenshotPreview("");
    setModalError("");
    setSuccessMessage("");
  };

  const handleClosePurchaseModal = () => {
    setSelectedCourse(null);
    setComboPurchaseDraft(null);
  };

  // Open the course-picker step for a combo offer
  const handleOpenComboPicker = (combo) => {
    setPickerCombo(combo);
    setPickerSelectedIds([]);
  };

  const handleClosePicker = () => {
    setPickerCombo(null);
    setPickerSelectedIds([]);
  };

  const togglePickerCourse = (courseId) => {
    setPickerSelectedIds((prev) => {
      if (prev.includes(courseId)) return prev.filter((id) => id !== courseId);
      if (prev.length >= pickerCombo.pickCount) return prev; // already at the pick limit
      return [...prev, courseId];
    });
  };

  const ownedCourseIds = (
    Array.isArray(user?.interestedCourses) ? user.interestedCourses : []
  ).map((c) => c.toLowerCase());
  const isOwned = (courseId) =>
    ownedCourseIds.includes((courseId || "").toLowerCase());

  const handleContinueComboToPayment = () => {
    if (!pickerCombo || pickerSelectedIds.length !== pickerCombo.pickCount)
      return;
    setComboPurchaseDraft({
      comboOffer: pickerCombo,
      selectedCourseIds: pickerSelectedIds,
    });
    setLastSubmittedRequest(null);
    setUpiTxnId("");
    setScreenshot(null);
    setScreenshotPreview("");
    setModalError("");
    setSuccessMessage("");
    setPickerCombo(null);
    setPickerSelectedIds([]);
  };

  // Determine combo purchase status (only "available" vs "pending" — once approved, courses unlock individually)
  const getComboStatus = (combo) => {
    const pendingRequest = purchaseRequests.find(
      (r) => r.comboOffer?._id === combo._id && r.status === "pending",
    );
    if (pendingRequest)
      return {
        type: "pending",
        label: "Pending Verification",
        request: pendingRequest,
      };
    return { type: "available", label: "Available" };
  };

  const handleScreenshotChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setModalError("Please upload an image file (PNG, JPG, JPEG).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB Limit
      setModalError("Screenshot size must be under 10MB.");
      return;
    }

    setModalError("");
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
    setModalError("");
    setSuccessMessage("");

    if (!screenshot) {
      setModalError("Please upload the screenshot of your payment.");
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      if (comboPurchaseDraft) {
        formData.append("comboOfferId", comboPurchaseDraft.comboOffer._id);
        formData.append(
          "selectedCourseIds",
          JSON.stringify(comboPurchaseDraft.selectedCourseIds),
        );
      } else {
        formData.append("courseId", selectedCourse.courseId);
      }
      formData.append("upiTxnId", upiTxnId.trim());
      formData.append("screenshot", screenshot);

      const res = await fetch("/api/courses/purchase-request", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit request");
      }

      setLastSubmittedRequest(data.request);
      setSuccessMessage(
        "Payment submitted! Admin will verify and activate your course within 6-8 hours.",
      );

      // Refresh requests list in background
      const reqRes = await fetch("/api/courses/purchase-requests", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        setPurchaseRequests(reqData);
      }
    } catch (err) {
      console.error("Error submitting checkout:", err);
      setModalError(err.message || "Error occurred while processing request.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle opening Telegram with pre-filled message to tdhadmin
  const handleTelegramNotify = (request, course, e) => {
    if (e) e.stopPropagation();

    // 1. Open the Telegram redirection URL immediately (synchronous user action to bypass browser popup blockers)
    const studentName = user?.fullName || user?.name || "Student";
    const courseName = course?.name || request?.courseName || "Course";
    const text = `I am ${studentName} enrolled in ${courseName}, requesting for confirmation and group link`;

    // Detect mobile browser
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );

    let telegramUrl = `https://t.me/tdhadmin?text=${encodeURIComponent(text)}`;
    if (!isMobile) {
      // Direct laptop/desktop users directly to Telegram Web K version
      telegramUrl = `https://web.telegram.org/k/#@tdhadmin`;
      // Attempt to copy the message text to clipboard for easy pasting (Ctrl+V)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            console.log("[Telegram Redirect] Message copied to clipboard");
          })
          .catch((err) => {
            console.warn("[Telegram Redirect] Clipboard copy failed:", err);
          });
      }
    }

    console.log(
      `[Telegram Redirect] Device: ${isMobile ? "Mobile" : "Desktop"}, Opening URL: ${telegramUrl}`,
    );
    window.open(telegramUrl, "_blank");

    // 2. Fire the database tracking counter in the background
    const token = localStorage.getItem("token");
    fetch(`/api/courses/purchase-requests/${request._id}/notify-telegram`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          console.warn(
            "[Telegram Redirect] Backend counter tracking failed:",
            data.error,
          );
          return;
        }

        // Update list of requests to synchronize counts
        const updatedRequests = purchaseRequests.map((r) =>
          r._id === request._id
            ? {
                ...r,
                telegramNotificationCount: data.telegramNotificationCount,
              }
            : r,
        );
        setPurchaseRequests(updatedRequests);

        // Update lastSubmittedRequest if that is the one
        if (lastSubmittedRequest && lastSubmittedRequest._id === request._id) {
          setLastSubmittedRequest({
            ...lastSubmittedRequest,
            telegramNotificationCount: data.telegramNotificationCount,
          });
        }
      })
      .catch((err) => {
        console.error(
          "[Telegram Redirect] Background tracking fetch failed:",
          err,
        );
      });
  };

  // Determine course purchase status
  const getCourseStatus = (course) => {
    // 1. Check if course is already in user's interestedCourses
    const interestedList = Array.isArray(user?.interestedCourses)
      ? user.interestedCourses
      : [];
    const hasPurchased = interestedList.some(
      (cId) => cId.toLowerCase() === course.courseId.toLowerCase(),
    );
    if (hasPurchased) return { type: "purchased", label: "Purchased" };

    // 2. Check if user has a pending request
    const pendingRequest = purchaseRequests.find(
      (r) => r.courseId === course.courseId && r.status === "pending",
    );
    if (pendingRequest)
      return { type: "pending", label: "Pending Verification" };

    // 3. Check if user has a rejected request
    const rejectedRequest = purchaseRequests.find(
      (r) => r.courseId === course.courseId && r.status === "rejected",
    );
    if (rejectedRequest)
      return { type: "rejected", label: "Rejected (Try Again)" };

    return { type: "available", label: "Available" };
  };

  // Generalized checkout target — either a single course or a configured combo draft
  const checkoutName = comboPurchaseDraft
    ? comboPurchaseDraft.comboOffer.label
    : selectedCourse?.name;
  const checkoutPrice = comboPurchaseDraft
    ? comboPurchaseDraft.comboOffer.price
    : selectedCourse
      ? selectedCourse.useDiscount
        ? selectedCourse.discountedPrice
        : selectedCourse.price
      : 0;

  // API returns courses newest-first. Oldest All GS = original Mains Master File (banner #1);
  // second-oldest All GS = Current Affairs Compass (banner #2). Any further All GS go to grid.
  const allGsCourses = courses.filter((c) => c.subject === "All GS");
  const mmfCourse = allGsCourses.at(-1);
  const cacCourse = allGsCourses.length >= 2 ? allGsCourses.at(-2) : null;
  const featuredIds = [mmfCourse?._id, cacCourse?._id].filter(Boolean);
  const mmfStatus = mmfCourse ? getCourseStatus(mmfCourse) : null;
  const cacStatus = cacCourse ? getCourseStatus(cacCourse) : null;
  const getPendingRequest = (course) =>
    purchaseRequests.find((r) => r.courseId === course.courseId && r.status === "pending");
  const mmfPendingRequest = mmfCourse ? getPendingRequest(mmfCourse) : null;
  const cacPendingRequest = cacCourse ? getPendingRequest(cacCourse) : null;

  const sampleStatus = activeSampleCourse ? getCourseStatus(activeSampleCourse) : null;
  const sampleStatusPendingRequest = activeSampleCourse ? getPendingRequest(activeSampleCourse) : null;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-14">
      {/* Header */}
      <div className="mb-8 md:mb-12 border-b border-border-default pb-4 md:pb-6">
        <h1 className="text-xl md:text-4xl font-display font-semibold text-text-primary tracking-tight">
          Purchase Courses
        </h1>
        <p className="text-text-secondary text-xs md:text-sm mt-1.5 md:mt-2 font-medium">
          Unlock standard study packages and syllabus guides directly. Simply
          make a UPI payment and upload your receipt for immediate access.
        </p>
      </div>

      {!loading && !error && mmfCourse && (
        <MmfHeroBanner
          course={mmfCourse}
          status={mmfStatus}
          pendingRequest={mmfPendingRequest}
          onPurchase={handleOpenPurchaseModal}
          onTelegramNotify={handleTelegramNotify}
          onSeeSample={handleSeeSample}
        />
      )}

      {!loading && !error && cacCourse && (
        <MmfHeroBanner
          course={cacCourse}
          status={cacStatus}
          pendingRequest={cacPendingRequest}
          onPurchase={handleOpenPurchaseModal}
          onTelegramNotify={handleTelegramNotify}
          onSeeSample={handleSeeSample}
          features={CAC_FEATURES}
          badge="Current Affairs"
          subtitle="Comprehensive current affairs coverage built for Mains — bridging news to syllabus."
        />
      )}

      {!loading && !error && comboOffers.length > 0 && (
        <ComboOffersSection
          comboOffers={comboOffers}
          getComboStatus={getComboStatus}
          onSelectCombo={handleOpenComboPicker}
        />
      )}

      {loading ? (
        <div className="py-16 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <LoadingSpinner text="Loading courses..." />
        </div>
      ) : error ? (
        <div className="py-12 text-center bg-rose-950/20 border border-rose-900/50 rounded-2xl p-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="w-8 h-8 text-rose-500 mx-auto mb-3"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3 className="font-bold text-white">Failed to load courses</h3>
          <p className="text-xs text-slate-400 mt-1">{error}</p>
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
          excludedCourseIds={featuredIds}
          getCourseStatus={getCourseStatus}
          getPendingRequest={getPendingRequest}
          onPurchase={handleOpenPurchaseModal}
          onTelegramNotify={handleTelegramNotify}
          onSeeSample={handleSeeSample}
        />
      )}

      <SamplePreviewSection
        activeSampleCourse={activeSampleCourse}
        sectionRef={sampleSectionRef}
        status={sampleStatus}
        pendingRequest={sampleStatusPendingRequest}
        onPurchase={handleOpenPurchaseModal}
        onTelegramNotify={handleTelegramNotify}
      />      {/* Combo Course Picker Modal */}
      {pickerCombo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-surface border border-border-default rounded-xl md:rounded-2xl w-full max-w-lg p-5 md:p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-5">
              <div>
                <span className="text-[9px] font-bold text-brand bg-accent-soft-bg border border-accent-soft-border rounded px-1.5 py-0.5 uppercase tracking-wide">
                  Bundle Offer
                </span>
                <h3 className="text-base md:text-lg font-display font-semibold text-text-primary mt-1.5 leading-snug">
                  {pickerCombo.label}
                </h3>
                <p className="text-[11px] text-text-secondary mt-1 font-medium">
                  Choose exactly {pickerCombo.pickCount} paper
                  {pickerCombo.pickCount > 1 ? "s" : ""} below for a flat ₹
                  {pickerCombo.price}.
                </p>
              </div>
              <button
                onClick={handleClosePicker}
                className="text-text-secondary hover:text-text-primary p-1 hover:bg-sunken rounded-lg transition"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="w-5 h-5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="space-y-2 mb-4">
              {pickerCombo.eligibleCourses.map((c) => {
                const owned = isOwned(c.courseId);
                const checked = pickerSelectedIds.includes(c.courseId);
                const disabled =
                  owned ||
                  (!checked &&
                    pickerSelectedIds.length >= pickerCombo.pickCount);
                return (
                  <button
                    type="button"
                    key={c.courseId}
                    disabled={disabled}
                    onClick={() => togglePickerCourse(c.courseId)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition ${
                      checked
                        ? "bg-accent-soft-bg border-brand text-brand cursor-pointer font-semibold"
                        : disabled
                          ? "bg-sunken/50 border-border-subtle text-text-tertiary cursor-not-allowed"
                          : "bg-surface border-border-default text-text-secondary hover:border-brand/40 cursor-pointer font-medium"
                    }`}
                  >
                    <span className="text-xs font-bold">{c.name}</span>
                    {owned ? (
                      <span className="text-[9px] font-bold text-status-success-text uppercase tracking-wide shrink-0">
                        Already owned
                      </span>
                    ) : (
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-brand border-brand" : "border-border-default"}`}
                      >
                        {checked && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            className="w-2.5 h-2.5 text-white"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {pickerCombo.requiredCourses.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5">
                  Always included
                </p>
                <div className="flex flex-wrap gap-2">
                  {pickerCombo.requiredCourses.map((c) => {
                    const owned = isOwned(c.courseId);
                    return (
                      <span
                        key={c.courseId}
                        className={`text-[11px] font-bold rounded-lg px-3 py-1.5 border ${owned ? "bg-status-danger-bg border-status-danger-text/25 text-status-danger-text" : "bg-status-success-bg border-status-success-text/25 text-status-success-text"}`}
                      >
                        {c.name}
                        {owned ? " (already owned)" : ""}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {pickerCombo.requiredCourses.some((c) => isOwned(c.courseId)) && (
              <div className="p-3 bg-status-danger-bg border border-status-danger-text/25 text-status-danger-text rounded-xl text-[11px] font-bold mb-4">
                You already own a course that's always included in this bundle,
                so it can't be purchased this way.
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-border-default">
              <span className="text-[11px] font-bold text-text-secondary">
                {pickerSelectedIds.length} / {pickerCombo.pickCount} selected
              </span>
              <div className="flex gap-3">
                <button
                  onClick={handleClosePicker}
                  className="px-4 py-2 text-text-secondary hover:text-text-primary text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleContinueComboToPayment}
                  disabled={
                    pickerSelectedIds.length !== pickerCombo.pickCount ||
                    pickerCombo.requiredCourses.some((c) => isOwned(c.courseId))
                  }
                  className="px-5 py-2 bg-brand hover:bg-brand-hover disabled:bg-surface-raised disabled:border disabled:border-border-default disabled:text-text-tertiary text-text-on-accent rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Continue to Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal Form */}
      {(selectedCourse || comboPurchaseDraft) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-surface border border-border-default rounded-xl md:rounded-2xl w-full max-w-lg p-5 md:p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[95vh] overflow-y-auto">
            {/* Header info */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-[9px] font-bold text-brand bg-accent-soft-bg border border-accent-soft-border rounded px-1.5 py-0.5 uppercase tracking-wide">
                  UPI Payment Checkout
                </span>
                <h3 className="text-base md:text-lg font-display font-semibold text-text-primary mt-1.5 leading-snug">
                  Unlock: {checkoutName}
                </h3>
                <p className="text-[11px] text-text-secondary mt-1 font-medium">
                  Complete standard payment verification for access.
                </p>
              </div>
              <button
                onClick={handleClosePurchaseModal}
                className="text-text-secondary hover:text-text-primary p-1 hover:bg-sunken rounded-lg transition"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="w-5 h-5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {successMessage ? (
              // Success Pending Screen
              <div className="py-8 text-center flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 bg-accent-soft-bg border border-accent-soft-border text-brand rounded-full flex items-center justify-center shadow-lg relative animate-bounce">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="w-8 h-8"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <h4 className="text-base font-display font-semibold text-text-primary">
                  Purchase Request Pending
                </h4>
                <p className="text-xs text-text-secondary max-w-xs leading-relaxed font-medium">
                  {successMessage}
                </p>
                {lastSubmittedRequest &&
                  lastSubmittedRequest.telegramNotificationCount < 2 && (
                    <div className="w-full max-w-xs pt-2">
                      <button
                        type="button"
                        onClick={(e) =>
                          handleTelegramNotify(
                            lastSubmittedRequest,
                            selectedCourse,
                            e,
                          )
                        }
                        className="w-full px-4 py-2.5 bg-brand hover:bg-brand-hover text-text-on-accent rounded-xl text-xs font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <svg
                          className="w-3.5 h-3.5 fill-current"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4 10-10S17.52 2 12 2zm4.64 6.8c-.15.75-.85 3.79-1.2 5.68-.15.8-.45 1.07-.73 1.1-.63.06-1.11-.42-1.72-.82-.96-.63-1.51-1.02-2.44-1.63-1.08-.71-.38-1.1.24-1.74.16-.17 3.01-2.76 3.07-3.01.01-.03.01-.14-.05-.2-.06-.06-.15-.04-.21-.03-.1.02-1.61 1.02-4.56 3.02-.43.3-.82.45-1.17.44-.39-.01-1.15-.22-1.71-.41-.69-.23-1.24-.35-1.19-.74.03-.2.3-.41.82-.63 3.2-1.39 5.34-2.31 6.42-2.75 3.07-1.28 3.7-1.5 4.12-1.5.09 0 .3.02.43.13.11.09.14.22.15.31-.01.07.01.21-.01.29z" />
                        </svg>
                        Notify Admin on Telegram
                      </button>
                      <p className="text-[10px] text-text-tertiary mt-2 text-center font-medium leading-relaxed">
                        Notify us personally or request for the Telegram group
                        link.
                      </p>
                    </div>
                  )}
                <button
                  onClick={handleClosePurchaseModal}
                  className="px-6 py-2 bg-accent-soft-bg border border-accent-soft-border hover:bg-accent-soft-border/50 text-brand rounded-xl text-xs font-bold transition cursor-pointer mt-4"
                >
                  Close Window
                </button>
              </div>
            ) : (
              // Payment Form
              <form onSubmit={handleFormSubmit} className="space-y-5">
                {/* Temporary Payment System Notice Banner */}
                <div className="bg-accent-soft-bg border border-accent-soft-border rounded-xl p-3 text-[10px] md:text-xs text-text-secondary leading-relaxed font-medium flex gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="w-4 h-4 text-brand flex-shrink-0 mt-0.5"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="9" x2="12.01" y2="9" />
                  </svg>
                  <div>
                    <span className="font-bold text-brand block mb-0.5">
                      Notice:
                    </span>
                    This is a temporary payment option. We are actively working
                    on improving the payment experience. For queries or support,
                    please message us on Telegram or contact us via Email.
                  </div>
                </div>

                {modalError && (
                  <div className="p-3 bg-status-danger-bg border border-status-danger-text/25 text-status-danger-text rounded-xl text-xs font-bold leading-normal">
                    {modalError}
                  </div>
                )}

                {/* QR Display Area */}
                <div className="bg-sunken border border-border-subtle rounded-2xl p-4 md:p-5 flex flex-col items-center text-center space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand to-transparent animate-pulse"></div>

                  <p className="text-xs text-text-secondary font-semibold leading-relaxed">
                    Scan the QR code below using GPay, PhonePe, Paytm, or any
                    UPI app to transfer{" "}
                    <span className="text-brand font-extrabold text-sm">
                      ₹{checkoutPrice}
                    </span>
                    . Click the QR code to view it full size.
                  </p>

                  {/* QR Image Box with scanning-line effect */}
                  <div
                    onClick={() => setZoomQr(true)}
                    className="relative p-2.5 bg-white rounded-xl shadow-xl group border border-border-default w-40 h-40 md:w-44 md:h-44 flex items-center justify-center cursor-zoom-in hover:border-brand/40 transition-colors"
                  >
                    <img
                      src="/qr/payment_qr.jpg"
                      alt="UPI Payment QR Code"
                      className="w-36 h-36 md:w-40 md:h-40 object-contain"
                    />
                    {/* Visual scan line animation */}
                    <div className="absolute inset-x-2.5 h-[2px] bg-brand/80 animate-[scan_2s_ease-in-out_infinite] pointer-events-none shadow-[0_0_10px_var(--color-brand)]"></div>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  {/* UPI Txn ID */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] md:text-xs font-bold text-text-secondary uppercase tracking-wider">
                      UPI Transaction ID / Ref No. (12-Digit) (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={24}
                      className="w-full bg-page border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-xl px-4 py-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-brand transition-all placeholder:text-text-tertiary"
                      placeholder="e.g. 123456789012"
                      value={upiTxnId}
                      onChange={(e) => {
                        setUpiTxnId(
                          e.target.value.replace(/[^0-9a-zA-Z]/g, ""),
                        );
                        if (e.target.value.trim()) setModalError("");
                      }}
                    />
                  </div>

                  {/* Screenshot Uploader */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] md:text-xs font-bold text-text-secondary uppercase tracking-wider block">
                      Upload Payment Screenshot
                    </label>

                    {screenshotPreview ? (
                      <div className="relative rounded-xl border border-border-default bg-page p-2 flex items-center gap-3">
                        <img
                          src={screenshotPreview}
                          alt="Screenshot preview"
                          className="w-12 h-12 rounded object-cover border border-border-default"
                        />
                        <div className="flex-grow min-w-0">
                          <p className="text-[11px] text-text-secondary font-bold truncate">
                            {screenshot.name}
                          </p>
                          <p className="text-[9px] text-text-tertiary font-medium">
                            {(screenshot.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setScreenshot(null);
                            setScreenshotPreview("");
                          }}
                          className="p-1 hover:bg-sunken text-text-secondary hover:text-status-danger-text rounded-lg transition"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            className="w-4 h-4"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="relative border-2 border-dashed border-border-default hover:border-brand/50 rounded-xl bg-page hover:bg-sunken/30 transition cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={handleScreenshotChange}
                        />
                        <div className="py-6 text-center space-y-1">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            className="w-8 h-8 text-text-tertiary mx-auto mb-1.5"
                          >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          <p className="text-[11px] text-brand font-bold">
                            Click to upload or drag payment receipt
                          </p>
                          <p className="text-[9px] text-text-tertiary font-medium">
                            Supports PNG, JPG, JPEG (Max 10MB)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-default">
                  <button
                    type="button"
                    onClick={handleClosePurchaseModal}
                    className="px-4 py-2 text-text-secondary hover:text-text-primary text-xs font-bold transition cursor-pointer"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-brand hover:bg-brand-hover disabled:bg-surface-raised disabled:border disabled:border-border-default disabled:text-text-tertiary text-text-on-accent rounded-xl text-xs font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                    disabled={submitting}
                  >
                    {submitting
                      ? "Uploading Receipt..."
                      : "Submit Payment Info"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* QR Lightbox Zoom Modal */}
      {zoomQr && (
        <div
          className="fixed inset-0 z-[150] bg-ink-950/95 flex flex-col items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomQr(false)}
        >
          <button
            onClick={() => setZoomQr(false)}
            className="absolute top-4 right-4 text-text-secondary hover:text-text-primary p-2 bg-surface/80 border border-border-default rounded-full hover:bg-sunken transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="w-5 h-5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <img
            src="/qr/payment_qr.jpg"
            alt="UPI Payment QR Code Zoomed"
            className="max-w-full max-h-[80vh] object-contain rounded-2xl border border-border-default shadow-2xl p-4 bg-white"
            onClick={(e) => e.stopPropagation()}
          />

          <div className="text-text-secondary text-xs mt-4 font-bold uppercase tracking-wider select-none bg-surface/60 border border-border-default px-3 py-1.5 rounded-xl">
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
