// Date helpers of the Admin screens.
// yyyy-MM-dd of a Date in the browser's own time zone
export const toIso = (d) => d.toLocaleDateString("en-CA");
export const todayIso = () => toIso(new Date());
export const yesterdayIso = () => toIso(new Date(Date.now() - 24 * 60 * 60 * 1000));
export const firstOfMonthIso = () => { const d = new Date(); return toIso(new Date(d.getFullYear(), d.getMonth(), 1)); };
// "2026-11-05..." -> "05/11/2026"
export const dmy = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? "")); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };