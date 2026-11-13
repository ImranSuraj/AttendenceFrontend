// Shapes the HR ticket answers for the screens (the one place to adjust field names).
// KeyValuePair<string,string> serializes as { key, value } — mirrors this app's existing
// ticket.categoryDetails + CATEGORY_FIELD_LABELS rendering convention, just server-built now.
function toCategoryDetails(details) {
  return (details || []).map(d => ({ label: d.key, value: d.value }));
}

export function toTicket(t) {
  return {
    ticketNo: t.ticketNo,
    canUpdate: !!t.canUpdate, // the server decides: only the ticket's assignee (an HR admin only when it has none) may update it; everyone else views
    employeeId: t.employeeId,
    employeeName: t.employeeName,
    category: t.category,
    subCategory: t.subCategory || "",
    description: t.description,
    attachmentName: t.attachmentName || "",
    priority: t.priority,
    status: t.status,
    createdDate: t.createdDate,
    adminRemarks: t.adminRemarks || "",
    lastUpdatedBy: t.lastUpdatedBy || "",
    lastUpdatedByName: t.lastUpdatedByName || "",
    lastUpdatedDate: t.lastUpdatedDate || "",
    categoryDetails: toCategoryDetails(t.categoryDetails),
  };
}
