import { useState, useRef, useEffect } from "react";
import {
  Menu, X, Home, ChevronRight, Sun, Moon,
  ChevronDown, User, Settings, HelpCircle, LogOut,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "../../shared/utils/cn";
import { Modal } from "../../shared/components/Modal";
import { Btn } from "../../shared/components/Btn";
import { findNavLabel } from "../nav";
import { useAccessStore } from "../../shared/access/access.store";
import { useCurrentUser, getDepartmentOptions } from "@/features/employees";
import { signOut } from "@/features/auth";
import { ChatLauncher } from "@/features/chatbot";

export function TopNav({ module, darkMode, onDarkMode, onMenuToggle, showMenu, onNavigate, canChat }) {
  const CURRENT_USER = useCurrentUser();
  // Department "Code - Description" (same dropdown data, same cache entry as the Employees).
  const { data: departmentOptions = [] } = useQuery({
    queryKey: ["departmentOptions"], queryFn: getDepartmentOptions,
  });
  const departmentDisplay = departmentOptions.find(
    o => String(o.value ?? "").trim().toUpperCase() === String(CURRENT_USER.departmentCode ?? "").trim().toUpperCase()
  )?.label;
  const [showUser, setShowUser] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const accessItems = useAccessStore(s => s.items);
  const label = findNavLabel(module, accessItems);

  const userRef = useRef(null);

  // Click-outside-to-close for the user menu, same idea as SearchableSelect's own
  // document-mousedown listener elsewhere in this app.
  useEffect(() => {
    function onDocClick(e) {
      if (userRef.current && !userRef.current.contains(e.target)) setShowUser(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <header className="h-[46px] md:h-[44px] bg-sidebar border-b border-sidebar-border flex items-center gap-1 md:gap-3 px-2 md:px-4 sticky top-0 z-30 shrink-0">
      <button onClick={onMenuToggle} aria-label="Menu" className="flex items-center justify-center w-[32px] h-[32px] rounded-lg transition-colors bg-transparent border-0 cursor-pointer hover:bg-muted md:hidden">
        {showMenu ? <X size={22}/> : <Menu size={22}/>}
      </button>

      <div className="flex items-center gap-1.5 text-base md:text-sm min-w-0">
        <Home size={14} className="text-muted-foreground shrink-0"/>
        <ChevronRight size={12} className="text-muted-foreground shrink-0"/>
        <span className="text-foreground font-semibold overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        {canChat && <ChatLauncher/>}
        <button onClick={onDarkMode} aria-label="Toggle theme" className="flex items-center justify-center w-[32px] h-[32px] md:w-auto md:h-auto md:p-2 rounded-full transition-colors relative bg-transparent border-0 cursor-pointer hover:bg-muted" title="Toggle theme">
          {darkMode ? <Sun size={16} className="max-md:w-5 max-md:h-5"/> : <Moon size={16} className="max-md:w-5 max-md:h-5"/>}
        </button>

        <div className="relative" ref={userRef}>
          <button onClick={() => { setShowUser(v=>!v); }}
            aria-label="Account" className="flex items-center justify-center gap-2 min-w-[32px] h-[32px] md:h-auto md:py-1 md:pr-3 md:pl-2 rounded-full transition-colors bg-transparent border-0 cursor-pointer md:ml-1 hover:bg-muted">
            <div className="w-[32px] h-[32px] md:w-7 md:h-7 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm md:text-xs font-bold">
              {CURRENT_USER.name.split(" ").map(n=>n[0]).join("").slice(0,2)}
            </div>
            <span className="hidden text-sm font-medium sm:block">{CURRENT_USER.name.split(" ")[0]}</span>
            <ChevronDown size={12} className="hidden text-muted-foreground sm:block"/>
          </button>
          {showUser && (
            <div className="absolute right-0 top-full mt-1 w-max min-w-52 max-w-xs bg-popover border border-border rounded-lg shadow-xl z-50">
              <div className="py-3 px-4 border-b border-border">
                <p className="font-semibold text-sm">{CURRENT_USER.name}</p>
                <p className="text-xs text-muted-foreground">{CURRENT_USER.email}</p>
                <p className="text-xs text-primary mt-0.5">{CURRENT_USER.designation}</p>
              </div>
              {[
                { icon:User, label:"My Profile", onClick:() => { setShowProfile(true); setShowUser(false); } },
                { icon:Settings, label:"Settings", onClick:() => { onNavigate("settings"); setShowUser(false); } },
                { icon:HelpCircle, label:"Help & Support", onClick:() => { onNavigate("servicedesk"); setShowUser(false); } },
                // Sign out only clears the saved session (the token) in this browser and reloads the page, which then shows the sign-in page.
                { icon:LogOut, label:"Sign out", onClick:() => { setShowUser(false); signOut(); } },
              ].map(item => (
                <button key={item.label} onClick={item.onClick} className="w-full !flex !justify-start items-center gap-3 min-h-10 md:min-h-0 py-2 px-4 text-sm transition-colors bg-transparent border-0 cursor-pointer text-left hover:bg-muted">
                  <item.icon size={14} className="text-muted-foreground"/> {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal open={showProfile} onClose={() => setShowProfile(false)} title="My Profile"
        footer={<Btn variant="secondary" size="sm" onClick={() => setShowProfile(false)}>Close</Btn>}>
        <div className="flex items-center gap-4 mb-2">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xl font-bold">
            {CURRENT_USER.name.split(" ").map(n=>n[0]).join("").slice(0,2)}
          </div>
          <div>
            <p className="font-semibold">{CURRENT_USER.name}</p>
            <p className="text-sm text-muted-foreground">{CURRENT_USER.designation}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 text-sm">
          {[
            { label:"Employee Code", value:CURRENT_USER.empCode },
            { label:"Email", value:CURRENT_USER.email },
            { label:"Mobile", value:CURRENT_USER.mobile },
            { label:"Department", value:departmentDisplay ?? CURRENT_USER.departmentCode ?? CURRENT_USER.department },
            { label:"Manager", value:CURRENT_USER.manager },
            { label:"Location", value:CURRENT_USER.locationDisplay ?? CURRENT_USER.location },
            { label:"Plant", value:CURRENT_USER.plantDisplay ?? CURRENT_USER.plant },
            { label:"Grade", value:CURRENT_USER.gradeDisplay ?? CURRENT_USER.grade },
            { label:"Join Date", value:CURRENT_USER.joinDate },
            { label:"Status", value:CURRENT_USER.status },
          ].map(f => (
            <div key={f.label} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{f.label}</span>
              <span className="font-medium text-foreground text-right">{f.value}</span>
            </div>
          ))}
        </div>
      </Modal>
    </header>
  );
}
