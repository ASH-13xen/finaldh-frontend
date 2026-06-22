import { useState, useEffect, useRef } from "react";
import LoadingSpinner from "../components/LoadingSpinner";

const SUBJECT_NAMES = {
  "GS-1": "GS-1: Culture, History, Geography, Society",
  "GS-2": "GS-2: Governance, Constitution, Polity, Social Justice",
  "GS-3": "GS-3: Science & Tech, Economic Dev, Bio-diversity, Security",
  "GS-4": "GS-4: Ethics, Integrity & Aptitude",
};

const OPTIONAL_NAMES = {
  OptionalSubjectAgriculture: "Optional: Agriculture",
  OptionalSubjectAnimalHusbandryAndVeterinaryScience:
    "Optional: Animal Husbandry & Veterinary Science",
  OptionalSubjectAnthropology: "Optional: Anthropology",
  OptionalSubjectBotany: "Optional: Botany",
  OptionalSubjectChemistry: "Optional: Chemistry",
  OptionalSubjectCivilEngineering: "Optional: Civil Engineering",
  OptionalSubjectCommerceAndAccountancy: "Optional: Commerce & Accountancy",
  OptionalSubjectEconomics: "Optional: Economics",
  OptionalSubjectElectricalEngineering: "Optional: Electrical Engineering",
  OptionalSubjectGeography: "Optional: Geography",
  OptionalSubjectGeology: "Optional: Geology",
  OptionalSubjectHistory: "Optional: History",
  OptionalSubjectLaw: "Optional: Law",
  OptionalSubjectMangement: "Optional: Management",
  OptionalSubjectMathematics: "Optional: Mathematics",
  OptionalSubjectMechanicalEngineering: "Optional: Mechanical Engineering",
  OptionalSubjectMedicalScience: "Optional: Medical Science",
  OptionalSubjectPhilosophy: "Optional: Philosophy",
  OptionalSubjectPhysics: "Optional: Physics",
  OptionalSubjectPoliticalScienceAndInternationalRelations:
    "Optional: Political Science & International Relations",
  OptionalSubjectPsychology: "Optional: Psychology",
  OptionalSubjectPublicAdministration: "Optional: Public Administration",
  OptionalSubjectSociology: "Optional: Sociology",
  OptionalSubjectStatistics: "Optional: Statistics",
  OptionalSubjectZoology: "Optional: Zoology",
};

const isOptionalSubject = (subject) => subject?.startsWith("OptionalSubject");
const isGsCoreSubject = (subject) =>
  subject?.startsWith("GS-") || subject === "Essay" || subject === "All GS";

const MMF_FEATURES = [
  "Syllabus-wise & Topic-wise Compilation of prominent Mains Test Series summaries for streamlined revision.",
  "Quick Revision Boxes (QRBs) after every topic, containing important keywords, examples, and value-addition points for rapid recall.",
  "Dedicated Notes Space to help you incorporate additional value-addition points from your own preparation.",
  "Enhanced Content Coverage with carefully curated additions from our side to ensure a more comprehensive understanding of every topic.",
  "Dedicated Group for Value Addition Pointers.",
];

