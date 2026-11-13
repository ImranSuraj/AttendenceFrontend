import { CheckCircle2, Pencil, Lock } from "lucide-react";
import { Btn } from "@/shared/components/Btn";
import { StatusBadge } from "@/shared/components/StatusBadge";
import {
  computeSection80CTotal, computeAdditionalDeductionsTotal, computeSummary,
} from "../documents.validators";
import { SECTION_80C_FIELDS, ADDITIONAL_DEDUCTION_FIELDS } from "../documents.constants";

// canEdit: gates the Edit button — false once the employee has already used their one edit and
// HRAdmin hasn't granted another (see CLAUDE.md's note on this hook point + AdminPanel.jsx).
// Defaults to true so the step-5 wizard preview (which always passes hideEditButton anyway) and
// any other pre-existing caller keep their previous behavior unchanged.
// The declaration PDF is downloaded from the Documents tab ("IT Declaration"), not from here.
export default function DeclarationSummary({ declaration, onEdit, hideEditButton, canEdit = true }) {
  const summary = computeSummary(declaration);
  const total80C = computeSection80CTotal(declaration);
  const totalAdditionalDeductions = computeAdditionalDeductionsTotal(declaration);

  const rows = [
    { label: "Financial Year", value: declaration.financialYear },
    { label: "Location", value: declaration.location || "—" },
    { label: "Tax Regime", value: `${declaration.regime} Regime` },
    { label: "PAN", value: declaration.pan },
    { label: "Sodexo / Pluxee Meal Card", value: declaration.sodexoPluxee ? "Yes" : "No" },
    { label: "Superannuation Opt-in", value: declaration.superAnnuation ? "Yes" : "No" },
    ...(Number(declaration.childrenCount) > 0 ? [{ label: "Number of Children", value: declaration.childrenCount }] : []),
    { label: "NPS Enrolled", value: declaration.npsEnrolled ? "Yes" : "No" },
    ...(declaration.npsEnrolled ? [
      { label: "NPS Contribution", value: `${summary.npsContributionPct}% of Basic` },
      ...(declaration.npsType ? [{ label: "NPS Type", value: declaration.npsType }] : []),
      ...(declaration.npsInvestmentOption ? [{ label: "NPS Investment Option", value: declaration.npsInvestmentOption }] : []),
      ...(declaration.npsExistingSubscriber === false ? [
        { label: "PRAN", value: declaration.npsPran },
        { label: "Fund Manager", value: declaration.npsFundManager },
        { label: "Personal Email", value: declaration.npsPersonalEmail },
      ] : []),
    ] : []),
    ...(declaration.regime === "Old" ? [
      { label: "Monthly Rent", value: `₹${(Number(declaration.monthlyRent) || 0).toLocaleString("en-IN")}` },
      { label: "Annual Rent", value: `₹${summary.annualRent.toLocaleString("en-IN")}` },
      ...(declaration.landlordName ? [{ label: "Landlord", value: `${declaration.landlordName} (${declaration.landlordPan})` }] : []),
      { label: "LTA Opted", value: declaration.ltaOpted ? `Yes — ${summary.ltaPct}% of Basic` : "No" },
      { label: "Housing Loan Interest", value: `₹${(Number(declaration.housingLoanInterest) || 0).toLocaleString("en-IN")}` },
      ...(declaration.lenderName ? [{ label: "Lender", value: `${declaration.lenderName} (${declaration.lenderPan})` }] : []),
      ...(Number(declaration.rentReceived) > 0 ? [{ label: "Rent Received (Let-out Property)", value: `₹${(Number(declaration.rentReceived) || 0).toLocaleString("en-IN")}` }] : []),
      { label: "Section 80C Total", value: `₹${total80C.toLocaleString("en-IN")}` },
      { label: "Additional Deductions Total", value: `₹${totalAdditionalDeductions.toLocaleString("en-IN")}` },
      { label: "Total Deductions", value: `₹${summary.totalDeductions.toLocaleString("en-IN")}` },
    ] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg p-3 animate-fade-in-up" style={{ animationDelay: "0ms" }}>
        <CheckCircle2 size={18} className="animate-pop-in" />
        <div className="flex-1">
          <p className="text-sm font-semibold">{hideEditButton ? "Review your declaration" : "Declaration Submitted"}</p>
          {declaration.submittedOn && <p className="text-xs opacity-80">Submitted on {declaration.submittedOn}</p>}
        </div>
        <StatusBadge status={declaration.status || "Submitted"} />
      </div>

      {!hideEditButton && (
        <div className="flex justify-end gap-2 animate-fade-in-up" style={{ animationDelay: "30ms" }}>
          {canEdit ? (
            <Btn variant="secondary" size="sm" onClick={onEdit}>
              <Pencil size={14} /> Edit Declaration
            </Btn>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground italic px-1">
              <Lock size={12} /> Editing locked — contact HR
            </span>
          )}
        </div>
      )}

      <div className="bg-card rounded-lg border border-border divide-y divide-border animate-fade-in-up" style={{ animationDelay: "60ms" }}>
        {rows.map(r => (
          <div key={r.label} className="py-2.5 px-4 flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{r.label}</span>
            <span className="text-sm font-medium text-foreground text-right">{r.value}</span>
          </div>
        ))}
      </div>

      {declaration.regime === "Old" && (
        <div className="bg-card rounded-lg border border-border p-4 animate-fade-in-up" style={{ animationDelay: "120ms" }}>
          <h4 className="text-sm font-bold text-foreground mb-2">Section 80C Breakdown</h4>
          <div className="flex flex-col gap-1.5">
            {SECTION_80C_FIELDS.map(f => (
              <div key={f.key} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{f.label}</span>
                <span className="font-medium text-foreground">₹{(Number(declaration.section80C?.[f.key]) || 0).toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {declaration.regime === "Old" && totalAdditionalDeductions > 0 && (
        <div className="bg-card rounded-lg border border-border p-4 animate-fade-in-up" style={{ animationDelay: "150ms" }}>
          <h4 className="text-sm font-bold text-foreground mb-2">Additional Deductions Breakdown</h4>
          <div className="flex flex-col gap-1.5">
            {ADDITIONAL_DEDUCTION_FIELDS.filter(f => Number(declaration.additionalDeductions?.[f.key]) > 0).map(f => (
              <div key={f.key} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{f.label}</span>
                <span className="font-medium text-foreground">₹{(Number(declaration.additionalDeductions?.[f.key]) || 0).toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
