/**
 * Contrôle d'accès par rôle (STRICT). Aucune comparaison `role === 'admin'` ailleurs.
 * On se base sur le rôle ET, si présentes, les permissions renvoyées par l'API.
 *
 * - technicien / admin / manager / super_admin → projets et bons ; le portail
 *   filtre ensuite ce que chacun voit (ex. « mes bons » pour un technicien).
 * - Commandes en cours : pas un onglet. Les boutons suivent les codes
 *   `auth.me.permissions`, et `super_admin` passe toujours (comme le serveur).
 *   Lecture et création : `work_orders.view_all` ou `view_assigned`.
 *   Modifier une commande : `canUpdateCustomerOrder`. Statut et facture :
 *   `work_orders.edit`. Suppression : `work_orders.delete`.
 * - Autre rôle → Accueil + Saisie d'heures uniquement.
 */
import type { AuthUser, CustomerOrder } from '../api/types';

export type Section = 'home' | 'projects' | 'work-orders' | 'customer-orders' | 'timesheet';

/** Rôles « élevés » ayant accès à toutes les sections. */
const ELEVATED_ROLES = ['admin', 'manager', 'super_admin'] as const;

/** Rôles terrain + gestion qui voient projets et bons. */
const FIELD_ROLES = ['technician', ...ELEVATED_ROLES] as const;

/** Permissions explicites qui débloquent une section (si l'API les fournit). */
const SECTION_PERMISSIONS: Record<Exclude<Section, 'customer-orders'>, readonly string[]> = {
  home: [],
  timesheet: [],
  projects: ['projects.read', 'projects.view', 'projects'],
  'work-orders': ['workOrders.read', 'workOrders.view', 'workOrders'],
};

/** list, get et create : l'un ou l'autre. `work_orders.create` ne crée pas. */
const CUSTOMER_ORDER_VIEW = ['work_orders.view_all', 'work_orders.view_assigned'] as const;
/** setStatus, setInvoice, et update de n'importe quelle commande. */
const CUSTOMER_ORDER_EDIT = ['work_orders.edit'] as const;
const CUSTOMER_ORDER_DELETE = ['work_orders.delete'] as const;

export type CustomerOrderAction = 'read' | 'create' | 'setStatus' | 'setInvoice' | 'delete';

export function isElevated(user: Pick<AuthUser, 'role'>): boolean {
  return (ELEVATED_ROLES as readonly string[]).includes(user.role);
}

export function isSuperAdmin(user: Pick<AuthUser, 'role'>): boolean {
  return user.role === 'super_admin';
}

/**
 * Technicien terrain : le rôle de FIELD_ROLES qui n'est pas élevé.
 * Même découpage que le reste de l'app (bons : isElevated vs le terrain).
 */
export function isTechnician(user: Pick<AuthUser, 'role'>): boolean {
  return (FIELD_ROLES as readonly string[]).includes(user.role) && !isElevated(user);
}

function hasCode(user: Pick<AuthUser, 'permissions'>, codes: readonly string[]): boolean {
  const perms = user.permissions ?? [];
  return codes.some((code) => perms.includes(code));
}

/**
 * Lecture, création, changement de statut ou suppression d'une commande.
 * `setStatus` et `setInvoice` exigent `work_orders.edit`.
 * La modification du contenu est `canUpdateCustomerOrder` : elle dépend
 * de la commande (auteur + statut), pas seulement du rôle.
 */
export function canCustomerOrder(
  action: CustomerOrderAction,
  user: Pick<AuthUser, 'role' | 'permissions'> | null | undefined,
): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (action === 'read' || action === 'create') return hasCode(user, CUSTOMER_ORDER_VIEW);
  if (action === 'setStatus' || action === 'setInvoice') return hasCode(user, CUSTOMER_ORDER_EDIT);
  return hasCode(user, CUSTOMER_ORDER_DELETE);
}

/**
 * Même identifiant, que l'un soit le nombre du fil et l'autre la chaîne
 * de session (`String(me.id)`).
 */
function sameUserId(a: string | number, b: string | number): boolean {
  const left = String(a).trim();
  const right = String(b).trim();
  if (!left || !right) return false;
  return left === right;
}

/**
 * update : `work_orders.edit` (ou super_admin) sur n'importe quelle commande.
 * Sans ce droit : seulement si `createdBy === String(auth.me.id)` et que
 * le statut courant est `nouveau`. `envoye`, `a_facturer` et `facture`
 * sont refusés, y compris pour l'auteur.
 */
export function canUpdateCustomerOrder(
  user: Pick<AuthUser, 'id' | 'role' | 'permissions'> | null | undefined,
  order: Pick<CustomerOrder, 'createdBy' | 'status'>,
): boolean {
  if (!user) return false;
  if (isSuperAdmin(user) || hasCode(user, CUSTOMER_ORDER_EDIT)) return true;
  return order.status === 'nouveau' && sameUserId(order.createdBy, user.id);
}

export function canAccess(
  section: Section,
  user: Pick<AuthUser, 'role' | 'permissions'>,
  mode: 'token' | null,
): boolean {
  // Accueil et saisie d'heures : accessibles à tous les utilisateurs connectés.
  if (section === 'home' || section === 'timesheet') return true;

  if (mode !== 'token') return false;

  // Commandes : codes work_orders.*, super_admin inclus dans canCustomerOrder.
  if (section === 'customer-orders') return canCustomerOrder('read', user);

  if ((FIELD_ROLES as readonly string[]).includes(user.role)) return true;

  // Sinon, on autorise si l'API a accordé une permission explicite.
  const perms = user.permissions ?? [];
  return SECTION_PERMISSIONS[section].some((p) => perms.includes(p));
}

/**
 * Sections d'onglet visibles, dans l'ordre d'affichage.
 * Les commandes en cours n'y figurent pas : l'accès se fait depuis l'accueil.
 */
export function visibleSections(
  user: Pick<AuthUser, 'role' | 'permissions'>,
  mode: 'token' | null,
): Section[] {
  const all: Section[] = ['home', 'projects', 'work-orders', 'timesheet'];
  return all.filter((s) => canAccess(s, user, mode));
}
