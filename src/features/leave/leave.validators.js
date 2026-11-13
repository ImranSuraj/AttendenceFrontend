// Checks of the Apply form, shown in red under the field BEFORE anything is sent. They repeat the rules the database procedures enforce
// (usp_v1_ApplyLeave / usp_v1_ApplyOnDuty / usp_v1_ApplyForgotToSwipe), so the person sees the problem at once; the database still checks everything again
// and its own message is shown too. Which dates can be chosen is NOT checked here: the database answers that (usp_v1_GetLeaveApplyDates).

const REMARKS_CHARS = /^[A-Za-z0-9 ,.]*$/;      // on duty and forgot to swipe remarks: letters, numbers, spaces, commas, full stops
const PLACE_CHARS = /^[A-Za-z0-9 ,/]+$/;        // on duty place: letters, numbers, spaces, commas, /
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// currentEmpNo: the signed-in employee, so nobody can choose themselves as the authorised person.
export function validateApplyLeaveForm(form, currentEmpNo) {
  const errors = {};
  if (!form.leaveType) { errors.leaveType = "Leave type is required"; return errors; }
  if (!form.authPerson) errors.authPerson = "Authorized Person is required";
  else if (currentEmpNo && String(form.authPerson).trim().toLowerCase() === String(currentEmpNo).trim().toLowerCase()) errors.authPerson = "You cannot choose yourself as the authorised person.";

  const remarks = String(form.reason || "").trim();

  if (form.leaveType === "Forgot to Swipe") {
    if (!form.singleDate) errors.date = "Please select a date";
    else if (form.singleDate > todayIso()) errors.date = "Cannot apply for a future date.";
    if (!form.forgotReason) errors.forgotReason = "Please select a reason";
    if (form.forgotReason === "Others" && !remarks) errors.remarks = "Remarks are required when Reason is Others.";
    else if (remarks.length > 155) errors.remarks = "Remarks can be at most 155 characters.";
    else if (!REMARKS_CHARS.test(remarks)) errors.remarks = "Remarks can only contain letters, numbers, spaces, commas and full stops.";
    return errors;
  }

  if (!form.startDate || !form.endDate) errors.dates = "Please select start and end dates";
  else if (form.endDate < form.startDate) errors.dates = "End date cannot be before start date";
  else if (form.startDate.slice(0, 4) !== form.endDate.slice(0, 4)) errors.dates = "Start and end date must be in the same year.";

  if (form.leaveType === "On Duty") {
    const place = String(form.place || "").trim();
    if (!place) errors.place = "Place is required";
    else if (!PLACE_CHARS.test(place)) errors.place = "Place can only contain letters, numbers, spaces, commas and /.";
    else if (place.length > 155) errors.place = "Place can be at most 155 characters.";
    if (remarks.length > 155) errors.remarks = "Remarks can be at most 155 characters.";
    else if (!REMARKS_CHARS.test(remarks)) errors.remarks = "Remarks can only contain letters, numbers, spaces, commas and full stops.";
  } else if (remarks.length > 255) {
    errors.remarks = "Remarks can be at most 255 characters.";
  }

  return errors;
}

// The Edit form of the manager's modal. source: leave | onduty | fts.
export function validateManageEditForm(source, form, rangeDateCount) {
  const errors = {};
  const remarks = String(form.remarks || "").trim();
  if (source === "fts") {
    if (!form.date) errors.date = "Please select a date";
    else if (form.date > todayIso()) errors.date = "Cannot apply for a future date.";
    if (!form.reason) errors.reason = "Please select a reason";
    if (form.reason === "Others" && !remarks) errors.remarks = "Remarks are required when Reason is Others.";
    else if (remarks && !REMARKS_CHARS.test(remarks)) errors.remarks = "Remarks can only contain letters, numbers, spaces, commas and full stops.";
    return errors;
  }
  if (!form.fromDate || !form.toDate) errors.dates = "Please select start and end dates";
  else if (form.toDate < form.fromDate) errors.dates = "End date cannot be before start date";
  else if (rangeDateCount === 0) errors.dates = "Select at least one working day (Sundays are not allowed).";
  if (source === "onduty") {
    const place = String(form.place || "").trim();
    if (!place) errors.place = "Place is required";
    else if (!PLACE_CHARS.test(place)) errors.place = "Place can only contain letters, numbers, spaces, commas and /.";
    if (remarks && !REMARKS_CHARS.test(remarks)) errors.remarks = "Remarks can only contain letters, numbers, spaces, commas and full stops.";
  }
  return errors;
}
