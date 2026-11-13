import { useState, useMemo } from "react";
import { Plus, Pencil, UploadCloud, Folder, ChevronUp, ChevronDown, ChevronLeft, LayoutGrid, List, X, Search, Eye } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/utils/cn";
import { Btn } from "@/shared/components/Btn";
import { DataTable } from "@/shared/components/DataTable";
import { Modal, FormField, inputCls } from "@/shared/components/Modal";
import { usePoliciesQuery, usePolicyMutations } from "../hooks/usePoliciesQuery";
import { validatePolicyForm } from "../policies.validators";
import { PdfViewer } from "../components/PdfViewer";
import { ImageViewer } from "../components/ImageViewer";
import { POLICY_TYPES } from "../policies.constants";
import { UploadProgress } from "@/shared/components/UploadProgress";
import { uploadPolicyDocument, downloadPolicyDocument } from "../services/policyDocument.service";
import { useHasExactRole } from "@/shared/access/access.store";
import { toDisplayFileName } from "@/shared/utils/fileDisplayName";
import { validateNewFiles, MAX_FILE_COUNT, MAX_FILE_SIZE_BYTES, MAX_TOTAL_SIZE_BYTES, ALLOWED_EXTENSIONS } from "@/shared/utils/fileValidation";

// A policy is exactly one row per file. attachments here holds what this Add/Edit modal is about
// to submit: on Add, 0-MAX_FILE_COUNT entries -- one PolicyMaster row gets created per entry (all
// sharing this same policyName/policyType/folder), or a single row with no attachment if empty; on
// Edit, at most 1 entry -- Edit only ever replaces or clears THIS row's own single file. Each
// attachment is { fileName, displayName }: fileName is the real on-disk name
// ("{base}_{8-digit-random}.ext", what's actually sent to/stored by the server); displayName is
// only ever shown in the UI.
const emptyForm = { policyName: "", policyType: "HR Policies", folder: "", attachments: [] };

