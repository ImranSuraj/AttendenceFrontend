import { useState, useMemo, useEffect } from "react";
import { CheckCircle2, Send, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/utils/cn";
import { Btn } from "@/shared/components/Btn";
import { useAuthStore } from "@/shared/auth/auth.store";
import { signOut } from "@/features/auth";
import { FormField, inputCls } from "@/shared/components/Modal";
import { HostSelect } from "../components/HostSelect";
import { useVisitorMutations, useDepartmentNamesQuery, useVisitorRequestsQuery } from "../hooks/useVisitorsQuery";
import { useNavIntent } from "@/shared/navigation/navIntent";
import { validateVisitorForm, VISITOR_FIELD_LIMITS, VISITOR_MAX_PEOPLE } from "../visitors.validators";

const emptyForm = { visitorName: "", contactNumber: "", visitorEmail: "", company: "", purpose: "", noOfVisitors: "1", host: null };

// Visitor registration form. A Visitor (outsider) lands here and sees nothing else -- App.jsx renders this page
// without the sidebar / top bar for that role. Submitting saves the request and (backend, later) mails the
// employee being visited with exactly these fields; the employee then accepts / rejects it in Visitor Requests.
export default function VisitorPage({ onNavigate }) {
  const { submit, update } = useVisitorMutations();
  const { data: departmentNames } = useDepartmentNamesQuery();

  // "Complete the details" mode: opened from Visitor Requests on a request made from a conference booking (Meeting Type = Scheduled), which only
  // holds the visitor's e-mail so far. The employee / receptionist fills in the rest here and saves it back to that same request.
  const intent = useNavIntent(s => s.intent);
  const clearIntent = useNavIntent(s => s.clear);
  const [editId, setEditId] = useState(null);
  useEffect(() => {
    if (intent?.module === "visitor" && intent.requestId) { setEditId(intent.requestId); clearIntent(); }
  }, [intent, clearIntent]);
  // Only asked for in this mode: a Visitor (outsider) is not allowed to list requests.
  const { data: requests = [], isFetching: loadingRequests } = useVisitorRequestsQuery({ enabled: !!editId });
  const editing = editId ? requests.find(r => r.id === editId) : null;

  const signedInWithEmployeeId = useAuthStore(s => s.method === "dev"); // the temporary Employee ID sign-in can be ended here
  const [form, setForm] = useState(emptyForm);
  const [touched, setTouched] = useState({});
  const [sent, setSent] = useState(null); // the saved request, shown as the confirmation

  // Fill the form from the request being completed (once). The name is blank when it only holds the e-mail the booking put there.
  useEffect(() => {
    if (!editing) return;
    const nameIsEmail = editing.visitorName.trim().toLowerCase() === editing.visitorEmail.trim().toLowerCase();
    setForm({
      visitorName: nameIsEmail ? "" : editing.visitorName,
      contactNumber: editing.contactNumber ?? "",
      visitorEmail: editing.visitorEmail ?? "",
      company: editing.company ?? "",
      purpose: editing.purpose ?? "",
      noOfVisitors: String(editing.noOfVisitors ?? 1),
      host: { id: editing.hostEmpNo, name: editing.hostName },
    });
    setTouched({});
  }, [editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // The host is the person who booked the meeting and cannot be changed here.
  const errors = useMemo(() => {
    const e = validateVisitorForm(form);
    if (editId) delete e.host;
    return e;
  }, [form, editId]);
  const err = (k) => (touched[k] ? errors[k] : undefined);
  const touch = (k) => setTouched(t => (t[k] ? t : { ...t, [k]: true }));
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const fieldCls = (k) => cn(inputCls, "w-full", err(k) && "border-destructive focus:ring-destructive");
  const Err = ({ k }) => (err(k) ? <span className="text-xs text-destructive" role="alert">{err(k)}</span> : null);

  const onSubmit = (e) => {
    e.preventDefault();
    if (Object.keys(errors).length) {
      setTouched(Object.fromEntries(Object.keys(emptyForm).map(k => [k, true])));
      toast.error(Object.values(errors)[0]);
      return;
    }
    if (editId) {
      update.mutate({ id: editId, form }, {
        onSuccess: () => {
          toast.success("Visitor details updated");
          setEditId(null); setForm(emptyForm); setTouched({});
          onNavigate?.("visitorRequests");
        },
      });
      return;
    }
    submit.mutate(form, {
      onSuccess: (req) => { setSent(req); setForm(emptyForm); setTouched({}); },
    });
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <div className="animate-fade-in-up">
        {editId ? (
          <>
            <button type="button" onClick={() => { setEditId(null); setForm(emptyForm); setTouched({}); onNavigate?.("visitorRequests"); }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground bg-transparent border-none cursor-pointer hover:underline p-0 mb-2"><ArrowLeft size={13}/> Back to Visitor Requests</button>
            <p className="text-sm text-muted-foreground">This visit was created from a meeting booking. Fill in the visitor's missing details and save.</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Fill in your details and who you are here to meet. They will be notified of your visit.</p>
        )}
      </div>

      {editId && !editing ? (
        <div className="bg-card rounded-lg border border-border shadow-sm p-8 text-center text-sm text-muted-foreground">
          {loadingRequests ? "Loading the visitor request…" : "This visitor request was not found."}
        </div>
      ) : sent ? (
        <div className="bg-card rounded-lg border border-border shadow-sm p-8 flex flex-col items-center text-center gap-3 animate-fade-in-up">
          <CheckCircle2 size={40} className="text-green-600"/>
          <h3 className="text-base font-semibold text-foreground">Request submitted</h3>
          <p className="text-sm text-muted-foreground">{sent.hostName} has been notified about your visit.</p>
          <Btn variant="primary" size="sm" onClick={() => setSent(null)}>Register another visitor</Btn>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="bg-card rounded-lg border border-border shadow-sm p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in-up">
          <FormField label="Visitor Name" required>
            <input value={form.visitorName} onChange={set("visitorName")} onBlur={() => touch("visitorName")} maxLength={VISITOR_FIELD_LIMITS.visitorName} className={fieldCls("visitorName")}/>
            <Err k="visitorName"/>
          </FormField>
          <FormField label="Contact Number" required>
            <input value={form.contactNumber} onChange={e => setForm(f => ({ ...f, contactNumber: e.target.value.replace(/\D/g, "").slice(0, 10) }))} onBlur={() => touch("contactNumber")} inputMode="numeric" maxLength={10} className={fieldCls("contactNumber")}/>
            <Err k="contactNumber"/>
          </FormField>
          <FormField label="Visitor Email" required>
            <input type="email" value={form.visitorEmail} onChange={set("visitorEmail")} onBlur={() => touch("visitorEmail")} maxLength={VISITOR_FIELD_LIMITS.visitorEmail} className={fieldCls("visitorEmail")}/>
            <Err k="visitorEmail"/>
          </FormField>
          <FormField label="Company" required>
            <input value={form.company} onChange={set("company")} onBlur={() => touch("company")} maxLength={VISITOR_FIELD_LIMITS.company} className={fieldCls("company")}/>
            <Err k="company"/>
          </FormField>
          <FormField label="No. of Visitors" required>
            <input type="number" min={1} max={VISITOR_MAX_PEOPLE} value={form.noOfVisitors} onChange={set("noOfVisitors")} onBlur={() => touch("noOfVisitors")} className={fieldCls("noOfVisitors")}/>
            <Err k="noOfVisitors"/>
          </FormField>
          <FormField label="Whom you want to meet" required>
            {editId ? (
              <input value={form.host?.name ?? ""} disabled className={cn(inputCls, "w-full bg-muted text-muted-foreground")}/>
            ) : (
              <HostSelect value={form.host} onChange={(host) => setForm(f => ({ ...f, host }))} departmentNames={departmentNames}
                invalid={!!err("host")} onBlur={() => touch("host")}/>
            )}
            <Err k="host"/>
          </FormField>
          <FormField label="Purpose" required className="sm:col-span-2">
            <textarea rows={3} value={form.purpose} onChange={set("purpose")} onBlur={() => touch("purpose")} maxLength={VISITOR_FIELD_LIMITS.purpose} className={fieldCls("purpose")}/>
            <Err k="purpose"/>
          </FormField>
          <div className="sm:col-span-2 flex justify-end">
            <Btn variant="primary" size="sm" loading={submit.isPending || update.isPending}><Send size={14}/> {editId ? "Save details" : "Submit"}</Btn>
          </div>
        </form>
      )}


      {signedInWithEmployeeId && (
        <button type="button" onClick={() => signOut()} className="self-center text-xs text-muted-foreground bg-transparent border-none cursor-pointer hover:underline">Sign out</button>
      )}
    </div>
  );
}
