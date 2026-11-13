import { useState } from "react";
import { Btn } from "@/shared/components/Btn";
import { Modal, FormField, inputCls } from "@/shared/components/Modal";
import { Spinner } from "@/shared/components/Spinner";
import { saveNavItem, deleteNavItem } from "../services/access.service";
import { useNavItemsQuery, NAV_ITEMS_KEY as KEY, ROLE_PERMISSIONS_KEY } from "../hooks/useAccessManagement";
import { useAdminAction } from "../hooks/useAdminAction";
import { Table, th, td, ConfirmDelete } from "./accessKit";

const empty = { id: null, navItem: "", endpoint: "", showInMenu: true, isActive: true };

// dbo.NavItems -- the modules and permission keys. Key = the front-end module key; leave it empty for a parent group; write '<group>/<key>'
// (the group's label in lower case, no spaces) for a page inside a group. "In menu" off = a permission key with no menu entry.
// Menu order is the order the items were added in.
export default function NavItemsSection() {
  const { data = [], isLoading } = useNavItemsQuery();
  const refresh = [KEY, ROLE_PERMISSIONS_KEY];
  const save = useAdminAction(saveNavItem, refresh);
  const del = useAdminAction(deleteNavItem, refresh);
  const [form, setForm] = useState(null);

  if (isLoading) return <div className="p-6 flex justify-center"><Spinner message="Loading…"/></div>;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="flex flex-col gap-3">
      <div><Btn variant="primary" size="sm" onClick={() => setForm(empty)}>Add item</Btn></div>
      <Table>
        <thead><tr><th className={th}>Label</th><th className={th}>Key</th><th className={th}>In menu</th><th className={th}>Active</th><th className={th}>APIs</th><th className={th}></th></tr></thead>
        <tbody>
          {data.map(n => (
            <tr key={n.id}>
              <td className={td}>{n.navItem}</td>
              <td className={td}>{n.endpoint ?? <span className="text-muted-foreground">(group)</span>}</td>
              <td className={td}>{n.showInMenu ? "Yes" : "No"}</td>
              <td className={td}>{n.isActive ? "Yes" : "No"}</td>
              <td className={td}>{n.apis}</td>
              <td className={`${td} text-right`}>
                <span className="inline-flex gap-1">
                  <Btn variant="ghost" size="xs" onClick={() => setForm({ id: n.id, navItem: n.navItem, endpoint: n.endpoint ?? "", showInMenu: n.showInMenu, isActive: n.isActive })}>Edit</Btn>
                  <ConfirmDelete onConfirm={() => del.mutate(n.id)}/>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Edit item" : "Add item"}
        footer={<>
          <Btn variant="secondary" size="sm" onClick={() => setForm(null)}>Cancel</Btn>
          <Btn variant="primary" size="sm" loading={save.isPending} disabled={!form?.navItem.trim()}
            onClick={() => save.mutate({ ...form, endpoint: form.endpoint.trim() || null }, { onSuccess: () => setForm(null) })}>Save</Btn>
        </>}>
        {form && (
          <div className="flex flex-col gap-3">
            <FormField label="Label" required><input value={form.navItem} onChange={e => set("navItem", e.target.value)} maxLength={100} className={`${inputCls} w-full`}/></FormField>
            <FormField label="Key (empty = parent group)"><input value={form.endpoint} onChange={e => set("endpoint", e.target.value)} maxLength={100} className={`${inputCls} w-full`}/></FormField>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.showInMenu} onChange={e => set("showInMenu", e.target.checked)}/> Show in the menu</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={e => set("isActive", e.target.checked)}/> Active</label>
          </div>
        )}
      </Modal>
    </div>
  );
}