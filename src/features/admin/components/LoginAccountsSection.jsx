import { useEffect, useMemo, useState } from "react";
import { UserPlus, Mail, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/shared/components/Btn";
import { inputCls, Modal } from "@/shared/components/Modal";
import { Spinner } from "@/shared/components/Spinner";
import { DataTable } from "@/shared/components/DataTable";
import { listLoginCandidates, setLoginAccountActive, sendLoginResetLink } from "../services/registerAccounts.service";
import { useLoginAccountsQuery, useRegisterLoginAccount, LOGIN_ACCOUNTS_KEY as KEY } from "../hooks/useLoginAccounts";
import { useAdminAction } from "../hooks/useAdminAction";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";

const STATUS_HELP = { "Not set": "Waiting for the employee to use the e-mailed link", "Must change": "Must choose a new password at the next sign-in", Active: "Signs in with their own password" };
const fmt = (v) => (v ? new Date(v.endsWith?.("Z") ? v : v + "Z").toLocaleDateString() : "—");

function FieldError({ message }) {
  return message ? <span className="text-xs text-destructive" role="alert">{message}</span> : null;
}

// dbo.Login -- HR Admin / IT Admin register an employee for Employee No + password sign-in, send a password reset link, and switch an account on or off.
// Nobody but the employee ever sets the password: registering and "Send link" both e-mail the employee a one-time link and a 6-digit code.
export default function LoginAccountsSection() {
  const [find, setFind] = useState("");
  const [candidates, setCandidates] = useState(null);
  const [finding, setFinding] = useState(false);
  const [picked, setPicked] = useState(null);
  const [errors, setErrors] = useState({});
  const [confirm, setConfirm] = useState(null); // { kind: "link" | "toggle", account } - the dialog that asks before an action is done

  // Every account is loaded once (up to 500); the table's own search, sorting, Excel export and pagination work on them.
  const { data = [], isLoading } = useLoginAccountsQuery();
  const rows = useMemo(() => data.map(a => ({
    ...a,
    email: (a.email ?? "").trim().toLowerCase(), // shown (and searched / exported) in lower case
    // one column: "3661 - Imran Yousuf" (searched and exported the same way)
    employeeText: a.empNo + (a.empName ? " - " + a.empName : "") + (a.userType === "CONTRACT" ? " (contract)" : ""),
    accountText: a.active ? "Enabled" : "Disabled",
    createdOn: fmt(a.createdAt),
    createdByText: a.createdBy ?? "",
  })), [data]);
  const columns = [
    { key: "employeeText", label: "Name" },
    { key: "email", label: "E-mail" },
    { key: "status", label: "Password", render: a => a.status },
    { key: "accountText", label: "Account", render: a => a.accountText },
    { key: "createdOn", label: "Created" },
    { key: "createdByText", label: "Created by" },
  ];
  const toggle = useAdminAction(setLoginAccountActive, [KEY]);
  const sendLink = useAdminAction(sendLoginResetLink, [KEY]);
  const register = useRegisterLoginAccount({
    onRegistered: () => { setPicked(null); setCandidates(null); setFind(""); setErrors({}); },
    onFailed: (message) => setErrors({ form: message }),
  });

  // The search runs by itself 400 ms after the last key (no Find button): at least 2 characters of the employee number or name.
  const debouncedFind = useDebouncedValue(find, 400);
  useEffect(() => {
    const text = debouncedFind.trim();
    if (text.length < 2) { setCandidates(null); setFinding(false); return undefined; }
    let alive = true;
    setFinding(true); setPicked(null);
    listLoginCandidates(text)
      .then((rows) => { if (alive) { setCandidates(rows); setErrors((x) => ({ ...x, find: "" })); } })
      .catch((err) => { if (alive) { setCandidates(null); setErrors({ find: err?.response?.data?.message ?? "Could not search." }); } })
      .finally(() => { if (alive) setFinding(false); });
    return () => { alive = false; };
  }, [debouncedFind]);

  const submit = (e) => {
    e.preventDefault();
    if (!picked) { setErrors({ pick: "Select an employee first." }); return; }
    if (!picked.hasEmail) { setErrors({ form: "Your email is not configured. Please contact HR." }); return; }
    setErrors({});
    register.mutate({ empNo: picked.empNo, userType: picked.userType });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card rounded-lg border border-border shadow-sm p-4 flex flex-col gap-3">
        <div className="font-semibold text-sm flex items-center gap-2"><UserPlus size={15}/> Register an employee</div>
        <p className="text-xs text-muted-foreground">The employee gets a one-time link and a 6-digit code at their own e-mail address and chooses their own password. You cannot set or see it.</p>
        <div className="flex flex-col gap-1 w-full lg:w-1/3 lg:min-w-[280px]">
          <input value={find} onChange={e => { setFind(e.target.value); setErrors(x => ({ ...x, find: "" })); }} placeholder="Employee number or name (at least 2 characters)"
            className={inputCls + (errors.find ? " border-destructive" : "")} aria-invalid={errors.find ? true : undefined}/>
          <FieldError message={errors.find}/>
          {finding ? <span className="text-xs text-muted-foreground">Searching...</span> : (find.trim().length > 0 && find.trim().length < 2 ? <span className="text-xs text-muted-foreground">Type at least 2 characters of the employee number or name.</span> : null)}
        </div>

        {candidates && (candidates.length === 0
          ? <p className="text-sm text-muted-foreground">No active employee without a login account matches this search.</p>
          : (
            <div className="max-h-48 overflow-auto rounded-md border border-border">
              {candidates.map(c => (
                <button type="button" key={c.userType + c.empNo} onClick={() => { setPicked(c); setErrors({}); }}
                  className={"w-full text-left px-3 py-2 text-sm border-0 border-b border-border cursor-pointer " + (picked?.empNo === c.empNo && picked?.userType === c.userType ? "bg-[var(--colorBrandBackground2)]" : "bg-transparent hover:bg-secondary/60")}>
                  <span className="font-medium">{c.empNo}</span> — {c.empName ?? "—"}
                  <span className="text-xs text-muted-foreground"> · {c.userType === "CONTRACT" ? "Contract · " : ""}{c.hasEmail ? c.email : "no e-mail address"}</span>
                </button>
              ))}
            </div>
          ))}
        <FieldError message={errors.pick}/>

        {picked && (
          <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
            <p className="text-sm">Selected: <strong>{picked.empNo}</strong> — {picked.empName} {picked.hasEmail ? <span className="text-xs text-muted-foreground">· link goes to {picked.email}</span> : null}</p>
            <FieldError message={errors.form || (!picked.hasEmail ? "Your email is not configured. Please contact HR." : "")}/>
            <div className="flex gap-2">
              <Btn variant="primary" size="sm" loading={register.isPending} disabled={!picked.hasEmail}>Register and send link</Btn>
              <Btn variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); setPicked(null); setErrors({}); }}>Cancel</Btn>
            </div>
          </form>
        )}
      </div>

      {isLoading ? <div className="p-6 flex justify-center"><Spinner message="Loading…"/></div> : (
        <DataTable
          title="Register Account"
          columns={columns}
          data={rows}
          exportFileName="Login_Accounts"
          actions={(a) => (
            <>
              {a.active && (
                <button onClick={() => setConfirm({ kind: "link", account: a })} title="Send reset link" aria-label="Send reset link"
                  className="p-1.5 rounded-md transition-colors bg-transparent border-none cursor-pointer hover:bg-secondary text-primary"><Mail size={14}/></button>
              )}
              <button onClick={() => setConfirm({ kind: "toggle", account: a })} title={a.active ? "Disable account" : "Enable account"} aria-label={a.active ? "Disable account" : "Enable account"}
                className={"p-1.5 rounded-md transition-colors bg-transparent border-none cursor-pointer hover:bg-secondary " + (a.active ? "text-destructive" : "text-primary")}>
                {a.active ? <UserX size={14}/> : <UserCheck size={14}/>}
              </button>
            </>
          )}
        />
      )}

      <Modal open={!!confirm} onClose={() => setConfirm(null)} maxWidth="max-w-md"
        title={confirm?.kind === "link" ? "Send reset link" : confirm?.account.active ? "Disable account" : "Enable account"}
        footer={<>
          <Btn variant="secondary" size="sm" onClick={() => setConfirm(null)}>Cancel</Btn>
          <Btn variant={confirm?.kind === "toggle" && confirm?.account.active ? "danger" : "primary"} size="sm" onClick={() => {
            const a = confirm.account;
            if (confirm.kind === "link") sendLink.mutate({ userType: a.userType, empNo: a.empNo });
            else toggle.mutate({ userType: a.userType, empNo: a.empNo, active: !a.active });
            setConfirm(null);
          }}>{confirm?.kind === "link" ? "Send link" : confirm?.account.active ? "Disable" : "Enable"}</Btn>
        </>}>
        {confirm && (
          <p className="text-sm m-0">
            {confirm.kind === "link"
              ? <>A link and a 6-digit code will be e-mailed to <strong>{confirm.account.email || "the employee"}</strong> ({confirm.account.empNo}{confirm.account.empName ? " - " + confirm.account.empName : ""}). You will not see either.</>
              : confirm.account.active
                ? <>{confirm.account.empNo}{confirm.account.empName ? " - " + confirm.account.empName : ""} will no longer be able to sign in or reset the password. A session that is already open lasts until it expires (about 8 hours).</>
                : <>{confirm.account.empNo}{confirm.account.empName ? " - " + confirm.account.empName : ""} will be able to sign in again.</>}
          </p>
        )}
      </Modal>
    </div>
  );
}