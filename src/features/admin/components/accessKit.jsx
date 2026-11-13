import { useState } from "react";


export const th = "text-left font-semibold px-3 py-2 border-b border-border sticky top-0 bg-card";
export const td = "px-3 py-2 border-b border-border";

export function Table({ children }) {
  return (
    <div className="bg-card rounded-lg border border-border shadow-sm overflow-auto">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  );
}

import { Btn } from "@/shared/components/Btn";
// A delete button that asks "Sure?" on the first click (no browser dialog).
export function ConfirmDelete({ onConfirm, disabled, label = "Delete" }) {
  const [ask, setAsk] = useState(false);
  if (!ask) return <Btn variant="ghost" size="xs" disabled={disabled} onClick={() => setAsk(true)}>{label}</Btn>;
  return (
    <span className="inline-flex gap-1">
      <Btn variant="danger" size="xs" onClick={() => { setAsk(false); onConfirm(); }}>Sure?</Btn>
      <Btn variant="ghost" size="xs" onClick={() => setAsk(false)}>No</Btn>
    </span>
  );
}