import { User, Building2, Mail, Phone, MapPin, Calendar, Users, Factory, Award, Home } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { formatDate } from "@/shared/utils/date";

// Shared presentational profile card — used both for "My Profile" (fed from the current user's own
// record + getEmployeeProfile's live fields) and for a Directory Search result (fed from
// searchEmployeeDirectory). Purely presentational: the parent resolves every field (including any
// "Loading…"/"Unavailable" live-field substitution) before passing it in via `employee`, so this
// component never talks to the network itself. Any field left `undefined` on `employee` is simply
// omitted from the grid — this lets a leaner result (e.g. Directory Search, which doesn't return
// Grade/Address/Status/Join Date) reuse the exact same markup without showing empty rows.
export function EmployeeProfileCard({ employee }) {
  const initials = employee.name ? employee.name.split(" ").map(n => n[0]).join("").slice(0, 2) : "";

  const fields = [
    { label: "Employee Code", value: employee.empCode, icon: User },
    { label: "Department", value: employee.department, icon: Building2 },
    { label: "Email", value: employee.email, icon: Mail },
    { label: "Mobile", value: employee.mobile, icon: Phone },
    { label: "Location", value: employee.location, icon: MapPin },
    { label: "Plant", value: employee.plant, icon: Factory },
    { label: "Manager", value: employee.manager, icon: Users },
    { label: "Grade", value: employee.grade, icon: Award },
    { label: "Join Date", value: employee.joinDate ? formatDate(employee.joinDate) : employee.joinDate, icon: Calendar },
  ].filter(f => f.value !== undefined && f.value !== "");

  return (
    <div className={cn("bg-card rounded-lg border border-border shadow-sm p-6", "hover-lift")}>
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="max-md:hidden w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0">
            {initials}
          </div>
          <div>
            <h4 className="text-lg font-bold text-foreground">{employee.name}</h4>
            <p className="text-sm text-primary">{employee.designation}</p>
            {employee.status && <StatusBadge status={employee.status}/>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
        {fields.map(f => (
          <div key={f.label} className="flex items-start gap-2">
            <f.icon size={14} className="text-muted-foreground mt-0.5 shrink-0"/>
            <div>
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="font-medium text-foreground text-sm">{f.value}</p>
            </div>
          </div>
        ))}
        {employee.address !== undefined && (
          <div className="flex items-start gap-2 sm:col-span-2 lg:col-span-3">
            <Home size={14} className="text-muted-foreground mt-0.5 shrink-0"/>
            <div>
              <p className="text-xs text-muted-foreground">Address</p>
              <p className="font-medium text-foreground text-sm">{employee.address}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
