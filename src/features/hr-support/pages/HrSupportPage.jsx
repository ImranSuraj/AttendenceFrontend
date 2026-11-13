import { useState, useMemo, useEffect, useRef } from "react";
import { Plus, Eye, Pencil, RefreshCw, User, Users, Paperclip, X, Download } from "lucide-react";
import { toast } from "sonner";
import { UploadProgress } from "@/shared/components/UploadProgress";
import { cn } from "@/shared/utils/cn";
import { currentMonthRange } from "@/shared/utils/date";
import { useNavIntent } from "@/shared/navigation/navIntent";
import { emailLinkRange } from "@/shared/navigation/deepLink";
import { Modal, FormField, inputCls } from "@/shared/components/Modal";
import { Btn } from "@/shared/components/Btn";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { DataTable } from "@/shared/components/DataTable";
import { SearchableSelect } from "@/shared/components/SearchableSelect";
import { Spinner } from "@/shared/components/Spinner";
import { useServiceDeskQuery, useServiceDeskMutations, useHRMasterDataQuery } from "../hooks/useHrSupportQuery";
import { downloadTicketAttachments } from "../services/hrTickets.service";
import { validateNewTicketForm } from "../hr-support.validators";
import { useCurrentUser } from "@/features/employees";
import { useHasRole, useHasExactRole } from "@/shared/access/access.store";
import { CountUp } from "@/shared/components/CountUp";
import { toDisplayFileName } from "@/shared/utils/fileDisplayName";
import { validateNewFiles, MAX_FILE_COUNT, MAX_FILE_SIZE_BYTES, MAX_TOTAL_SIZE_BYTES, ALLOWED_EXTENSIONS } from "@/shared/utils/fileValidation";
import { triggerBlobDownload } from "@/shared/utils/blobDownload";
import { DatePickerCalendar } from "@/shared/components/DatePickerCalendar";

// Strictly sequential, forward-only status workflow: OPEN -> ACKNOWLEDGED -> CLOSED, one step at
// a time, no skipping, no going back -- enforced server-side too (spv1_HRTicketSave's
// UPDATE_STATUS branch), not just here. CLOSED has no entry (undefined), which is exactly the
// terminal-state signal the Update Ticket modal below checks for.
const NEXT_STATUS = { OPEN: "ACKNOWLEDGED", ACKNOWLEDGED: "CLOSED" };

const emptyNewTicket = { categoryId: "", subCategoryId: "", description: "", attachments: [], priority: "" };
const emptyCategoryDetails = {};

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function subjectFor(t) {
  return t.subCategory ? `${t.category} - ${t.subCategory}` : t.category;
}

