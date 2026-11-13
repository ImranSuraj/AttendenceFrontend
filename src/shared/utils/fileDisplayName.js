// Every real upload in this app stores the on-disk name as
// "{original-base-name}_{8-digit-random}.{extension}" (backend's FileNaming.BuildUniqueFileName).
// The UI must never show that random suffix to the user -- this strips it back off for display,
// leaving the DB/disk value (the only thing ever sent to the server) untouched.
//
// The original base name can itself contain underscores (spaces/dots get sanitized to "_"), so
// this is parsed strictly from the END, not by scanning forward: split off the extension after
// the LAST ".", then the LAST "_"-separated segment before that is the random suffix (only if it's
// exactly 8 digits) -- everything before it is the real display name, whatever underscores it has.
export function toDisplayFileName(fileName) {
  if (!fileName) return fileName;

  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1) return fileName;

  const base = fileName.slice(0, lastDot);
  const extension = fileName.slice(lastDot);
  const lastUnderscore = base.lastIndexOf("_");
  if (lastUnderscore === -1) return fileName;

  const suffix = base.slice(lastUnderscore + 1);
  if (!/^\d{8}$/.test(suffix)) return fileName;

  return base.slice(0, lastUnderscore) + extension;
}
