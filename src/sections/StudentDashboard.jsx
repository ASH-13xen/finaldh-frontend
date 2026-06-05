import { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

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

function CourseSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <div 
          key={i} 
          className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between h-[230px] animate-pulse"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-4 w-16 bg-slate-800 rounded-md"></div>
              <div className="h-4 w-12 bg-slate-800 rounded-md"></div>
            </div>
            <div className="space-y-2">
              <div className="h-4 w-3/4 bg-slate-800 rounded-md"></div>
              <div className="h-3 w-1/2 bg-slate-800 rounded-md"></div>
            </div>
            <div className="h-8 w-full bg-slate-950/60 rounded-xl border border-slate-900/50 mt-1"></div>
          </div>
          <div className="pt-4 border-t border-slate-850/60 flex items-center justify-between gap-4">
            <div className="h-4 w-20 bg-slate-800 rounded-full"></div>
            <div className="h-7 w-28 bg-slate-800 rounded-xl"></div>
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
    setDownloadingStatus(prev => ({ ...prev, [courseId]: 'Preparing secure download...' }));

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

      const contentLength = res.headers.get('content-length');
      console.log(`[Main Fetch] Content-Length header: ${contentLength}`);
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

      const reader = res.body.getReader();
      let receivedBytes = 0;
      const chunks = [];

      setDownloadingStatus(prev => ({ ...prev, [courseId]: 'Downloading (0%)...' }));

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
            [courseId]: `Downloading (${progressPercent}%)...` 
          }));
        } else {
          const receivedKB = Math.round(receivedBytes / 1024);
          setDownloadingStatus(prev => ({ 
            ...prev, 
            [courseId]: `Downloading (${receivedKB} KB)...` 
          }));
        }
      }

      setDownloadingStatus(prev => ({ ...prev, [courseId]: 'Saving file...' }));
      const blob = new Blob(chunks, { type: 'application/pdf' });

      const url = window.URL.createObjectURL(blob);
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

      setDownloadingStatus(prev => ({ ...prev, [courseId]: 'Success!' }));

    } catch (err) {
      console.error(`[handleDownload] Fatal catch block error:`, err);
      setDownloadingStatus(prev => ({ ...prev, [courseId]: `Error: ${err.message || 'Download failed'}` }));
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
    <div className="w-full max-w-5xl mx-auto px-6 py-10 md:py-14">
      {/* Dashboard Header */}
      <div className="mb-10 border-b border-slate-800/80 pb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{getGreeting()},</span>
          <span className="bg-gradient-to-r from-indigo-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent capitalize">
            {currentUser?.fullName?.split(' ')[0] || currentUser?.name || 'Scholar'}
          </span>
        </h1>
        <p className="text-slate-400 text-sm mt-1.5 font-medium">Access and download study materials matching your learning preferences.</p>
      </div>

      {/* Profile summary banner */}
      <div className="bg-gradient-to-r from-slate-900/80 via-slate-900/40 to-indigo-950/15 border border-slate-800/70 rounded-2xl p-6 shadow-xl mb-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-indigo-550/10 border border-indigo-900/40 text-indigo-400 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg>
              </div>
              <h2 className="text-xs font-bold text-slate-350 uppercase tracking-widest">My Taken Courses</h2>
            </div>
            {interestedList.length > 0 && (
              <span className="text-[10px] px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5 self-start sm:self-auto">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                {interestedList.length} Active {interestedList.length === 1 ? 'Course' : 'Courses'}
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2.5">
            {interestedList.length > 0 ? (
              interestedList.map((courseId, index) => {
                const courseDetail = courses.find(c => c.courseId && typeof c.courseId === 'string' && c.courseId.toLowerCase() === courseId.toLowerCase());
                const dispName = courseDetail ? courseDetail.name : courseId;
                
                return (
                  <div 
                    key={index}
                    className="group/pill relative flex items-center gap-2 px-3 py-1.5 bg-slate-950/60 hover:bg-indigo-950/20 border border-slate-850 hover:border-indigo-500/30 rounded-xl text-xs text-indigo-300 hover:text-indigo-250 font-bold shadow-sm transition-all duration-300 cursor-default hover:scale-[1.02]"
                  >
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full group-hover/pill:bg-indigo-400 transition-colors"></span>
                    <span>{courseId}</span>
                    {courseDetail && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 hidden group-hover/pill:block bg-slate-950 border border-slate-800 text-[10px] text-slate-400 rounded-lg p-2.5 shadow-2xl z-30 leading-normal pointer-events-none text-center">
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
        <div className="py-16 text-center text-slate-555 border border-dashed border-slate-800/80 rounded-2xl bg-slate-900/30 p-8">
          <div className="w-12 h-12 bg-slate-900/50 border border-slate-800/60 rounded-xl flex items-center justify-center mx-auto mb-4 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <h3 className="font-bold text-slate-300 text-sm">No matched courses found</h3>
          <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto font-medium">
            There are currently no uploaded courses matching your profile's taken courses ({interestedList.join(', ') || 'none'}).
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-base font-extrabold text-slate-200">Downloadable Resources</h2>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{matchedCourses.length} Courses Available</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  className="course-card relative overflow-hidden bg-slate-900/40 backdrop-blur-md border border-slate-800/80 hover:border-slate-700/60 rounded-2xl p-6 shadow-md flex flex-col justify-between hover:shadow-[0_8px_30px_rgba(0,0,0,0.35)] hover:shadow-indigo-950/10 transition-all duration-300 transform hover:-translate-y-0.5 before:absolute before:inset-0 before:z-0 before:pointer-events-none before:rounded-2xl before:bg-[radial-gradient(400px_circle_at_var(--mouse-x)_var(--mouse-y),rgba(99,102,241,0.06),transparent_60%)]"
                >
                  <div className="relative z-10 flex-grow flex flex-col justify-between space-y-6">
                    <div>
                      {/* Course Title */}
                      <h3 className="text-xl md:text-2xl font-black text-slate-100 hover:text-white leading-tight tracking-wide transition-colors duration-200">
                        {course.name}
                      </h3>
                      
                      {/* Downloads Tracker */}
                      <p className="text-xs text-slate-400 mt-2 font-medium tracking-wide">
                        downloads : {downloadedCount} used of {allowedCount}
                      </p>
                    </div>

                    {/* Action Panel */}
                    <div className="pt-4 border-t border-slate-850/60 flex items-center justify-between gap-4 mt-auto">
                      {isLimitReached ? (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
                          <span className="text-[11px] text-rose-500 font-bold whitespace-nowrap">
                            locked used {downloadedCount} out of {allowedCount}
                          </span>
                          {hasPendingRequest ? (
                            <button
                              disabled
                              className="px-4 py-1.5 bg-slate-850 text-slate-500 rounded-xl text-xs font-bold cursor-not-allowed whitespace-nowrap"
                            >
                              request pending
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenRequestModal(course.courseId, course.name)}
                              className="px-4 py-1.5 bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-850/80 text-indigo-400 rounded-xl text-xs font-bold transition-all duration-300 shadow-sm cursor-pointer whitespace-nowrap"
                            >
                              request download
                            </button>
                          )}
                        </div>
                      ) : (
                        downloadingStatus[course.courseId] ? (() => {
                          const status = downloadingStatus[course.courseId];
                          const cleanText = getCleanStatusText(status);
                          const isPreparing = status && 
                            !status.includes('Downloading') && 
                            !status.includes('Saving') && 
                            !status.includes('Success') && 
                            !status.includes('Error');
                          const isDownloading = status && status.includes('Downloading');
                          
                          return (
                            <div className="flex flex-col items-end gap-1.5 w-full">
                              <span className="text-sm text-indigo-400 font-extrabold whitespace-nowrap flex items-center gap-2 animate-pulse">
                                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></span>
                                {cleanText}
                              </span>
                              
                              {isPreparing && (
                                <span className="text-xs text-slate-300 font-medium text-right leading-relaxed block mt-1">
                                  It may take up to a few minutes to prepare your file.
                                </span>
                              )}

                              {isDownloading && (() => {
                                 const match = status.match(/\((\d+)%\)/);
                                 const percent = match ? parseInt(match[1], 10) : null;
                                 if (percent !== null && percent > 0) {
                                   return (
                                     <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden mt-1">
                                       <div 
                                         className="bg-indigo-500 h-1 rounded-full transition-all duration-300" 
                                         style={{ width: `${percent}%` }}
                                       ></div>
                                     </div>
                                   );
                                 }
                                 return null;
                               })()}
                              
                              <button
                                disabled
                                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-850/85 text-slate-500 rounded-xl text-xs font-bold cursor-wait mt-1"
                              >
                                {isDownloading ? 'Downloading...' : 'Processing...'}
                              </button>
                            </div>
                          );
                        })() : (
                          <button
                            onClick={() => {
                              console.log(`[UI Click] Clicked download button for courseId: ${course.courseId}`);
                              handleDownload(course.courseId, course.name);
                            }}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-bold transition-all duration-300 shadow-md hover:shadow-indigo-950/20 cursor-pointer"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-extrabold text-white mb-2">Request Additional Download</h3>
            <p className="text-xs text-slate-400 mb-4 font-medium">
              Please specify a reason for requesting another download of <span className="text-indigo-400 font-bold">{requestModalCourseName}</span>.
            </p>
            
            {requestErrorMsg && (
              <div className="p-2.5 bg-rose-950/20 border border-rose-900/30 text-rose-500 rounded-xl text-xs font-bold mb-4">
                {requestErrorMsg}
              </div>
            )}

            <textarea
              className="w-full h-24 bg-slate-950 border border-slate-850 hover:border-slate-700 focus:border-indigo-500 text-slate-100 rounded-xl p-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all duration-200 placeholder:text-slate-600 resize-none"
              placeholder="Type your reason here... (reason cannot be empty)"
              value={requestReason}
              onChange={(e) => {
                setRequestReason(e.target.value);
                if (e.target.value.trim()) setRequestErrorMsg('');
              }}
            />

            <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-slate-850/60">
              <button
                onClick={() => {
                  setShowRequestModal(false);
                  setRequestReason('');
                  setRequestErrorMsg('');
                }}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                cancel
              </button>
              <button
                onClick={handleSubmitRequest}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-md hover:shadow-indigo-950/20 cursor-pointer"
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
