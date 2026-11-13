import { useState, useCallback, useEffect, useRef } from "react";
import { Toaster } from "sonner";
import { cn } from "../shared/utils/cn";
import { Sidebar } from "./layout/Sidebar";
import { TopNav } from "./layout/TopNav";
import { connectNotificationHub, disconnectNotificationHub, useNotificationStore } from "@/features/notifications";
import { SettingsPage, useEmployeeSettingsQuery, useEmployeeSettingsMutations } from "@/features/settings";

import { HomePage } from "@/features/home";
import { EmployeesPage } from "@/features/employees";
import { AttendancePage } from "@/features/attendance";
import { LeavePage, EmployeeLeaveBalancePage } from "@/features/leave";
import { DocumentsPage, UploadDocumentsPage } from "@/features/documents";
import { HrSupportPage } from "@/features/hr-support";
import { LearningPage } from "@/features/learning";
import { ConferencePage } from "@/features/conference";
import { DoctorPage } from "@/features/doctor";
import { HolidaysPage } from "@/features/holidays";
import { PoliciesPage } from "@/features/policies";
import {
  AccessManagementPage, ShiftChangeUploadPage, ConsolidatedAttendancePage, ApproverMappingPage,
  UploadClPlPage, CalendarPatternUploadPage, SapWagesPage, LogsPage,
} from "@/features/admin";
import { VisitorPage, VisitorRequestsPage } from "@/features/visitors";
import { useQuery } from "@tanstack/react-query";
import { useAccessStore, hasAccessKey } from "../shared/access/access.store";
import { canOpenModule, firstVisibleModule, buildNavTree, flattenNav } from "./nav";
import { getMyMenu } from "../shared/access/access.service";
import { useAuthStore } from "../shared/auth/auth.store";
import { signOut, LoginPage } from "@/features/auth";
import { Spinner } from "../shared/components/Spinner";
import { Btn } from "../shared/components/Btn";
import { useNavIntent } from "../shared/navigation/navIntent";
import { peekDeepLink, clearDeepLink } from "../shared/navigation/deepLink";
import { ChatWidget } from "@/features/chatbot";

