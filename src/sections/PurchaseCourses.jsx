import { useState, useEffect, useRef } from "react";
import LoadingSpinner from "../components/LoadingSpinner";
import PurchaseModal from "../components/PurchaseModal";
import MmfHeroBanner from "../components/courses/MmfHeroBanner";
import ComboOffersSection from "../components/courses/ComboOffersSection";
import CategorizedCourseGrid from "../components/courses/CategorizedCourseGrid";
import SamplePreviewSection from "../components/courses/SamplePreviewSection";
import CourseCategoryNav from "../components/courses/CourseCategoryNav";
import { CAC_FEATURES, categorizeCourses } from "../components/courses/courseHelpers";

export default function PurchaseCourses({ user, onUserUpdate }) {
  const [courses, setCourses] = useState([]);
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [comboOffers, setComboOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal State - selectedCourse/comboPurchaseDraft choose WHAT to buy; the actual payment
  // form/QR/screenshot-upload UI lives in the shared PurchaseModal component.
  const [selectedCourse, setSelectedCourse] = useState(null);

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

  // Called when the shared PurchaseModal's success screen is dismissed - refresh the
  // pending-requests list in the background and close whichever modal was open.
  const handlePurchaseSubmitted = async () => {
    setSelectedCourse(null);
    setComboPurchaseDraft(null);
    try {
      const token = localStorage.getItem("token");
      const reqRes = await fetch("/api/courses/purchase-requests", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (reqRes.ok) {
        setPurchaseRequests(await reqRes.json());
      }
    } catch (err) {
      console.error("Error refreshing purchase requests:", err);
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
  const { optional, gsCore } = categorizeCourses(courses, featuredIds);
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

      <CourseCategoryNav
        hasMmf={!loading && !error && !!mmfCourse}
        hasCac={!loading && !error && !!cacCourse}
        hasCombos={!loading && !error && comboOffers.length > 0}
        optionalCount={optional.length}
        gsCoreCount={gsCore.length}
      />

      {!loading && !error && mmfCourse && (
        <div id="category-mmf" className="scroll-mt-20 md:scroll-mt-24">
          <MmfHeroBanner
            course={mmfCourse}
            status={mmfStatus}
            pendingRequest={mmfPendingRequest}
            onPurchase={handleOpenPurchaseModal}
            onTelegramNotify={handleTelegramNotify}
            onSeeSample={handleSeeSample}
          />
        </div>
      )}

      {!loading && !error && cacCourse && (
        <div id="category-cac" className="scroll-mt-20 md:scroll-mt-24">
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
        </div>
      )}

      {!loading && !error && comboOffers.length > 0 && (
        <div id="category-combos" className="scroll-mt-20 md:scroll-mt-24">
          <ComboOffersSection
            comboOffers={comboOffers}
            getComboStatus={getComboStatus}
            onSelectCombo={handleOpenComboPicker}
          />
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center bg-surface-raised border border-border-default rounded-2xl">
          <LoadingSpinner text="Loading courses..." />
        </div>
      ) : error ? (
        <div className="py-12 text-center bg-status-danger-bg border border-status-danger-text/30 rounded-2xl p-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="w-8 h-8 text-status-danger-text mx-auto mb-3"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3 className="font-bold text-text-primary">Failed to load courses</h3>
          <p className="text-xs text-text-secondary mt-1">{error}</p>
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

      {/* Checkout Modal - shared with the MCQ purchase flow */}
      {(selectedCourse || comboPurchaseDraft) && (
        <PurchaseModal
          title={`Unlock: ${checkoutName}`}
          price={checkoutPrice}
          submitEndpoint="/api/courses/purchase-request"
          formFields={
            comboPurchaseDraft
              ? {
                  comboOfferId: comboPurchaseDraft.comboOffer._id,
                  selectedCourseIds: JSON.stringify(comboPurchaseDraft.selectedCourseIds),
                }
              : { courseId: selectedCourse.courseId }
          }
          onClose={handleClosePurchaseModal}
          onSubmitted={handlePurchaseSubmitted}
          telegramMessage={`I am ${user?.fullName || user?.name || "Student"} enrolled in ${checkoutName}, requesting for confirmation and group link`}
          telegramTrackEndpointBase="/api/courses/purchase-requests"
        />
      )}
    </div>
  );
}