export default function HrSupportPage() {
  const CURRENT_USER = useCurrentUser();
  const isHrAdmin = useHasRole("HRAdmin");

  const { data: masterData } = useHRMasterDataQuery();
  const {
    create, isCreating, updateStatus, uploadImage, isUploadingImage,
    uploadAttachments, isUploadingAttachments, exportTickets, isExporting,
  } = useServiceDeskMutations();
  const isSubmittingTicket = isCreating || isUploadingImage || isUploadingAttachments;

  // Exactly 2-tier scoping, no manager/reportee tier: "mine" (everyone's own tickets) vs. "all"
  // (HRAdmin only, every employee's tickets).
  const [tab, setTab] = useState("mine");

  // "Assigned Tickets": an HR admin sees every ticket; anyone else who is the assignee of some tickets (dbo.HRTicketEscalation.AssigneeEmail) sees just those and
  // may update them. The tab is only offered to one of those two kinds of person.
  const scope = useMemo(() => (tab === "all" ? (isHrAdmin ? { allEmployees: true } : { assignedToMe: true }) : {}), [tab, isHrAdmin]);
  const scopeKey = tab === "all" ? (isHrAdmin ? "all" : "assigned") : "mine";
  const { data: assignedToMe } = useServiceDeskQuery({ assignedToMe: true }, "assigned");
  const canAssignedTab = isHrAdmin || assignedToMe.length > 0;

  // isFetching (not isLoading) so this actually fires: the query's own initialData: [] convention
  // (see useServiceDeskQuery.js) makes isLoading/isPending false from the very first render, same
  // as every other real-data feature's query in this app -- gated on an empty list too, so a
  // background refetch behind already-loaded rows doesn't flash the spinner over real data.
  const { data: scoped, isFetching: isTicketsFetching } = useServiceDeskQuery(scope, scopeKey);
  const showTicketsSpinner = isTicketsFetching && scoped.length === 0;

  const [statusFilter, setStatusFilter] = useState("");
  const [catFilter, setCatFilter] = useState("");
  // Same default as Leaves: the current month so far (1st through today). Reset returns
  // to this range rather than clearing it.
  const DEFAULT_RANGE = currentMonthRange();
  const [fromDate, setFromDate] = useState(DEFAULT_RANGE.fromDate);
  const [toDate, setToDate] = useState(DEFAULT_RANGE.toDate);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [viewTicket, setViewTicket] = useState(null);
  const [editTicket, setEditTicket] = useState(null);
  const [editStatus, setEditStatus] = useState("");
  const [editRemarks, setEditRemarks] = useState("");
  const [newTicket, setNewTicket] = useState(emptyNewTicket);
  const [categoryDetails, setCategoryDetails] = useState(emptyCategoryDetails);

  // Opened from the link in an HR ticket e-mail: switch to the right list (all tickets for an HR admin, otherwise My Tickets) with the wider e-mail date range,
  // then -- once that list has loaded -- open the ticket (ready to update for an HR admin, its details otherwise).
  const navIntent = useNavIntent(s => s.intent);
  const clearNavIntent = useNavIntent(s => s.clear);
  const intentStage = useRef("first"); // "first" = the list the link points at; "fallback" = My Tickets, tried when the ticket is not one assigned to them
  useEffect(() => {
    if (navIntent?.module !== "servicedesk") return;
    intentStage.current = "first";
    setTab(navIntent.scope === "all" ? "all" : "mine");
    setStatusFilter(""); setCatFilter("");
    if (navIntent.fromEmail) { const range = emailLinkRange(); setFromDate(range.fromDate); setToDate(range.toDate); }
  }, [navIntent]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (navIntent?.module !== "servicedesk" || isTicketsFetching) return;
    const expectedTab = intentStage.current === "fallback" || navIntent.scope !== "all" ? "mine" : "all";
    if (tab !== expectedTab) return; // the list switch is not applied yet
    const row = scoped.find(t => String(t.ticketNo).toLowerCase() === String(navIntent.ticketNo).toLowerCase());
    if (!row && expectedTab === "all") { intentStage.current = "fallback"; setTab("mine"); return; } // not one assigned to them (or not an assignee): try the tickets they raised
    if (!row) toast.info(`Ticket ${navIntent.ticketNo} was not found in your tickets.`);
    else if (row.canUpdate && row.status !== "CLOSED") setEditTicket(row); // theirs to act on: ready to update
    else setViewTicket(row);
    clearNavIntent();
  }, [navIntent, isTicketsFetching, tab, scoped, isHrAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // editStatus is always the ONE valid next status (never the current one, never freely chosen) --
  // "" for an already-CLOSED ticket, which the modal below treats as terminal (no further update
  // possible).
  useEffect(() => {
    if (editTicket) { setEditStatus(NEXT_STATUS[editTicket.status] || ""); setEditRemarks(""); }
  }, [editTicket]);

  // The 4 bespoke categories (Stationery/Repair and Maintenance/Visitor Lunch/Access Request-ID
  // Card) are gated by the caller's own BLRF/CRPO plant server-side, at the master-data source
  // (spv1_HRMasterData's CATEGORIES @IncludeBespoke) -- masterData.categories already omits them
  // entirely for an ineligible plant, so no client-side filtering is needed here.
  const categoryObj = masterData.categories.find(c => String(c.categoryId) === String(newTicket.categoryId));
  const isBespoke = !!categoryObj?.isBespoke;
  const hasSubCategory = !!categoryObj?.hasSubCategory;
  const defaultPriority = masterData.priorities.find(p => p.isDefault)?.priorityName || masterData.priorities[0]?.priorityName || "Low";
  const subCategoryOptions = categoryObj
    ? masterData.subCategories.filter(sc => sc.categoryId === categoryObj.categoryId).map(sc => ({ value: String(sc.subCategoryId), label: sc.subCategoryName }))
    : [];

  const stationarySubCategoryOptions = categoryDetails.stationaryCategoryId
    ? masterData.stationarySubCategories.filter(sc => String(sc.stationaryCategoryId) === String(categoryDetails.stationaryCategoryId))
    : [];
  const stationaryItemDescriptionOptions = categoryDetails.stationarySubCategoryId
    ? masterData.stationaryItemDescriptions.filter(d => String(d.stationarySubCategoryId) === String(categoryDetails.stationarySubCategoryId))
    : [];
  const stationaryItemQtyOptions = categoryDetails.stationaryItemDescriptionId
    ? masterData.stationaryItemQty.filter(q => String(q.itemDescriptionId) === String(categoryDetails.stationaryItemDescriptionId))
    : [];

  const setDetail = (key, value) => setCategoryDetails(d => ({ ...d, [key]: value }));

  const filtered = useMemo(() => scoped.filter(t => {
    const createdDateOnly = (t.createdDate || "").slice(0, 10);
    return (!statusFilter || t.status === statusFilter)
      && (!catFilter || t.category === catFilter)
      && (!fromDate || createdDateOnly >= fromDate)
      && (!toDate || createdDateOnly <= toDate);
  }), [scoped, statusFilter, catFilter, fromDate, toDate]);

  const stats = useMemo(() => ({
    open: scoped.filter(t => t.status === "OPEN").length,
    acknowledged: scoped.filter(t => t.status === "ACKNOWLEDGED").length,
    closed: scoped.filter(t => t.status === "CLOSED").length,
  }), [scoped]);

  const resetTicketForm = () => {
    setNewTicket(emptyNewTicket);
    setCategoryDetails(emptyCategoryDetails);
  };

  const handleAttachmentsSelected = async (fileList) => {
    const newFiles = Array.from(fileList || []);
    if (newFiles.length === 0) return;

    const validationErrors = validateNewFiles(newTicket.attachments.length, newFiles);
    if (validationErrors.length > 0) {
      validationErrors.forEach(msg => toast.error(msg));
      return;
    }

    try {
      const fileNames = await uploadAttachments(newFiles);
      const uploaded = fileNames.map((fileName, i) => ({ fileName, displayName: newFiles[i].name }));
      setNewTicket(f => ({ ...f, attachments: [...f.attachments, ...uploaded] }));
      toast.success(`${newFiles.length} file${newFiles.length > 1 ? "s" : ""} attached`);
    } catch (err) {
      toast.error(err.message || "Attachment upload failed.");
    }
  };

  const removeAttachment = (index) => {
    setNewTicket(f => ({ ...f, attachments: f.attachments.filter((_, i) => i !== index) }));
  };

  const submitTicket = async () => {
    const errors = validateNewTicketForm(categoryObj, newTicket, categoryDetails);
    if (Object.keys(errors).length) {
      toast.error(Object.values(errors)[0]);
      return;
    }

    try {
      let idCardImagePath = null;
      if (categoryObj.categoryName === "Access Request/ID Card" && categoryDetails.idCardImageFile) {
        const uploaded = await uploadImage(categoryDetails.idCardImageFile);
        idCardImagePath = uploaded.fileName;
      }

      const payload = {
        categoryId: categoryObj.categoryId,
        subCategoryId: newTicket.subCategoryId ? Number(newTicket.subCategoryId) : null,
        description: newTicket.description.trim(),
        attachmentName: newTicket.attachments.map(a => a.fileName).join(",") || null,
        priority: newTicket.priority || defaultPriority,
        lunchFromDate: categoryDetails.lunchFromDate || null,
        lunchToDate: categoryDetails.lunchToDate || null,
        lunchType: categoryDetails.lunchType || null,
        lunchCount: categoryDetails.lunchCount ? Number(categoryDetails.lunchCount) : null,
        repairItemId: categoryDetails.repairItemId ? Number(categoryDetails.repairItemId) : null,
        repairCount: categoryDetails.repairCount ? Number(categoryDetails.repairCount) : null,
        repairFloorId: categoryDetails.repairFloorId ? Number(categoryDetails.repairFloorId) : null,
        stationaryItemQtyId: categoryDetails.stationaryItemQtyId ? Number(categoryDetails.stationaryItemQtyId) : null,
        stationaryFloorId: categoryDetails.stationaryFloorId ? Number(categoryDetails.stationaryFloorId) : null,
        idCardBloodGroupId: categoryDetails.idCardBloodGroupId ? Number(categoryDetails.idCardBloodGroupId) : null,
        idCardImagePath,
      };

      const result = await create(payload);
      toast.success(`Ticket ${result?.ticketNo || ""} raised successfully!`);
      setShowTicketForm(false);
      resetTicketForm();
    } catch {
      // Real failures (validation, plant restriction, network) are already toasted centrally.
    }
  };

  const closeTicketForm = () => {
    setShowTicketForm(false);
    resetTicketForm();
  };

  // Clicking Download in the View modal always returns every attachment on the ticket -- the
  // single file directly, or a ZIP when there's more than one (mirrors PoliciesPage's own
  // downloadPolicy). attachmentName is the ticket's comma-separated list of on-disk names.
  const downloadTicketAttachmentsClick = async (attachmentName) => {
    const fileNames = (attachmentName || "").split(",").filter(Boolean);
    if (fileNames.length === 0) return;
    const displayName = fileNames.length === 1 ? toDisplayFileName(fileNames[0]) : "TicketAttachments.zip";
    try {
      const blob = await downloadTicketAttachments(fileNames);
      triggerBlobDownload(blob, displayName);
      toast.success(`Downloading ${displayName}`);
    } catch (err) {
      toast.error(err.message || "Download failed.");
    }
  };

  // Full data export (every HRTicket field + full HRTicketLog status-change history, one row per
  // status change) for whichever scope ("My Tickets" vs HRAdmin's "Assigned Tickets") is active --
  // NOT the DataTable's own generic "Excel" button, which only ever dumps the 7 visible grid
  // columns. hideExport on the DataTable below replaces that generic button with this one so
  // there's a single, unambiguous "Export" action.
  const canExport = useHasExactRole("HRAdmin"); // the Export is HRAdmin only (ITAdmin does not get it)
  const handleExport = async () => {
    try {
      const { rowCount } = await exportTickets(scope);
      toast.success(`Exported ${rowCount} row${rowCount === 1 ? "" : "s"}.`);
    } catch (err) {
      toast.error(err.message || "Export failed.");
    }
  };

  const saveTicketUpdate = () => {
    if (!editTicket || !editStatus) return;
    updateStatus({ ticketNo: editTicket.ticketNo, newStatus: editStatus, adminRemarks: editRemarks });
    toast.success(`${editTicket.ticketNo} updated to ${editStatus}`);
    setEditTicket(null);
  };

  const cols = [
    { key: "ticketNo", label: "Ticket No" },
    { key: "subject", label: "Subject", render: t => <span className="font-medium max-w-[200px] block whitespace-nowrap overflow-hidden text-ellipsis">{subjectFor(t)}</span> },
    { key: "employeeName", label: "Raised By" },
    { key: "category", label: "Category" },
    { key: "priority", label: "Priority" },
    { key: "status", label: "Status", render: t => <StatusBadge status={t.status} /> },
    { key: "createdDate", label: "Created Date", render: t => formatDate(t.createdDate) },
  ];

  const viewCategoryObj = viewTicket ? masterData.categories.find(c => c.categoryName === viewTicket.category) : null;
  const isViewBespoke = !!viewCategoryObj?.isBespoke;

  const ticketTabs = (
        <div className="flex gap-1 flex-nowrap overflow-x-auto max-w-full teams-tablist [scrollbar-width:none] [&>button]:shrink-0 [&>button]:whitespace-nowrap">
      <button onClick={() => setTab("mine")}
        className={cn("flex items-center gap-1.5 py-1.5 px-3 text-sm font-medium rounded-md transition-colors border-none cursor-pointer bg-transparent text-muted-foreground hover:text-foreground", tab==="mine" && "bg-card shadow text-foreground")}>
        <User size={14}/> My Tickets
      </button>
      {canAssignedTab && (
        <button onClick={() => setTab("all")}
          className={cn("flex items-center gap-1.5 py-1.5 px-3 text-sm font-medium rounded-md transition-colors border-none cursor-pointer bg-transparent text-muted-foreground hover:text-foreground", tab==="all" && "bg-card shadow text-foreground")}>
          <Users size={14}/> Assigned Tickets
        </button>
      )}
    </div>
  );
  const ticketFilterControls = (
    <>
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-xs font-semibold text-muted-foreground">Category</label>
          {/* Not plant-filtered like the Raise Ticket dropdown below: this filters EXISTING
              tickets (e.g. HR searching "Assigned Tickets"), which can legitimately include bespoke-
              category tickets raised by a BLRF/CRPO employee regardless of the viewer's own plant. */}
          <SearchableSelect value={catFilter} onChange={setCatFilter}
            options={[{ value:"", label:"All" }, ...masterData.categories.map(c=>({ value:c.categoryName, label:c.categoryName }))]}
            placeholder="All"/>
        </div>

        {/* Two separate date fields, each with its own label. */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">From Date</label>
          <DatePickerCalendar value={fromDate} onChange={v => setFromDate(v)} max={toDate || undefined}/>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">To Date</label>
          <DatePickerCalendar value={toDate} onChange={v => setToDate(v)} min={fromDate || undefined}/>
        </div>
    </>
  );
  const resetTicketFilters = () => { setStatusFilter(""); setCatFilter(""); setFromDate(DEFAULT_RANGE.fromDate); setToDate(DEFAULT_RANGE.toDate); };
  const ticketFilterCount = (statusFilter ? 1 : 0) + (catFilter ? 1 : 0) + (fromDate !== DEFAULT_RANGE.fromDate || toDate !== DEFAULT_RANGE.toDate ? 1 : 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Raise Ticket shares this row with the status counters, placed AFTER Resolved (last, on
          the right) -- on mobile it therefore renders LAST too, simply by being the last item in
          source order, since this grid applies no explicit order-* overrides at any breakpoint. */}
      <div className={cn("grid grid-cols-3 sm:grid-cols-4 gap-2 md:gap-3", "animate-fade-in-up")} style={{ animationDelay: "30ms" }}>
        {[
          { key:"OPEN", label:"Open", value:stats.open, color:"bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300", pulse:true },
          { key:"ACKNOWLEDGED", label:"Acknowledged", value:stats.acknowledged, color:"bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300" },
          { key:"CLOSED", label:"Closed", value:stats.closed, color:"bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300" },
        ].map((s,i)=>(
          <button key={s.key} onClick={() => setStatusFilter(f => f === s.key ? "" : s.key)}
            className={cn(
              "border rounded-lg py-2 px-4 max-md:px-1 max-md:py-1.5 max-md:flex-col max-md:gap-0 text-center hover-lift animate-fade-in-up flex items-center justify-center gap-2 cursor-pointer transition-shadow",
              s.color, statusFilter === s.key && "ring-2 ring-offset-1 ring-primary"
            )} style={{ animationDelay: `${60 + i*40}ms` }}>
            <p className="text-xl font-bold flex items-center gap-1.5">
              <CountUp value={s.value}/>
              {s.pulse && s.value > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse-dot"/>}
            </p>
            <p className="text-xs font-semibold">{s.label}</p>
          </button>
        ))}
        <div className="flex items-center justify-center col-span-3 sm:col-span-1">
          <Btn variant="primary" size="sm" onClick={() => setShowTicketForm(true)}
            className="hover-lift animate-fade-in-up" style={{ animationDelay: "180ms" }}>
            <Plus size={14} /> Raise Ticket
          </Btn>
        </div>
      </div>

      <div className={cn("relative z-10 bg-card rounded-lg border border-border p-3 flex flex-wrap gap-3 items-end", "animate-fade-in-up")} style={{ animationDelay: "100ms" }}>
        {ticketTabs}
        {ticketFilterControls}

        <Btn variant="ghost" size="sm" className="ml-auto" onClick={resetTicketFilters}>
          <RefreshCw size={13}/> Reset
        </Btn>
      </div>

      <div className="animate-fade-in-up" style={{ animationDelay: "150ms" }}>
      {showTicketsSpinner ? (
        <div className="bg-card rounded-lg border border-border"><Spinner message="Loading tickets…"/></div>
      ) : (
        <DataTable
          title={tab === "all" ? "Assigned Tickets" : "My Tickets"}
          columns={cols} data={filtered}
          hideExport
          toolbarExtra={canExport && (
            <Btn variant="secondary" size="sm" disabled={isExporting} onClick={handleExport} title="Export" aria-label="Export" className="max-md:!w-[32px] max-md:!px-0 shrink-0">
              <Download size={13}/> <span className="max-md:hidden">{isExporting ? "Exporting…" : "Export"}</span>
            </Btn>
          )}
          actions={(row) => {
            const t = row;
            return (
              <>
                <button onClick={() => setViewTicket(t)} className="p-1.5 rounded-md transition-colors bg-transparent border-none cursor-pointer hover:bg-secondary text-primary"><Eye size={14}/></button>
                {t.canUpdate && (
                  <button onClick={() => setEditTicket(t)} className="p-1.5 rounded-md transition-colors bg-transparent border-none cursor-pointer hover:bg-secondary text-muted-foreground"><Pencil size={14}/></button>
                )}
              </>
            );
          }}
        />
      )}
      </div>

      <Modal open={showTicketForm} onClose={closeTicketForm} title="Raise New Ticket" maxWidth="max-w-2xl"
        footer={<>
          <Btn variant="primary" size="sm" onClick={submitTicket} disabled={isSubmittingTicket} loading={isSubmittingTicket}>Submit Ticket</Btn>
          <Btn variant="secondary" size="sm" onClick={closeTicketForm}>Cancel</Btn>
        </>}>
        {!isBespoke && hasSubCategory ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Category">
              <SearchableSelect value={newTicket.categoryId}
                onChange={value => { setNewTicket(f=>({...f, categoryId:value, subCategoryId:""})); setCategoryDetails(emptyCategoryDetails); }}
                options={masterData.categories.map(c=>({ value:String(c.categoryId), label:c.categoryName }))} placeholder="Please select Category"/>
            </FormField>
            <FormField label="Sub Category">
              <SearchableSelect value={newTicket.subCategoryId} onChange={value=>setNewTicket(f=>({...f, subCategoryId:value}))}
                options={subCategoryOptions}
                placeholder="Please select sub category"/>
            </FormField>
            <FormField label="Priority">
              <select value={newTicket.priority || defaultPriority} onChange={e=>setNewTicket(f=>({...f, priority:e.target.value}))} className={inputCls}>
                {masterData.priorities.map(p=><option key={p.priorityId} value={p.priorityName}>{p.priorityName}</option>)}
              </select>
            </FormField>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Category">
              <SearchableSelect value={newTicket.categoryId}
                onChange={value => { setNewTicket(f=>({...f, categoryId:value, subCategoryId:""})); setCategoryDetails(emptyCategoryDetails); }}
                options={masterData.categories.map(c=>({ value:String(c.categoryId), label:c.categoryName }))} placeholder="Please select Category"/>
            </FormField>
            <FormField label="Priority">
              <select value={newTicket.priority || defaultPriority} onChange={e=>setNewTicket(f=>({...f, priority:e.target.value}))} className={inputCls}>
                {masterData.priorities.map(p=><option key={p.priorityId} value={p.priorityName}>{p.priorityName}</option>)}
              </select>
            </FormField>
          </div>
        )}

        {!isBespoke && (
          <>
            <FormField label="Description">
              <textarea rows={3} value={newTicket.description} onChange={e=>setNewTicket(f=>({...f, description:e.target.value}))}
                placeholder="Tell us more about the issue" className={cn(inputCls,"resize-none")}/>
            </FormField>
            <FormField label="Attach File">
              <div className="flex items-center gap-2">
                <Paperclip size={14} className="text-muted-foreground shrink-0"/>
                <input type="file" accept={ALLOWED_EXTENSIONS.join(",")} multiple
                  disabled={isUploadingAttachments || newTicket.attachments.length >= MAX_FILE_COUNT}
                  onChange={e => { handleAttachmentsSelected(e.target.files); e.target.value = ""; }}
                  className={inputCls}/>
              </div>
              <span className="text-xs text-muted-foreground">
                Up to {MAX_FILE_COUNT} files, {MAX_FILE_SIZE_BYTES / 1_000_000} MB each, {MAX_TOTAL_SIZE_BYTES / 1_000_000} MB total ({ALLOWED_EXTENSIONS.join(", ")})
              </span>
              <UploadProgress active={isUploadingAttachments} />
              {newTicket.attachments.length > 0 && (
                <ul className="flex flex-col gap-1 mt-1">
                  {newTicket.attachments.map((a, i) => (
                    <li key={`${a.fileName}-${i}`} className="flex items-center justify-between gap-2 text-xs bg-muted rounded-md px-2 py-1">
                      <span className="truncate">{a.displayName}</span>
                      <button type="button" onClick={() => removeAttachment(i)}
                        className="p-0.5 rounded bg-transparent border-none cursor-pointer text-muted-foreground hover:text-destructive shrink-0" title="Remove">
                        <X size={12}/>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </FormField>
          </>
        )}

        {categoryObj?.categoryName === "Visitor Lunch" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Lunch Request">
                <select value={categoryDetails.lunchType || ""} onChange={e=>setDetail("lunchType", e.target.value)} className={inputCls}>
                  <option value="">-Select-</option>
                  {masterData.lunchTypes.map(o=><option key={o.lunchTypeId} value={o.lunchTypeName}>{o.lunchTypeName}</option>)}
                </select>
              </FormField>
              <FormField label="From Date">
                <DatePickerCalendar value={categoryDetails.lunchFromDate || ""} onChange={v => setDetail("lunchFromDate", v)}/>
              </FormField>
              <FormField label="To Date">
                <DatePickerCalendar value={categoryDetails.lunchToDate || ""} onChange={v => setDetail("lunchToDate", v)}/>
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Count">
                <input type="number" min="1" value={categoryDetails.lunchCount || ""} onChange={e=>setDetail("lunchCount", e.target.value)} className={inputCls}/>
              </FormField>
              <FormField label="Description">
                <textarea rows={1} value={newTicket.description} onChange={e=>setNewTicket(f=>({...f, description:e.target.value}))} className={cn(inputCls,"resize-none")}/>
              </FormField>
            </div>
          </>
        )}

        {categoryObj?.categoryName === "Repair and Maintenance" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Repair Items">
                <SearchableSelect value={categoryDetails.repairItemId || ""} onChange={value=>setDetail("repairItemId", value)}
                  options={masterData.repairItems.map(o=>({ value:String(o.repairItemId), label:o.repairItemName }))} placeholder="-Select-"/>
              </FormField>
              <FormField label="Count">
                <input type="number" min="1" value={categoryDetails.repairCount || ""} onChange={e=>setDetail("repairCount", e.target.value)} className={inputCls}/>
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Floor">
                <SearchableSelect value={categoryDetails.repairFloorId || ""} onChange={value=>setDetail("repairFloorId", value)}
                  options={masterData.floors.map(o=>({ value:String(o.floorId), label:o.floorName }))} placeholder="-Select-"/>
              </FormField>
              <FormField label="Description">
                <textarea rows={1} value={newTicket.description} onChange={e=>setNewTicket(f=>({...f, description:e.target.value}))} className={cn(inputCls,"resize-none")}/>
              </FormField>
            </div>
          </>
        )}

        {categoryObj?.categoryName === "Access Request/ID Card" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Blood Group">
                <select value={categoryDetails.idCardBloodGroupId || ""} onChange={e=>setDetail("idCardBloodGroupId", e.target.value)} className={inputCls}>
                  <option value="">-Select-</option>
                  {masterData.bloodGroups.map(o=><option key={o.bloodGroupId} value={o.bloodGroupId}>{o.bloodGroupName}</option>)}
                </select>
              </FormField>
              <FormField label="Upload Image">
                <input type="file" accept="image/jpeg" onChange={e=>setDetail("idCardImageFile", e.target.files?.[0] || null)} className={inputCls}/>
                {categoryDetails.idCardImageFile && <span className="text-xs text-muted-foreground">Selected: {categoryDetails.idCardImageFile.name}</span>}
              </FormField>
            </div>
            <FormField label="Description">
              <textarea rows={2} value={newTicket.description} onChange={e=>setNewTicket(f=>({...f, description:e.target.value}))} className={cn(inputCls,"resize-none")}/>
            </FormField>
            <p className="text-xs text-destructive font-medium">Note: Image must be in jpg format and size &lt;= 512 KB</p>
            <p className="text-xs text-destructive font-medium">Note: For issuing a new ID Card an Amount of Rs. 350/- will be deducted from your salary as per admin policy.</p>
          </>
        )}

        {categoryObj?.categoryName === "Stationery" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Stationary Category">
                <SearchableSelect value={categoryDetails.stationaryCategoryId || ""}
                  onChange={value => setCategoryDetails(d => ({ ...d, stationaryCategoryId: value, stationarySubCategoryId: "", stationaryItemDescriptionId: "", stationaryItemQtyId: "" }))}
                  options={masterData.stationaryCategories.map(o=>({ value:String(o.stationaryCategoryId), label:o.categoryName }))} placeholder="-Select-"/>
              </FormField>
              <FormField label="Stationary Item">
                <SearchableSelect value={categoryDetails.stationarySubCategoryId || ""}
                  onChange={value => setCategoryDetails(d => ({ ...d, stationarySubCategoryId: value, stationaryItemDescriptionId: "", stationaryItemQtyId: "" }))}
                  options={stationarySubCategoryOptions.map(o=>({ value:String(o.stationarySubCategoryId), label:o.subCategoryName }))}
                  disabled={!categoryDetails.stationaryCategoryId} placeholder="-Select-"/>
              </FormField>
              <FormField label="Item Description">
                <SearchableSelect value={categoryDetails.stationaryItemDescriptionId || ""}
                  onChange={value => setCategoryDetails(d => ({ ...d, stationaryItemDescriptionId: value, stationaryItemQtyId: "" }))}
                  options={stationaryItemDescriptionOptions.map(o=>({ value:String(o.itemDescriptionId), label:o.description }))}
                  disabled={!categoryDetails.stationarySubCategoryId} placeholder="-Select-"/>
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Quantity / Unit">
                <SearchableSelect value={categoryDetails.stationaryItemQtyId || ""} onChange={value=>setDetail("stationaryItemQtyId", value)}
                  options={stationaryItemQtyOptions.map(o=>({ value:String(o.itemQtyId), label:`${o.qty} ${o.unit}` }))}
                  disabled={!categoryDetails.stationaryItemDescriptionId} placeholder="-Select-"/>
              </FormField>
              <FormField label="Department">
                <input value={CURRENT_USER.department} readOnly disabled className={cn(inputCls, "bg-muted text-muted-foreground")}/>
              </FormField>
              <FormField label="Floor">
                <SearchableSelect value={categoryDetails.stationaryFloorId || ""} onChange={value=>setDetail("stationaryFloorId", value)}
                  options={masterData.floors.map(o=>({ value:String(o.floorId), label:o.floorName }))} placeholder="-Select-"/>
              </FormField>
            </div>
            <FormField label="Description">
              <textarea rows={1} value={newTicket.description} onChange={e=>setNewTicket(f=>({...f, description:e.target.value}))} className={cn(inputCls,"resize-none")}/>
            </FormField>
            <p className="text-xs text-destructive font-medium">Note: Any Changes Designation/ Mobile Number for Visiting Card please fill in description box.</p>
          </>
        )}
      </Modal>

      <Modal open={!!viewTicket} onClose={() => setViewTicket(null)} title="Ticket Details" maxWidth={isViewBespoke ? "max-w-2xl" : "max-w-md"}
        footer={<Btn variant="secondary" size="sm" onClick={() => setViewTicket(null)}>Close</Btn>}>
        {viewTicket && (
          <div className={cn("text-sm gap-2.5", isViewBespoke ? "grid grid-cols-1 sm:grid-cols-2 gap-x-6" : "flex flex-col")}>
            {[
              { label:"Ticket No", value:viewTicket.ticketNo },
              { label:"Raised By", value:viewTicket.employeeName },
              { label:"Category", value:viewTicket.category },
              { label:"Priority", value:viewTicket.priority },
              { label:"Status", value:<StatusBadge status={viewTicket.status}/> },
              { label:"Created Date", value:formatDate(viewTicket.createdDate) },
              ...(viewTicket.subCategory ? [{ label:"Sub Category", value:viewTicket.subCategory }] : []),
              ...(viewTicket.description ? [{ label:"Description", value:viewTicket.description }] : []),
              ...viewTicket.categoryDetails.filter(d => d.value).map(d => ({ label:d.label, value:d.value })),
              ...(viewTicket.adminRemarks ? [{ label:"Admin Remarks", value:viewTicket.adminRemarks }] : []),
              ...(viewTicket.lastUpdatedByName ? [{ label:"Last Updated By", value:viewTicket.lastUpdatedByName }] : []),
              ...(viewTicket.lastUpdatedDate ? [{ label:"Last Updated Date", value:formatDate(viewTicket.lastUpdatedDate) }] : []),
            ].map(f => (
              <div key={f.label} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{f.label}</span>
                <span className="font-medium text-foreground text-right">{f.value}</span>
              </div>
            ))}
            {viewTicket.attachmentName && (
              <div className={cn("flex flex-col gap-1.5", isViewBespoke && "sm:col-span-2")}>
                <span className="text-muted-foreground">Attachment{viewTicket.attachmentName.split(",").filter(Boolean).length > 1 ? "s" : ""}</span>
                <button type="button" onClick={() => downloadTicketAttachmentsClick(viewTicket.attachmentName)}
                  className="w-fit flex items-center gap-1.5 text-xs font-medium text-primary bg-transparent border border-border rounded-md px-2 py-1 cursor-pointer hover:bg-secondary">
                  <Download size={12}/>
                  {(() => {
                    const names = viewTicket.attachmentName.split(",").filter(Boolean);
                    return names.length === 1 ? toDisplayFileName(names[0]) : `Download ${names.length} files`;
                  })()}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!editTicket} onClose={() => setEditTicket(null)} title="Update Ticket"
        footer={<>
          <Btn variant="primary" size="sm" onClick={saveTicketUpdate} disabled={!editStatus}>Save</Btn>
          <Btn variant="secondary" size="sm" onClick={() => setEditTicket(null)}>Cancel</Btn>
        </>}>
        {editTicket && (
          <>
            <p className="text-sm text-muted-foreground">{editTicket.ticketNo} · {subjectFor(editTicket)}</p>
            <FormField label="Current Status">
              <div className="w-fit py-1"><StatusBadge status={editTicket.status}/></div>
            </FormField>
            {/* Strictly the one valid next step, never a free choice -- per explicit direction
                ("do not allow user to select and update" an arbitrary status), enforced server-side
                too (spv1_HRTicketSave's UPDATE_STATUS branch rejects anything else). w-fit keeps
                the pill sized to its own content instead of stretching across the full field width. */}
            {editStatus ? (
              <FormField label="Update Status To">
                <div className="w-fit py-1"><StatusBadge status={editStatus}/></div>
              </FormField>
            ) : (
              <p className="text-sm text-muted-foreground">This ticket is Closed and cannot be updated further.</p>
            )}
            {editStatus && (
              <FormField label="Admin Remarks">
                <textarea rows={3} value={editRemarks} onChange={e => setEditRemarks(e.target.value)} className={cn(inputCls,"resize-none")}/>
              </FormField>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
