import { useState } from "react";
import { cn } from "@/shared/utils/cn";
import RolePermissionsSection from "../components/RolePermissionsSection";
import UserRolesSection from "../components/UserRolesSection";
import RolesSection from "../components/RolesSection";
import NavItemsSection from "../components/NavItemsSection";
import LoginAccountsSection from "../components/LoginAccountsSection";
import { useHasRole } from "@/shared/access/access.store";

const SECTIONS = [
  { id: "permissions", label: "Module access", hint: "Tick what each role, ITAdmin included, may use (dbo.RoleNavItems).", Component: RolePermissionsSection },
  { id: "users", label: "Users & roles", hint: "Who holds which role (dbo.UserRoles).", Component: UserRolesSection },
  { id: "roles", label: "Roles", hint: "Add, rename and delete roles (dbo.Roles).", Component: RolesSection },
  { id: "items", label: "Menu items", hint: "The modules and permission keys (dbo.NavItems).", Component: NavItemsSection },
  { id: "login", label: "Register Account", hint: "Register employees for Employee No and password sign-in, and switch accounts on or off (dbo.Login).", Component: LoginAccountsSection, hr: true },
];

// Admin > Access Management: one page to manage every authorization table -- create, read, update and delete.
export default function AccessManagementPage() {
  // An HR Admin sees only the Register Account section; an IT Admin sees all five.
  const isIt = useHasRole("ITAdmin");
  const sections = isIt ? SECTIONS : SECTIONS.filter(s => s.hr);
  const [active, setActive] = useState(() => (isIt ? "permissions" : "login"));
  const section = sections.find(s => s.id === active) ?? sections[0];
  const Section = section.Component;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1">
        {sections.map(s => (
          <button key={s.id} type="button" onClick={() => setActive(s.id)}
            className={cn("px-3 py-1.5 text-sm rounded-md border cursor-pointer",
              active === s.id ? "bg-[var(--colorBrandBackground2)] text-[var(--colorBrandForeground2)] border-transparent font-semibold" : "bg-transparent border-border text-muted-foreground hover:text-foreground")}>
            {s.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{section.hint}</p>
      <Section/>
    </div>
  );
}