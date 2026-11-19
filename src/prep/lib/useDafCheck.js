// Where the student's DAF verification stands (from the credits payload). Admins count as verified.
import { usePrep } from './context';

export function useDafCheck() {
  const { credits } = usePrep();
  if (!credits) return { loading: true, status: null, verified: false };
  if (credits.admin) return { loading: false, status: 'verified', verified: true, admin: true };
  const daf = credits.daf || { status: 'none' };
  return { loading: false, ...daf, verified: daf.status === 'verified' };
}
