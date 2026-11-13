// Visitor registration form rules. Returns { fieldKey: message } -- empty when valid.
export const VISITOR_FIELD_LIMITS = { visitorName: 50, company: 100, purpose: 400, visitorEmail: 155 };
export const VISITOR_NAME_MIN = 3;
export const VISITOR_MAX_PEOPLE = 50;
export const VISITOR_PURPOSE_MIN = 10; // purpose must be 10 to 400 characters

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\d{10}$/; // mobile number: exactly 10 digits

export function validateVisitorForm(f) {
  const e = {};
  if (!f.visitorName.trim()) e.visitorName = "Please enter the visitor name.";
  else if (f.visitorName.trim().length < VISITOR_NAME_MIN) e.visitorName = `Visitor name must be at least ${VISITOR_NAME_MIN} characters.`;
  else if (f.visitorName.trim().length > VISITOR_FIELD_LIMITS.visitorName) e.visitorName = `Visitor name can be at most ${VISITOR_FIELD_LIMITS.visitorName} characters.`;

  if (!f.contactNumber.trim()) e.contactNumber = "Please enter a contact number.";
  else if (!PHONE_RE.test(f.contactNumber.trim())) e.contactNumber = "Contact number must be exactly 10 digits.";

  if (!f.visitorEmail.trim()) e.visitorEmail = "Please enter the visitor email.";
  else if (!EMAIL_RE.test(f.visitorEmail.trim())) e.visitorEmail = "Enter a valid email address.";
  else if (f.visitorEmail.trim().length > VISITOR_FIELD_LIMITS.visitorEmail) e.visitorEmail = `Email can be at most ${VISITOR_FIELD_LIMITS.visitorEmail} characters.`;

  if (!f.company.trim()) e.company = "Please enter the company.";
  else if (f.company.trim().length > VISITOR_FIELD_LIMITS.company) e.company = `Company can be at most ${VISITOR_FIELD_LIMITS.company} characters.`;

  if (!f.purpose.trim()) e.purpose = "Please enter the purpose of the visit.";
  else if (f.purpose.trim().length < VISITOR_PURPOSE_MIN) e.purpose = `Purpose must be at least ${VISITOR_PURPOSE_MIN} characters.`;
  else if (f.purpose.trim().length > VISITOR_FIELD_LIMITS.purpose) e.purpose = `Purpose can be at most ${VISITOR_FIELD_LIMITS.purpose} characters.`;

  const n = Number(f.noOfVisitors);
  if (f.noOfVisitors === "" || !Number.isInteger(n) || n < 1) e.noOfVisitors = "Enter the number of visitors (at least 1).";
  else if (n > VISITOR_MAX_PEOPLE) e.noOfVisitors = `No. of visitors can be at most ${VISITOR_MAX_PEOPLE}.`;

  if (!f.host) e.host = "Please select whom you want to meet.";
  return e;
}
