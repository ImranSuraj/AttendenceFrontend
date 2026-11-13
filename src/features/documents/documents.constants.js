// Fixed lists and values of the Documents screens (Income Tax Declaration).

export const NPS_OPTIONS = ["Conservative", "Moderate", "Aggressive"];
export const FUND_MANAGERS = ["HDFC Pension", "ICICI Pension", "SBI Pension", "LIC Pension"];

export const CURRENT_FY = (() => {
  const now = new Date();
  const y = now.getFullYear();
  // Indian FY: Apr - Mar. If month (0-indexed) >= 3 (April) it's y-(y+1), else (y-1)-y.
  return now.getMonth() >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
})();

// Section 80C fields — `apiKey` is the exact stored-procedure parameter name from the legacy
// ITDeclaration.aspx.cs's InsertITDeclaration/GetEmployeeITDeclarationDetails (the real backend is
// being ported straight from this), used by taxdeclaration.service.js's toApiPayload/
// fromApiDeclaration mapping so this list is the single source of truth for both the UI grid and
// the wire field name.
export const SECTION_80C_FIELDS = [
  { key: "epfVpf", label: "EPF / VPF", apiKey: "epf" },
  { key: "ppf", label: "PPF", apiKey: "ppf" },
  { key: "lifeInsurance", label: "Life Insurance Premium", apiKey: "lifeInsurance" },
  { key: "elss", label: "ELSS", apiKey: "elss" },
  { key: "nsc", label: "NSC", apiKey: "nsc" },
  { key: "homeLoanPrincipal", label: "Home Loan Principal", apiKey: "homeLoanPrincipal" },
  { key: "tuitionFees", label: "Tuition Fees", apiKey: "tuitionFees" },
  { key: "fixedDeposit5yr", label: "Fixed Deposit (5yr)", apiKey: "fixedDeposit" },
  { key: "sukanyaSamriddhi", label: "Sukanya Samriddhi", apiKey: "sukanyaSamriddhi" },
  { key: "stampDuty", label: "Stamp Duty (House Purchase)", apiKey: "stampDuty" },
  { key: "scss", label: "Senior Citizen Savings Scheme", apiKey: "scss" },
  { key: "ulip", label: "ULIP", apiKey: "ulip" },
  { key: "postOfficeDeposit", label: "Post Office Time Deposit", apiKey: "postOfficeDeposit" },
  { key: "superannuationFund", label: "Superannuation Fund", apiKey: "superannuationFund" },
  { key: "pensionPlans", label: "Pension Plans", apiKey: "pensionPlans" },
];

// Additional (Chapter VI-A, beyond 80C) deduction fields — itemized to match the legacy system's
// exact field set, replacing the old free-text "Other Deductions amount + description" pair (the
// legacy has no generic catch-all bucket, it's fully itemized).
export const ADDITIONAL_DEDUCTION_FIELDS = [
  { key: "nps80CCD1", label: "NPS Additional Contribution (80CCD(1B))", apiKey: "nps80CCD1" },
  { key: "atalPension80CCD", label: "Atal Pension Yojana (80CCD)", apiKey: "atalPension80CCD" },
  { key: "educationLoan80E", label: "Education Loan Interest (80E)", apiKey: "educationLoan80E" },
  { key: "electricVehicleLoan80EEB", label: "Electric Vehicle Loan Interest (80EEB)", apiKey: "electricVehicleLoan80EEB" },
  { key: "medicalInsurance80D1", label: "Medical Insurance — Self & Family (80D)", apiKey: "medicalInsurance80D1" },
  { key: "medicalInsurance80D2", label: "Medical Insurance — Parents (80D)", apiKey: "medicalInsurance80D2" },
  { key: "medicalInsurance80D3", label: "Preventive Health Checkup (80D)", apiKey: "medicalInsurance80D3" },
  { key: "medicalTreatment80DD", label: "Medical Treatment — Disabled Dependent (80DD)", apiKey: "medicalTreatment80DD" },
  { key: "medicalTreatment80DDB", label: "Medical Treatment — Specified Disease (80DDB)", apiKey: "medicalTreatment80DDB" },
  { key: "disability80U", label: "Self Disability (80U)", apiKey: "disability80U" },
  { key: "donations80GGC", label: "Donations (80GGC)", apiKey: "donations80GGC" },
];
