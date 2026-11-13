import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { FormField, inputCls } from "@/shared/components/Modal";
import { Btn } from "@/shared/components/Btn";
import { SearchableSelect } from "@/shared/components/SearchableSelect";
import { cn } from "@/shared/utils/cn";
import { CURRENT_FY } from "../documents.constants";
import { useITDeclarationLookup } from "../hooks/useItDeclarationQuery";
import {
  validateStep, validateDeclaration, computeSection80CTotal, computeAdditionalDeductionsTotal,
  computeDeductionsTotal, computeSummary,
} from "../documents.validators";
import { SECTION_80C_FIELDS, ADDITIONAL_DEDUCTION_FIELDS } from "../documents.constants";
import DeclarationSummary from "./DeclarationSummary";

const STEPS = [
  { id: 1, label: "Personal Details" },
  { id: 2, label: "Tax Regime" },
  { id: 3, label: "NPS Details" },
  { id: 4, label: "Tax Deductions" },
  { id: 5, label: "Review & Submit" },
];

const emptyForm = (CURRENT_USER) => ({
  employeeId: CURRENT_USER.id,
  employeeName: CURRENT_USER.name,
  financialYear: CURRENT_FY,
  location: CURRENT_USER.location || "",
  regime: "",
  pan: "",
  sodexoPluxee: null,
  childrenCount: "",
  superAnnuation: null,
  npsEnrolled: null,
  npsExistingSubscriber: null,
  npsType: "",
  npsContributionPct: "",
  npsInvestmentOption: "",
  npsPran: "",
  npsFundManager: "",
  npsPersonalEmail: "",
  monthlyRent: "",
  landlordPan: "",
  landlordName: "",
  houseAddress: "",
  ltaOpted: false,
  ltaPct: "",
  housingLoanInterest: "",
  lenderName: "",
  lenderPan: "",
  rentReceived: "",
  section80C: SECTION_80C_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: "" }), {}),
  additionalDeductions: ADDITIONAL_DEDUCTION_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: "" }), {}),
  termsAccepted: false,
});

