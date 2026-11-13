import { useMemo } from "react";
import {
  LayoutDashboard, Users, Clock, Calendar, FileText,
  Headphones, Settings, LayoutGrid, ScrollText,
  GraduationCap, DoorOpen, CalendarDays, Stethoscope, UploadCloud, UserPlus, ClipboardList, ShieldCheck, CalendarClock, CalendarRange, UsersRound, FileUp, Banknote,
} from "lucide-react";
import { useAccessStore, hasAccessKey } from "../shared/access/access.store";

// WHICH items exist, their labels, order, grouping and who sees them all come from the server (dbo.NavItems / dbo.RoleNavItems, via
// POST /api/access/menu). The only thing kept here is how an item LOOKS: an icon per module key (and per group label).
const ICONS = {
  home: LayoutDashboard, attendance: Clock, leave: Calendar, employeeDocuments: FileText, uploadDocuments: UploadCloud,
  employees: Users, servicedesk: Headphones, learning: GraduationCap, conference: DoorOpen, doctor: Stethoscope,
  visitor: UserPlus, visitorRequests: ClipboardList, policies: ScrollText, holidays: CalendarDays, settings: Settings,
  leaveBalanceHistory: Calendar, accessManagement: ShieldCheck,
  shiftChangeUpload: CalendarClock, consolidatedAttendance: ClipboardList, approverMapping: UsersRound, uploadClPl: FileUp, calendarPatternUpload: CalendarRange, sapWages: Banknote, logs: ScrollText,
};
const GROUP_ICONS = { Documents: FileText, Services: LayoutGrid, Admin: ShieldCheck };

// The menu order is the item's Id order (dbo.NavItems has no sort column).
const bySort = (a, b) => a.id - b.id;

// The order the top-level links are SHOWN in (a UI choice, kept here -- not the database Id order). A link is identified by its module key, or by
// its label for a group; anything not listed goes after these, in Id order.
const MENU_ORDER = ["home", "attendance", "leave", "documents", "employees", "conference", "visitorRequests", "servicedesk",
  "services", "visitor", "admin", "policies", "holidays", "settings"];
const menuRank = (i) => {
  const k = i.endpoint ?? i.navItem.toLowerCase();
  const at = MENU_ORDER.indexOf(k);
  return at === -1 ? MENU_ORDER.length : at;
};
const byMenuOrder = (a, b) => menuRank(a) - menuRank(b) || a.id - b.id;

// The sidebar tree: top-level menu items; a parent group (no module key) holds its children and is dropped when it has none.
export function buildNavTree(items) {
  const menu = items.filter(i => i.showInMenu).sort(bySort);
  const leaf = (i) => ({ id: i.endpoint, label: i.navItem, icon: ICONS[i.endpoint] ?? LayoutGrid });
  return menu.filter(i => !i.parentId).sort(byMenuOrder)
    .map(i => i.endpoint
      ? leaf(i)
      : { id: `group-${i.id}`, label: i.navItem, icon: GROUP_ICONS[i.navItem] ?? LayoutGrid, children: menu.filter(c => c.parentId === i.id && c.endpoint).map(leaf) })
    .filter(n => !n.children || n.children.length > 0);
}

export function useNavTree() {
  const items = useAccessStore(s => s.items);
  return useMemo(() => buildNavTree(items), [items]);
}

// Flattened leaf list (groups expanded to their children).
export const flattenNav = (tree) => tree.flatMap(n => n.children ?? [n]);

// Breadcrumb label for a module; a hidden drill-down page (e.g. leaveBalanceHistory) resolves from the permission rows too.
export function findNavLabel(moduleId, items) {
  return items.find(i => i.endpoint === moduleId)?.navItem || "Home";
}

// The id of the group a module sits in (if any).
export function findParentGroupId(moduleId, tree) {
  return tree.find(n => n.children?.some(c => c.id === moduleId))?.id || null;
}

// Whether the user may open this module (a hidden drill-down page counts too), and where they land when they may not / have just signed in.
export function canOpenModule(moduleId, items) {
  return hasAccessKey(items, moduleId) && Object.hasOwn(ICONS, moduleId);
}

export function firstVisibleModule(items) {
  return flattenNav(buildNavTree(items))[0]?.id ?? null;
}