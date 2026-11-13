import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { searchHosts } from "../services/visitorRequests.service";
import { useMyPlantCode } from "@/features/employees";

// "Whom you want to meet": a searchable dropdown fed by a live employee search (the list is far too long to
// load up front). Shows "EmployeeName - Department" (department name, never its code). `value` is the picked
// host object { id, name, email, department, label } (or null); `onChange` receives the next one.
export function HostSelect({ value, onChange, departmentNames, invalid, onBlur }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);
  // The hosts are the employees of the signed-in person's own plant (e.g. the Corporate Office), not the whole company.
  const myPlant = useMyPlantCode();

  useEffect(() => {
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setQuery(""); } };
    const onKey = (e) => { if (e.key === "Escape") { setOpen(false); setQuery(""); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setLoading(false); return undefined; }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      searchHosts(q, departmentNames, myPlant)
        .then(rows => { if (!cancelled) setResults(rows); })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, departmentNames, myPlant]);

  const pick = (host) => { onChange(host); setOpen(false); setQuery(""); onBlur?.(); };

  return (
    <div ref={wrapRef} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="listbox"
        className={cn("teams-field w-full flex items-center justify-between py-[5px] px-3 text-sm text-left cursor-pointer", invalid && "border-destructive")}>
        <span className={cn("truncate", !value && "text-muted-foreground")}>{value ? value.label : "Search and select an employee"}</span>
        <ChevronDown size={14} className="text-muted-foreground shrink-0 ml-2"/>
      </button>
      {open && (
        <div className="teams-popover absolute left-0 right-0 top-full mt-1 z-40 bg-card border border-border rounded-md shadow-xl flex flex-col max-h-72">
          <div className="flex items-center gap-2 py-1.5 px-2 border-b border-border shrink-0">
            <Search size={13} className="text-muted-foreground shrink-0"/>
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Type a name or employee number…"
              className="flex-1 text-sm bg-transparent outline-none min-w-0"/>
          </div>
          <div className="overflow-y-auto pb-1.5 flex-1 min-h-0">
            {query.trim().length < 2 ? (
              <p className="text-xs text-muted-foreground py-3 px-3 text-center">Type at least 2 characters to search</p>
            ) : loading && results.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">Searching…</p>
            ) : results.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">No matches</p>
            ) : results.map(h => (
              <button key={h.id} type="button" onClick={() => pick(h)}
                className={cn("w-full text-left px-3 py-1.5 text-sm font-normal bg-transparent border-none cursor-pointer hover:bg-[var(--colorNeutralBackground1Hover)]",
                  value?.id === h.id && "bg-[var(--colorSubtleBackgroundSelected)]")}>
                {h.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
