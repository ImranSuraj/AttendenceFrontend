import { useState } from "react";
import { Btn } from "@/shared/components/Btn";
import { inputCls } from "@/shared/components/Modal";
import { Spinner } from "@/shared/components/Spinner";
import { saveRole, deleteRole } from "../services/access.service";
import { useRolesQuery, ROLES_KEY as KEY, ROLE_PERMISSIONS_KEY, USER_ROLES_KEY } from "../hooks/useAccessManagement";
import { useAdminAction } from "../hooks/useAdminAction";
import { Table, th, td, ConfirmDelete } from "./accessKit";


// dbo.Roles -- add, rename and delete roles. The six built-in roles (the application refers to them by name) cannot be renamed or deleted, and a
// role still held by people cannot be deleted.
export default function RolesSection() {
  const { data = [], isLoading } = useRolesQuery({ staleTime: 0 });
  const save = useAdminAction(saveRole, [KEY, ROLE_PERMISSIONS_KEY, USER_ROLES_KEY]);
  const del = useAdminAction(deleteRole, [KEY, ROLE_PERMISSIONS_KEY]);
  const [name, setName] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");

  if (isLoading) return <div className="p-6 flex justify-center"><Spinner message="Loading…"/></div>;

  return (
    <div className="flex flex-col gap-3">
      <form className="flex gap-2 items-center" onSubmit={(e) => { e.preventDefault(); save.mutate({ id: null, roleName: name }, { onSuccess: () => setName("") }); }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="New role name" maxLength={50} className={inputCls}/>
        <Btn variant="primary" size="sm" loading={save.isPending} disabled={name.trim().length < 2}>Add role</Btn>
      </form>
      <Table>
        <thead><tr><th className={th}>Role</th><th className={th}>People</th><th className={th}></th></tr></thead>
        <tbody>
          {data.map(r => (
            <tr key={r.roleId}>
              <td className={td}>
                {editId === r.roleId
                  ? <input value={editName} onChange={e => setEditName(e.target.value)} maxLength={50} className={inputCls}/>
                  : <>{r.roleName}{r.isBuiltIn && <span className="ml-2 text-xs text-muted-foreground">built-in</span>}</>}
              </td>
              <td className={td}>{r.users}</td>
              <td className={`${td} text-right`}>
                {editId === r.roleId ? (
                  <span className="inline-flex gap-1">
                    <Btn variant="primary" size="xs" onClick={() => save.mutate({ id: r.roleId, roleName: editName }, { onSuccess: () => setEditId(null) })}>Save</Btn>
                    <Btn variant="ghost" size="xs" onClick={() => setEditId(null)}>Cancel</Btn>
                  </span>
                ) : (
                  <span className="inline-flex gap-1">
                    {!r.isBuiltIn && <Btn variant="ghost" size="xs" onClick={() => { setEditId(r.roleId); setEditName(r.roleName); }}>Rename</Btn>}
                    {!r.isBuiltIn && <ConfirmDelete onConfirm={() => del.mutate(r.roleId)}/>}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}