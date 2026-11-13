import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/utils/cn";
import { Btn } from "@/shared/components/Btn";
import { useEmployeeSettingsQuery, useEmployeeSettingsMutations } from "../hooks/useEmployeeSettingsQuery";

export default function SettingsPage({ darkMode, onDarkMode }) {
  const [saved, setSaved] = useState(false);

  // --- Notification Preferences (real, persisted per-employee -- dbo.EmployeeSettings) ---
  const { data: employeeSettings } = useEmployeeSettingsQuery();
  const { update: updateSettings } = useEmployeeSettingsMutations();
  const toggleNotification = (key) => {
    updateSettings.mutate({ ...employeeSettings, [key]: employeeSettings[key] === false });
  };

  const handleSave = () => {
    setSaved(true);
    toast.success("Settings saved successfully");
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className={cn("bg-card rounded-lg border border-border shadow-sm", "hover-lift", "animate-fade-in-up")} style={{ animationDelay: "120ms" }}>
        <div className="py-4 px-5 border-b border-border font-semibold text-sm">Appearance & Theme</div>
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Dark Mode</p>
              <p className="text-xs text-muted-foreground">Switch between light and dark interface</p>
            </div>
            <button onClick={onDarkMode}
              className={cn("relative w-12 h-6 rounded-full transition-colors border-none cursor-pointer", darkMode ? "bg-primary" : "bg-muted")}>
              <span className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform", darkMode ? "translate-x-7" : "translate-x-1")}/>
            </button>
          </div>
        </div>
      </div>

      <div className={cn("bg-card rounded-lg border border-border shadow-sm", "hover-lift", "animate-fade-in-up")} style={{ animationDelay: "240ms" }}>
        <div className="py-4 px-5 border-b border-border font-semibold text-sm">Notification Preferences</div>
        <div className="p-5 flex flex-col gap-4">
          {/* Only the 2 categories this app's backend actually has a real notification event for
              (see AMS.Api's NotificationEvent enum + SignalR wiring): Leave approve/reject/cancel
              and HR Support ticket status changes. Attendance reminders, Policy-publish alerts, and
              Training due-date alerts were removed -- none of those have any backend event source
              at all (Learning Portal doesn't even have a due-date field anymore), so they were pure
              decoration promising something the app can't do. */}
          {[
            { key:"leaveApprovalAlerts", label:"Leave Approval Alerts", sub:"Get mail notification when the leave is approved/rejected" },
            { key:"ticketStatusUpdates", label:"Ticket Status Updates", sub:"Get mail notifications on your HR support tickets" },
            { key:"visitorAlertSound", label:"Visitor Request Beep", sub:"Turn off visitor alerts for no sound at all." },
          ].map(n => {
            const on = employeeSettings[n.key] !== false;
            return (
              <div key={n.key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{n.label}</p>
                  <p className="text-xs text-muted-foreground">{n.sub}</p>
                </div>
                <button onClick={() => toggleNotification(n.key)}
                  className={cn("relative shrink-0 w-10 h-5 rounded-full transition-colors border-none cursor-pointer after:content-[''] after:absolute after:-inset-3 md:after:hidden", on ? "bg-primary" : "bg-muted")}>
                  <span className={cn("absolute top-0.5 left-0 w-4 h-4 bg-white rounded-full shadow transition-transform", on ? "translate-x-5" : "translate-x-0.5")}/>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 animate-fade-in-up" style={{ animationDelay: "420ms" }}>
        <Btn variant="primary" onClick={handleSave}>
          {saved ? <><Check size={14}/> Saved!</> : "Save Changes"}
        </Btn>
        <Btn variant="secondary" onClick={() => toast.info("Changes discarded")}>Discard</Btn>
      </div>
    </div>
  );
}
