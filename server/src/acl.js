// The four checks from BACKEND-SPEC §10. The server enforces them on every request.
export const ROLES = ['admin', 'analyst', 'reviewer', 'viewer'];
export const GUEST = { id: 'guest', name: 'Guest', role: 'viewer', guest: true, cases: 'public', tlpRed: false };
const PUBLIC_TLPS = new Set(['', 'clear', 'green']);
export function canSee(u, c) {
  if (!u || !c) return false;
  if (u.guest) return !!c.public && PUBLIC_TLPS.has(c.tlp || '');
  if (u.role === 'admin') return true;
  if ((c.tlp === 'red' || c.tlp === 'amber+strict') && !u.tlpRed) return false;
  return u.cases === 'all' || (Array.isArray(u.cases) && u.cases.includes(c.id));
}
export const canEdit = (u, c) => !!u && (u.role === 'admin' || u.role === 'analyst') && canSee(u, c);
export const canReview = (u, c) => !!u && (u.role === 'admin' || u.role === 'reviewer' || u.role === 'analyst') && canSee(u, c);
export const canCreate = (u) => !!u && (u.role === 'admin' || u.role === 'analyst');
export const isAdmin = (u) => !!u && u.role === 'admin';
// Fields a reviewer may change on a case they can see but not edit.
export const REVIEW_FIELDS = new Set(['review', 'signoff', 'archived', 'desk', 'color', 'tags', 'log']);
