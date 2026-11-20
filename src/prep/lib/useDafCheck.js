// Where the student's DAF verification stands (from the credits payload). Admins count as verified; a visitor
// who hasn't signed in is 'guest'.
import { usePrep } from './context';

export function useDafCheck() {
  const { credits } = usePrep();
  if (!credits) return { loading: true, status: null, verified: false };
  if (credits.guest) return { loading: false, status: 'guest', verified: false, guest: true };
  if (credits.admin) return { loading: false, status: 'verified', verified: true, admin: true };
  const daf = credits.daf || { status: 'none' };
  return { loading: false, ...daf, verified: daf.status === 'verified' };
}
