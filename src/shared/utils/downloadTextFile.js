import { triggerBlobDownload } from "./blobDownload";

export function downloadTextFile(fileName, content) {
  triggerBlobDownload(new Blob([content], { type: "text/plain" }), fileName);
}