function CourseCard({
  course,
  status,
  pendingRequest,
  onPurchase,
  onTelegramNotify,
}) {
  const isGS = course.subject.startsWith("GS-");
  const subjectDisplay = isGS
    ? course.subject
    : OPTIONAL_NAMES[course.subject]?.replace("Optional: ", "") ||
      course.subject;

  return (
    <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 hover:border-slate-700 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-xl flex flex-col justify-between hover:shadow-accent-950/10 hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
      <div className="space-y-2.5 md:space-y-4">
        {/* Category Badge */}
        <span className="text-[8px] md:text-[9px] font-extrabold text-accent-400 bg-accent-950/40 border border-accent-900/60 rounded px-1.5 py-0.5 uppercase tracking-wider w-fit block">
          {subjectDisplay}
        </span>

        {/* Course Name */}
        <h3 className="text-xs md:text-base font-bold text-slate-100 group-hover:text-white line-clamp-2 leading-relaxed transition-colors">
          {course.name || course.fileName}
        </h3>

        {course.discountLimitTag && (
          <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 text-[9px] font-bold text-amber-400 w-fit tracking-wide animate-pulse">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="w-3 h-3 text-amber-500"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            Discount valid only for first 50 students!
          </div>
        )}
      </div>

      <div className="border-t border-slate-800 pt-3 mt-4 md:pt-4 md:mt-6 flex items-center justify-between">
        <div>
          <span className="text-[8px] md:text-[9px] font-bold text-slate-400 block uppercase tracking-wider">
            Price
          </span>
          {course.useDiscount ? (
            <div className="flex items-baseline gap-1">
              <span className="text-sm md:text-lg font-extrabold text-accent-400">
                ₹{course.discountedPrice}
              </span>
              <span className="text-[9px] md:text-xs text-slate-500 line-through">
                ₹{course.price}
              </span>
            </div>
          ) : (
            <span className="text-sm md:text-lg font-extrabold text-slate-100">
              ₹{course.price || 499}
            </span>
          )}
        </div>

        {/* Status Render */}
        {status.type === "purchased" ? (
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-xl text-xs font-bold shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="w-3.5 h-3.5"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Purchased
          </div>
        ) : status.type === "pending" ? (
          <div className="flex items-center gap-1 px-2 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg md:rounded-xl text-[9px] md:text-xs font-bold animate-pulse">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="w-3 h-3"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="hidden min-[350px]:inline">
              Pending Verification
            </span>
            <span className="min-[350px]:hidden">Pending</span>
          </div>
        ) : (
          <button
            onClick={() => onPurchase(course)}
            className="px-2.5 py-1.5 md:px-4 md:py-2 bg-accent-600 hover:bg-accent-550 text-white rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold transition-all shadow-md hover:shadow-accent-950/20 cursor-pointer flex items-center gap-1 md:gap-1.5"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="w-3 h-3 md:w-3.5 md:h-3.5"
            >
              <circle cx="8" cy="21" r="1" />
              <circle cx="19" cy="21" r="1" />
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
            </svg>
            {status.type === "rejected" ? (
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
      {status.type === "pending" &&
        pendingRequest &&
        pendingRequest.telegramNotificationCount < 2 && (
          <button
            onClick={(e) => onTelegramNotify(pendingRequest, course, e)}
            className="w-full mt-3 px-3 py-2 bg-accent-600 hover:bg-accent-550 text-white rounded-xl text-[10px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4 10-10S17.52 2 12 2zm4.64 6.8c-.15.75-.85 3.79-1.2 5.68-.15.8-.45 1.07-.73 1.1-.63.06-1.11-.42-1.72-.82-.96-.63-1.51-1.02-2.44-1.63-1.08-.71-.38-1.1.24-1.74.16-.17 3.01-2.76 3.07-3.01.01-.03.01-.14-.05-.2-.06-.06-.15-.04-.21-.03-.1.02-1.61 1.02-4.56 3.02-.43.3-.82.45-1.17.44-.39-.01-1.15-.22-1.71-.41-.69-.23-1.24-.35-1.19-.74.03-.2.3-.41.82-.63 3.2-1.39 5.34-2.31 6.42-2.75 3.07-1.28 3.7-1.5 4.12-1.5.09 0 .3.02.43.13.11.09.14.22.15.31-.01.07.01.21-.01.29z" />
            </svg>
            Notify Admin on Telegram
          </button>
        )}
    </div>
  );
}

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

  // Optional Subjects section search
  const [optionalSearch, setOptionalSearch] = useState("");

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

  // Categorize courses into sections for the page below
  const mmfCourse = courses.find((c) => c.subject === "All GS");
  const mmfStatus = mmfCourse ? getCourseStatus(mmfCourse) : null;
  const mmfPendingRequest = mmfCourse
    ? purchaseRequests.find(
        (r) => r.courseId === mmfCourse.courseId && r.status === "pending",
      )
    : null;
  const gsCoreCourses = courses.filter(
    (c) => isGsCoreSubject(c.subject) && c.subject !== "All GS",
  );
  const optionalCourses = courses.filter((c) => isOptionalSubject(c.subject));
  const otherCourses = courses.filter(
    (c) => !isGsCoreSubject(c.subject) && !isOptionalSubject(c.subject),
  );
  const optionalSearchTerm = optionalSearch.trim().toLowerCase();
  const filteredOptionalCourses = optionalSearchTerm
    ? optionalCourses.filter((c) => {
        const display = (
          OPTIONAL_NAMES[c.subject]?.replace("Optional: ", "") || c.subject
        ).toLowerCase();
        return (
          (c.name || "").toLowerCase().includes(optionalSearchTerm) ||
          display.includes(optionalSearchTerm)
        );
      })
    : optionalCourses;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-14">
      {/* Header */}
      <div className="mb-8 md:mb-12 border-b border-slate-800 pb-4 md:pb-6">
        <h1 className="text-xl md:text-3xl font-extrabold text-white tracking-tight">
          Purchase Courses
        </h1>
        <p className="text-slate-400 text-xs md:text-sm mt-1.5 font-medium">
          Unlock standard study packages and syllabus guides directly. Simply
          make a UPI payment and upload your receipt for immediate access.
        </p>
      </div>

      {!loading && !error && mmfCourse && (
        <div className="mb-10 md:mb-14">
          <div className="bg-gradient-to-br from-accent-950/40 via-slate-900/60 to-slate-900/40 border border-accent-700/50 rounded-2xl p-5 md:p-10 shadow-2xl shadow-accent-950/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent-500 to-transparent"></div>
            <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
              <div className="flex-1">
                <span className="inline-flex items-center gap-1.5 text-[10px] md:text-xs font-extrabold text-accent-300 bg-accent-600/20 border border-accent-500/50 rounded-full px-3 py-1 uppercase tracking-wider mb-3">
                  Most Popular
                </span>
                <h2 className="text-lg md:text-3xl font-black text-white tracking-tight mb-1.5">
                  {mmfCourse.name}
                </h2>
                <p className="text-slate-300 text-xs md:text-sm font-medium mb-5">
                  Everything you need for GS Mains, compiled into one master
                  file.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                  {MMF_FEATURES.map((point, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span className="text-[11px] md:text-xs text-slate-300 font-medium leading-relaxed">
                        {point}
                      </span>
                    </div>
                  ))}
                </div>

                {mmfCourse.discountLimitTag && (
                  <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 text-[9px] font-bold text-amber-400 w-fit tracking-wide animate-pulse">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="w-3 h-3 text-amber-500"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    Discount valid only for first 50 students!
                  </div>
                )}
              </div>

              <div className="lg:w-56 flex flex-col items-center lg:items-end gap-4 shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-accent-900/40">
                <div className="text-center lg:text-right">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                    Price
                  </span>
                  {mmfCourse.useDiscount ? (
                    <div className="flex items-baseline gap-1.5 justify-center lg:justify-end">
                      <span className="text-xl md:text-2xl font-extrabold text-accent-300">
                        ₹{mmfCourse.discountedPrice}
                      </span>
                      <span className="text-sm text-slate-500 line-through">
                        ₹{mmfCourse.price}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xl md:text-2xl font-extrabold text-white">
                      ₹{mmfCourse.price}
                    </span>
                  )}
                </div>

                {mmfStatus.type === "purchased" ? (
                  <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-xl text-xs font-bold shadow-sm">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="w-3.5 h-3.5"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Purchased
                  </div>
                ) : mmfStatus.type === "pending" ? (
                  <div className="w-full flex flex-col items-center lg:items-end gap-2">
                    <div className="flex items-center gap-1 px-2 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-xs font-bold animate-pulse">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className="w-3 h-3"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      Pending Verification
                    </div>
                    {mmfPendingRequest &&
                      mmfPendingRequest.telegramNotificationCount < 2 && (
                        <button
                          onClick={(e) =>
                            handleTelegramNotify(
                              mmfPendingRequest,
                              mmfCourse,
                              e,
                            )
                          }
                          className="w-full px-3 py-2 bg-accent-600 hover:bg-accent-550 text-white rounded-xl text-[10px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          Notify Admin on Telegram
                        </button>
                      )}
                  </div>
                ) : (
                  <button
                    onClick={() => handleOpenPurchaseModal(mmfCourse)}
                    className="w-full lg:w-auto px-6 py-3 bg-accent-600 hover:bg-accent-500 text-white rounded-xl text-sm font-bold transition shadow-lg shadow-accent-950/30 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="w-4 h-4"
                    >
                      <circle cx="8" cy="21" r="1" />
                      <circle cx="19" cy="21" r="1" />
                      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                    </svg>
                    {mmfStatus.type === "rejected"
                      ? "Retry Purchase"
                      : "Purchase Now"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && comboOffers.length > 0 && (
        <div className="mb-10 md:mb-14">
          <div className="mb-5">
            <h2 className="text-base md:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="w-4 h-4 md:w-5 md:h-5 text-accent-400"
              >
                <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
                <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
                <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z" />
              </svg>
              Bundle & Save
            </h2>
            <p className="text-slate-400 text-xs md:text-sm mt-1 font-medium">
              Buy multiple papers together at a flat discounted price instead of
              purchasing them one by one.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {comboOffers.map((combo) => {
              const comboStatus = getComboStatus(combo);
              const sortedEligiblePrices = [...combo.eligibleCourses]
                .map((c) => c.price || 0)
                .sort((a, b) => b - a);
              const estimatedIndividualTotal =
                sortedEligiblePrices
                  .slice(0, combo.pickCount)
                  .reduce((sum, p) => sum + p, 0) +
                combo.requiredCourses.reduce(
                  (sum, c) => sum + (c.price || 0),
                  0,
                );
              const savings = estimatedIndividualTotal - combo.price;

              return (
                <div
                  key={combo._id}
                  className="bg-gradient-to-br from-accent-950/30 to-slate-900/40 backdrop-blur-md border border-accent-900/50 hover:border-accent-700/60 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-xl flex flex-col justify-between hover:shadow-accent-950/20 hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden"
                >
                  <div className="space-y-2.5 md:space-y-3">
                    <span className="text-[8px] md:text-[9px] font-extrabold text-accent-300 bg-accent-900/50 border border-accent-800/60 rounded px-1.5 py-0.5 uppercase tracking-wider w-fit block">
                      Bundle Offer
                    </span>

                    <h3 className="text-xs md:text-base font-bold text-slate-100 leading-relaxed">
                      {combo.label}
                    </h3>

                    <div className="space-y-2 text-[10px] md:text-xs">
                      <div>
                        <span className="text-slate-400 font-semibold">
                          Choose any {combo.pickCount} of:
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {combo.eligibleCourses.map((c) => (
                            <span
                              key={c.courseId}
                              className="bg-slate-800/80 border border-slate-700/60 text-slate-300 rounded px-1.5 py-0.5 font-bold"
                            >
                              {c.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      {combo.requiredCourses.length > 0 && (
                        <div>
                          <span className="text-slate-400 font-semibold">
                            Always includes:
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {combo.requiredCourses.map((c) => (
                              <span
                                key={c.courseId}
                                className="bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 rounded px-1.5 py-0.5 font-bold"
                              >
                                {c.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-accent-900/40 pt-3 mt-4 md:pt-4 md:mt-5 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[8px] md:text-[9px] font-bold text-slate-400 block uppercase tracking-wider">
                        Bundle Price
                      </span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-sm md:text-lg font-extrabold text-accent-300">
                          ₹{combo.price}
                        </span>
                        {savings > 0 && (
                          <span className="text-[9px] md:text-xs text-slate-500 line-through">
                            ₹{estimatedIndividualTotal}
                          </span>
                        )}
                      </div>
                      {savings > 0 && (
                        <span className="text-[9px] md:text-[10px] font-bold text-emerald-400 block">
                          Save ₹{savings}
                        </span>
                      )}
                    </div>

                    {comboStatus.type === "pending" ? (
                      <div className="flex items-center gap-1 px-2 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg md:rounded-xl text-[9px] md:text-xs font-bold animate-pulse shrink-0">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          className="w-3 h-3"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span className="hidden min-[350px]:inline">
                          Pending Verification
                        </span>
                        <span className="min-[350px]:hidden">Pending</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleOpenComboPicker(combo)}
                        className="px-2.5 py-1.5 md:px-4 md:py-2 bg-accent-600 hover:bg-accent-550 text-white rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold transition-all shadow-md hover:shadow-accent-950/20 cursor-pointer flex items-center gap-1 md:gap-1.5 shrink-0"
                      >
                        Select Papers
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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
        <div className="space-y-12 md:space-y-16">
          {optionalCourses.length > 0 && (
            <div>
              <div className="mb-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                  <h2 className="text-base md:text-xl font-extrabold text-white tracking-tight">
                    Optional Subjects
                  </h2>
                  <p className="text-slate-400 text-xs md:text-sm mt-1 font-medium">
                    Choose your optional from {optionalCourses.length} available
                    subjects.
                  </p>
                </div>
                <input
                  type="text"
                  value={optionalSearch}
                  onChange={(e) => setOptionalSearch(e.target.value)}
                  placeholder="Search optional subjects..."
                  className="w-full sm:w-64 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-550 focus:outline-none focus:border-accent-500 transition-all font-medium"
                />
              </div>
              {filteredOptionalCourses.length === 0 ? (
                <p className="text-sm text-slate-500 font-semibold text-center py-8 border border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
                  No optional subjects match your search.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredOptionalCourses.map((course) => {
                    const status = getCourseStatus(course);
                    const pendingRequest = purchaseRequests.find(
                      (r) =>
                        r.courseId === course.courseId &&
                        r.status === "pending",
                    );
                    return (
                      <CourseCard
                        key={course._id}
                        course={course}
                        status={status}
                        pendingRequest={pendingRequest}
                        onPurchase={handleOpenPurchaseModal}
                        onTelegramNotify={handleTelegramNotify}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {gsCoreCourses.length > 0 && (
            <div>
              <div className="mb-5">
                <h2 className="text-base md:text-xl font-extrabold text-white tracking-tight">
                  GS Core Papers
                </h2>
                <p className="text-slate-400 text-xs md:text-sm mt-1 font-medium">
                  GS-1 through GS-4, Essay, and the all-in-one Mains Master
                  File.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {gsCoreCourses.map((course) => {
                  const status = getCourseStatus(course);
                  const pendingRequest = purchaseRequests.find(
                    (r) =>
                      r.courseId === course.courseId && r.status === "pending",
                  );
                  return (
                    <CourseCard
                      key={course._id}
                      course={course}
                      status={status}
                      pendingRequest={pendingRequest}
                      onPurchase={handleOpenPurchaseModal}
                      onTelegramNotify={handleTelegramNotify}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {otherCourses.length > 0 && (
            <div>
              <div className="mb-5">
                <h2 className="text-base md:text-xl font-extrabold text-white tracking-tight">
                  Other Courses
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {otherCourses.map((course) => {
                  const status = getCourseStatus(course);
                  const pendingRequest = purchaseRequests.find(
                    (r) =>
                      r.courseId === course.courseId && r.status === "pending",
                  );
                  return (
                    <CourseCard
                      key={course._id}
                      course={course}
                      status={status}
                      pendingRequest={pendingRequest}
                      onPurchase={handleOpenPurchaseModal}
                      onTelegramNotify={handleTelegramNotify}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Combo Course Picker Modal */}
      {pickerCombo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 md:p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-5">
              <div>
                <span className="text-[9px] font-bold text-accent-400 bg-accent-950 border border-accent-900 rounded px-1.5 py-0.5 uppercase tracking-wide">
                  Bundle Offer
                </span>
                <h3 className="text-base md:text-lg font-extrabold text-white mt-1.5 leading-snug">
                  {pickerCombo.label}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">
                  Choose exactly {pickerCombo.pickCount} paper
                  {pickerCombo.pickCount > 1 ? "s" : ""} below for a flat ₹
                  {pickerCombo.price}.
                </p>
              </div>
              <button
                onClick={handleClosePicker}
                className="text-slate-450 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition"
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
                        ? "bg-accent-950/40 border-accent-600 text-accent-200 cursor-pointer"
                        : disabled
                          ? "bg-slate-950/40 border-slate-850 text-slate-500 cursor-not-allowed"
                          : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 cursor-pointer"
                    }`}
                  >
                    <span className="text-xs font-bold">{c.name}</span>
                    {owned ? (
                      <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide shrink-0">
                        Already owned
                      </span>
                    ) : (
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-accent-600 border-accent-500" : "border-slate-700"}`}
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
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Always included
                </p>
                <div className="flex flex-wrap gap-2">
                  {pickerCombo.requiredCourses.map((c) => {
                    const owned = isOwned(c.courseId);
                    return (
                      <span
                        key={c.courseId}
                        className={`text-[11px] font-bold rounded-lg px-3 py-1.5 border ${owned ? "bg-rose-950/30 border-rose-900/50 text-rose-400" : "bg-emerald-950/30 border-emerald-900/50 text-emerald-400"}`}
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
              <div className="p-3 bg-rose-950/20 border border-rose-900/40 text-rose-400 rounded-xl text-[11px] font-bold mb-4">
                You already own a course that's always included in this bundle,
                so it can't be purchased this way.
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <span className="text-[11px] font-bold text-slate-400">
                {pickerSelectedIds.length} / {pickerCombo.pickCount} selected
              </span>
              <div className="flex gap-3">
                <button
                  onClick={handleClosePicker}
                  className="px-4 py-2 text-slate-400 hover:text-white text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleContinueComboToPayment}
                  disabled={
                    pickerSelectedIds.length !== pickerCombo.pickCount ||
                    pickerCombo.requiredCourses.some((c) => isOwned(c.courseId))
                  }
                  className="px-5 py-2 bg-accent-600 hover:bg-accent-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 md:p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[95vh] overflow-y-auto">
            {/* Header info */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-[9px] font-bold text-accent-400 bg-accent-950 border border-accent-900 rounded px-1.5 py-0.5 uppercase tracking-wide">
                  UPI Payment Checkout
                </span>
                <h3 className="text-base md:text-lg font-extrabold text-white mt-1.5 leading-snug">
                  Unlock: {checkoutName}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">
                  Complete standard payment verification for access.
                </p>
              </div>
              <button
                onClick={handleClosePurchaseModal}
                className="text-slate-450 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition"
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
                <div className="w-16 h-16 bg-accent-950/40 border border-accent-500/30 text-accent-400 rounded-full flex items-center justify-center shadow-lg relative animate-bounce">
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
                <h4 className="text-base font-extrabold text-white">
                  Purchase Request Pending
                </h4>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed font-medium">
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
                        className="w-full px-4 py-2.5 bg-accent-600 hover:bg-accent-550 text-white rounded-xl text-xs font-bold transition shadow-md hover:shadow-accent-950/20 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <svg
                          className="w-3.5 h-3.5 fill-current"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4 10-10S17.52 2 12 2zm4.64 6.8c-.15.75-.85 3.79-1.2 5.68-.15.8-.45 1.07-.73 1.1-.63.06-1.11-.42-1.72-.82-.96-.63-1.51-1.02-2.44-1.63-1.08-.71-.38-1.1.24-1.74.16-.17 3.01-2.76 3.07-3.01.01-.03.01-.14-.05-.2-.06-.06-.15-.04-.21-.03-.1.02-1.61 1.02-4.56 3.02-.43.3-.82.45-1.17.44-.39-.01-1.15-.22-1.71-.41-.69-.23-1.24-.35-1.19-.74.03-.2.3-.41.82-.63 3.2-1.39 5.34-2.31 6.42-2.75 3.07-1.28 3.7-1.5 4.12-1.5.09 0 .3.02.43.13.11.09.14.22.15.31-.01.07.01.21-.01.29z" />
                        </svg>
                        Notify Admin on Telegram
                      </button>
                      <p className="text-[10px] text-slate-500 mt-2 text-center font-medium leading-relaxed">
                        Notify us personally or request for the Telegram group
                        link.
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
                <div className="bg-accent-950/25 border border-accent-900/40 rounded-xl p-3 text-[10px] md:text-xs text-accent-300 leading-relaxed font-medium flex gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="w-4 h-4 text-accent-400 flex-shrink-0 mt-0.5"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="9" x2="12.01" y2="9" />
                  </svg>
                  <div>
                    <span className="font-bold text-accent-200 block mb-0.5">
                      Notice:
                    </span>
                    This is a temporary payment option. We are actively working
                    on improving the payment experience. For queries or support,
                    please message us on Telegram or contact us via Email.
                  </div>
                </div>

                {modalError && (
                  <div className="p-3 bg-rose-950/20 border border-rose-900/40 text-rose-500 rounded-xl text-xs font-bold leading-normal">
                    {modalError}
                  </div>
                )}

                {/* QR Display Area */}
                <div className="bg-slate-950/80 border border-slate-850 rounded-2xl p-4 md:p-5 flex flex-col items-center text-center space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent-500 to-transparent animate-pulse"></div>

                  <p className="text-xs text-slate-300 font-semibold leading-relaxed">
                    Scan the QR code below using GPay, PhonePe, Paytm, or any
                    UPI app to transfer{" "}
                    <span className="text-accent-400 font-extrabold text-sm">
                      ₹{checkoutPrice}
                    </span>
                    . Click the QR code to view it full size.
                  </p>

                  {/* QR Image Box with scanning-line effect */}
                  <div
                    onClick={() => setZoomQr(true)}
                    className="relative p-2.5 bg-white rounded-xl shadow-xl group border border-slate-250 w-40 h-40 md:w-44 md:h-44 flex items-center justify-center cursor-zoom-in hover:border-accent-500/50 transition-colors"
                  >
                    <img
                      src="/qr/payment_qr.jpg"
                      alt="UPI Payment QR Code"
                      className="w-36 h-36 md:w-40 md:h-40 object-contain"
                    />
                    {/* Visual scan line animation */}
                    <div className="absolute inset-x-2.5 h-[2px] bg-accent-500/80 animate-[scan_2s_ease-in-out_infinite] pointer-events-none shadow-[0_0_10px_#8b5cf6]"></div>
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
                      className="w-full bg-slate-950 border border-slate-850 hover:border-slate-750 focus:border-accent-500 text-slate-100 rounded-xl px-4 py-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-accent-500 transition-all placeholder:text-slate-600"
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
                          <p className="text-[11px] text-slate-350 font-bold truncate">
                            {screenshot.name}
                          </p>
                          <p className="text-[9px] text-slate-500 font-medium">
                            {(screenshot.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setScreenshot(null);
                            setScreenshotPreview("");
                          }}
                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-rose-500 rounded-lg transition"
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
                      <div className="relative border-2 border-dashed border-slate-800 hover:border-accent-500/50 rounded-xl bg-slate-950 transition cursor-pointer">
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
                            className="w-8 h-8 text-slate-500 mx-auto mb-1.5"
                          >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          <p className="text-[11px] text-accent-400 font-bold">
                            Click to upload or drag payment receipt
                          </p>
                          <p className="text-[9px] text-slate-500 font-medium">
                            Supports PNG, JPG, JPEG (Max 10MB)
                          </p>
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
                    className="px-6 py-2 bg-accent-600 hover:bg-accent-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold transition shadow-md hover:shadow-accent-950/20 cursor-pointer flex items-center justify-center gap-1.5"
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
          className="fixed inset-0 z-[150] bg-slate-950/95 flex flex-col items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomQr(false)}
        >
          <button
            onClick={() => setZoomQr(false)}
            className="absolute top-4 right-4 text-slate-350 hover:text-white p-2 bg-slate-900/80 border border-slate-800 rounded-full hover:bg-slate-800 transition"
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
