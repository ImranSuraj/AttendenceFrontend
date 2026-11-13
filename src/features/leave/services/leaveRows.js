// The row shape LeavePage's table expects, shared by the three request types (leave, on duty, forgot to swipe).
// ---- Listing (normalized into LeavePage's table row shape) --------------------------------

export function toTableRow(source, requestNo, base) {
  return { id: `${source}-${requestNo}`, _source: source, _requestNo: requestNo, ...base };
}
