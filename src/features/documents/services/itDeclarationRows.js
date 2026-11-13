import { SECTION_80C_FIELDS, ADDITIONAL_DEDUCTION_FIELDS } from "../documents.constants";

const numOrEmpty = (v) => (v === "" || v === undefined || v === null ? "" : Number(v));

// ---- form (UI/JS shape) -> API payload --------------------------------------------------------
export function toApiPayload(form) {
  return {
    employeeCode: form.employeeId,
    employeeName: form.employeeName,
    pan: (form.pan || "").trim().toUpperCase(),
    location: form.location || "",
    financialYear: form.financialYear,

    sodexoPluxee: !!form.sodexoPluxee,
    childrenCount: form.childrenCount === "" ? null : Number(form.childrenCount),
    superAnnuation: !!form.superAnnuation,

    regime: form.regime,
    npsEnrolled: !!form.npsEnrolled,
    npsExistingSubscriber: !!form.npsExistingSubscriber,
    npsContributionPct: form.npsEnrolled ? numOrEmpty(form.npsContributionPct) : null,
    npsPran: form.npsPran || "",
    npsFundManager: form.npsFundManager || "",
    npsPersonalEmail: form.npsPersonalEmail || "",
    npsType: form.npsType || "",
    npsInvestmentOption: form.npsInvestmentOption || "",

    monthlyRent: numOrEmpty(form.monthlyRent) || 0,
    landlordName: form.landlordName || "",
    landlordPan: (form.landlordPan || "").trim().toUpperCase(),
    houseAddress: form.houseAddress || "",

    ltaOpted: !!form.ltaOpted,
    ltaPct: form.ltaOpted ? numOrEmpty(form.ltaPct) : null,

    housingLoanInterest: numOrEmpty(form.housingLoanInterest) || 0,
    lenderName: form.lenderName || "",
    lenderPan: (form.lenderPan || "").trim().toUpperCase(),
    rentReceived: numOrEmpty(form.rentReceived) || 0,

    section80C: Object.fromEntries(SECTION_80C_FIELDS.map(f => [f.key, numOrEmpty(form.section80C?.[f.key]) || 0])),
    additionalDeductions: Object.fromEntries(ADDITIONAL_DEDUCTION_FIELDS.map(f => [f.key, numOrEmpty(form.additionalDeductions?.[f.key]) || 0])),

    // The backend re-checks the Terms & Conditions box (SubmitITDeclarationRequest.TermsAccepted defaults to false), so it has to be sent.
    termsAccepted: !!form.termsAccepted,
  };
}

// ---- API row -> form/declaration (UI/JS shape) ------------------------------------------------
export function fromApiDeclaration(row) {
  if (!row) return null;
  return {
    id: `TD-${row.employeeId}-${row.financialYear}`,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    financialYear: row.financialYear,
    location: row.location || "",

    regime: row.regime || "",
    pan: row.pan || "",
    sodexoPluxee: row.sodexoPluxee ?? null,
    childrenCount: numOrEmpty(row.childrenCount),
    superAnnuation: row.superAnnuation ?? null,

    npsEnrolled: row.npsEnrolled ?? null,
    npsExistingSubscriber: row.npsExistingSubscriber ?? null,
    npsType: row.npsType || "",
    npsContributionPct: numOrEmpty(row.npsContributionPct),
    npsInvestmentOption: row.npsInvestmentOption || "",
    npsPran: row.npsPran || "",
    npsFundManager: row.npsFundManager || "",
    npsPersonalEmail: row.npsPersonalEmail || "",

    monthlyRent: numOrEmpty(row.monthlyRent),
    landlordName: row.landlordName || "",
    landlordPan: row.landlordPan || "",
    houseAddress: row.houseAddress || "",

    ltaOpted: row.ltaOpted ?? false,
    ltaPct: numOrEmpty(row.ltaPct),

    housingLoanInterest: numOrEmpty(row.housingLoanInterest),
    lenderName: row.lenderName || "",
    lenderPan: row.lenderPan || "",
    rentReceived: numOrEmpty(row.rentReceived),

    section80C: Object.fromEntries(SECTION_80C_FIELDS.map(f => [f.key, numOrEmpty(row.section80C?.[f.key])])),
    additionalDeductions: Object.fromEntries(ADDITIONAL_DEDUCTION_FIELDS.map(f => [f.key, numOrEmpty(row.additionalDeductions?.[f.key])])),

    termsAccepted: true,
    status: row.status || "Submitted",
    submittedOn: row.submittedOn || "",
    canEdit: row.canEdit !== false,
    documentName: row.documentName || "",
  };
}