export default function PoliciesPage() {
  const { data: POLICIES } = usePoliciesQuery();
  const { add, update } = usePolicyMutations();
  const isHrAdmin = useHasExactRole("HRAdmin"); // add / edit / upload: the HRAdmin role itself (ITAdmin does not count)

  const [policyType, setPolicyType] = useState("HR Policies");
  const [viewMode, setViewMode] = useState("folder");
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [foldersOpen, setFoldersOpen] = useState(true);

  const [editing, setEditing] = useState(null); // null = closed, {} = add, {...policy} = edit
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // One search box (next to the policy-type buttons) drives everything below: the folder cards, the
  // folder's article list and the table all show only policies matching it (ID, category or name).
  const [search, setSearch] = useState("");

  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase();
    return POLICIES.filter(p => p.policyType === policyType
      && (!q || [p.id, p.folder, p.policyName].some(v => String(v ?? "").toLowerCase().includes(q))));
  }, [POLICIES, policyType, search]);

  // Folder cards are driven entirely by whatever Policy Category values are actually present in
  // the real uploaded policies -- no predefined/hardcoded category list, since PolicyCategory is
  // plain free text the HRAdmin enters on Add/Edit (dbo.PolicyMaster.PolicyCategory isn't FK'd to
  // a lookup table).
  const folderNames = useMemo(() => [...new Set(scoped.map(p => p.folder).filter(Boolean))].sort(), [scoped]);
  const folderCounts = useMemo(() => {
    const counts = {};
    scoped.forEach(p => { counts[p.folder] = (counts[p.folder] || 0) + 1; });
    return counts;
  }, [scoped]);

  const switchPolicyType = (pt) => { setPolicyType(pt); setSelectedFolder(null); };
  const switchViewMode = (v) => { setViewMode(v); setSelectedFolder(null); };

  const folderArticles = useMemo(() => selectedFolder ? scoped.filter(p => p.folder === selectedFolder) : [], [scoped, selectedFolder]);

  const isEditingExisting = !!(editing && editing.id);

  const openAdd = () => { setEditing({}); setForm({ ...emptyForm, policyType, folder: selectedFolder || "" }); setErrors({}); };
  // Edit never touches the attachment at all -- per explicit direction, there's no file
  // upload/replace in Edit, only Policy Name/Type/Category can change.
  const openEdit = (policy) => { setEditing(policy); setForm({ ...emptyForm, ...policy, attachments: [] }); setErrors({}); };
  const closeModal = () => setEditing(null);

  const submitForm = () => {
    const validationErrors = validatePolicyForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    if (isEditingExisting) {
      update(editing.id, {
        policyName: form.policyName,
        policyType: form.policyType,
        folder: form.folder,
      });
      toast.success("Policy updated");
    } else {
      // One PolicyMaster row per attached file (all sharing this same name/type/category) -- 0
      // files still creates exactly one row, with no attachment.
      add({
        policyName: form.policyName,
        policyType: form.policyType,
        folder: form.folder,
        fileNames: form.attachments.map(a => a.fileName),
      });
      toast.success(form.attachments.length > 1 ? `${form.attachments.length} policies added` : "Policy added");
    }
    closeModal();
  };

  // View: shows the policy document INSIDE the app (a pop-up with the document in it), for every user.
  // It is not opened in a new browser tab on purpose: inside Microsoft Teams a new tab is handed to
  // Windows, which cannot open a temporary blob: link ("this link cannot be opened ... download an app
  // from the Microsoft Store"). Only types a browser can display itself are previewed (PDF, images, plain
  // text); anything else (Excel, Word, CSV) can't be shown, and policies cannot be downloaded, so a note says so.
  const VIEWABLE_MIME = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", txt: "text/plain" };
  const [preview, setPreview] = useState(null); // { url, mime, name, policy } while the viewer is open
  const [previewLoading, setPreviewLoading] = useState(false);

  const closePreview = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const viewPolicy = async (p) => {
    const fileName = p.fileName;
    if (!fileName) { toast.info("This policy has no document attached."); return; }

    const mime = VIEWABLE_MIME[fileName.split(".").pop().toLowerCase()];
    if (!mime) {
      toast.info("This file type can't be previewed here (only PDF, images and text files can be viewed).");
      return;
    }

    setPreviewLoading(true);
    try {
      const blob = await downloadPolicyDocument(fileName);
      const typed = new Blob([blob], { type: mime });
      setPreview({ url: URL.createObjectURL(typed), blob: typed, mime, name: toDisplayFileName(fileName), policy: p });
    } catch (err) {
      toast.error(err.message || "Could not open the document.");
    } finally {
      setPreviewLoading(false);
    }
  };

  // Add-only -- Edit never shows this field at all (see openEdit's own remarks).
  const handleFilesSelected = async (fileList) => {
    const newFiles = Array.from(fileList || []);
    if (newFiles.length === 0) return;

    const validationErrors = validateNewFiles(form.attachments.length, newFiles);
    if (validationErrors.length > 0) {
      validationErrors.forEach(msg => toast.error(msg));
      return;
    }

    setUploadingDoc(true);
    try {
      const fileNames = await uploadPolicyDocument(newFiles);
      const uploaded = fileNames.map((fileName, i) => ({ fileName, displayName: newFiles[i].name }));
      setForm(f => ({ ...f, attachments: [...f.attachments, ...uploaded] }));
      toast.success(`${newFiles.length} file${newFiles.length > 1 ? "s" : ""} uploaded`);
    } catch (err) {
      toast.error(err.message || "Document upload failed.");
    } finally {
      setUploadingDoc(false);
    }
  };

  const removeAttachment = (index) => {
    setForm(f => ({ ...f, attachments: f.attachments.filter((_, i) => i !== index) }));
  };

  const tableCols = [
    // p.id already arrives as the 5-digit code ("00001") -- PolicyMaster.PolicyId is itself
    // CHAR(5), generated by its own DEFAULT constraint, not reformatted here.
    { key:"id", label:"Policy ID" },
    { key:"folder", label:"Policy Category" },
    { key:"policyName", label:"Policy Name", render: p => <span className="font-medium">{p.policyName}</span> },
  ];

  // Same columns as the main table view (Actions, Policy ID, Policy Category, Policy Name only) --
  // Actions is handled by the shared `actions` prop passed to both DataTable instances below.
  const folderCols = tableCols;

  const actions = (p) => (
    <>
      <button onClick={() => viewPolicy(p)}
        className="p-1.5 rounded-md transition-colors bg-transparent border-none cursor-pointer hover:bg-secondary text-primary" title="View"><Eye size={14}/></button>
      {isHrAdmin && (
        <>
          <button onClick={() => openEdit(p)}
            className="p-1.5 rounded-md transition-colors bg-transparent border-none cursor-pointer hover:bg-secondary text-muted-foreground" title="Edit"><Pencil size={14}/></button>
        </>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      {isHrAdmin && (
        <div className="flex justify-end animate-fade-in-up" style={{ animationDelay: "0ms" }}>
          <Btn variant="primary" size="sm" onClick={openAdd}>
            <Plus size={14}/> Add Policy
          </Btn>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2 animate-fade-in-up" style={{ animationDelay: "30ms" }}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 teams-tablist w-fit">
            {POLICY_TYPES.map(pt => (
              <button key={pt} onClick={() => switchPolicyType(pt)}
                className={cn("py-1.5 px-4 text-sm font-medium rounded-md transition-colors border-none cursor-pointer",
                  policyType===pt ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground bg-transparent")}>
                {pt}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="py-1.5 pl-8 pr-3 text-sm border border-border rounded-md bg-input-background w-48 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div className="flex gap-1 teams-tablist w-fit">
          <button onClick={() => switchViewMode("folder")}
            className={cn("flex items-center gap-1.5 py-1.5 px-3 text-sm font-medium rounded-md transition-colors border-none cursor-pointer",
              viewMode==="folder" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground bg-transparent")}>
            <LayoutGrid size={13}/> Folder View
          </button>
          <button onClick={() => switchViewMode("table")}
            className={cn("flex items-center gap-1.5 py-1.5 px-3 text-sm font-medium rounded-md transition-colors border-none cursor-pointer",
              viewMode==="table" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground bg-transparent")}>
            <List size={13}/> Table View
          </button>
        </div>
      </div>

      {viewMode === "folder" ? (
        selectedFolder ? (
          <div className="flex flex-col gap-4 animate-fade-in-up" style={{ animationDelay: "60ms" }}>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedFolder(null)}
                className="flex items-center gap-1 text-sm text-primary font-medium bg-transparent border-none cursor-pointer hover:underline">
                <ChevronLeft size={15}/> Back to Folders
              </button>
              <span className="text-sm text-muted-foreground">/ {policyType} / <span className="text-foreground font-medium">{selectedFolder}</span></span>
            </div>
            <DataTable columns={folderCols} data={folderArticles} hideSearch hideExport actions={actions}/>
          </div>
        ) : (
          <div className="flex flex-col gap-3 animate-fade-in-up" style={{ animationDelay: "60ms" }}>
            <button onClick={() => setFoldersOpen(v=>!v)}
              className="flex items-center gap-1.5 text-sm font-semibold text-foreground bg-transparent border-none cursor-pointer w-fit">
              {foldersOpen ? <ChevronUp size={15}/> : <ChevronDown size={15}/>} Folders
            </button>
            {foldersOpen && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {folderNames.map((f, i) => (
                  <button key={f} onClick={() => setSelectedFolder(f)}
                    style={{ animationDelay: `${i*30}ms` }}
                    className={cn("text-left bg-card rounded-lg border border-border shadow-sm p-4 flex items-center gap-3 transition-all duration-200 hover:shadow-md hover:border-primary cursor-pointer", "hover-lift", "animate-fade-in-up")}>
                    <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Folder size={20}/>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{f}</p>
                      <p className="text-xs text-muted-foreground">{folderCounts[f] || 0} Article{folderCounts[f]===1?"":"s"}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-4 animate-fade-in-up" style={{ animationDelay: "60ms" }}>
          <DataTable columns={tableCols} data={scoped} hideSearch hideExport actions={actions}/>
        </div>
      )}

      <Modal open={!!editing} onClose={closeModal} title={editing?.id ? "Edit Policy" : "Add Policy"} maxWidth="max-w-lg"
        footer={
          <>
            <Btn variant="secondary" size="sm" onClick={closeModal}>Cancel</Btn>
            <Btn variant="primary" size="sm" onClick={submitForm}>{editing?.id ? "Save Changes" : "Add Policy"}</Btn>
          </>
        }>
        <FormField label="Policy Name">
          <input value={form.policyName} onChange={e=>setForm(f=>({...f, policyName:e.target.value}))} className={inputCls}/>
          {errors.policyName && <span className="text-xs text-destructive">{errors.policyName}</span>}
        </FormField>
        {/* Add-only -- Edit never offers file upload/replace at all, per explicit direction. */}
        {isHrAdmin && !isEditingExisting && (
          <FormField label="Policy Document Upload">
            <div className="flex items-center gap-2">
              <UploadCloud size={14} className="text-muted-foreground shrink-0"/>
              <input type="file" accept={ALLOWED_EXTENSIONS.join(",")} multiple
                disabled={uploadingDoc || form.attachments.length >= MAX_FILE_COUNT}
                onChange={e => { handleFilesSelected(e.target.files); e.target.value = ""; }}
                className={inputCls}/>
            </div>
            <span className="text-xs text-muted-foreground">
              Attach up to {MAX_FILE_COUNT} files -- one policy is created per file, {MAX_FILE_SIZE_BYTES / 1_000_000} MB each, {MAX_TOTAL_SIZE_BYTES / 1_000_000} MB total ({ALLOWED_EXTENSIONS.join(", ")})
            </span>
            <UploadProgress active={uploadingDoc} />
            {form.attachments.length > 0 && (
              <ul className="flex flex-col gap-1 mt-1">
                {form.attachments.map((a, i) => (
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
        )}
        <FormField label="Policy Type">
          <select value={form.policyType} onChange={e=>setForm(f=>({...f, policyType:e.target.value, folder:""}))} className={inputCls}>
            {POLICY_TYPES.map(pt=><option key={pt}>{pt}</option>)}
          </select>
          {errors.policyType && <span className="text-xs text-destructive">{errors.policyType}</span>}
        </FormField>
        <FormField label="Policy Category">
          <input value={form.folder} onChange={e=>setForm(f=>({...f, folder:e.target.value}))}
            placeholder="e.g. Leave, Payroll, Travel..." className={inputCls}/>
          {errors.folder && <span className="text-xs text-destructive">{errors.folder}</span>}
        </FormField>
      </Modal>

      {/* Document viewer: the policy shown inside the app (images as an image, PDF / text in a frame). */}
      <Modal open={!!preview || previewLoading} onClose={closePreview} title={preview?.name || "Opening document…"} maxWidth="max-w-5xl" tall
        footer={<>
          <Btn variant="secondary" size="sm" onClick={closePreview}>Close</Btn>
        </>}>
        {!preview ? (
          <p className="text-sm text-muted-foreground py-10 text-center">Loading the document…</p>
        ) : preview.mime.startsWith("image/") ? (
          <ImageViewer src={preview.url} alt={preview.name}/>
        ) : preview.mime === "application/pdf" ? (
          <PdfViewer blob={preview.blob}/>
        ) : (
          <iframe src={preview.url} title={preview.name} className="w-full h-[calc(100vh-14rem)] border-0 rounded-md bg-white"/>
        )}
      </Modal>
    </div>
  );
}
