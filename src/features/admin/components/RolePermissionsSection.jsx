import { useMemo } from "react";
import { toast } from "sonner";
import { Spinner } from "@/shared/components/Spinner";
import { useRolePermissionsQuery, useSetRolePermission } from "../hooks/useAccessManagement";


// Role permissions: one checkbox per role per module. A tick means the role may use that module (its menu entry AND the APIs behind it);
// every change is saved at once by updating that role/module row in dbo.RoleNavItems (dbo.spv1_ManageAccessControl, SET_ROLE_NAV_ITEM). Items under "Permissions" have no
// menu entry: they switch features on inside screens (e.g. approving leave, administering HR data).
export default function RolePermissionsSection() {
  const { data, isLoading, isError, refetch } = useRolePermissionsQuery();

  const save = useSetRolePermission();

  const rows = useMemo(() => {
    if (!data) return [];
    const byParent = (parentId) => data.navItems.filter(n => (n.parentId ?? null) === parentId).sort((a, b) => a.id - b.id);
    const menu = data.navItems.filter(n => n.showInMenu);
    const out = [];
    byParent(null).filter(n => n.showInMenu).forEach(n => {
      // A parent group has no module of its own: it is a heading for its children.
      out.push({ ...n, heading: !n.endpoint, indent: false });
      menu.filter(c => c.parentId === n.id).sort((a, b) => a.id - b.id).forEach(c => out.push({ ...c, indent: true }));
    });
    return out;
  }, [data]);

  if (isLoading) return <div className="p-8 flex justify-center"><Spinner message="Loading…"/></div>;
  if (isError || !data) {
    return (
      <div className="p-8 text-sm text-muted-foreground flex flex-col items-start gap-2">
        Could not load the role permissions.
        <button type="button" onClick={() => refetch()} className="text-primary bg-transparent border-0 cursor-pointer underline">Retry</button>
      </div>
    );
  }

  const isOn = (roleId, navItemId) => data.grants.some(g => g.roleId === roleId && g.navItemId === navItemId && g.isVisible);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Tick what each role may use. A change is saved immediately and applies the next time that person opens the app; ITAdmin is ticked like any other role (the server keeps the items that protect this screen).
      </p>
      <div className="bg-card rounded-lg border border-border shadow-sm overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky top-0 text-left font-semibold px-4 py-2 border-b border-border">Module</th>
              {data.roles.map(r => (
                <th key={r.roleId} className="sticky top-0 font-semibold px-3 py-2 border-b border-border text-center">{r.roleName}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              row.heading ? (
                <tr key={row.id} className="bg-muted/30">
                  <td colSpan={data.roles.length + 1} className="px-4 py-1.5 font-semibold text-foreground">{row.navItem}</td>
                </tr>
              ) : (
                <tr key={row.id} className="border-b border-border last:border-b-0 hover:bg-muted/30">
                  <td className={`px-4 py-2 ${row.indent ? "pl-8" : ""}`}>{row.navItem}</td>
                  {data.roles.map(r => {
                    return (
                      <td key={r.roleId} className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${r.roleName}: ${row.navItem}`}
                          checked={isOn(r.roleId, row.id)}
                          disabled={save.isPending}
                          onChange={(e) => save.mutate({ roleId: r.roleId, navItemId: row.id, isVisible: e.target.checked })}
                          className="w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                        />
                      </td>
                    );
                  })}
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}