
// Central helper for every "save this Blob as a file" download in the app (previously duplicated,
// slightly differently, in 6+ places -- some revoked the object URL immediately after .click(),
// which can race the browser's own async handling of the download and occasionally let it fall
// back to opening the content instead of saving it). Also force-wraps the blob as generic
// application/octet-stream before creating the object URL -- octet-stream is never eligible for
// inline/browser-native rendering, so a PDF/image can't be opened in a viewer tab instead of
// downloaded, regardless of the browser's own content-type-based heuristics.
export function triggerBlobDownload(blob, fileName) {
  const forcedBlob = blob.type === "application/octet-stream"
    ? blob
    : new Blob([blob], { type: "application/octet-stream" });
  const url = URL.createObjectURL(forcedBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a short delay, not immediately -- the browser can still be processing the
  // click-triggered download asynchronously; revoking too early can interrupt it.
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