export default function App() {
  const [moduleState, setModule] = useState("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const menuItems = useAccessStore(s => s.items);
  // Where the user is: the page they navigated to if the server's menu allows it, otherwise the first page they can open (the start page).
  const module = canOpenModule(moduleState, menuItems) ? moduleState : (firstVisibleModule(menuItems) ?? "home");
  const menuLoaded = useAccessStore(s => s.loaded);
  const setMenu = useAccessStore(s => s.setMenu);
  const resetMenu = useAccessStore(s => s.reset);

  // What the user may use comes from the server (database-driven: dbo.spv1_ManageAccessControl, GET_USER_NAVIGATION) and is asked for again whenever the window
  // regains focus, so a role change shows up without signing out. It is fail-closed at start-up: if the first call fails nothing is shown (an error screen with
  // Retry) -- the user is never assumed to have access. A later refresh that fails keeps the menu already loaded.
  // Only once someone is signed in (a session token exists); keyed by employee number so a different user never sees another's menu.
  const authToken = useAuthStore(s => s.token);
  const authEmpNo = useAuthStore(s => s.empNo);
  const menuQuery = useQuery({ queryKey: ["myMenu", authEmpNo], queryFn: getMyMenu, enabled: !!authToken, retry: false });
  useEffect(() => {
    if (!authToken) resetMenu();
    else if (menuQuery.isSuccess) setMenu(menuQuery.data.items, menuQuery.data.roles);
  }, [authToken, menuQuery.isSuccess, menuQuery.data, setMenu, resetMenu]);
  // Unread notification counts (kept on the server) are loaded once the menu is known; cleared on sign-out.
  const loadNotificationCounts = useNotificationStore(s => s.loadCounts);
  const resetNotificationCounts = useNotificationStore(s => s.reset);
  useEffect(() => {
    if (!authToken) resetNotificationCounts();
    else if (menuLoaded && menuItems.some(i => i.endpoint === "settings")) {
      loadNotificationCounts();
      const timer = setInterval(loadNotificationCounts, 60000); // catches work that arrived or was finished while no push reached this browser
      return () => clearInterval(timer);
    }
  }, [authToken, menuLoaded, menuItems, loadNotificationCounts, resetNotificationCounts]);
  // Whatever page is open -- including the full-screen Conference page, which has no sidebar -- has its notifications marked read, now and as
  // new ones arrive while it is open.
  const setActiveModule = useNotificationStore(s => s.setActiveModule);
  useEffect(() => { if (menuLoaded) setActiveModule(module); }, [menuLoaded, module, setActiveModule]);
  // The chat assistant is for everyone who was given the "chatbot" item -- not for the outsider visitor login (dbo.EmployeeAccess takes it away).
  const canChat = hasAccessKey(menuItems, "chatbot");

  useEffect(() => {
    const saved = localStorage.getItem("ams-dark");
    if (saved === "true") setDarkMode(true);
  }, []);

  // Real-time (SignalR) notification bell — one connection for the whole app session, not
  // per-page. Reconnects automatically on a "View As" role change (see notificationHub.js).
  useEffect(() => {
    connectNotificationHub();
    return () => disconnectNotificationHub();
  }, []);

  // Dark Mode is now a real per-employee preference (dbo.EmployeeSettings), not just
  // localStorage (which is per-browser only). localStorage above still drives the very first
  // paint (instant, no request round trip), but once the real per-employee value arrives it wins
  // — overriding a stale/wrong local guess (e.g. a different employee's preference on a shared
  // machine, or a first-ever visit with no localStorage entry). Only syncs ONCE, right after the
  // query's first real fetch completes (isFetching flips false) — never again after that, so the
  // user's own later toggle (which updates local state immediately, see toggleDark) is never
  // clobbered by a background refetch.
  const { data: employeeSettings, isFetching: settingsFetching } = useEmployeeSettingsQuery();
  const { update: updateEmployeeSettings } = useEmployeeSettingsMutations();
  const didSyncServerDarkMode = useRef(false);
  useEffect(() => {
    if (didSyncServerDarkMode.current || settingsFetching) return;
    didSyncServerDarkMode.current = true;
    setDarkMode(employeeSettings.darkMode);
    localStorage.setItem("ams-dark", String(employeeSettings.darkMode));
  }, [settingsFetching, employeeSettings]);

  // Mirror `.dark` onto <html> too: SearchableSelect/DatePickerCalendar portal their popups
  // straight into <body>, outside the app root div below, so without this they'd render with
  // light-mode tokens even in dark mode.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  const toggleDark = useCallback(() => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("ams-dark", String(next));
    updateEmployeeSettings.mutate({ ...employeeSettings, darkMode: next });
  }, [darkMode, employeeSettings, updateEmployeeSettings]);

  // An e-mail link ("open this request"): once signed in and the menu is known, go to that page with the request selected -- only if the server's menu
  // lets this person open it; otherwise it is dropped and they land on their normal start page.
  const setNavIntent = useNavIntent(s => s.setIntent);
  useEffect(() => {
    if (!authToken || !menuLoaded) return;
    const link = peekDeepLink();
    if (!link) return;
    clearDeepLink();
    if (canOpenModule(link.module, menuItems)) {
      setNavIntent({ fromEmail: true, module: link.module, scope: link.scope ?? undefined, requestNo: link.requestNo ?? undefined, requestId: link.requestId ?? undefined, ticketNo: link.ticketNo ?? undefined });
      setModule(link.module);
    }
  }, [authToken, menuLoaded, menuItems, setNavIntent]);

  const handleNav = useCallback((m) => {
    setModule(m);
    setMobileSidebarOpen(false);
  }, []);

  // Not signed in: the sign-in page (Microsoft Teams SSO signs the user in automatically inside Teams).
  if (!authToken) {
    return (
      <div className={cn(darkMode && "dark")}>
        <LoginPage/>
        <Toaster duration={10000} position="top-right" theme={darkMode ? "dark" : "light"} richColors closeButton/>
      </div>
    );
  }

  // Nothing is drawn until the roles are known, so no one ever sees a screen built for the wrong role.
  if (menuQuery.isError && !menuLoaded) {
    return (
      <div className={cn("h-screen w-screen flex flex-col items-center justify-center gap-3 bg-background text-foreground", darkMode && "dark")}>
        <p className="text-sm text-muted-foreground">We could not load your access. Please try again.</p>
        <div className="flex gap-2">
          <Btn variant="primary" size="sm" onClick={() => menuQuery.refetch()}>Retry</Btn>
          <Btn variant="secondary" size="sm" onClick={() => signOut()}>Sign out</Btn>
        </div>
      </div>
    );
  }
  if (!menuLoaded) {
    return <div className="h-screen w-screen flex items-center justify-center bg-background text-foreground"><Spinner message="Loading…"/></div>;
  }

  // A user whose only menu entry is the visitor form (an outsider) sees ONLY that form: no sidebar, top bar or chat.
  const menuModules = flattenNav(buildNavTree(menuItems));
  if (menuModules.length === 1 && menuModules[0].id === "visitor") {
    return (
      <div className={cn("min-h-screen w-screen overflow-auto bg-background text-foreground", darkMode && "dark")}>
        <div className="p-4 sm:p-6"><VisitorPage/></div>
        <Toaster duration={10000} position="top-right" theme={darkMode ? "dark" : "light"} richColors closeButton
          toastOptions={{ style: { fontFamily: "var(--font-sans)", fontSize: 14, borderRadius: "var(--borderRadiusMedium)", boxShadow: "var(--shadow16)", border: "1px solid var(--colorNeutralStroke2)", background: "var(--card)", color: "var(--foreground)" } }}/>
      </div>
    );
  }

  // Conference Room Booking renders full-screen — no Sidebar/TopNav chrome — per
  // explicit request, since its own calendar/table views need the full viewport. A small
  // floating close button is the only way back, since there's no nav to click otherwise.
  if (module === "conference") {
    return (
      <div className={cn("h-screen w-screen overflow-hidden bg-background text-foreground", darkMode && "dark")}>
        <div className="h-full w-full overflow-auto px-2 py-3 sm:px-2 sm:py-4">
          <ConferencePage onHome={() => setModule("home")}/>
        </div>
        {canChat && <ChatWidget onNavigate={setModule} accent="#5B5FC7"/>}
        <Toaster duration={10000}
          position="top-right"
          theme={darkMode ? "dark" : "light"}
          richColors
          closeButton
          toastOptions={{ style: { fontFamily: "var(--font-sans)", fontSize: 14, borderRadius: "var(--borderRadiusMedium)", boxShadow: "var(--shadow16)", border: "1px solid var(--colorNeutralStroke2)", background: "var(--card)", color: "var(--foreground)" } }}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex h-screen overflow-hidden bg-background text-foreground", darkMode && "dark")}>
      {mobileSidebarOpen && (
        <div className="fixed inset-0 bg-[color:var(--colorBackgroundOverlay)] z-40 md:hidden" onClick={() => setMobileSidebarOpen(false)}/>
      )}

      <div className={cn(
        "fixed top-0 bottom-0 left-0 z-50 h-full transition-transform duration-300 md:relative md:z-auto md:!translate-x-0",
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Sidebar
          active={module}
          onNav={handleNav}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(v=>!v)}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopNav
          module={module}
          darkMode={darkMode}
          onDarkMode={toggleDark}
          onMenuToggle={() => setMobileSidebarOpen(v=>!v)}
          showMenu={mobileSidebarOpen}
          onNavigate={setModule}
          canChat={canChat}
        />
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          {module === "home" && <HomePage onNavigate={setModule}/>}
          {module === "employees" && <EmployeesPage/>}
          {module === "attendance" && <AttendancePage/>}
          {module === "leave" && <LeavePage/>}
          {module === "leaveBalanceHistory" && <EmployeeLeaveBalancePage onNavigate={setModule}/>}
          {module === "employeeDocuments" && <DocumentsPage/>}
          {module === "uploadDocuments" && <UploadDocumentsPage/>}
          {module === "servicedesk" && <HrSupportPage/>}
          {module === "learning" && <LearningPage/>}
          {module === "doctor" && <DoctorPage/>}
          {module === "holidays" && <HolidaysPage/>}
          {module === "visitor" && <VisitorPage onNavigate={setModule}/>}
          {module === "visitorRequests" && <VisitorRequestsPage onNavigate={setModule}/>}
          {module === "policies" && <PoliciesPage/>}
          {module === "accessManagement" && <AccessManagementPage/>}
          {module === "shiftChangeUpload" && <ShiftChangeUploadPage/>}
          {module === "consolidatedAttendance" && <ConsolidatedAttendancePage/>}
          {module === "approverMapping" && <ApproverMappingPage/>}
          {module === "uploadClPl" && <UploadClPlPage/>}
          {module === "calendarPatternUpload" && <CalendarPatternUploadPage/>}
          {module === "sapWages" && <SapWagesPage/>}
          {module === "logs" && <LogsPage/>}
          {module === "settings" && <SettingsPage darkMode={darkMode} onDarkMode={toggleDark}/>}
        </main>
      </div>

      {canChat && <ChatWidget onNavigate={setModule}/>}

      <Toaster duration={10000}
        position="top-right"
        theme={darkMode ? "dark" : "light"}
        richColors
        closeButton
        toastOptions={{ style: { fontFamily: "var(--font-sans)", fontSize: 14, borderRadius: "var(--borderRadiusMedium)", boxShadow: "var(--shadow16)", border: "1px solid var(--colorNeutralStroke2)", background: "var(--card)", color: "var(--foreground)" } }}
      />
    </div>
  );
}
