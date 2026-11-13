import { useState, useRef, useEffect, useMemo } from "react";
import { Search, X, RefreshCw } from "lucide-react";
import { searchEmployees } from "@/features/employees";

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const isEmail = (s) => EMAIL_RE.test(String(s).trim());

function initialsOf(name) {
  return name ? name.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase() : "?";
}

// Real-employee multi-picker for Conference Room booking's Participants field (replaces the old
// plain numeric "Attendees" input). Live, debounced search against spv1_SearchEmployees (a
// bounded, ACTIVE-only, any-authenticated-employee typeahead) rather than filtering useEmployees()
// in-memory — CONFIRMED REAL BUG, since fixed: useEmployees() (spv1_GetEmployeeProfile's listing
// mode) returns ONLY the caller's own record for any non-HRAdmin viewer, so every search here
// came back "No matches" for anyone but yourself unless simulating HRAdmin. spv1_SearchEmployees
// is a deliberately separate, narrower capability (bounded top 20, no full-directory browsing)
// available to any employee, matching what "invite a colleague to a meeting" actually needs.
//
// Anyone outside AMS can be added by typing their email address (Enter, or click the "Add" row):
// such entries are stored in the same array as the raw email string, shown as an "external" chip.
//
// `value` is the array of already-picked employee ids (or external emails); `onChange` receives the whole next array.
// `excludeIds` (e.g. the organizer/CURRENT_USER) are hidden from results and can never be
// re-added — combined here with already-picked ids so neither shows up twice.
export function EmployeeMultiPicker({ value, onChange, excludeIds = [] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  // id -> resolved {id,name,...}, since there's no local full directory to look these up in
  // anymore. Populated immediately for a newly-added participant (the search result object is
  // already on hand); resolved via a fresh exact-empno search for ids the picker is handed
  // up front (editing an existing booking's already-saved participantIds).
  const [resolvedById, setResolvedById] = useState({});
  const wrapperRef = useRef(null);

  useEffect(() => {
    const unresolved = value.filter(id => !isEmail(id) && !resolvedById[id]);
    if (unresolved.length === 0) return;
    Promise.all(unresolved.map(id => searchEmployees(id).then(rows => rows.find(e => e.id === id))))
      .then(found => {
        const additions = {};
        found.forEach((emp, i) => { if (emp) additions[unresolved[i]] = emp; });
        if (Object.keys(additions).length) setResolvedById(prev => ({ ...prev, ...additions }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    function onDocClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    function onKeyDown(e) {
      if (e.key === "Escape") { setOpen(false); setQuery(""); }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const excludeSet = useMemo(() => new Set([...excludeIds, ...value]), [excludeIds, value]);

  // Debounced live search — 300ms after the user stops typing, not on every keystroke.
  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(() => {
      searchEmployees(q)
        .then(rows => setResults(rows.filter(e => !excludeSet.has(e.id))))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const picked = useMemo(
    () => value.map(id => (isEmail(id) ? { id, name: id, external: true } : resolvedById[id])).filter(Boolean),
    [value, resolvedById]
  );

  const typedEmail = query.trim().toLowerCase();
  const canAddTypedEmail = isEmail(typedEmail) && !value.some(v => v.toLowerCase() === typedEmail);
  const addTypedEmail = () => {
    if (!canAddTypedEmail) return;
    onChange([...value, typedEmail]);
    setQuery("");
  };

  const addParticipant = (emp) => {
    onChange([...value, emp.id]);
    setResolvedById(prev => ({ ...prev, [emp.id]: emp }));
    setQuery("");
  };
  const removeParticipant = (id) => onChange(value.filter(v => v !== id));

  return (
    <div ref={wrapperRef} className="flex flex-col gap-2">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"/>
        <input
          value={query}
          // Browser autofill / saved-entry suggestions are switched off here: this box searches employees
          // (and takes an email), so the browser's own suggestion list would only get in the way.
          type="text"
          name="participant-search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          data-form-type="other"
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTypedEmail(); } }}
          placeholder="Search employee, or type an email to invite someone outside TTK..."
          className="w-full border border-border rounded-md py-2 pl-8 pr-3 text-sm bg-input-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {open && query.trim() && (
          <div className="absolute z-30 left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg max-h-44 overflow-y-auto">
            {loading ? (
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground py-2.5"><RefreshCw size={12} className="animate-spin"/> Searching…</p>
            ) : results.length === 0 && !canAddTypedEmail ? (
              <p className="text-xs text-muted-foreground py-2.5 text-center">No matches</p>
            ) : (
              <>
              {canAddTypedEmail && (
                <button type="button" onClick={addTypedEmail}
                  className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm bg-transparent border-none cursor-pointer transition-colors hover:bg-secondary">
                  <span className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center text-[10px] font-bold shrink-0">@</span>
                  <span className="truncate">Add <b>{typedEmail}</b> <span className="text-muted-foreground">(external)</span></span>
                </button>
              )}
              {results.map(e => (
                <button key={e.id} type="button" onClick={() => addParticipant(e)}
                  className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm bg-transparent border-none cursor-pointer transition-colors hover:bg-secondary">
                  <span className="w-6 h-6 rounded-full bg-[#5B5FC7] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                    {initialsOf(e.name)}
                  </span>
                  <span className="truncate">{e.name} <span className="text-muted-foreground">({e.empCode || e.id})</span></span>
                </button>
              ))}
              </>
            )}
          </div>
        )}
      </div>

      {picked.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {picked.map(e => (
            <span key={e.id} className="flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-full bg-secondary text-xs">
              <span className="w-5 h-5 rounded-full bg-[#5B5FC7] flex items-center justify-center text-white text-[8px] font-bold shrink-0">
                {e.external ? "@" : initialsOf(e.name)}
              </span>
              <span className="text-foreground">{e.name}</span>
              <button type="button" onClick={() => removeParticipant(e.id)} title="Remove"
                className="p-0.5 rounded-full border-none bg-transparent cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted">
                <X size={10}/>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
