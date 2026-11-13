import { useState } from "react";
import { Btn } from "@/shared/components/Btn";
import { inputCls } from "@/shared/components/Modal";
import { Spinner } from "@/shared/components/Spinner";
import { addUserRole, removeUserRole } from "../services/access.service";
import { useRolesQuery, useUserRolesQuery, USER_ROLES_KEY as KEY, ROLES_KEY } from "../hooks/useAccessManagement";
import { useAdminAction } from "../hooks/useAdminAction";
import { Table, th, td, ConfirmDelete } from "./accessKit";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";


// dbo.UserRoles -- who holds which role: search by employee number, name or role, assign a role to an employee number, remove one.
// A person with no row is a plain Employee.
export default function UserRolesSection() {
  const [search, setSearch] = useState("");
  const applied = useDebouncedValue(search.trim(), 400);   // the server is asked 400 ms after the last key, not on every key
  const [userId, setUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const { data: roles = [] } = useRolesQuery();
  const { data = [], isLoading } = useUserRolesQuery(applied);
  const add = useAdminAction(addUserRole, [KEY, ROLES_KEY]);
  const remove = useAdminAction(removeUserRole, [KEY, ROLES_KEY]);

  return (
    <div className="flex flex-col gap-3">
      <form className="flex flex-wrap gap-2 items-center" onSubmit={(e) => { e.preventDefault(); add.mutate({ userId: userId.trim(), roleId: Number(roleId) }, { onSuccess: () => setUserId("") }); }}>
        <input value={userId} onChange={e => setUserId(e.target.value.replace(/\s/g, "").slice(0, 10))} placeholder="Employee number" className={inputCls} inputMode="numeric"/>
        <select value={roleId} onChange={e => setRoleId(e.target.value)} className={inputCls}>
          <option value="">Select role…</option>
          {roles.map(r => <option key={r.roleId} value={r.roleId}>{r.roleName}</option>)}
        </select>
        <Btn variant="primary" size="sm" loading={add.isPending} disabled={!userId.trim() || !roleId}>Assign role</Btn>
      </form>
      <div className="flex gap-2 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by number, name or role" className={inputCls}/>
      </div>
      {isLoading ? <div className="p-6 flex justify-center"><Spinner message="Loading…"/></div> : (
        <Table>
          <thead><tr><th className={th}>Employee</th><th className={th}>Name</th><th className={th}>Role</th><th className={th}></th></tr></thead>
          <tbody>
            {data.map(u => (
              <tr key={u.id}>
                <td className={td}>{u.userId}</td>
                <td className={td}>{u.empName ?? "—"}</td>
                <td className={td}>{u.roleName}</td>
                <td className={`${td} text-right`}><ConfirmDelete label="Remove" onConfirm={() => remove.mutate(u.id)}/></td>
              </tr>
            ))}
            {data.length === 0 && <tr><td className={td} colSpan={4}>Nothing found.</td></tr>}
          </tbody>
        </Table>
      )}
      <p className="text-xs text-muted-foreground">Shows up to 500 rows; narrow it with the search.</p>
    </div>
  );
}