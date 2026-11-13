import { useState, useMemo, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Search, FileSpreadsheet, AlertCircle, ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../utils/cn";
import { downloadExcelFile } from "../utils/downloadExcelFile";

// Generic data table. Toolbar intentionally has Search / Excel export only
// (no copy-to-clipboard button, no Print) — shared by every module's table.
// On a narrow screen the table scrolls sideways with its header kept in view; the table's own filters (titleExtra / filterExtra) stay in the toolbar and wrap onto more lines.
export function DataTable({ columns, data, title, exportFileName, actions, filterExtra, hideExport, hideSearch, exportColumns, titleExtra, compact, toolbarExtra, exportData, bodyMaxHeight, noPagination }) {
  const rowPad = compact ? "py-1" : "py-2.5";
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading] = useState(false);
  // Fluent (Teams) table header: a plain, slightly tinted row with semibold text, not a filled colour bar.
  const headBg = "color-mix(in srgb, var(--muted) 45%, var(--card))";
  const headFg = "var(--foreground)";

  const filtered = useMemo(() => {
    let d = data;
    if (search) {
      const q = search.toLowerCase();
      // a column may supply its own searchable text (col.text) when its cell shows something computed from several fields
      d = d.filter(row => columns.some(c => String(c.text ? c.text(row) : (row[c.key] ?? "")).toLowerCase().includes(q)));
    }
    if (sortKey) {
      const sortCol = columns.find(c => String(c.key) === sortKey);
      const sortOf = (r) => String(sortCol?.sortValue ? sortCol.sortValue(r) : (r[sortKey] ?? ""));  // col.sortValue: a sortable form of a computed cell
      d = [...d].sort((a, b) => {
        const av = sortOf(a);
        const bv = sortOf(b);
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return d;
  }, [data, search, sortKey, sortDir, columns]);

  const sortableCols = columns.filter(c => c.sortable !== false);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = noPagination ? filtered : filtered.slice((page-1)*pageSize, page*pageSize);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  useEffect(() => { setPage(1); }, [search]);

  // Exports whatever the search box currently filtered to (not just the visible page) --
  // col.render is only used when it returns a plain string/number (a formatted date, a status
  // label); a render that returns JSX (a badge, an icon button) falls back to the raw field value
  // so the CSV never ends up with a literal "[object Object]" cell.
  const cellText = (row, col) => {
    if (col.render) {
      const rendered = col.render(row);
      if (typeof rendered === "string" || typeof rendered === "number") return String(rendered);
    }
    const raw = row[col.key];
    return raw == null ? "" : String(raw);
  };

  const exportExcel = () => {
    // exportColumns (optional) lets a table export more fields than it shows on screen.
    const exportCols = exportColumns || columns;
    const headers = exportCols.map(c => c.label);
    // exportData (optional): the rows to export when they should not be the ones currently shown (e.g. every tab, not just the open one).
    const rows = (exportData || filtered).map(row => exportCols.map(c => cellText(row, c)));
    downloadExcelFile(`${(exportFileName || title || "export").replace(/[^\w-]+/g, "_")}.xls`, headers, rows);
    toast.success("Excel exported");
  };

  return (
    <div className={cn("bg-card rounded-lg border border-border shadow-sm overflow-hidden")}>
      {/* Toolbar — omitted entirely when title/filterExtra/search/export are ALL absent, rather
          than always rendering this row: with nothing to show, its own p-4/border-b styling was
          rendering as a bare empty bar above the table header (confirmed live — a modal's
          `hideSearch hideExport`-only DataTable with no title had nowhere else for that space to
          go). Every existing caller already passes at least one of these, so this only changes
          behavior for that all-hidden case. */}
      {(title || filterExtra || toolbarExtra || !hideSearch || !hideExport) && (
        <div className="flex flex-col items-stretch gap-3 p-3 md:p-4 border-b border-border sm:flex-row sm:items-center">
          {title && <h3 className={cn("font-semibold text-foreground", !titleExtra && "mr-auto")}>{title}</h3>}
          {/* Optional controls placed right after the title, on the same row. */}
          {titleExtra && <div className="flex items-center gap-2 flex-wrap mr-auto">{titleExtra}</div>}
          <div className="flex items-center gap-2 ml-auto flex-wrap max-sm:w-full">
            {!hideSearch && (
              <div className="relative max-md:flex-1 max-md:min-w-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="py-[5px] max-md:h-[32px] md:py-1.5 pl-8 pr-3 text-sm border border-border rounded-md bg-input-background w-full md:w-48 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
            {filterExtra}
            {toolbarExtra}
            {!hideExport && (
              <button onClick={exportExcel} aria-label="Export to Excel" className="flex items-center justify-center gap-1.5 max-md:h-[32px] max-md:w-[32px] max-md:px-0 py-1.5 px-3 text-sm md:text-xs font-medium border border-border rounded-md bg-transparent cursor-pointer transition-colors hover:bg-muted shrink-0" title="Export Excel">
                <FileSpreadsheet size={13} className="max-md:w-5 max-md:h-5" /> <span className="max-md:hidden">Excel</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      {/* The wrapper scrolls BOTH ways (a sticky header sticks to its nearest scrolling ancestor, so an
          overflow-x-only wrapper made it scroll away with the rows). Rows scroll under the header while the
          page stays put; the Actions column stays pinned on the left. */}
      {/* bodyMaxHeight (optional): the height the rows may use before they scroll. A table inside a dialog passes a smaller one so its pagination below stays on screen. */}
      <div className="overflow-auto min-h-[120px]" style={{ maxHeight: bodyMaxHeight ?? "calc(100vh - 260px)" }}>
        <table className="w-full text-sm border-collapse">
          <thead>
            {/* Background/text color are set inline on the row AND every cell, not just via
                bg-primary/text-primary-foreground — those Tailwind JIT classes occasionally fail
                to regenerate (a known Vite+Tailwind v4 gap: seen both after a dev-mode HMR update
                and after a plain click-triggered re-render, e.g. sorting), which otherwise left
                the header looking blank/white until a full page reload. Setting the same inline
                style on each <th> too (not just the parent <tr>) means a header cell's own paint
                never depends on background inheriting cleanly from its row. */}
            <tr className="border-b border-border" style={{ backgroundColor: headBg, color: headFg }}>
              {actions && (
                <th className="py-2.5 px-4 text-left font-semibold text-sm whitespace-nowrap select-none sticky top-0 left-0 z-30 border-r border-border"
                  style={{ backgroundColor: headBg, color: headFg, boxShadow: "inset 0 -1px 0 var(--border)" }}>
                  Actions
                </th>
              )}
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  onClick={() => col.sortable !== false && handleSort(String(col.key))}
                  className={cn(
                    "py-2.5 px-4 text-left font-semibold text-sm whitespace-nowrap select-none sticky top-0 z-20",
                    col.sortable !== false && "cursor-pointer transition-colors hover:bg-muted"
                  )}
                  style={{ backgroundColor: headBg, color: headFg, boxShadow: "inset 0 -1px 0 var(--border)", ...(col.width ? { width: col.width } : null) }}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable !== false && (
                      sortKey === String(col.key)
                        ? (sortDir === "asc" ? <ChevronUp size={13}/> : <ChevronDown size={13}/>)
                        : <ArrowUpDown size={12} className="opacity-50"/>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border transition-colors">
                  {columns.map((_, j) => (
                    <td key={j} className="py-3 px-4">
                      <div className="h-4 bg-muted rounded-lg animate-pulse" style={{ width: `${60+((i*j*7)%40)}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="py-12 px-4 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle size={32} className="opacity-30" />
                    <p className="font-medium">No records found</p>
                    <p className="text-xs">Try adjusting your search or filters</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map((row, ri) => (
                <tr key={ri} className="border-b border-border transition-colors hover:bg-muted/50">
                  {actions && (
                    <td className={cn(rowPad, "px-4 sticky left-0 z-10 bg-card border-r border-border")}>
                      <div className="flex items-center gap-1">{actions(row)}</div>
                    </td>
                  )}
                  {columns.map(col => (
                    <td key={String(col.key)} className={cn(rowPad, "px-4 whitespace-nowrap text-foreground")}>
                      {col.render ? col.render(row) : String(row[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination (noPagination: a short list shows every row and a record count instead) */}
      {noPagination ? (
        <div className="py-2 px-4 max-md:px-2.5 border-t border-border bg-muted/20 text-xs text-muted-foreground">{filtered.length} records</div>
      ) : (
      <div className="flex flex-col items-center justify-between gap-3 py-3 px-4 max-md:py-1.5 max-md:px-2.5 border-t border-border bg-muted/20 sm:flex-row">
        <span className="max-md:hidden text-xs text-muted-foreground">
          Showing {filtered.length === 0 ? 0 : (page-1)*pageSize+1}–{Math.min(page*pageSize, filtered.length)} of {filtered.length} records
        </span>
        <div className="flex items-center gap-2 max-md:w-full max-md:justify-between">
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="ec-compact shrink-0 whitespace-nowrap text-sm md:text-xs border border-border rounded-lg h-[32px] md:h-auto py-0 md:py-1 px-2 bg-card focus:outline-none"
          >
            {[5,10,25,50].map(n => <option key={n} value={n}>{n} / page</option>)}
          </select>
          {/* Phones: the range and the page on the same slim row as the controls (the longer "Showing ..." line is for tablet and desktop). */}
          <span className="md:hidden text-xs text-muted-foreground whitespace-nowrap tabular-nums">{filtered.length === 0 ? 0 : (page-1)*pageSize+1}–{Math.min(page*pageSize, filtered.length)} of {filtered.length}</span>
          <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} aria-label="Previous page"
            className="flex items-center justify-center w-[32px] h-[32px] md:w-auto md:h-auto p-1 rounded-lg border border-border bg-transparent cursor-pointer transition-colors hover:enabled:bg-muted disabled:opacity-40 disabled:cursor-not-allowed">
            <ChevronLeft size={14}/>
          </button>
          {/* Phones: a short "page / pages" label instead of numbered buttons, which do not fit and pushed the later pages off the screen. */}
          <span className="md:hidden text-sm font-medium whitespace-nowrap tabular-nums" aria-live="polite">{page}/{totalPages}</span>
          <div className="hidden md:contents">
          {Array.from({ length: Math.min(5,totalPages) }, (_, i) => {
            const pg = totalPages <= 5 ? i+1 : Math.max(1, Math.min(totalPages-4, page-2)) + i;
            return (
              <button key={pg} onClick={() => setPage(pg)}
                className={cn(
                  "w-10 h-11 md:w-7 md:h-7 text-sm md:text-xs rounded-lg border cursor-pointer transition-colors",
                  // bg-transparent only on the other pages: on every button it competed with bg-primary, so the
                  // current page's box could lose its colour.
                  page===pg ? "bg-primary text-primary-foreground border-primary font-semibold"
                            : "bg-transparent border-border hover:bg-muted"
                )}
                aria-current={page===pg ? "page" : undefined}>
                {pg}
              </button>
            );
          })}
          </div>
          <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages} aria-label="Next page"
            className="flex items-center justify-center w-[32px] h-[32px] md:w-auto md:h-auto p-1 rounded-lg border border-border bg-transparent cursor-pointer transition-colors hover:enabled:bg-muted disabled:opacity-40 disabled:cursor-not-allowed">
            <ChevronRight size={14}/>
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
