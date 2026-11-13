// Mirrors LeenaAI.Backend's Common/Files/FileValidationRules.cs exactly -- introduced for
// Policies (originally as multiple attachments per row; a policy is now one row per file, so
// MAX_FILE_COUNT there caps how many files can be selected in one Add action, i.e. how many rows
// get created at once) and HR Support's general ticket "Attach File" field (still genuinely
// multiple attachments per ticket row). Client-side check is just for immediate UX feedback; the
// backend re-validates authoritatively.
export const MAX_FILE_COUNT = 5;
export const MAX_FILE_SIZE_BYTES = 1_000_000; // 1 MB per file
export const MAX_TOTAL_SIZE_BYTES = 5_000_000; // 5 MB total across all files in one selection
export const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".png", ".xlsx", ".docx", ".txt", ".csv"];

function extensionOf(file) {
  const dot = file.name.lastIndexOf(".");
  return dot === -1 ? "" : file.name.slice(dot).toLowerCase();
}

// existingCount = attachments already kept; newFiles = freshly selected File[]; maxCount defaults
// to MAX_FILE_COUNT but callers with a tighter cap (e.g. PoliciesPage's Edit mode, capped to 1
// since Edit only ever replaces a single row's own file) can override it.
// Returns a list of human-readable error strings (empty = valid).
export function validateNewFiles(existingCount, newFiles, maxCount = MAX_FILE_COUNT) {
  const errors = [];
  if (existingCount + newFiles.length > maxCount) {
    errors.push(`You can have a maximum of ${maxCount} file${maxCount === 1 ? "" : "s"} here (${existingCount} already attached).`);
    return errors;
  }
  for (const file of newFiles) {
    // "," is the separator the backend uses to store several on-disk names in one column
    // (PolicyMaster.FileName / HRTicket.AttachmentName) -- rejected here on the original file
    // name so it can never reach that column and be misread as a separator.
    if (file.name.includes(",")) {
      errors.push(`"${file.name}": file name must not contain a comma (,).`);
    }
    if (!ALLOWED_EXTENSIONS.includes(extensionOf(file))) {
      errors.push(`"${file.name}": only ${ALLOWED_EXTENSIONS.join(", ")} files are allowed.`);
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      errors.push(`"${file.name}" exceeds the ${MAX_FILE_SIZE_BYTES / 1_000_000} MB limit.`);
    }
  }
  const totalSize = newFiles.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_TOTAL_SIZE_BYTES) {
    errors.push(`Total upload size exceeds the ${MAX_TOTAL_SIZE_BYTES / 1_000_000} MB limit.`);
  }
  return errors;
}