function StepHeader({ step }) {
  return (
    <div className="flex items-center mb-2">
      {STEPS.map((s, idx) => {
        const state = s.id < step ? "done" : s.id === step ? "active" : "pending";
        return (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className={cn(
                "w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold shrink-0",
                (state === "active" || state === "done") ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
              )}>
                {state === "done" ? <Check size={14} /> : s.id}
              </div>
              <span className={cn(
                "text-[10px] font-medium text-center max-w-[70px] leading-tight",
                state === "active" ? "text-foreground" : "text-muted-foreground"
              )}>{s.label}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={cn("flex-1 border-t mx-1 mb-4", s.id < step ? "border-primary" : "border-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function buildFormState(currentUser, existing) {
  const base = emptyForm(currentUser);
  if (!existing) return base;
  return {
    ...base,
    ...existing,
    section80C: { ...base.section80C, ...(existing.section80C || {}) },
    additionalDeductions: { ...base.additionalDeductions, ...(existing.additionalDeductions || {}) },
  };
}

// Dropdown fed by a database list ({ label, value } items from the lookups API). A value saved earlier that is no longer in the list is kept as an
// option so an old declaration still shows what it held.
function LookupSelect({ lookup, value, onChange, invalid }) {
  const items = (lookup.data ?? []).map(i => ({ value: String(i.value), label: i.label }));
  const current = value === "" || value == null ? "" : String(value);
  const options = !current || items.some(i => i.value === current) ? items : [{ value: current, label: current }, ...items];
  // The same searchable dropdown the rest of the app uses (Documents, Doctor, Employees ...), not a plain browser select.
  return (
    <SearchableSelect value={current} onChange={onChange} options={options}
      placeholder={lookup.isLoading ? "Loading..." : "Select..."} disabled={lookup.isLoading}
      className={invalid ? "border-destructive" : undefined} />
  );
}

export default function DeclarationForm({ currentUser, existing, onSubmit, onCancel, submitting = false, locked = false }) {
  const [form, setForm] = useState(() => buildFormState(currentUser, existing));
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState(1);

  // Dropdown lists, read from the database (one endpoint, one stored procedure). The % of Basic list depends on the tax regime.
  const pctBasicLookup = useITDeclarationLookup("PERCENTAGE_BASIC", form.regime, !!form.regime && !!form.npsEnrolled);
  const fundManagerLookup = useITDeclarationLookup("FUND_MANAGERS", null, !!form.npsEnrolled);
  const investmentLookup = useITDeclarationLookup("INVESTMENT_OPTIONS", null, !!form.npsEnrolled);
  const ltaLookup = useITDeclarationLookup("LTA_PERCENTAGE", null, !!form.ltaOpted);

  // Reset form whenever the record being edited changes (e.g. Edit clicked on a different declaration)
  useEffect(() => {
    // Not during the save / success-message sequence: the saved declaration reloading must not throw the person back to step 1 under the spinner.
    if (locked) return;
    setForm(buildFormState(currentUser, existing));
    setErrors({});
    setStep(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id, currentUser]);

  const set = (patch) => setForm(f => ({ ...f, ...patch }));
  const setSection80C = (key, value) => setForm(f => ({ ...f, section80C: { ...f.section80C, [key]: value } }));
  const setAdditionalDeduction = (key, value) => setForm(f => ({ ...f, additionalDeductions: { ...f.additionalDeductions, [key]: value } }));

  const rentAnnual = (Number(form.monthlyRent) || 0) * 12;
  const rentRequiresLandlord = form.regime === "Old" && rentAnnual > 100000;
  const total80C = computeSection80CTotal(form);
  const totalAdditionalDeductions = computeAdditionalDeductionsTotal(form);
  const totalDeductions = computeDeductionsTotal(form);
  const summary = computeSummary(form);

  const goNext = () => {
    const errs = validateStep(step, form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Please fix the highlighted errors before continuing");
      return;
    }
    setStep(s => Math.min(5, s + 1));
  };

  const goBack = () => setStep(s => Math.max(1, s - 1));

  const handleSubmit = () => {
    const errs = validateDeclaration(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Please fix the highlighted errors before submitting");
      // Jump back to the first step that has an error
      const stepWithError = [1, 2, 3, 4, 5].find(s => Object.keys(validateStep(s, form)).length > 0);
      if (stepWithError) setStep(stepWithError);
      return;
    }
    onSubmit(form);
  };

  return (
    <div className="bg-card rounded-lg border border-border p-5 flex flex-col gap-4 animate-fade-in-up" style={{ animationDelay: "0ms" }}>
      <h3 className="text-sm font-bold text-foreground">
        {existing ? "Edit Income Tax Declaration" : "Income Tax Investment Declaration"}
      </h3>

      <StepHeader step={step} />

      {step === 1 && (
        <div className="flex flex-col gap-3 animate-fade-in-up" style={{ animationDelay: "60ms" }}>
          <h4 className="text-sm font-bold text-foreground">Personal Details</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <FormField label="Employee Name">
              <input value={currentUser.name} disabled className={cn(inputCls, "bg-muted text-muted-foreground")} />
            </FormField>
            <FormField label="Employee Code">
              <input value={currentUser.empCode || ""} disabled className={cn(inputCls, "bg-muted text-muted-foreground")} />
            </FormField>
            <FormField label="Location">
              <input value={form.location || currentUser.location || ""} disabled className={cn(inputCls, "bg-muted text-muted-foreground")} />
            </FormField>
            <FormField label="Financial Year">
              <input value={form.financialYear} disabled className={cn(inputCls, "bg-muted text-muted-foreground")} />
            </FormField>
            <FormField label="PAN Number" required>
              <input value={form.pan} onChange={e => set({ pan: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" maxLength={10}
                className={cn(inputCls, errors.pan && "border-destructive")} />
              {errors.pan && <p className="text-xs text-destructive mt-1">{errors.pan}</p>}
            </FormField>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3 animate-fade-in-up" style={{ animationDelay: "60ms" }}>
          <h4 className="text-sm font-bold text-foreground">Tax Regime Selection <span className="text-destructive" aria-hidden="true">*</span></h4>
          <div className="flex gap-4">
            {["Old", "New"].map(r => (
              <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="regime" checked={form.regime === r} onChange={() => set({ regime: r })} />
                {r} Regime
              </label>
            ))}
          </div>
          {errors.regime && <p className="text-xs text-destructive mt-1">{errors.regime}</p>}

          <div className="border-t border-border pt-3 mt-1 flex flex-col gap-3">
            <h5 className="text-xs font-bold text-foreground uppercase tracking-wide">Salary Structure Declarations</h5>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Sodexo / Pluxee Meal Card">
                <div className="flex gap-4">
                  {[["Yes", true], ["No", false]].map(([label, val]) => (
                    <label key={label} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="sodexoPluxee" checked={form.sodexoPluxee === val} onChange={() => set({ sodexoPluxee: val })} />
                      {label}
                    </label>
                  ))}
                </div>
              </FormField>
              <FormField label="Superannuation Opt-in">
                <div className="flex gap-4">
                  {[["Yes", true], ["No", false]].map(([label, val]) => (
                    <label key={label} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="superAnnuation" checked={form.superAnnuation === val} onChange={() => set({ superAnnuation: val })} />
                      {label}
                    </label>
                  ))}
                </div>
              </FormField>
              <FormField label="Number of Children">
                <input type="number" min="0" step="1" value={form.childrenCount} onChange={e => set({ childrenCount: e.target.value })}
                  className={cn(inputCls, errors.childrenCount && "border-destructive")} />
                {errors.childrenCount && <p className="text-xs text-destructive mt-1">{errors.childrenCount}</p>}
              </FormField>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-3 animate-fade-in-up" style={{ animationDelay: "60ms" }}>
          <h4 className="text-sm font-bold text-foreground">NPS (National Pension Scheme)</h4>
          <FormField label="Are you enrolled in NPS?" required>
            <div className="flex gap-4">
              {[["Yes", true], ["No", false]].map(([label, val]) => (
                <label key={label} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="npsEnrolled" checked={form.npsEnrolled === val} onChange={() => set({ npsEnrolled: val })} />
                  {label}
                </label>
              ))}
            </div>
            {errors.npsEnrolled && <p className="text-xs text-destructive mt-1">{errors.npsEnrolled}</p>}
          </FormField>

          {form.npsEnrolled && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-1 pl-3 border-l-2 border-border">
              <FormField label="Existing NPS subscriber?" required className="col-span-full">
                <div className="flex gap-4">
                  {[["Yes", true], ["No", false]].map(([label, val]) => (
                    <label key={label} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="npsExisting" checked={form.npsExistingSubscriber === val} onChange={() => set({ npsExistingSubscriber: val })} />
                      {label}
                    </label>
                  ))}
                </div>
                {errors.npsExistingSubscriber && <p className="text-xs text-destructive mt-1">{errors.npsExistingSubscriber}</p>}
              </FormField>

              <>
                <FormField label="% of Basic Contribution" required>
                  <LookupSelect lookup={pctBasicLookup} value={form.npsContributionPct}
                    onChange={v => set({ npsContributionPct: v })}
                    invalid={!!errors.npsContributionPct} />
                  {errors.npsContributionPct && <p className="text-xs text-destructive mt-1">{errors.npsContributionPct}</p>}
                </FormField>
                <FormField label="NPS Type">
                  <SearchableSelect value={form.npsType} onChange={v => set({ npsType: v })} options={["Active", "Auto"]} placeholder="Select..." />
                </FormField>
              </>

              {form.npsType === "Active" && (
                <FormField label="Investment Option" required>
                  <LookupSelect lookup={investmentLookup} value={form.npsInvestmentOption}
                    onChange={v => set({ npsInvestmentOption: v })}
                    invalid={!!errors.npsInvestmentOption} />
                  {errors.npsInvestmentOption && <p className="text-xs text-destructive mt-1">{errors.npsInvestmentOption}</p>}
                </FormField>
              )}

              {form.npsExistingSubscriber === false && (
                <>
                  <FormField label="PRAN (12 digits)" required>
                    <input value={form.npsPran} onChange={e => set({ npsPran: e.target.value.replace(/\D/g, "").slice(0, 12) })}
                      className={cn(inputCls, errors.npsPran && "border-destructive")} />
                    {errors.npsPran && <p className="text-xs text-destructive mt-1">{errors.npsPran}</p>}
                  </FormField>
                  <FormField label="Fund Manager" required>
                    <LookupSelect lookup={fundManagerLookup} value={form.npsFundManager}
                      onChange={v => set({ npsFundManager: v })}
                      invalid={!!errors.npsFundManager} />
                    {errors.npsFundManager && <p className="text-xs text-destructive mt-1">{errors.npsFundManager}</p>}
                  </FormField>
                  <FormField label="Personal Email (non-company domain)" required>
                    <input type="email" value={form.npsPersonalEmail} onChange={e => set({ npsPersonalEmail: e.target.value })}
                      placeholder="you@gmail.com" className={cn(inputCls, errors.npsPersonalEmail && "border-destructive")} />
                    {errors.npsPersonalEmail && <p className="text-xs text-destructive mt-1">{errors.npsPersonalEmail}</p>}
                  </FormField>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-4 animate-fade-in-up" style={{ animationDelay: "60ms" }}>
          <h4 className="text-sm font-bold text-foreground">Tax Deductions</h4>
          {form.regime !== "Old" ? (
            <p className="text-sm text-muted-foreground">Deductions are only applicable under the Old Regime. You selected the New Regime, so this step can be skipped.</p>
          ) : (
            <>
              <div className="border-b border-border pb-4">
                <h5 className="text-xs font-bold text-foreground mb-2 uppercase tracking-wide">HRA</h5>
                <FormField label="Monthly Rent Paid" className="md:w-1/3">
                  <input type="number" min="0" value={form.monthlyRent} onChange={e => set({ monthlyRent: e.target.value })} className={inputCls} />
                </FormField>
                {rentRequiresLandlord && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pl-3 border-l-2 border-border mt-3">
                    <p className="text-xs text-muted-foreground md:col-span-3">Annual rent (₹{rentAnnual.toLocaleString("en-IN")}) exceeds ₹1,00,000 — landlord details are mandatory.</p>
                    <FormField label="Landlord PAN" required>
                      <input value={form.landlordPan} onChange={e => set({ landlordPan: e.target.value.toUpperCase() })} maxLength={10}
                        className={cn(inputCls, errors.landlordPan && "border-destructive")} />
                      {errors.landlordPan && <p className="text-xs text-destructive mt-1">{errors.landlordPan}</p>}
                    </FormField>
                    <FormField label="Landlord Name" required>
                      <input value={form.landlordName} onChange={e => set({ landlordName: e.target.value })}
                        className={cn(inputCls, errors.landlordName && "border-destructive")} />
                      {errors.landlordName && <p className="text-xs text-destructive mt-1">{errors.landlordName}</p>}
                    </FormField>
                    <FormField label="House Address" required className="md:col-span-3">
                      <textarea rows={2} value={form.houseAddress} onChange={e => set({ houseAddress: e.target.value })}
                        className={cn(inputCls, "resize-none", errors.houseAddress && "border-destructive")} />
                      {errors.houseAddress && <p className="text-xs text-destructive mt-1">{errors.houseAddress}</p>}
                    </FormField>
                  </div>
                )}
              </div>

              <div className="border-b border-border pb-4">
                <h5 className="text-xs font-bold text-foreground mb-2 uppercase tracking-wide">LTA</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormField label="Opt in for LTA (Leave Travel Allowance)?">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.ltaOpted} onChange={e => set({ ltaOpted: e.target.checked })} />
                    Yes, I want to claim LTA
                  </label>
                </FormField>
                {form.ltaOpted && (
                  <FormField label="% of Basic for LTA" required>
                    <LookupSelect lookup={ltaLookup} value={form.ltaPct} onChange={v => set({ ltaPct: v })}
                      invalid={!!errors.ltaPct} />
                    {errors.ltaPct && <p className="text-xs text-destructive mt-1">{errors.ltaPct}</p>}
                  </FormField>
                )}
                </div>
              </div>

              <div className="border-b border-border pb-4">
                <h5 className="text-xs font-bold text-foreground mb-2 uppercase tracking-wide">Housing Loan Interest</h5>
                <FormField label="Interest Paid on Housing Loan (annual)" className="md:w-1/3">
                  <input type="number" min="0" value={form.housingLoanInterest} onChange={e => set({ housingLoanInterest: e.target.value })}
                    className={cn(inputCls, errors.housingLoanInterest && "border-destructive")} />
                  {errors.housingLoanInterest && <p className="text-xs text-destructive mt-1">{errors.housingLoanInterest}</p>}
                </FormField>
                {Number(form.housingLoanInterest) > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 pl-3 border-l-2 border-border">
                    <FormField label="Lender Name">
                      <input value={form.lenderName} onChange={e => set({ lenderName: e.target.value })} className={inputCls} />
                    </FormField>
                    <FormField label="Lender PAN">
                      <input value={form.lenderPan} onChange={e => set({ lenderPan: e.target.value.toUpperCase() })} maxLength={10}
                        className={cn(inputCls, errors.lenderPan && "border-destructive")} />
                      {errors.lenderPan && <p className="text-xs text-destructive mt-1">{errors.lenderPan}</p>}
                    </FormField>
                    <FormField label="Rent Received (if let-out property)">
                      <input type="number" min="0" value={form.rentReceived} onChange={e => set({ rentReceived: e.target.value })} className={inputCls} />
                    </FormField>
                  </div>
                )}
              </div>

              <div className="border-b border-border pb-4">
                <h5 className="text-xs font-bold text-foreground mb-2 uppercase tracking-wide">Section 80C</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {SECTION_80C_FIELDS.map(f => (
                    <FormField key={f.key} label={f.label}>
                      <input type="number" min="0" value={form.section80C[f.key]}
                        onChange={e => setSection80C(f.key, e.target.value)} className={inputCls} />
                    </FormField>
                  ))}
                </div>
                <p className="text-sm font-semibold text-foreground mt-3">
                  Total 80C: <span className="text-primary">₹{total80C.toLocaleString("en-IN")}</span>
                  <span className="text-xs text-muted-foreground font-normal ml-2">(conceptual ₹1,50,000 cap — not enforced)</span>
                </p>
              </div>

              <div>
                <h5 className="text-xs font-bold text-foreground mb-2 uppercase tracking-wide">Additional Deductions (Chapter VI-A)</h5>
                <div className="grid grid-cols-2 gap-3">
                  {ADDITIONAL_DEDUCTION_FIELDS.map(f => (
                    <FormField key={f.key} label={f.label}>
                      <input type="number" min="0" value={form.additionalDeductions[f.key]}
                        onChange={e => setAdditionalDeduction(f.key, e.target.value)} className={inputCls} />
                    </FormField>
                  ))}
                </div>
                <p className="text-sm font-semibold text-foreground mt-3">
                  Total Additional Deductions: <span className="text-primary">₹{totalAdditionalDeductions.toLocaleString("en-IN")}</span>
                </p>
                <p className="text-sm font-semibold text-foreground mt-1">
                  Total Deductions (80C + Housing Loan + Additional): <span className="text-primary">₹{totalDeductions.toLocaleString("en-IN")}</span>
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {step === 5 && (
        <div className="flex flex-col gap-4 animate-fade-in-up" style={{ animationDelay: "60ms" }}>
          <h4 className="text-sm font-bold text-foreground">Review &amp; Submit</h4>
          <DeclarationSummary declaration={{ ...form, status: "Draft" }} onEdit={() => setStep(1)} hideEditButton />
          <div className="border-t border-border pt-4">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.termsAccepted} onChange={e => set({ termsAccepted: e.target.checked })} className="mt-0.5" />
              I confirm the above declarations are true and I accept the Terms &amp; Conditions. <span className="text-destructive" aria-hidden="true">*</span>
            </label>
            {errors.termsAccepted && <p className="text-xs text-destructive mt-1">{errors.termsAccepted}</p>}
          </div>
        </div>
      )}

      {/* Extra bottom space so the buttons scroll clear of the floating chat button (fixed bottom-right). */}
      <div className="flex gap-2 justify-between border-t border-border pt-4 pb-20 md:pb-24">
        <div>
          {existing && <Btn variant="secondary" size="sm" onClick={onCancel}>Cancel</Btn>}
        </div>
        <div className="flex gap-2">
          {step > 1 && <Btn variant="secondary" size="sm" onClick={goBack}>Back</Btn>}
          {step < 5 && <Btn variant="primary" size="sm" onClick={goNext}>Next</Btn>}
          {step === 5 && <Btn variant="primary" size="sm" onClick={handleSubmit} loading={submitting}>Submit Declaration</Btn>}
        </div>
      </div>
    </div>
  );
}
