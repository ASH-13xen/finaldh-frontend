import { useState, useEffect, useRef } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import DownloadProgressBar from '../components/DownloadProgressBar';

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

export default function StudentDashboard({ user }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(user);
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

  async function handleDownload(courseId, courseName) {
    console.log(`[handleDownload] Initiated download process for courseId: ${courseId}, courseName: ${courseName}`);
    setDownloadingStatus(prev => ({ 
      ...prev, 
      [courseId]: { step: 1, isDownloading: false, downloadPercent: 0 } 
    }));

    // Start progress polling interval every 800ms
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/courses/download-progress/${courseId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          const step = data.step || 1;
          console.log(`[Progress Polling] Polled step: ${step}`);
          setDownloadingStatus(prev => {
            if (prev[courseId]?.isClientSideProcessing) return prev;
            return {
              ...prev,
              [courseId]: { step, isDownloading: false, downloadPercent: 0 }
            };
          });
        }
      } catch (err) {
        console.warn('Error polling progress:', err);
      }
    }, 800);

    try {
      // Bypass Vite dev server proxy for large PDF files to prevent proxy timeout/buffer issues
      console.log(`[Main Fetch] Triggering GET request to /api/courses/download/${courseId}`);
      const res = await fetch(`/api/courses/download/${courseId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      console.log(`[Main Fetch] Response received. Status: ${res.status} ${res.statusText}`);

      // Stop polling progress once headers are received
      clearInterval(pollInterval);

      if (!res.ok) {
        let errorMsg = 'Failed to download PDF';
        try {
          const errData = await res.json();
          errorMsg = errData.error || errorMsg;
          console.error('[Main Fetch] Error response payload:', errData);
        } catch (jsonErr) {
          console.warn('[Main Fetch] Failed to parse JSON error response:', jsonErr);
        }
        throw new Error(errorMsg);
      }

      const downloadMode = res.headers.get('x-download-mode');
      console.log(`[Main Fetch] Download Mode from headers: ${downloadMode}`);

      const contentLength = res.headers.get('content-length');
      console.log(`[Main Fetch] Content-Length header: ${contentLength}`);
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

      const reader = res.body.getReader();
      let receivedBytes = 0;
      const chunks = [];

      setDownloadingStatus(prev => ({ 
        ...prev, 
        [courseId]: { step: 5, isDownloading: true, downloadPercent: 0, isClientSideProcessing: downloadMode === 'client-side' } 
      }));

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log(`[Main Fetch] Body stream reader finished. Total received bytes: ${receivedBytes}`);
          break;
        }

        chunks.push(value);
        receivedBytes += value.length;

        if (totalBytes > 0) {
          const progressPercent = Math.round((receivedBytes * 100) / totalBytes);
          setDownloadingStatus(prev => ({ 
            ...prev, 
            [courseId]: { step: 5, isDownloading: true, downloadPercent: progressPercent, isClientSideProcessing: downloadMode === 'client-side' } 
          }));
        } else {
          setDownloadingStatus(prev => ({ 
            ...prev, 
            [courseId]: { step: 5, isDownloading: true, downloadPercent: 95, isClientSideProcessing: downloadMode === 'client-side' } 
          }));
        }
      }

      let finalBlob;

      if (downloadMode === 'client-side') {
        console.log(`[Client-Side Mode] Raw PDF downloaded. Starting watermarking and encryption...`);

        // Step 6: Fetch barcode
        setDownloadingStatus(prev => ({ 
          ...prev, 
          [courseId]: { step: 6, isDownloading: false, downloadPercent: 0, isClientSideProcessing: true } 
        }));
        const barcodeRes = await fetch('/api/user/barcode', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (!barcodeRes.ok) {
          throw new Error('Failed to generate user barcode for client-side stamping');
        }
        const barcodeBytes = await barcodeRes.arrayBuffer();
        console.log(`[Client-Side Mode] Fetched user barcode (${barcodeBytes.byteLength} bytes)`);

        // Step 7: Stamp watermark & barcode
        setDownloadingStatus(prev => ({ 
          ...prev, 
          [courseId]: { step: 7, isDownloading: false, downloadPercent: 0, isClientSideProcessing: true } 
        }));

        // Lazy load pdf-lib and pdf-encrypt-lite dynamically
        console.log(`[Client-Side Mode] Lazy loading pdf-lib and pdf-encrypt-lite...`);
        const { PDFDocument, rgb } = await import('pdf-lib');
        const { encryptPDF } = await import('@pdfsmaller/pdf-encrypt-lite');

        // Combine chunks into single Uint8Array
        const pdfBytes = new Uint8Array(receivedBytes);
        let offset = 0;
        for (const chunk of chunks) {
          pdfBytes.set(chunk, offset);
          offset += chunk.length;
        }

        const pdfDoc = await PDFDocument.load(pdfBytes);
        const barcodeImage = await pdfDoc.embedPng(barcodeBytes);
        const helveticaFont = await pdfDoc.embedFont('Helvetica');
        const helveticaBoldFont = await pdfDoc.embedFont('Helvetica-Bold');

        const currentCourse = courses.find(c => c.courseId === courseId) || {};

        pdfDoc.setTitle(courseName || 'Secured Course PDF');
        pdfDoc.setAuthor(currentUser.email);
        pdfDoc.setSubject(currentCourse.subject || 'Syllabus Course Content');
        pdfDoc.setProducer('The Dark Horse UPSC');
        pdfDoc.setCreator('The Dark Horse UPSC');
        pdfDoc.setKeywords([currentUser._id.toString(), currentUser.email]);

        const pages = pdfDoc.getPages();
        const watermarkText = `Name: ${currentUser.fullName || currentUser.name}  |  Email: ${currentUser.email}  |  Mobile: ${currentUser.mobileNumber || 'N/A'}`;

        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          const { width, height } = page.getSize();
          page.drawText(watermarkText, {
            x: 25,
            y: height - 25,
            size: 9,
            font: helveticaFont,
            color: rgb(0.6, 0.6, 0.6),
          });

          const barcodeWidth = 90;
          const barcodeHeight = 20;
          page.drawImage(barcodeImage, {
            x: width - barcodeWidth - 25,
            y: 15,
            width: barcodeWidth,
            height: barcodeHeight,
          });
        }

        if (pages.length > 0) {
          const firstPage = pages[0];
          const { width, height } = firstPage.getSize();
          const numPagesToAdd = Math.max(1, Math.floor(pages.length / 40));
          const insertIndices = [];
          let currentPagesCount = pages.length;
          for (let j = 0; j < numPagesToAdd; j++) {
            let maxIdx = currentPagesCount;
            let minIdx = currentPagesCount > 1 ? 1 : 0;
            insertIndices.push(Math.floor(Math.random() * (maxIdx - minIdx + 1)) + minIdx);
            currentPagesCount++;
          }
          insertIndices.sort((a, b) => a - b);
          for (const insertIdx of insertIndices) {
            const newPage = pdfDoc.insertPage(insertIdx, [width, height]);
            drawSecurityWarningPage(newPage, currentUser, currentCourse, helveticaFont, helveticaBoldFont, rgb);
          }
        }

        // Step 8: Save modified PDF
        setDownloadingStatus(prev => ({ 
          ...prev, 
          [courseId]: { step: 8, isDownloading: false, downloadPercent: 0, isClientSideProcessing: true } 
        }));
        const modifiedPdfBytes = await pdfDoc.save({
          useObjectStreams: false,
          updateFieldAppearances: false
        });

        // Step 9: Encrypt PDF
        setDownloadingStatus(prev => ({ 
          ...prev, 
          [courseId]: { step: 9, isDownloading: false, downloadPercent: 0, isClientSideProcessing: true } 
        }));
        const userPassword = currentUser.email.trim().toLowerCase();
        const encryptedPdfBytes = await encryptPDF(modifiedPdfBytes, userPassword);

        finalBlob = new Blob([encryptedPdfBytes], { type: 'application/pdf' });
      } else {
        finalBlob = new Blob(chunks, { type: 'application/pdf' });
      }

      setDownloadingStatus(prev => ({ 
        ...prev, 
        [courseId]: { step: 9, isDownloading: false, downloadPercent: 100, isSuccess: true } 
      }));

      const url = window.URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${courseName.replace(/\s+/g, '_')}_secured.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      console.log(`[Main Fetch] Saved PDF download object URL successfully.`);

      // Manually increment locally to update UI
      setCurrentUser(prev => {
        const limits = [...(prev.downloadLimits || [])];
        const entry = limits.find(d => d.courseId === courseId);
        if (entry) {
          entry.downloadedCount += 1;
        } else {
          limits.push({
            courseId,
            downloadedCount: 1,
            allowedCount: 1
          });
        }
        return {
          ...prev,
          downloadLimits: limits
        };
      });

    } catch (err) {
      clearInterval(pollInterval);
      console.error(`[handleDownload] Fatal catch block error:`, err);
      setDownloadingStatus(prev => ({ 
        ...prev, 
        [courseId]: { isError: true, errorMsg: err.message || 'Download failed' } 
      }));
    } finally {
      setTimeout(() => {
        setDownloadingStatus(prev => {
          const next = { ...prev };
          delete next[courseId];
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
              const limitEntry = currentUser?.downloadLimits?.find(d => d.courseId === course.courseId);
              const downloadedCount = limitEntry ? limitEntry.downloadedCount : 0;
              const allowedCount = limitEntry ? limitEntry.allowedCount : 1;
              const remaining = allowedCount - downloadedCount;
              const isLimitReached = remaining <= 0;

              const courseRequests = requests.filter(r => r.courseId === course.courseId);
              const hasPendingRequest = courseRequests.some(r => r.status === 'pending');

              return (
                <div 
                  key={course._id}
                  onMouseMove={handleMouseMove}
                  style={{ '--mouse-x': '0px', '--mouse-y': '0px' }}
                  className="course-card relative overflow-hidden bg-slate-900/40 backdrop-blur-md border border-slate-800/80 hover:border-slate-700/60 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-md flex flex-col justify-between hover:shadow-[0_8px_30px_rgba(0,0,0,0.35)] hover:shadow-indigo-950/10 transition-all duration-300 transform hover:-translate-y-0.5 before:absolute before:inset-0 before:z-0 before:pointer-events-none before:rounded-xl md:before:rounded-2xl before:bg-[radial-gradient(400px_circle_at_var(--mouse-x)_var(--mouse-y),rgba(99,102,241,0.06),transparent_60%)]"
                >
                  <div className="relative z-10 flex-grow flex flex-col justify-between space-y-4 md:space-y-6">
                    <div>
                      {/* Course Title */}
                      <h3 className="text-base md:text-2xl font-black text-slate-100 hover:text-white leading-tight tracking-wide transition-colors duration-200">
                        {course.name}
                      </h3>
                      
                      {/* Downloads Tracker */}
                      <p className="text-[10px] md:text-xs text-slate-400 mt-1 md:mt-2 font-medium tracking-wide">
                        downloads : {downloadedCount} used of {allowedCount}
                      </p>
                    </div>

                    {/* Action Panel */}
                    <div className="pt-3 md:pt-4 border-t border-slate-850/60 flex items-center justify-between gap-3 md:gap-4 mt-auto">
                      {isLimitReached ? (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 md:gap-3 w-full">
                          <span className="text-[9px] md:text-[11px] text-rose-500 font-bold whitespace-nowrap">
                            locked used {downloadedCount} out of {allowedCount}
                          </span>
                          {hasPendingRequest ? (
                            <button
                              disabled
                              className="px-2.5 py-1.5 md:px-4 md:py-1.5 bg-slate-850 text-slate-500 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold cursor-not-allowed whitespace-nowrap"
                            >
                              request pending
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenRequestModal(course.courseId, course.name)}
                              className="px-2.5 py-1.5 md:px-4 md:py-1.5 bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-850/80 text-indigo-400 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold transition-all duration-300 shadow-sm cursor-pointer whitespace-nowrap"
                            >
                              request download
                            </button>
                          )}
                        </div>
                      ) : (
                        downloadingStatus[course.courseId] ? (() => {
                          const status = downloadingStatus[course.courseId];

                          if (status.isError) {
                            return (
                              <div className="flex flex-col gap-1 w-full">
                                <span className="text-[10px] md:text-xs text-rose-500 font-bold text-center mb-1 animate-pulse">
                                  {status.errorMsg}
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div className="flex flex-col gap-2 md:gap-3.5 w-full">
                              {!status.isSuccess && (
                                <div className="flex flex-col gap-1.5 md:gap-2 bg-rose-950/25 border border-rose-900/60 rounded-lg md:rounded-xl p-2.5 md:p-3 animate-pulse">
                                  <div className="flex items-center gap-1.5 text-rose-400 font-black text-[8px] md:text-[10px] uppercase tracking-wider">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3 md:w-3.5 md:h-3.5 text-rose-500"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                    <span>This process may take a few minutes -- Do Not Refresh or Close This Page</span>
                                  </div>
                                  <p className="text-[8px] md:text-[10px] text-rose-350 font-bold leading-normal">
                                    The secure watermarking & encryption is in progress. Refreshing will abort the process.
                                  </p>
                                </div>
                              )}
                              <DownloadProgressBar 
                                step={status.step || 0}
                                isDownloading={status.isDownloading || false}
                                downloadPercent={status.downloadPercent || 0}
                              />
                              <button
                                disabled
                                className="w-full inline-flex items-center justify-center gap-1 md:gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-slate-850/85 text-slate-500 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold cursor-wait"
                              >
                                {status.isSuccess ? 'completed' : 'processing...'}
                              </button>
                            </div>
                          );
                        })() : (
                          <button
                            onClick={() => {
                              console.log(`[UI Click] Clicked download button for courseId: ${course.courseId}`);
                              handleDownload(course.courseId, course.name);
                            }}
                            className="w-full inline-flex items-center justify-center gap-1 md:gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold transition-all duration-300 shadow-md hover:shadow-indigo-950/20 cursor-pointer"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3 md:w-3.5 md:h-3.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Download PDF
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              className="w-full h-20 md:h-24 bg-slate-950 border border-slate-850 hover:border-slate-700 focus:border-indigo-500 text-slate-100 rounded-lg md:rounded-xl p-2.5 md:p-3 text-[11px] md:text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all duration-200 placeholder:text-slate-600 resize-none"
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
    </div>
  );
}
