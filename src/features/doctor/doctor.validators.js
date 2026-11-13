export function validateAppointmentForm(form) {
  const errors = {};
  if (!form.date) errors.date = "Please select a booking date";
  if (!form.start) errors.start = "Please select an available slot";
  return errors;
}

// For the Download Report panel's From Date/To Date/Attended-Status filters.
export function validateReportFilters(filters) {
  const errors = {};
  if (!filters.fromDate) errors.fromDate = "Please select a From Date";
  if (!filters.toDate) errors.toDate = "Please select a To Date";
  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
    errors.toDate = "To Date must be on or after From Date";
  }
  return errors;
}
