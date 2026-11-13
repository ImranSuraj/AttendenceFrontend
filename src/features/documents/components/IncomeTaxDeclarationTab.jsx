import { useState } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/features/employees";
import { useHasRole } from "@/shared/access/access.store";
import { useMyDeclaration, useTaxDeclarationActions } from "../hooks/useItDeclaration";
import DeclarationForm from "./DeclarationForm";
import DeclarationSummary from "./DeclarationSummary";
import AdminPanel from "./AdminPanel";

const MIN_SPINNER_MS = 1000;   // the spinner stays at least this long
const MESSAGE_HOLD_MS = 1500;   // after it, the success message is shown on the form for this long before the summary page opens

export default function IncomeTaxDeclarationTab() {
  const currentUser = useCurrentUser();
  const isHrAdmin = useHasRole("HRAdmin");
  const { exists, canEdit, declaration } = useMyDeclaration();
  const { submit } = useTaxDeclarationActions();
  // What the person sees after pressing Submit, in this order:  1) "saving": the form stays and the button spins (at least MIN_SPINNER_MS, the
  // save can finish in a blink)  2) "done": the spinner stops and the success message appears, still on the form (MESSAGE_HOLD_MS)  3) "idle": the
  // summary page opens. Without the hold, a first-time submit flipped to the summary the moment the saved declaration reloaded, BEFORE the message.
  const [phase, setPhase] = useState("idle");
  const [editing, setEditing] = useState(false);

  const handleSubmit = (form) => {
    if (phase !== "idle") return;
    const startedAt = Date.now();
    setPhase("saving");
    const afterSpinner = (after) => setTimeout(after, Math.max(0, MIN_SPINNER_MS - (Date.now() - startedAt)));
    submit(form, {
      onSuccess: () => afterSpinner(() => {
        setPhase("done");
        toast.success(exists ? "Tax declaration updated" : "Tax declaration submitted");
        setTimeout(() => { setEditing(false); setPhase("idle"); }, MESSAGE_HOLD_MS);
      }),
      // A failure is already toasted centrally; just release the button (the form stays open to retry).
      onError: () => afterSpinner(() => setPhase("idle")),
    });
  };

  // The form stays on screen through the whole save-and-message sequence above.
  const showForm = editing || !exists || phase !== "idle";

  return (
    <div className="flex flex-col gap-4">
      {isHrAdmin && <AdminPanel />}

      {showForm ? (
        <DeclarationForm
          currentUser={currentUser}
          existing={declaration}
          onSubmit={handleSubmit}
          submitting={phase === "saving"}
          locked={phase !== "idle"}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <DeclarationSummary
          declaration={declaration}
          onEdit={() => setEditing(true)}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
