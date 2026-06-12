import { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

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

export default function BuyCourses({ onRedirectToLogin }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [checkoutStatus, setCheckoutStatus] = useState({ success: '', error: '' });
  const [checkingOut, setCheckingOut] = useState(false);

  // Fetch available courses from backend on mount
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await fetch('/api/courses/list');
        if (res.ok) {
          const data = await res.json();
          setCourses(data.courses || []);
        }
      } catch (err) {
        console.error('Error fetching courses:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  // Add a course to the shopping cart
  const addToCart = (course) => {
    setCheckoutStatus({ success: '', error: '' });
    if (cart.some((item) => item._id === course._id)) {
      setCheckoutStatus({ success: '', error: 'Item is already in your cart!' });
      return;
    }
    setCart([...cart, course]);
  };

  // Remove a course from the shopping cart
  const removeFromCart = (courseId) => {
    setCart(cart.filter((item) => item._id !== courseId));
  };

  // Handle Cart Checkout
  const handleCheckout = async () => {
    setCheckoutStatus({ success: '', error: '' });
    const token = localStorage.getItem('token');
    
    // Auth Check
    if (!token) {
      setCheckoutStatus({ 
        success: '', 
        error: 'Please sign in to buy. Purchased courses will be saved securely to your account.' 
      });
      return;
    }

    if (cart.length === 0) {
      setCheckoutStatus({ success: '', error: 'Your cart is empty!' });
      return;
    }

    setCheckingOut(true);
    try {
      const res = await fetch('/api/courses/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ courseIds: cart.map((item) => item._id) })
      });

      let data = {};
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        throw new Error(`Server error: status code ${res.status}`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Checkout failed');
      }

      setCheckoutStatus({ 
        success: 'Checkout successful! Payment Completed. These courses have been linked to your Student Dashboard.', 
        error: '' 
      });
      setCart([]); // Clear cart
    } catch (err) {
      console.error('Checkout error:', err);
      setCheckoutStatus({ success: '', error: err.message || 'Error occurred during checkout.' });
    } finally {
      setCheckingOut(false);
    }
  };

  // Calculate cart total price
  const cartTotal = cart.reduce((sum, item) => sum + ((item.useDiscount ? item.discountedPrice : item.price) || 499), 0);

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-10 md:py-14 flex flex-col lg:flex-row gap-8">
      {/* Course List Workspace (Left Column) */}
      <div className="flex-grow space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Buy Course PDFs</h1>
          <p className="text-slate-500 text-sm mt-1.5 font-medium">Acquire verified study packages and syllabus guides compiled by subject experts.</p>
        </div>

        {loading ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-sm">
            <LoadingSpinner text="Loading courses..." />
          </div>
        ) : courses.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center text-slate-400 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-12 h-12 mx-auto mb-4 text-slate-350"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>
            <p className="text-sm font-semibold text-slate-650">No courses available yet</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Upload syllabus PDF files in the "Upload Course" section to display them here in the marketplace.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {courses.map((course) => {
              const isGS = course.subject.startsWith('GS-');
              const subjectDisplay = isGS ? course.subject : OPTIONAL_NAMES[course.subject]?.replace('Optional: ', '') || course.subject;
              return (
                <div key={course._id} className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:border-slate-300 hover:shadow-md transition-all duration-300">
                  <div className="space-y-3.5">
                    <span className="text-[9px] font-bold text-indigo-650 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 uppercase tracking-wide w-fit block">
                      {subjectDisplay}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 line-clamp-2 leading-relaxed">
                      {course.name || course.fileName}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium truncate mt-1">
                      File: {course.fileName}
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-4 mt-5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Price</span>
                      {course.useDiscount ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-base font-extrabold text-indigo-600">₹{course.discountedPrice}</span>
                          <span className="text-[10px] text-slate-405 line-through">₹{course.price}</span>
                        </div>
                      ) : (
                        <span className="text-base font-extrabold text-slate-900">₹{course.price || 499}</span>
                      )}
                    </div>
                    <button
                      onClick={() => addToCart(course)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
                      Add to Cart
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Shopping Cart Drawer/Sidebar (Right Column - 1/3 Width) */}
      <div className="lg:w-80 flex-shrink-0 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm h-fit space-y-6">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-slate-500"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
            Shopping Cart
          </h2>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Manage selections and complete purchases.</p>
        </div>

        {/* Cart Item Feed */}
        {cart.length === 0 ? (
          <div className="py-8 text-center text-slate-400 italic text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            Cart is empty.
          </div>
        ) : (
          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {cart.map((item) => (
              <div key={item._id} className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="truncate flex-grow min-w-0">
                  <h4 className="font-bold text-slate-900 truncate">{item.name || item.fileName}</h4>
                  <p className="text-[10px] text-slate-400 truncate">File: {item.fileName}</p>
                  <span className="text-[9px] text-indigo-650 font-bold uppercase">{item.subject.replace('OptionalSubject', '')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-800">₹{item.useDiscount ? item.discountedPrice : item.price || 499}</span>
                  <button
                    onClick={() => removeFromCart(item._id)}
                    className="text-slate-400 hover:text-rose-600 transition-all cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cart Total & Status Summary */}
        <div className="border-t border-slate-100 pt-4 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-400">Total Price</span>
            <span className="text-lg font-extrabold text-slate-900">₹{cartTotal}</span>
          </div>

          {/* Checkout Info States */}
          {checkoutStatus.error && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-[10px] font-semibold rounded-xl leading-relaxed flex flex-col gap-2">
              <span>{checkoutStatus.error}</span>
              {checkoutStatus.error.includes("sign in") && (
                <button
                  onClick={onRedirectToLogin}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-750 text-white rounded text-[9px] font-bold transition-all w-fit cursor-pointer"
                >
                  Sign In Now
                </button>
              )}
            </div>
          )}

          {checkoutStatus.success && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-semibold rounded-xl leading-relaxed flex items-start gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0"><circle cx="12" cy="12" r="10"/><polyline points="12 8 8 12 12 16"/><line x1="16" y1="12" x2="8" y2="12"/></svg>
              <span>{checkoutStatus.success}</span>
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || checkingOut}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {checkingOut ? 'Checking out...' : 'Checkout (Mock Payment)'}
          </button>
        </div>
      </div>
    </div>
  );
}
