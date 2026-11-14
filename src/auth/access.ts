/**
 * Contrôle d'accès par rôle (STRICT). Aucune comparaison `role === 'admin'` ailleurs.
 * On se base sur le rôle ET, si présentes, les permissions renvoyées par l'API.
 *
 * - technicien / admin / manager / super_admin → projets et bons ; le portail
 *   filtre ensuite ce que chacun voit (ex. « mes bons » pour un technicien).
 * - Commandes en cours : pas un onglet. Lecture comme les bons (technicien
 *   compris) ou codes `work_orders.view_all` / `view_assigned`. Création :
 *   technicien, rôles élevés, ou `work_orders.create`. Modifier, changer le
 *   statut et supprimer : rôles élevés seulement (`admin`, `manager`,
 *   `super_admin`). La réponse API ne dit pas encore qui a créé la commande,
 *   donc un technicien ne peut pas modifier « la sienne ».
 * - Autre rôle → Accueil + Saisie d'heures uniquement.
 */
import type { AuthUser } from '../api/types';

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

/** Lecture explicite. La création technicien est un rôle, pas ce code. */
const CUSTOMER_ORDER_READ = ['work_orders.view_all', 'work_orders.view_assigned'] as const;
const CUSTOMER_ORDER_CREATE = ['work_orders.create'] as const;

export type CustomerOrderAction = 'read' | 'create' | 'edit' | 'delete';

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
 * Lecture, création, modification ou suppression d'une commande en cours.
 * `edit` couvre Modifier, Marquer facturé et Remettre à facturer.
 * `delete` couvre Supprimer. Les deux sont réservés aux rôles élevés.
 */
export function canCustomerOrder(
  action: CustomerOrderAction,
  user: Pick<AuthUser, 'role' | 'permissions'> | null | undefined,
): boolean {
  if (!user) return false;
  if (action === 'edit' || action === 'delete') return isElevated(user);
  if (isElevated(user) || isTechnician(user)) return true;
  return action === 'create' ? hasCode(user, CUSTOMER_ORDER_CREATE) : hasCode(user, CUSTOMER_ORDER_READ);
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
