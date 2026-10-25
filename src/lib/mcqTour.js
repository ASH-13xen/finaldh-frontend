const TOUR_KEY = 'mcq_tour_v1';

// localStorage can throw (private mode, blocked storage) - the tour then simply shows again next time.
export const hasSeenTour = () => { try { return localStorage.getItem(TOUR_KEY) === '1'; } catch { return false; } };
export const markTourSeen = () => { try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* ignore */ } };
