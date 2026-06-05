import { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

export default function StudentDashboard({ user }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(user);
  const [requests, setRequests] = useState([]);
  const [requestingCourseId, setRequestingCourseId] = useState(null);
  const [downloadingStatus, setDownloadingStatus] = useState({});
  const [requestingStatus, setRequestingStatus] = useState({});

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

  const handleDownload = async (courseId, courseName) => {
    setDownloadingStatus(prev => ({ ...prev, [courseId]: 'Initiating download...' }));
    try {
      await new Promise(r => setTimeout(r, 400));
      setDownloadingStatus(prev => ({ ...prev, [courseId]: 'Securing PDF (applying watermark & barcode)...' }));
      
      // Bypass Vite dev server proxy for large PDF files to prevent proxy timeout/buffer issues
      const apiBaseUrl = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:5000' : '');
      const res = await fetch(`${apiBaseUrl}/api/courses/download/${courseId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to download PDF');
      }

      setDownloadingStatus(prev => ({ ...prev, [courseId]: 'Downloading file...' }));
      const blob = await res.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${courseName.replace(/\s+/g, '_')}_secured.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

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

  // Filter courses that match user's interestedCourses (case-insensitive check)
  const interestedList = Array.isArray(currentUser?.interestedCourses) ? currentUser.interestedCourses : [];
  const matchedCourses = courses.filter(course => 
    interestedList.some(intCourse => intCourse.toLowerCase() === course.courseId?.toLowerCase())
  );

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-10 md:py-14">
      {/* Dashboard Header */}
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Student Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1.5 font-medium">Access and download study materials matching your learning preferences.</p>
        </div>
        <div className="bg-indigo-950/45 border border-indigo-900/50 rounded-xl px-4 py-2 text-xs font-semibold text-indigo-400 flex flex-col gap-0.5">
          <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">Student Profile</span>
          <span className="font-extrabold text-slate-200">{user?.fullName || user?.name || user?.email}</span>
        </div>
      </div>

      {/* Profile summary banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">My Interested Courses</h2>
          <div className="flex flex-wrap gap-2 mt-2">
            {interestedList.length > 0 ? (
              interestedList.map((courseId, index) => (
                <span 
                  key={index} 
                  className="px-2.5 py-1 bg-indigo-950/40 border border-indigo-900/50 text-indigo-400 rounded-lg text-xs font-bold shadow-sm"
                >
                  {courseId}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500 font-medium italic">No interested courses specified in profile.</span>
            )}
          </div>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center sm:text-right flex-shrink-0">
          <span className="text-[10px] text-slate-550 font-bold uppercase tracking-wider block">Access Status</span>
          <span className="text-xs font-bold text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 rounded-full px-2.5 py-0.5 mt-1 inline-block">
            Authorized Account
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 text-center">
          <LoadingSpinner text="Retrieving matched courses..." />
        </div>
      ) : error ? (
        <div className="py-12 text-center bg-rose-950/20 border border-rose-900/50 rounded-2xl p-6">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8 text-rose-500 mx-auto mb-3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <h3 className="font-bold text-white">Failed to load courses</h3>
          <p className="text-xs text-slate-400 mt-1">{error}</p>
        </div>
      ) : matchedCourses.length === 0 ? (
        <div className="py-16 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/50 p-8">
          <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center mx-auto mb-4 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <h3 className="font-extrabold text-slate-300 text-sm">No matched courses found</h3>
          <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto font-medium">
            There are currently no uploaded courses matching your profile's interested courses ({interestedList.join(', ') || 'none'}).
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-250">Downloadable Resources</h2>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{matchedCourses.length} Courses Available</span>
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
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 shadow-md flex flex-col justify-between hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-indigo-400 bg-indigo-950/10 border border-indigo-900/50 rounded-lg px-2.5 py-1 uppercase tracking-wider">
                        ID: {course.courseId}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
                        Subject: {course.subject}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-white leading-snug line-clamp-2">
                        {course.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-1.5 font-medium truncate">
                        File: {course.fileName}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border border-slate-850 rounded-lg p-2 bg-slate-950">
                        <span className="font-semibold text-slate-400">Downloads:</span>
                        <span className={`font-bold ${isLimitReached ? 'text-amber-400' : 'text-indigo-400'}`}>
                          {downloadedCount} / {allowedCount} used
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-5 mt-5 border-t border-slate-850 flex items-center justify-between gap-4">
                    {isLimitReached ? (
                      hasPendingRequest ? (
                        <span className="text-[11px] text-amber-400 bg-amber-950/30 border border-amber-900/50 px-3 py-1.5 rounded-full font-bold">
                          Pending Approval
                        </span>
                      ) : (
                        <span className="text-[11px] text-rose-455 bg-rose-950/30 border border-rose-900/50 px-3 py-1.5 rounded-full font-bold">
                          Limit Reached
                        </span>
                      )
                    ) : (
                      <span className="text-[11px] text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 px-3 py-1.5 rounded-full font-bold">
                        {remaining} Download{remaining > 1 ? 's' : ''} Left
                      </span>
                    )}
                    
                    {isLimitReached ? (
                      hasPendingRequest ? (
                        <button
                          disabled
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-slate-500 rounded-xl text-xs font-extrabold cursor-not-allowed"
                        >
                          Request Pending
                        </button>
                      ) : (
                        requestingStatus[course.courseId] ? (
                          <div className="relative">
                            <span className="absolute bottom-full mb-2 right-0 bg-slate-950 border border-slate-800 text-[10px] text-indigo-400 font-extrabold px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap animate-bounce flex items-center gap-1.5 z-20">
                              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping"></span>
                              {requestingStatus[course.courseId]}
                            </span>
                            <button
                              disabled
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-slate-500 rounded-xl text-xs font-extrabold cursor-wait"
                            >
                              Requesting...
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleRequestDownload(course.courseId, course.name)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-950/30 hover:bg-indigo-900/40 border border-indigo-800/80 text-indigo-400 rounded-xl text-xs font-extrabold transition-all duration-300 shadow-sm cursor-pointer"
                          >
                            Request Download
                          </button>
                        )
                      )
                    ) : (
                      downloadingStatus[course.courseId] ? (
                        <div className="relative">
                          <span className="absolute bottom-full mb-2 right-0 bg-slate-950 border border-slate-800 text-[10px] text-indigo-400 font-extrabold px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap animate-bounce flex items-center gap-1.5 z-20">
                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping"></span>
                            {downloadingStatus[course.courseId]}
                          </span>
                          <button
                            disabled
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-slate-500 rounded-xl text-xs font-extrabold cursor-wait"
                          >
                            Processing...
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleDownload(course.courseId, course.name)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold transition-all duration-300 shadow-md hover:shadow-indigo-900/30 cursor-pointer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
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
      )}
    </div>
  );
}
