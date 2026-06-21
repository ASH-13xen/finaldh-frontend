import { useState, useEffect } from 'react';
import axios from 'axios';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';

const SUBJECT_NAMES = {
  'GS-1': 'GS-1: Culture, History, Geography, Society',
  'GS-2': 'GS-2: Governance, Constitution, Polity, Social Justice',
  'GS-3': 'GS-3: Science & Tech, Economic Dev, Bio-diversity, Security',
  'GS-4': 'GS-4: Ethics, Integrity & Aptitude',
  'All GS': 'All GS',
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

const availableSubjects = [
  ...Object.entries(SUBJECT_NAMES).map(([id, name]) => ({ id, name })),
  ...Object.entries(OPTIONAL_NAMES).map(([id, name]) => ({ id, name }))
];

export default function UploadCourse() {
  // Courses List state
  const [courses, setCourses] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState('');

  // Add / Edit Modal states
  const [showModal, setShowModal] = useState(false);
  const [editCourse, setEditCourse] = useState(null); // null for Add mode, course object for Edit mode

  // Form states
  const [courseId, setCourseId] = useState('');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [price, setPrice] = useState('499');
  const [discountedPrice, setDiscountedPrice] = useState('499');
  const [useDiscount, setUseDiscount] = useState(false);
  const [discountLimitTag, setDiscountLimitTag] = useState(false);
  const [courseFiles, setCourseFiles] = useState([]);

  // Status states
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);

  // Download Requests state
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [approvingId, setApprovingId] = useState(null);

  // Toast notifications state
  const [toasts, setToasts] = useState([]);
  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Fetch all existing courses on load
  const fetchCourses = async () => {
    setLoadingList(true);
    setListError('');
    try {
      const res = await fetch('/api/courses/list');
      if (!res.ok) throw new Error('Failed to retrieve courses list');
      const data = await res.json();
      setCourses(data.courses || []);
    } catch (err) {
      console.error(err);
      setListError(err.message || 'Failed to load courses.');
    } finally {
      setLoadingList(false);
    }
  };

  // Fetch pending download requests
  const fetchPendingRequests = async () => {
    setLoadingRequests(true);
    setRequestError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/user/admin/requests', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error('Failed to retrieve pending download requests');
      }
      const data = await res.json();
      setRequests(data || []);
    } catch (err) {
      console.error(err);
      setRequestError(err.message || 'Failed to load requests.');
    } finally {
      setLoadingRequests(false);
    }
  };

  // Approve a student's download request
  const handleApproveRequest = async (id) => {
    setApprovingId(id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/user/admin/requests/${id}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to approve request');
      }
      await fetchPendingRequests();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error approving request.', 'error');
    } finally {
      setApprovingId(null);
    }
  };

  useEffect(() => {
    fetchCourses();
    fetchPendingRequests();
  }, []);

  // PDF file slots helper methods
  const handleAddFileSlot = () => {
    setCourseFiles(prev => [...prev, { id: Date.now(), type: 'new', name: '', file: null }]);
  };

  const handleRemoveFileSlot = (id) => {
    setCourseFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleUpdateFileSlot = (id, updates) => {
    setCourseFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  // Open modal for adding
  const handleOpenAdd = () => {
    setEditCourse(null);
    setCourseId('');
    setName('');
    setSubject('');
    setPrice('499');
    setDiscountedPrice('499');
    setUseDiscount(false);
    setDiscountLimitTag(false);
    setCourseFiles([{ id: Date.now(), type: 'new', name: '', file: null }]);
    setFormError('');
    setSuccessMsg('');
    setUploadProgress(0);
    setShowProgress(false);
    setShowModal(true);
  };

  // Open modal for editing
  const handleOpenEdit = (course) => {
    setEditCourse(course);
    setCourseId(course.courseId || '');
    setName(course.name || '');
    setSubject(course.subject || '');
    setPrice(String(course.price || 499));
    setDiscountedPrice(String(course.discountedPrice !== undefined ? course.discountedPrice : (course.price || 499)));
    setUseDiscount(!!course.useDiscount);
    setDiscountLimitTag(!!course.discountLimitTag);
    
    if (course.fileUrls && course.fileUrls.length > 0) {
      setCourseFiles(course.fileUrls.map((url, idx) => ({
        id: idx,
        type: 'existing',
        name: course.fileNames?.[idx] || `PDF ${idx + 1}`,
        url,
        pageCount: course.partPageCounts?.[idx] || 0
      })));
    } else {
      setCourseFiles([{
        id: 0,
        type: 'existing',
        name: course.fileName || 'PDF File',
        url: course.fileUrl,
        pageCount: course.partPageCounts?.[0] || 0
      }]);
    }

    setFormError('');
    setSuccessMsg('');
    setUploadProgress(0);
    setShowProgress(false);
    setShowModal(true);
  };

  // Handle Form Submit (Add or Update)
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!courseId || !name || !subject || !price) {
      setFormError('Please fill in all required fields.');
      return;
    }

    const hasValidFile = courseFiles.some(f => f.type === 'existing' || (f.type === 'new' && f.file));
    if (!hasValidFile) {
      setFormError('Please select at least one PDF file for the course.');
      return;
    }

    const hasEmptyFileName = courseFiles.some(f => !f.name.trim());
    if (hasEmptyFileName) {
      setFormError('All PDF slots must have a display name.');
      return;
    }

    setSaving(true);
    setFormError('');
    setSuccessMsg('');
    setUploadProgress(0);
    setShowProgress(true);

    const formData = new FormData();
    formData.append('courseId', courseId);
    formData.append('name', name);
    formData.append('subject', subject);
    formData.append('price', price);
    formData.append('discountedPrice', discountedPrice);
    formData.append('useDiscount', useDiscount);
    formData.append('discountLimitTag', discountLimitTag);

    // Build the filesConfig array and append files
    const filesConfig = [];
    courseFiles.forEach(f => {
      if (f.type === 'existing') {
        filesConfig.push({
          type: 'existing',
          name: f.name.trim(),
          url: f.url,
          pageCount: f.pageCount
        });
      } else if (f.file) {
        filesConfig.push({
          type: 'new',
          name: f.name.trim()
        });
        formData.append('files', f.file);
      }
    });

    formData.append('filesConfig', JSON.stringify(filesConfig));

    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL || '';
      const url = editCourse 
        ? `${apiBaseUrl}/api/courses/${editCourse._id}` 
        : `${apiBaseUrl}/api/courses/upload`;
      const method = editCourse ? 'PUT' : 'POST';

      const response = await axios({
        method,
        url,
        data: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      });

      setSuccessMsg(editCourse ? 'Course updated successfully!' : 'Course added successfully!');
      
      // Refresh course list
      await fetchCourses();

      // Close modal after brief delay
      setTimeout(() => {
        setShowModal(false);
        setShowProgress(false);
      }, 1000);

    } catch (err) {
      console.error(err);
      let errorMessage = 'An error occurred while saving.';
      if (err.response?.data) {
        if (typeof err.response.data.error === 'string') {
          errorMessage = err.response.data.error;
        } else if (typeof err.response.data.error === 'object' && err.response.data.error !== null) {
          errorMessage = err.response.data.error.message || JSON.stringify(err.response.data.error);
        } else if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        } else {
          errorMessage = JSON.stringify(err.response.data);
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      setFormError(errorMessage);
      setShowProgress(false);
    } finally {
      setSaving(false);
    }
  };

  // Handle course deletion
  const handleDeleteCourse = async (id) => {
    if (!window.confirm('Are you sure you want to delete this course completely? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/api/courses/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete course');
      }
      fetchCourses();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error occurred while deleting course.', 'error');
    }
  };

  // Handle toggling course discount
  const handleToggleDiscount = async (course) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/courses/${course._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          useDiscount: !course.useDiscount
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to toggle discount');
      }
      showToast('Discount status updated successfully!', 'success');
      fetchCourses();
    } catch (err) {
      console.error('Error toggling discount:', err);
      showToast(err.message || 'Error occurred while toggling discount.', 'error');
    }
  };

  // Handle toggling course discount limit tag
  const handleToggleDiscountLimitTag = async (course) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/courses/${course._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          discountLimitTag: !course.discountLimitTag
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to toggle limit tag');
      }
      showToast('Discount limit tag updated successfully!', 'success');
      fetchCourses();
    } catch (err) {
      console.error('Error toggling discount limit tag:', err);
      showToast(err.message || 'Error occurred while toggling discount limit tag.', 'error');
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-10 md:py-14">
      {/* Admin Mode active banner callout */}
      <div className="bg-rose-950/30 border border-rose-900/50 rounded-2xl p-4.5 mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-950/80 text-rose-400 rounded-xl flex items-center justify-center border border-rose-900/50">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <div>
            <h2 className="text-xs font-bold text-rose-400 uppercase tracking-wide">Logged in as Administrator (Admin Mode)</h2>
            <p className="text-[11px] text-rose-400/85 font-semibold mt-0.5">You have elevated access controls to publish, modify, and delete courses.</p>
          </div>
        </div>
      </div>

      {/* Course management header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6 mb-10">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Course Management</h1>
          <p className="text-slate-400 text-sm mt-1.5 font-medium">Create, update, and manage study guides and courses on the platform.</p>
        </div>
        <div>
          <button 
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-accent-600 hover:bg-accent-500 text-white rounded-xl text-xs font-bold transition duration-200 cursor-pointer shadow-md hover:shadow-accent-950/30"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add New Course
          </button>
        </div>
      </div>

      {/* Courses List Table */}
      {loadingList ? (
        <div className="py-20 text-center">
          <LoadingSpinner text="Loading courses..." />
        </div>
      ) : listError ? (
        <div className="p-4 bg-rose-950/30 border border-rose-900/50 text-rose-400 text-xs font-semibold rounded-xl text-center">
          {listError}
        </div>
      ) : courses.length === 0 ? (
        <div className="py-16 text-center text-slate-500 border border-dashed border-slate-800 bg-slate-900/50 rounded-2xl p-8">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-12 h-12 mx-auto mb-3 text-slate-400"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
          <p className="text-xs font-bold text-slate-400">No courses uploaded yet.</p>
          <p className="text-[10px] text-slate-500 mt-1">Click the "Add New Course" button to publish your first study guide.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Course ID</th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Price (₹)</th>
                  <th className="px-6 py-4">Use Discount</th>
                  <th className="px-6 py-4">50 Stud Tag</th>
                  <th className="px-6 py-4">PDF Files</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs text-slate-300">
                {courses.map((course) => {
                  const subDisplayName = availableSubjects.find(s => s.id === course.subject)?.name || course.subject;
                  return (
                    <tr key={course._id} className="hover:bg-slate-850/50 transition-colors">
                       <td className="px-6 py-4 font-bold text-accent-400">
                        <span className="bg-accent-950/40 border border-accent-900/50 rounded-lg px-2 py-1 text-[10px]">
                          {course.courseId}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-200 max-w-xs truncate">{course.name}</td>
                      <td className="px-6 py-4 text-slate-400 font-medium">{subDisplayName}</td>
                      <td className="px-6 py-4">
                        {course.useDiscount ? (
                          <div className="flex flex-col">
                            <span className="font-extrabold text-accent-400">₹{course.discountedPrice}</span>
                            <span className="text-[10px] text-slate-500 line-through">₹{course.price}</span>
                          </div>
                        ) : (
                          <span className="font-extrabold text-slate-300">₹{course.price}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => handleToggleDiscount(course)}
                          className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${course.useDiscount ? 'bg-accent-600' : 'bg-slate-700'}`}
                          role="switch"
                          aria-checked={course.useDiscount}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${course.useDiscount ? 'translate-x-5' : 'translate-x-0'}`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => handleToggleDiscountLimitTag(course)}
                          className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${course.discountLimitTag ? 'bg-accent-600' : 'bg-slate-700'}`}
                          role="switch"
                          aria-checked={course.discountLimitTag}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${course.discountLimitTag ? 'translate-x-5' : 'translate-x-0'}`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 text-slate-400 font-medium max-w-xs">
                        <div className="flex flex-col gap-1.5">
                          {(course.fileNames && course.fileNames.length > 0 ? course.fileNames : [course.fileName]).map((fname, idx) => (
                            <a 
                              key={idx}
                              href={`${import.meta.env.VITE_API_URL || ''}/api/courses/raw/${course._id}?token=${localStorage.getItem('token')}&index=${idx}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="hover:text-accent-400 hover:underline flex items-center gap-1 truncate"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-slate-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                              {fname}
                            </a>
                          ))}
                        </div>   </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEdit(course)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold transition cursor-pointer border border-slate-750"
                        >
                          Modify
                        </button>
                        <button
                          onClick={() => handleDeleteCourse(course._id)}
                          className="px-2.5 py-1.5 bg-rose-950/20 hover:bg-rose-900/40 text-rose-400 rounded-lg font-bold transition cursor-pointer border border-rose-900/50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending Download Requests Section */}
      <div className="mt-14 pt-10 border-t border-slate-800">
        <div className="mb-6">
          <h2 className="text-xl font-extrabold text-white tracking-tight">Pending Download Requests</h2>
          <p className="text-slate-400 text-xs mt-1 font-medium">Review and approve additional PDF download requests from students.</p>
        </div>

        {loadingRequests ? (
          <div className="py-10 text-center">
            <LoadingSpinner text="Loading requests..." />
          </div>
        ) : requestError ? (
          <div className="p-4 bg-rose-950/30 border border-rose-900/50 text-rose-400 text-xs font-semibold rounded-xl text-center">
            {requestError}
          </div>
        ) : requests.length === 0 ? (
          <div className="py-10 text-center text-slate-500 border border-dashed border-slate-800 bg-slate-900/50 rounded-2xl p-6">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 mx-auto mb-3 text-slate-400"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <p className="text-xs font-bold text-slate-400">No pending download requests.</p>
            <p className="text-[10px] text-slate-500 mt-1">All student download requests are processed.</p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Student</th>
                    <th className="px-6 py-4">Course ID</th>
                    <th className="px-6 py-4">Course Name</th>
                    <th className="px-6 py-4">Reason</th>
                    <th className="px-6 py-4">Requested At</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-xs text-slate-300">
                  {requests.map((req) => (
                    <tr key={req._id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-200">{req.userName}</div>
                        <div className="text-[10px] text-slate-500 font-medium">{req.userEmail}</div>
                      </td>
                      <td className="px-6 py-4 font-bold text-accent-400">
                        <span className="bg-accent-950/10 border border-accent-900/50 rounded-lg px-2 py-1 text-[10px]">
                          {req.courseId}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-200 truncate max-w-xs">{req.courseName}</td>
                      <td className="px-6 py-4 font-medium text-slate-350 max-w-xs break-words">{req.reason || '-'}</td>
                      <td className="px-6 py-4 text-slate-400 font-medium">
                        {new Date(req.requestedAt || req.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleApproveRequest(req._id)}
                          disabled={approvingId === req._id}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white rounded-lg font-bold transition cursor-pointer text-xs"
                        >
                          {approvingId === req._id ? 'Approving...' : 'Approve'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal Overlay */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl w-full max-w-lg space-y-6 relative transform transition-all duration-300">
            {/* Close Button */}
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>

            <div>
              <h2 className="text-xl font-extrabold text-white">
                {editCourse ? 'Modify Course details' : 'Add New Course'}
              </h2>
              <p className="text-slate-400 text-xs mt-1 font-medium">
                {editCourse ? 'Change details of the published course PDF.' : 'Publish a new course PDF to the directory.'}
              </p>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Course ID (e.g. GS1) */}
              <div>
                <label htmlFor="modal-course-id" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Course ID (matches user Interested Course)</label>
                <input
                  id="modal-course-id"
                  type="text"
                  placeholder="e.g., GS1, GS2, Essay"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full px-4.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-accent-500 transition-all font-semibold"
                  required
                />
              </div>

              {/* Course Name */}
              <div>
                <label htmlFor="modal-course-name" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Course Name</label>
                <input
                  id="modal-course-name"
                  type="text"
                  placeholder="e.g., GS-1 History Complete Study Guide"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-accent-500 transition-all font-semibold"
                  required
                />
              </div>

              {/* Subject Dropdown */}
              <div>
                <label htmlFor="modal-course-subject" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Subject Category</label>
                <select
                  id="modal-course-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-accent-500 transition-all font-semibold"
                  required
                >
                  <option value="">Select subject...</option>
                  {availableSubjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </div>

              {/* Pricing Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Original Price (INR) */}
                <div>
                  <label htmlFor="modal-course-price" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Original Price (₹)</label>
                  <input
                    id="modal-course-price"
                    type="number"
                    min="0"
                    placeholder="e.g., 499"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-4.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-accent-500 transition-all font-semibold"
                    required
                  />
                </div>

                {/* Discounted Price (INR) */}
                <div>
                  <label htmlFor="modal-course-discounted-price" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Discounted Price (₹)</label>
                  <input
                    id="modal-course-discounted-price"
                    type="number"
                    min="0"
                    placeholder="e.g., 399"
                    value={discountedPrice}
                    onChange={(e) => setDiscountedPrice(e.target.value)}
                    className="w-full px-4.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-accent-500 transition-all font-semibold"
                    required
                  />
                </div>
              </div>

              {/* Active Discount Checkbox */}
              <div className="flex items-center gap-2 bg-slate-950/40 border border-slate-800/80 rounded-xl p-3">
                <input
                  id="modal-course-use-discount"
                  type="checkbox"
                  checked={useDiscount}
                  onChange={(e) => setUseDiscount(e.target.checked)}
                  className="w-4 h-4 text-accent-650 bg-slate-950 border-slate-800 rounded focus:ring-accent-500"
                />
                <label htmlFor="modal-course-use-discount" className="text-xs font-bold text-slate-350 cursor-pointer">
                  Activate discount price by default for this course
                </label>
              </div>

              {/* Discount Limit Tag Checkbox */}
              <div className="flex items-center gap-2 bg-slate-950/40 border border-slate-800/80 rounded-xl p-3">
                <input
                  id="modal-course-discount-limit-tag"
                  type="checkbox"
                  checked={discountLimitTag}
                  onChange={(e) => setDiscountLimitTag(e.target.checked)}
                  className="w-4 h-4 text-accent-650 bg-slate-950 border-slate-800 rounded focus:ring-accent-500"
                />
                <label htmlFor="modal-course-discount-limit-tag" className="text-xs font-bold text-slate-350 cursor-pointer">
                  Show "Discount valid only for first 50 students!" tag on the card
                </label>
              </div>

              {/* Dynamic Course PDF Files Configuration */}
              <div className="space-y-4 pt-2 border-t border-slate-850">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Course PDF Files ({courseFiles.length})
                  </label>
                </div>
                
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {courseFiles.map((f, idx) => (
                    <div key={f.id} className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5 space-y-3.5 relative">
                      {/* Remove File Button */}
                      {courseFiles.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFileSlot(f.id)}
                          className="absolute top-3 right-3 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                          title="Remove PDF file slot"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      )}

                      {/* Display Name */}
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          PDF Display Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Part-1 Ancient History"
                          value={f.name}
                          onChange={(e) => handleUpdateFileSlot(f.id, { name: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-accent-500 transition-all font-semibold"
                          required
                        />
                      </div>

                      {/* PDF File picker or existing status info */}
                      {f.type === 'existing' ? (
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            PDF Source Status
                          </label>
                          <div className="flex items-center justify-between text-xs text-slate-350 bg-slate-900 border border-slate-800/80 rounded-lg px-3 py-2 font-medium">
                            <span className="truncate max-w-[200px]" title={f.url.replace('r2://', '')}>
                              {f.url.replace('r2://', '')}
                            </span>
                            <span className="text-[10px] font-bold bg-accent-950/80 border border-accent-900/60 text-accent-400 px-2 py-0.5 rounded shrink-0">
                              {f.pageCount} pages
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Choose PDF File
                          </label>
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => {
                              const fileObj = e.target.files[0];
                              if (fileObj) {
                                handleUpdateFileSlot(f.id, {
                                  file: fileObj,
                                  name: f.name || fileObj.name.replace(/\.[^/.]+$/, "")
                                });
                              }
                            }}
                            className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-slate-900 file:text-accent-400 hover:file:bg-slate-800 cursor-pointer"
                            required={!editCourse}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddFileSlot}
                  className="w-full py-2 bg-slate-950/60 hover:bg-slate-900 border border-dashed border-slate-800 hover:border-slate-700 text-accent-400 hover:text-accent-300 rounded-xl text-xs font-bold transition duration-200 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add Another PDF File
                </button>
              </div>

              {/* Progress Bar */}
              {showProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>Uploading file...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                    <div 
                      className="bg-accent-500 h-2.5 rounded-full transition-all duration-300 ease-out" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Notification Boxes */}
              {formError && (
                <div className="p-3 bg-rose-950/30 border border-rose-900/50 text-rose-400 text-[11px] font-semibold rounded-xl flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 text-rose-500"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span>{formError}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-950/30 border border-emerald-900/50 text-emerald-400 text-[11px] font-semibold rounded-xl flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <Button variant="primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Course'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Container */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-sm pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-xl shadow-2xl border text-xs font-bold pointer-events-auto flex items-center gap-2.5 animate-bounce ${
              toast.type === 'error'
                ? 'bg-rose-950/95 border-rose-900/50 text-rose-200'
                : 'bg-accent-950/95 border-accent-900/50 text-accent-200'
            }`}
          >
            {toast.type === 'error' ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-rose-400"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-accent-400"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
