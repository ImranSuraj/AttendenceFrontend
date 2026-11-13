import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "../../shared/utils/cn";
import { useNavTree, findParentGroupId, canOpenModule, firstVisibleModule } from "../nav";
import { useAccessStore } from "../../shared/access/access.store";
import { isInTeams } from "../../shared/utils/teams";
import { useNotificationStore } from "@/features/notifications";
import { useNavIntent } from "../../shared/navigation/navIntent";

// Decided once per page load -- the app never moves in or out of Teams while running.
const IN_TEAMS = isInTeams();

function NavButton({ item, isActive, collapsed, onClick, indent }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group w-full flex items-center gap-3 h-10 px-4 text-left relative border-0 cursor-pointer text-sm",
        indent && !collapsed && "pl-9",
        // Teams app-bar item: the page being worked on gets the selected-subtle background, a brand indicator bar
        // and semibold text; the others a subtle hover/press background.
        isActive
          ? "bg-[var(--colorBrandBackground2)] text-[var(--colorBrandForeground2)] font-semibold"
          : "bg-transparent font-normal text-[var(--colorNeutralForeground2)] hover:bg-sidebar-accent hover:text-foreground active:bg-[var(--colorSubtleBackgroundPressed)]"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {isActive && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-[var(--colorCompoundBrandBackground)]"/>}
      <Icon size={18} className={cn("shrink-0", isActive && "text-[var(--colorCompoundBrandForeground1)]")}/>
      {!collapsed && (
        <span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1">{item.label}</span>
      )}
      {!collapsed && item.badge && (
        <span className="bg-red-500 text-white text-[10px] font-bold py-0.5 px-1.5 rounded-full min-w-[18px] text-center">
          {item.badge}
        </span>
      )}
      {collapsed && item.badge && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"/>
      )}
      {collapsed && (
        <span className="absolute left-full ml-2 py-1 px-2 bg-[#292929] text-white text-xs rounded-lg shadow-md opacity-0 pointer-events-none whitespace-nowrap z-50 transition-opacity group-hover:opacity-100">
          {item.label}
        </span>
      )}
    </button>
  );
}

export function Sidebar({ active, onNav, collapsed, onToggle }) {
  const items = useAccessStore(s => s.items);
  const visibleNavItems = useNavTree();

  // Unread notifications per page (the page each one concerns): shown as a count on that page's link; a group shows the sum of its pages.
  const counts = useNotificationStore(s => s.counts);
  const setNavIntent = useNavIntent(s => s.setIntent);
  const badgeOf = (item) => (item.children ? item.children.reduce((sum, c) => sum + (counts[c.id]?.unread ?? 0), 0) : (counts[item.id]?.unread ?? 0)) || undefined;

  // Opening a page marks what happened there as read; if something there needs action (the newest unread one), the page opens straight to it.
  const goTo = (id) => {
    const c = counts[id];
    if (c?.unread) setNavIntent({ module: id, scope: c.scope ?? undefined, requestNo: c.requestNo });
    onNav(id);
  };
  const activeGroupId = findParentGroupId(active, visibleNavItems);
  const [openGroups, setOpenGroups] = useState(() => new Set(activeGroupId ? [activeGroupId] : []));

  // Keep the group containing the active module expanded (e.g. after a
  // direct nav via Dashboard quick-actions or TopNav search).
  useEffect(() => {
    if (activeGroupId) setOpenGroups(prev => new Set(prev).add(activeGroupId));
  }, [activeGroupId]);

  // If the active module is not one the user's roles allow (e.g. a Receptionist landing on Home), go to the first one they can open.
  useEffect(() => {
    if (!canOpenModule(active, items)) { const first = firstVisibleModule(items); if (first) onNav(first); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const toggleGroup = (id) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <aside className={cn(
      "flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-[width] duration-300 shrink-0",
      collapsed ? "md:w-16" : "md:w-60", "max-md:w-[min(300px,85vw)]"
    )}>
      {/* Logo + app name. Hidden inside Microsoft Teams, which already shows them in its own app header
          and left rail. */}
      {!IN_TEAMS && (
        <div className="flex items-center gap-3 px-4 border-b border-sidebar-border h-[44px] shrink-0">
          <img src={`${import.meta.env.BASE_URL}employee-connect.png`} alt="Employee Connect" className="shrink-0 w-8 h-8 rounded-md"/>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-[16px] text-foreground leading-tight overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontWeight: 700 }}>Employee Connect</p>
            </div>
          )}
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-2 max-md:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {visibleNavItems.map(item => {
          if (!item.children) {
            return (
              <NavButton key={item.id} item={{ ...item, badge: badgeOf(item) }} isActive={active === item.id} collapsed={collapsed}
                onClick={() => goTo(item.id)} />
            );
          }

          const Icon = item.icon;
          const isOpen = openGroups.has(item.id) || collapsed;
          const groupActive = item.id === activeGroupId;
          return (
            <div key={item.id}>
              <button
                onClick={() => (collapsed ? goTo(item.children[0].id) : toggleGroup(item.id))}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group w-full flex items-center gap-3 h-10 px-4 text-left relative border-0 cursor-pointer text-sm",
                  // A group whose child page is open is highlighted too (fully, when the sidebar is collapsed and
                  // the child itself isn't visible).
                  groupActive ? (collapsed ? "bg-[var(--colorBrandBackground2)] text-[var(--colorBrandForeground2)] font-semibold" : "bg-transparent text-foreground font-semibold")
                              : "bg-transparent font-normal text-[var(--colorNeutralForeground2)] hover:bg-sidebar-accent hover:text-foreground active:bg-[var(--colorSubtleBackgroundPressed)]"
                )}
              >
                <Icon size={18} className={cn("shrink-0", groupActive && "text-[var(--colorCompoundBrandForeground1)]")}/>
                {!collapsed && (
                  <>
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1">{item.label}</span>
                    {badgeOf(item) && !isOpen && (
                      <span className="bg-red-500 text-white text-[10px] font-bold py-0.5 px-1.5 rounded-full min-w-[18px] text-center">{badgeOf(item)}</span>
                    )}
                    <ChevronDown size={14} className={cn("shrink-0 transition-transform", isOpen && "rotate-180")}/>
                  </>
                )}
                {collapsed && (
                  <span className="absolute left-full ml-2 py-1 px-2 bg-[#292929] text-white text-xs rounded-lg shadow-md opacity-0 pointer-events-none whitespace-nowrap z-50 transition-opacity group-hover:opacity-100">
                    {item.label}
                  </span>
                )}
              </button>
              {!collapsed && isOpen && item.children
                .map(child => (
                  <NavButton key={child.id} item={{ ...child, badge: badgeOf(child) }} isActive={active === child.id} collapsed={collapsed}
                    onClick={() => goTo(child.id)} indent />
                ))}
            </div>
          );
        })}
      </nav>

      <div className="hidden md:block border-t border-sidebar-border p-2">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-[var(--colorNeutralForeground2)] rounded-md bg-transparent border-0 cursor-pointer hover:text-foreground hover:bg-sidebar-accent active:bg-[var(--colorSubtleBackgroundPressed)]"
        >
          {collapsed ? <ChevronRight size={16}/> : <><ChevronLeft size={16}/><span className="text-xs">Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}
