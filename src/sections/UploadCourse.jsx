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
  'Essay': 'Essay',
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
  const [telegramGroupLink, setTelegramGroupLink] = useState('');
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

  // Combo Offers state
  const [comboOffers, setComboOffers] = useState([]);
  const [loadingCombos, setLoadingCombos] = useState(true);
  const [comboError, setComboError] = useState('');
  const [showComboModal, setShowComboModal] = useState(false);
  const [editCombo, setEditCombo] = useState(null);
  const [comboLabel, setComboLabel] = useState('');
  const [comboEligibleIds, setComboEligibleIds] = useState([]);
  const [comboPickCount, setComboPickCount] = useState(1);
  const [comboRequiredIds, setComboRequiredIds] = useState([]);
  const [comboPrice, setComboPrice] = useState('');
  const [savingCombo, setSavingCombo] = useState(false);
  const [comboFormError, setComboFormError] = useState('');

  // Course Samples state
  const [showSampleModal, setShowSampleModal] = useState(false);
  const [sampleCourse, setSampleCourse] = useState(null);
  const [sampleFile, setSampleFile] = useState(null);
  const [savingSample, setSavingSample] = useState(false);
  const [sampleFormError, setSampleFormError] = useState('');
  const [sampleUploadProgress, setSampleUploadProgress] = useState(0);

  // Optional Subjects common description state
  const [optionalDescription, setOptionalDescription] = useState('');
  const [savingOptionalDescription, setSavingOptionalDescription] = useState(false);
  const [loadingOptionalDescription, setLoadingOptionalDescription] = useState(true);

  // GS Core Papers common description state
  const [gsCoreDescription, setGsCoreDescription] = useState('');
  const [savingGsCoreDescription, setSavingGsCoreDescription] = useState(false);
  const [loadingGsCoreDescription, setLoadingGsCoreDescription] = useState(true);

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

  // Fetch all combo offers (admin view, includes inactive)
  const fetchComboOffers = async () => {
    setLoadingCombos(true);
    setComboError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/courses/combo-offers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to retrieve combo offers');
      const data = await res.json();
      setComboOffers(data.comboOffers || []);
    } catch (err) {
      console.error(err);
      setComboError(err.message || 'Failed to load combo offers.');
    } finally {
      setLoadingCombos(false);
    }
  };

  useEffect(() => {
    fetchCourses();
    fetchPendingRequests();
    fetchComboOffers();

    fetch('/api/courses/site-content/optional_subjects_description')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setOptionalDescription(data?.value || ''))
      .catch(() => {})
      .finally(() => setLoadingOptionalDescription(false));

    fetch('/api/courses/site-content/gs_core_description')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setGsCoreDescription(data?.value || ''))
      .catch(() => {})
      .finally(() => setLoadingGsCoreDescription(false));
  }, []);

  const handleSaveOptionalDescription = async () => {
    setSavingOptionalDescription(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/courses/site-content/optional_subjects_description', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ value: optionalDescription })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save description');
      }
      showToast('Optional Subjects description saved!', 'success');
    } catch (err) {
      console.error('Error saving optional subjects description:', err);
      showToast(err.message || 'Error occurred while saving description.', 'error');
    } finally {
      setSavingOptionalDescription(false);
    }
  };

  const handleSaveGsCoreDescription = async () => {
    setSavingGsCoreDescription(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/courses/site-content/gs_core_description', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ value: gsCoreDescription })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save description');
      }
      showToast('GS Core Papers description saved!', 'success');
    } catch (err) {
      console.error('Error saving GS core description:', err);
      showToast(err.message || 'Error occurred while saving description.', 'error');
    } finally {
      setSavingGsCoreDescription(false);
    }
  };

  // Open modal for adding a combo offer
  const handleOpenAddCombo = () => {
    setEditCombo(null);
    setComboLabel('');
    setComboEligibleIds([]);
    setComboPickCount(1);
    setComboRequiredIds([]);
    setComboPrice('');
    setComboFormError('');
    setShowComboModal(true);
  };

  // Open modal for editing a combo offer
  const handleOpenEditCombo = (combo) => {
    setEditCombo(combo);
    setComboLabel(combo.label || '');
    setComboEligibleIds(combo.eligibleCourseIds || []);
    setComboPickCount(combo.pickCount || 1);
    setComboRequiredIds(combo.requiredCourseIds || []);
    setComboPrice(String(combo.price ?? ''));
    setComboFormError('');
    setShowComboModal(true);
  };

  const toggleComboEligible = (courseId) => {
    setComboEligibleIds(prev => {
      const isRemoving = prev.includes(courseId);
      const next = isRemoving ? prev.filter(id => id !== courseId) : [...prev, courseId];
      // Keep pickCount valid as the eligible set shrinks/grows
      setComboPickCount(pc => Math.min(Math.max(pc, 1), Math.max(next.length, 1)));
      return next;
    });
    // A course can't be both eligible and required — adding to eligible clears it from required
    setComboRequiredIds(prev => prev.filter(id => id !== courseId));
  };

  const toggleComboRequired = (courseId) => {
    setComboRequiredIds(prev => prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]);
    // A course can't be both eligible and required — adding to required clears it from eligible
    setComboEligibleIds(prev => prev.filter(id => id !== courseId));
  };

  // Handle Combo Offer Form Submit (Add or Update)
  const handleComboFormSubmit = async (e) => {
    e.preventDefault();
    setComboFormError('');

    if (!comboLabel.trim() || comboEligibleIds.length === 0 || !comboPrice) {
      setComboFormError('Please fill in all required fields.');
      return;
    }

    setSavingCombo(true);
    try {
      const token = localStorage.getItem('token');
      const url = editCombo ? `/api/courses/combo-offers/${editCombo._id}` : '/api/courses/combo-offers';
      const method = editCombo ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          label: comboLabel.trim(),
          eligibleCourseIds: comboEligibleIds,
          pickCount: Number(comboPickCount),
          requiredCourseIds: comboRequiredIds,
          price: Number(comboPrice)
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save combo offer');
      }

      showToast(editCombo ? 'Combo offer updated successfully!' : 'Combo offer created successfully!', 'success');
      await fetchComboOffers();
      setShowComboModal(false);
    } catch (err) {
      console.error(err);
      setComboFormError(err.message || 'Error occurred while saving combo offer.');
    } finally {
      setSavingCombo(false);
    }
  };

  // Handle toggling combo offer active state
  const handleToggleComboActive = async (combo) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/courses/combo-offers/${combo._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ active: !combo.active })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to toggle combo offer');
      }
      showToast('Combo offer status updated!', 'success');
      fetchComboOffers();
    } catch (err) {
      console.error('Error toggling combo offer:', err);
      showToast(err.message || 'Error occurred while toggling combo offer.', 'error');
    }
  };

  // Handle combo offer deletion
  const handleDeleteCombo = async (id) => {
    if (!window.confirm('Are you sure you want to delete this combo offer? This action cannot be undone.')) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/courses/combo-offers/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete combo offer');
      }
      fetchComboOffers();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error occurred while deleting combo offer.', 'error');
    }
  };

  // Open modal to upload/replace a course's sample PDF
  const handleOpenSampleModal = (course) => {
    setSampleCourse(course);
    setSampleFile(null);
    setSampleFormError('');
    setSampleUploadProgress(0);
    setShowSampleModal(true);
  };

  // Handle Sample Upload Form Submit
  const handleSampleFormSubmit = async (e) => {
    e.preventDefault();
    setSampleFormError('');

    if (!sampleFile) {
      setSampleFormError('Please select a PDF file.');
      return;
    }

    setSavingSample(true);
    const formData = new FormData();
    formData.append('sample', sampleFile);

    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL || '';
      await axios({
        method: 'POST',
        url: `${apiBaseUrl}/api/courses/${sampleCourse._id}/sample`,
        data: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            setSampleUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
          }
        }
      });

      showToast('Sample uploaded successfully!', 'success');
      await fetchCourses();
      setShowSampleModal(false);
    } catch (err) {
      console.error(err);
      setSampleFormError(err.response?.data?.error || err.message || 'Error occurred while uploading sample.');
    } finally {
      setSavingSample(false);
    }
  };

  // Handle removing a course's sample PDF
  const handleRemoveSample = async (course) => {
    if (!window.confirm(`Remove the sample PDF for "${course.name}"? This cannot be undone.`)) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/courses/${course._id}/sample`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove sample');
      }
      showToast('Sample removed successfully!', 'success');
      fetchCourses();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error occurred while removing sample.', 'error');
    }
  };

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
    setTelegramGroupLink('');
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
    setTelegramGroupLink(course.telegramGroupLink || '');

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
    formData.append('telegramGroupLink', telegramGroupLink.trim());

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

  // Handle toggling whether a course appears in the student Progress tab
  const handleToggleProgressEnabled = async (course) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/courses/${course._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          progressEnabled: !course.progressEnabled
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to toggle Progress tab visibility');
      }
      showToast('Progress tab visibility updated successfully!', 'success');
      fetchCourses();
    } catch (err) {
      console.error('Error toggling Progress tab visibility:', err);
      showToast(err.message || 'Error occurred while toggling Progress tab visibility.', 'error');
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-10 md:py-14 text-text-primary">
      {/* Admin Mode active banner callout */}
      <div className="bg-status-danger-bg border border-status-danger-text/20 rounded-2xl p-4.5 mb-8 flex items-center justify-between gap-4 text-status-danger-text">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-status-danger-text/10 text-status-danger-text rounded-xl flex items-center justify-center border border-status-danger-text/20">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <div>
            <h2 className="text-xs font-bold text-status-danger-text uppercase tracking-wide">Logged in as Administrator (Admin Mode)</h2>
            <p className="text-[11px] text-status-danger-text/90 font-semibold mt-0.5">You have elevated access controls to publish, modify, and delete courses.</p>
          </div>
        </div>
      </div>

      {/* Course management header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-default pb-6 mb-10">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-semibold text-text-primary tracking-tight">Course Management</h1>
          <p className="text-text-secondary text-sm mt-1.5 font-medium">Create, update, and manage study guides and courses on the platform.</p>
        </div>
        <div>
          <button 
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-brand hover:bg-brand-hover text-text-on-accent rounded-xl text-xs font-bold transition duration-200 cursor-pointer shadow-md hover:shadow-brand/20 font-semibold"
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
        <div className="p-4 bg-status-danger-bg border border-status-danger-text/25 text-status-danger-text text-xs font-semibold rounded-xl text-center">
          {listError}
        </div>
      ) : courses.length === 0 ? (
        <div className="py-16 text-center text-text-tertiary border border-dashed border-border-default bg-sunken rounded-2xl p-8">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-12 h-12 mx-auto mb-3 text-text-secondary"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
          <p className="text-xs font-bold text-text-secondary">No courses uploaded yet.</p>
          <p className="text-[10px] text-text-tertiary mt-1">Click the "Add New Course" button to publish your first study guide.</p>
        </div>
      ) : (
        <div className="bg-surface border border-border-default rounded-2xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-sunken border-b border-border-default text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                  <th className="px-6 py-4">Course ID</th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Price (₹)</th>
                  <th className="px-6 py-4">Use Discount</th>
                  <th className="px-6 py-4">50 Stud Tag</th>
                  <th className="px-6 py-4">Progress Tab</th>
                  <th className="px-6 py-4">PDF Files</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default text-xs text-text-primary">
                {courses.map((course) => {
                  const subDisplayName = availableSubjects.find(s => s.id === course.subject)?.name || course.subject;
                  return (
                    <tr key={course._id} className="hover:bg-sunken/45 transition-colors">
                       <td className="px-6 py-4 font-bold text-brand">
                        <span className="bg-accent-soft-bg border border-accent-soft-border rounded-lg px-2 py-1 text-[10px]">
                          {course.courseId}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-text-primary max-w-xs truncate">{course.name}</td>
                      <td className="px-6 py-4 text-text-secondary font-medium">{subDisplayName}</td>
                      <td className="px-6 py-4">
                        {course.useDiscount ? (
                          <div className="flex flex-col">
                            <span className="font-extrabold text-brand">₹{course.discountedPrice}</span>
                            <span className="text-[10px] text-text-tertiary line-through">₹{course.price}</span>
                          </div>
                        ) : (
                          <span className="font-extrabold text-text-primary">₹{course.price}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => handleToggleDiscount(course)}
                          className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${course.useDiscount ? 'bg-brand' : 'bg-border-default'}`}
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
                          className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${course.discountLimitTag ? 'bg-brand' : 'bg-border-default'}`}
                          role="switch"
                          aria-checked={course.discountLimitTag}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${course.discountLimitTag ? 'translate-x-5' : 'translate-x-0'}`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => handleToggleProgressEnabled(course)}
                          title="When on, this course is visible in every user's Progress tab (locked until they purchase it)."
                          className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${course.progressEnabled ? 'bg-brand' : 'bg-border-default'}`}
                          role="switch"
                          aria-checked={course.progressEnabled}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${course.progressEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 text-text-secondary font-medium max-w-xs">
                        <div className="flex flex-col gap-1.5">
                          {(course.fileNames && course.fileNames.length > 0 ? course.fileNames : [course.fileName]).map((fname, idx) => (
                            <a 
                              key={idx}
                              href={`${import.meta.env.VITE_API_URL || ''}/api/courses/raw/${course._id}?token=${localStorage.getItem('token')}&index=${idx}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="hover:text-brand hover:underline flex items-center gap-1 truncate"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-text-secondary"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                              {fname}
                            </a>
                          ))}
                        </div>   </td>
                      <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEdit(course)}
                          className="px-2.5 py-1.5 bg-surface hover:bg-sunken text-text-secondary hover:text-text-primary rounded-lg font-bold transition cursor-pointer border border-border-default font-semibold"
                        >
                          Modify
                        </button>
                        <button
                          onClick={() => handleDeleteCourse(course._id)}
                          className="px-2.5 py-1.5 bg-status-danger-bg hover:bg-status-danger-bg/85 text-status-danger-text rounded-lg font-bold transition cursor-pointer border border-status-danger-text/20 font-semibold"
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

      {/* Combo Offers Section */}
      <div className="mt-14 pt-10 border-t border-border-default">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-display font-semibold text-text-primary tracking-tight">Combo Offers</h2>
            <p className="text-text-secondary text-xs mt-1 font-medium">Sell discounted multi-course bundles (e.g. "Any 2 GS Papers") on top of the courses above.</p>
          </div>
          <button
            onClick={handleOpenAddCombo}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-brand hover:bg-brand-hover text-text-on-accent rounded-xl text-xs font-bold transition duration-200 cursor-pointer shadow-md hover:shadow-brand/20 shrink-0 font-semibold"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Combo Offer
          </button>
        </div>

        {loadingCombos ? (
          <div className="py-10 text-center">
            <LoadingSpinner text="Loading combo offers..." />
          </div>
        ) : comboError ? (
          <div className="p-4 bg-status-danger-bg border border-status-danger-text/25 text-status-danger-text text-xs font-semibold rounded-xl text-center">
            {comboError}
          </div>
        ) : comboOffers.length === 0 ? (
          <div className="py-10 text-center text-text-tertiary border border-dashed border-border-default bg-sunken rounded-2xl p-6">
            <p className="text-xs font-bold text-text-secondary">No combo offers yet.</p>
            <p className="text-[10px] text-text-tertiary mt-1">Click "Add Combo Offer" to create your first bundle.</p>
          </div>
        ) : (
          <div className="bg-surface border border-border-default rounded-2xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-sunken border-b border-border-default text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                    <th className="px-6 py-4">Label</th>
                    <th className="px-6 py-4">Eligible Courses</th>
                    <th className="px-6 py-4">Required</th>
                    <th className="px-6 py-4">Price (₹)</th>
                    <th className="px-6 py-4">Active</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default text-xs text-text-primary">
                  {comboOffers.map((combo) => (
                    <tr key={combo._id} className="hover:bg-sunken/45 transition-colors">
                      <td className="px-6 py-4 font-semibold text-text-primary max-w-xs">{combo.label}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {(combo.eligibleCourses || []).map((c) => (
                            <span key={c.courseId} className="bg-accent-soft-bg border border-accent-soft-border rounded-lg px-2 py-1 text-[10px] font-bold text-brand">{c.courseId}</span>
                          ))}
                        </div>
                        <span className="text-[10px] text-text-tertiary font-bold mt-1 block">pick {combo.pickCount}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {(combo.requiredCourses || []).length === 0 ? (
                            <span className="text-[10px] text-text-tertiary font-medium">—</span>
                          ) : combo.requiredCourses.map((c) => (
                            <span key={c.courseId} className="bg-surface border border-border-default rounded-lg px-2 py-1 text-[10px] font-bold text-text-secondary">{c.courseId}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-extrabold text-text-primary">₹{combo.price}</td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => handleToggleComboActive(combo)}
                          className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${combo.active ? 'bg-brand' : 'bg-border-default'}`}
                          role="switch"
                          aria-checked={combo.active}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${combo.active ? 'translate-x-5' : 'translate-x-0'}`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEditCombo(combo)}
                          className="px-2.5 py-1.5 bg-surface hover:bg-sunken text-text-secondary hover:text-text-primary rounded-lg font-bold transition cursor-pointer border border-border-default font-semibold"
                        >
                          Modify
                        </button>
                        <button
                          onClick={() => handleDeleteCombo(combo._id)}
                          className="px-2.5 py-1.5 bg-status-danger-bg hover:bg-status-danger-bg/85 text-status-danger-text rounded-lg font-bold transition cursor-pointer border border-status-danger-text/20 font-semibold"
                        >
                          Remove
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

      {/* Course Samples Section */}
      <div className="mt-14 pt-10 border-t border-border-default">
        <div className="mb-6">
          <h2 className="text-xl font-display font-semibold text-text-primary tracking-tight">Course Samples</h2>
          <p className="text-text-secondary text-xs mt-1 font-medium">Upload a free preview PDF per course — shown via "See Sample" on the student Purchase Courses page.</p>
        </div>

        {loadingList ? (
          <div className="py-10 text-center">
            <LoadingSpinner text="Loading courses..." />
          </div>
        ) : courses.length === 0 ? (
          <div className="py-10 text-center text-text-tertiary border border-dashed border-border-default bg-sunken rounded-2xl p-6">
            <p className="text-xs font-bold text-text-secondary">No courses yet.</p>
            <p className="text-[10px] text-text-tertiary mt-1">Add a course above before uploading a sample.</p>
          </div>
        ) : (
          <div className="bg-surface border border-border-default rounded-2xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-sunken border-b border-border-default text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                    <th className="px-6 py-4">Course</th>
                    <th className="px-6 py-4">Sample Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default text-xs text-text-primary">
                  {courses.map((course) => (
                    <tr key={course._id} className="hover:bg-sunken/45 transition-colors">
                      <td className="px-6 py-4 font-semibold text-text-primary max-w-xs truncate">{course.name}</td>
                      <td className="px-6 py-4">
                        {course.sampleFileUrl ? (
                          <span className="bg-status-success-bg border border-status-success-text/25 text-status-success-text rounded-lg px-2 py-1 text-[10px] font-bold">
                            ✅ {course.samplePageCount} page{course.samplePageCount === 1 ? '' : 's'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-text-tertiary font-semibold">— No sample</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenSampleModal(course)}
                          className="px-2.5 py-1.5 bg-surface hover:bg-sunken text-text-secondary hover:text-text-primary rounded-lg font-bold transition cursor-pointer border border-border-default font-semibold"
                        >
                          {course.sampleFileUrl ? 'Replace' : 'Upload Sample'}
                        </button>
                        {course.sampleFileUrl && (
                          <button
                            onClick={() => handleRemoveSample(course)}
                            className="px-2.5 py-1.5 bg-status-danger-bg hover:bg-status-danger-bg/85 text-status-danger-text rounded-lg font-bold transition cursor-pointer border border-status-danger-text/20 font-semibold"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Optional Subjects Description Section */}
      <div className="mt-14 pt-10 border-t border-border-default">
        <div className="mb-6">
          <h2 className="text-xl font-display font-semibold text-text-primary tracking-tight">Optional Subjects Description</h2>
          <p className="text-text-secondary text-xs mt-1 font-medium">
            One shared description shown above the "Optional Subjects" section on the Purchase Courses page (visible to guests and logged-in students). Applies to all optional subject courses, so keep it generic — it won't mention any single subject by name.
          </p>
        </div>

        {loadingOptionalDescription ? (
          <div className="py-10 text-center">
            <LoadingSpinner text="Loading description..." />
          </div>
        ) : (
          <div className="bg-surface border border-border-default rounded-2xl shadow p-6 space-y-4">
            <textarea
              value={optionalDescription}
              onChange={(e) => setOptionalDescription(e.target.value)}
              placeholder="e.g. Every optional subject package includes topic-wise compiled notes, previous year question mapping, and quick revision boxes — structured the same way across all subjects so you can switch optionals without relearning a new format."
              rows={5}
              className="w-full px-4.5 py-3 bg-sunken border border-border-default rounded-xl text-xs text-text-primary focus:outline-none focus:border-brand transition-all font-medium resize-y"
            />
            <div className="flex justify-end">
              <button
                onClick={handleSaveOptionalDescription}
                disabled={savingOptionalDescription}
                className="px-4 py-2.5 bg-brand hover:bg-brand-hover disabled:opacity-50 text-text-on-accent rounded-xl text-xs font-bold transition cursor-pointer shadow-md hover:shadow-brand/20 font-semibold"
              >
                {savingOptionalDescription ? 'Saving...' : 'Save Description'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* GS Core Papers Description Section */}
      <div className="mt-14 pt-10 border-t border-border-default">
        <div className="mb-6">
          <h2 className="text-xl font-display font-semibold text-text-primary tracking-tight">GS Core Papers Description</h2>
          <p className="text-text-secondary text-xs mt-1 font-medium">
            One shared description shown above the "GS Core Papers" section on the Purchase Courses page (visible to guests and logged-in students). Applies to GS-1 through GS-4, Essay, and the Mains Master File, so keep it generic.
          </p>
        </div>

        {loadingGsCoreDescription ? (
          <div className="py-10 text-center">
            <LoadingSpinner text="Loading description..." />
          </div>
        ) : (
          <div className="bg-surface border border-border-default rounded-2xl shadow p-6 space-y-4">
            <textarea
              value={gsCoreDescription}
              onChange={(e) => setGsCoreDescription(e.target.value)}
              placeholder="e.g. Each GS paper is compiled topic-wise with Mains-focused notes, mapped previous year questions, and quick revision boxes — the same structure across GS-1 through GS-4 so you always know where to look."
              rows={5}
              className="w-full px-4.5 py-3 bg-sunken border border-border-default rounded-xl text-xs text-text-primary focus:outline-none focus:border-brand transition-all font-medium resize-y"
            />
            <div className="flex justify-end">
              <button
                onClick={handleSaveGsCoreDescription}
                disabled={savingGsCoreDescription}
                className="px-4 py-2.5 bg-brand hover:bg-brand-hover disabled:opacity-50 text-text-on-accent rounded-xl text-xs font-bold transition cursor-pointer shadow-md hover:shadow-brand/20 font-semibold"
              >
                {savingGsCoreDescription ? 'Saving...' : 'Save Description'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pending Download Requests Section */}
      <div className="mt-14 pt-10 border-t border-border-default">
        <div className="mb-6">
          <h2 className="text-xl font-display font-semibold text-text-primary tracking-tight">Pending Download Requests</h2>
          <p className="text-text-secondary text-xs mt-1 font-medium">Review and approve additional PDF download requests from students.</p>
        </div>

        {loadingRequests ? (
          <div className="py-10 text-center">
            <LoadingSpinner text="Loading requests..." />
          </div>
        ) : requestError ? (
          <div className="p-4 bg-status-danger-bg border border-status-danger-text/25 text-status-danger-text text-xs font-semibold rounded-xl text-center">
            {requestError}
          </div>
        ) : requests.length === 0 ? (
          <div className="py-10 text-center text-text-tertiary border border-dashed border-border-default bg-sunken rounded-2xl p-6">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 mx-auto mb-3 text-text-tertiary"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <p className="text-xs font-bold text-text-secondary">No pending download requests.</p>
            <p className="text-[10px] text-text-tertiary mt-1">All student download requests are processed.</p>
          </div>
        ) : (
          <div className="bg-surface border border-border-default rounded-2xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-sunken border-b border-border-default text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                    <th className="px-6 py-4">Student</th>
                    <th className="px-6 py-4">Course ID</th>
                    <th className="px-6 py-4">Course Name</th>
                    <th className="px-6 py-4">Reason</th>
                    <th className="px-6 py-4">Requested At</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default text-xs text-text-primary">
                  {requests.map((req) => (
                    <tr key={req._id} className="hover:bg-sunken/45 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-text-primary">{req.userName}</div>
                        <div className="text-[10px] text-text-secondary font-medium">{req.userEmail}</div>
                      </td>
                      <td className="px-6 py-4 font-bold text-brand">
                        <span className="bg-accent-soft-bg border border-accent-soft-border rounded-lg px-2 py-1 text-[10px]">
                          {req.courseId}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-text-primary truncate max-w-xs">{req.courseName}</td>
                      <td className="px-6 py-4 font-medium text-text-secondary max-w-xs break-words">{req.reason || '-'}</td>
                      <td className="px-6 py-4 text-text-secondary font-medium">
                        {new Date(req.requestedAt || req.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleApproveRequest(req._id)}
                          disabled={approvingId === req._id}
                          className="px-3 py-1.5 bg-brand hover:bg-brand-hover disabled:bg-surface-raised text-text-on-accent rounded-lg font-bold transition cursor-pointer text-xs font-semibold"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/60 backdrop-blur-sm px-4 py-6">
          <div className="bg-surface border border-border-default rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col relative transform transition-all duration-300 overflow-hidden">
            {/* Header (sticky) */}
            <div className="flex items-start justify-between gap-4 p-6 sm:p-8 pb-5 border-b border-border-default shrink-0">
              <div>
                <h2 className="text-xl font-bold text-text-primary">
                  {editCourse ? 'Modify Course details' : 'Add New Course'}
                </h2>
                <p className="text-text-secondary text-xs mt-1 font-medium">
                  {editCourse ? 'Change details of the published course PDF.' : 'Publish a new course PDF to the directory.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-text-secondary hover:text-text-primary cursor-pointer shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0">
              {/* Scrollable body */}
              <div className="space-y-4 p-6 sm:p-8 overflow-y-auto flex-1 min-h-0">
              {/* Course ID (e.g. GS1) */}
              <div>
                <label htmlFor="modal-course-id" className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Course ID (matches user Interested Course)</label>
                <input
                  id="modal-course-id"
                  type="text"
                  placeholder="e.g., GS1, GS2, Essay"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full px-4.5 py-2.5 bg-sunken border border-border-default rounded-xl text-xs text-text-primary focus:outline-none focus:border-brand transition-all font-semibold"
                  required
                />
              </div>

              {/* Course Name */}
              <div>
                <label htmlFor="modal-course-name" className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Course Name</label>
                <input
                  id="modal-course-name"
                  type="text"
                  placeholder="e.g., GS-1 History Complete Study Guide"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4.5 py-2.5 bg-sunken border border-border-default rounded-xl text-xs text-text-primary focus:outline-none focus:border-brand transition-all font-semibold"
                  required
                />
              </div>

              {/* Subject Dropdown */}
              <div>
                <label htmlFor="modal-course-subject" className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Subject Category</label>
                <select
                  id="modal-course-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4.5 py-2.5 bg-sunken border border-border-default rounded-xl text-xs text-text-primary focus:outline-none focus:border-brand transition-all font-semibold"
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
                  <label htmlFor="modal-course-price" className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Original Price (₹)</label>
                  <input
                    id="modal-course-price"
                    type="number"
                    min="0"
                    placeholder="e.g., 499"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-4.5 py-2.5 bg-sunken border border-border-default rounded-xl text-xs text-text-primary focus:outline-none focus:border-brand transition-all font-semibold"
                    required
                  />
                </div>

                {/* Discounted Price (INR) */}
                <div>
                  <label htmlFor="modal-course-discounted-price" className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Discounted Price (₹)</label>
                  <input
                    id="modal-course-discounted-price"
                    type="number"
                    min="0"
                    placeholder="e.g., 399"
                    value={discountedPrice}
                    onChange={(e) => setDiscountedPrice(e.target.value)}
                    className="w-full px-4.5 py-2.5 bg-sunken border border-border-default rounded-xl text-xs text-text-primary focus:outline-none focus:border-brand transition-all font-semibold"
                    required
                  />
                </div>
              </div>

              {/* Active Discount Checkbox */}
              <div className="flex items-center gap-2 bg-sunken border border-border-default rounded-xl p-3">
                <input
                  id="modal-course-use-discount"
                  type="checkbox"
                  checked={useDiscount}
                  onChange={(e) => setUseDiscount(e.target.checked)}
                  className="w-4 h-4 text-brand bg-surface border-border-default rounded focus:ring-brand accent-brand"
                />
                <label htmlFor="modal-course-use-discount" className="text-xs font-bold text-text-secondary cursor-pointer">
                  Activate discount price by default for this course
                </label>
              </div>

              {/* Discount Limit Tag Checkbox */}
              <div className="flex items-center gap-2 bg-sunken border border-border-default rounded-xl p-3">
                <input
                  id="modal-course-discount-limit-tag"
                  type="checkbox"
                  checked={discountLimitTag}
                  onChange={(e) => setDiscountLimitTag(e.target.checked)}
                  className="w-4 h-4 text-brand bg-surface border-border-default rounded focus:ring-brand accent-brand"
                />
                <label htmlFor="modal-course-discount-limit-tag" className="text-xs font-bold text-text-secondary cursor-pointer">
                  Show "Discount valid only for first 50 students!" tag on the card
                </label>
              </div>

              {/* Telegram Group Link */}
              <div>
                <label htmlFor="modal-course-telegram-link" className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Telegram Group Link (optional)</label>
                <input
                  id="modal-course-telegram-link"
                  type="url"
                  placeholder="e.g., https://t.me/+AbCdEfGhIjKl"
                  value={telegramGroupLink}
                  onChange={(e) => setTelegramGroupLink(e.target.value)}
                  className="w-full px-4.5 py-2.5 bg-sunken border border-border-default rounded-xl text-xs text-text-primary focus:outline-none focus:border-brand transition-all font-semibold"
                />
                <p className="text-[10px] text-text-tertiary mt-1.5 font-medium">Shown as a "Join Telegram Group" button to students once they purchase this course.</p>
              </div>

              {/* Dynamic Course PDF Files Configuration */}
              <div className="space-y-4 pt-2 border-t border-border-default">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                    Course PDF Files ({courseFiles.length})
                  </label>
                </div>
                
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {courseFiles.map((f, idx) => (
                    <div key={f.id} className="bg-sunken border border-border-default rounded-xl p-3.5 space-y-3.5 relative">
                      {/* Remove File Button */}
                      {courseFiles.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFileSlot(f.id)}
                          className="absolute top-3 right-3 text-text-tertiary hover:text-status-danger-text transition cursor-pointer"
                          title="Remove PDF file slot"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      )}

                      {/* Display Name */}
                      <div>
                        <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-wider mb-1">
                          PDF Display Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Part-1 Ancient History"
                          value={f.name}
                          onChange={(e) => handleUpdateFileSlot(f.id, { name: e.target.value })}
                          className="w-full px-3 py-2 bg-surface border border-border-default rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand transition-all font-semibold"
                          required
                        />
                      </div>

                      {/* PDF File picker or existing status info */}
                      {f.type === 'existing' ? (
                        <div>
                          <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-wider mb-1">
                            PDF Source Status
                          </label>
                          <div className="flex items-center justify-between text-xs text-text-secondary bg-surface border border-border-default rounded-lg px-3 py-2 font-medium">
                            <span className="truncate max-w-[200px]" title={f.url.replace('r2://', '')}>
                              {f.url.replace('r2://', '')}
                            </span>
                            <span className="text-[10px] font-bold bg-accent-soft-bg border border-accent-soft-border text-brand px-2 py-0.5 rounded shrink-0">
                              {f.pageCount} pages
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-wider mb-1">
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
                            className="w-full text-xs text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-surface file:text-brand hover:file:bg-sunken border border-border-default rounded-xl p-2 cursor-pointer"
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
                  className="w-full py-2 bg-sunken hover:bg-border-default/40 border border-dashed border-border-default text-brand rounded-xl text-xs font-bold transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 font-semibold"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add Another PDF File
                </button>
              </div>
              </div>

              {/* Footer (sticky): progress, notifications & actions always reachable */}
              <div className="shrink-0 border-t border-border-default p-6 sm:p-8 pt-4 space-y-3">
                {/* Progress Bar */}
                {showProgress && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                      <span>Uploading file...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-sunken rounded-full h-2.5 overflow-hidden border border-border-default">
                      <div
                        className="bg-brand h-2.5 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Notification Boxes */}
                {formError && (
                  <div className="p-3 bg-status-danger-bg border border-status-danger-text/25 text-status-danger-text text-[11px] font-semibold rounded-xl flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 text-status-danger-text"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span>{formError}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-3 bg-status-success-bg border border-status-success-text/25 text-status-success-text text-[11px] font-semibold rounded-xl flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 text-status-success-text"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 bg-surface border border-border-default hover:bg-sunken text-text-secondary rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <Button variant="primary" fullWidth disabled={saving}>
                    {saving ? 'Saving...' : 'Save Course'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Combo Offer Modal Overlay */}
      {showComboModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/60 backdrop-blur-sm px-4">
          <div className="bg-surface border border-border-default rounded-2xl p-8 shadow-2xl w-full max-w-lg space-y-6 relative transform transition-all duration-300 text-text-primary">
            <button
              onClick={() => setShowComboModal(false)}
              className="absolute top-4 right-4 text-text-secondary hover:text-text-primary cursor-pointer border border-border-default bg-surface hover:bg-sunken rounded-full p-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>

            <div>
              <h2 className="text-xl font-bold text-text-primary">
                {editCombo ? 'Modify Combo Offer' : 'Add Combo Offer'}
              </h2>
              <p className="text-text-secondary text-xs mt-1 font-medium">
                Define a discounted bundle students can choose from a set of existing courses.
              </p>
            </div>

            <form onSubmit={handleComboFormSubmit} className="space-y-4">
              {/* Label */}
              <div>
                <label htmlFor="combo-label" className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Label</label>
                <input
                  id="combo-label"
                  type="text"
                  placeholder="e.g., Any 2 GS Papers"
                  value={comboLabel}
                  onChange={(e) => setComboLabel(e.target.value)}
                  className="w-full px-4.5 py-2.5 bg-sunken border border-border-default rounded-xl text-xs text-text-primary focus:outline-none focus:border-brand transition-all font-semibold"
                  required
                />
              </div>

              {/* Eligible Courses */}
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Eligible Courses (student picks from these)</label>
                <div className="flex flex-wrap gap-2 bg-sunken border border-border-default rounded-xl p-3 max-h-40 overflow-y-auto">
                  {courses.map((c) => (
                    <button
                      type="button"
                      key={c._id}
                      onClick={() => toggleComboEligible(c.courseId)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                        comboEligibleIds.includes(c.courseId)
                          ? 'bg-brand border-brand text-text-on-accent'
                          : 'bg-surface border-border-default text-text-secondary hover:border-border-default/80'
                      }`}
                    >
                      {c.courseId}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pick Count */}
              <div>
                <label htmlFor="combo-pick-count" className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                  Pick Count (how many of the eligible courses must the student choose)
                </label>
                <input
                  id="combo-pick-count"
                  type="number"
                  min="1"
                  max={Math.max(comboEligibleIds.length, 1)}
                  value={comboPickCount}
                  onChange={(e) => setComboPickCount(e.target.value)}
                  className="w-full px-4.5 py-2.5 bg-sunken border border-border-default rounded-xl text-xs text-text-primary focus:outline-none focus:border-brand transition-all font-semibold"
                  required
                />
              </div>

              {/* Required Courses */}
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Always-Included Courses (optional, e.g. Essay)</label>
                <div className="flex flex-wrap gap-2 bg-sunken border border-border-default rounded-xl p-3 max-h-40 overflow-y-auto">
                  {courses.filter(c => !comboEligibleIds.includes(c.courseId)).map((c) => (
                    <button
                      type="button"
                      key={c._id}
                      onClick={() => toggleComboRequired(c.courseId)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                        comboRequiredIds.includes(c.courseId)
                          ? 'bg-brand border-brand text-text-on-accent'
                          : 'bg-surface border-border-default text-text-secondary hover:border-border-default/80'
                      }`}
                    >
                      {c.courseId}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price */}
              <div>
                <label htmlFor="combo-price" className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Flat Combo Price (₹)</label>
                <input
                  id="combo-price"
                  type="number"
                  min="0"
                  placeholder="e.g., 949"
                  value={comboPrice}
                  onChange={(e) => setComboPrice(e.target.value)}
                  className="w-full px-4.5 py-2.5 bg-sunken border border-border-default rounded-xl text-xs text-text-primary focus:outline-none focus:border-brand transition-all font-semibold"
                  required
                />
              </div>

              {comboFormError && (
                <div className="p-3 bg-status-danger-bg border border-status-danger-text/25 text-status-danger-text text-[11px] font-semibold rounded-xl flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 text-status-danger-text"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span>{comboFormError}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowComboModal(false)}
                  className="px-4 py-2.5 bg-surface border border-border-default hover:bg-sunken text-text-secondary rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <Button variant="primary" fullWidth disabled={savingCombo}>
                  {savingCombo ? 'Saving...' : 'Save Combo Offer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload/Replace Sample Modal Overlay */}
      {showSampleModal && sampleCourse && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/60 backdrop-blur-sm px-4">
          <div className="bg-surface border border-border-default rounded-2xl p-8 shadow-2xl w-full max-w-lg space-y-6 relative transform transition-all duration-300 text-text-primary">
            <button
              onClick={() => setShowSampleModal(false)}
              className="absolute top-4 right-4 text-text-secondary hover:text-text-primary cursor-pointer border border-border-default bg-surface hover:bg-sunken rounded-full p-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>

            <div>
              <h2 className="text-xl font-bold text-text-primary">
                {sampleCourse.sampleFileUrl ? 'Replace Sample' : 'Upload Sample'}
              </h2>
              <p className="text-text-secondary text-xs mt-1 font-medium">
                For <span className="text-brand font-bold">{sampleCourse.name}</span>
              </p>
            </div>

            <form onSubmit={handleSampleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Sample PDF File</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setSampleFile(e.target.files[0] || null)}
                  className="w-full text-xs text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-surface file:text-brand hover:file:bg-sunken border border-border-default rounded-xl p-2 cursor-pointer"
                  required
                />
              </div>

              {savingSample && (
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                    <span>Uploading...</span>
                    <span>{sampleUploadProgress}%</span>
                  </div>
                  <div className="w-full bg-sunken rounded-full h-2.5 overflow-hidden border border-border-default">
                    <div
                      className="bg-brand h-2.5 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${sampleUploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {sampleFormError && (
                <div className="p-3 bg-status-danger-bg border border-status-danger-text/25 text-status-danger-text text-[11px] font-semibold rounded-xl flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 text-status-danger-text"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span>{sampleFormError}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowSampleModal(false)}
                  className="px-4 py-2.5 bg-surface border border-border-default hover:bg-sunken text-text-secondary rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <Button variant="primary" fullWidth disabled={savingSample}>
                  {savingSample ? 'Uploading...' : 'Save Sample'}
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
                ? 'bg-status-danger-bg/95 border-status-danger-text/30 text-status-danger-text'
                : 'bg-status-success-bg/95 border-status-success-text/30 text-status-success-text'
            }`}
          >
            {toast.type === 'error' ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-status-danger-text"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-status-success-text"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
