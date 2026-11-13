import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { cardCls, UploadBox } from "../components/adminKit";
import { uploadCalendarPattern } from "../services/calendarPatterns.service";
import { useUploadMutation } from "../hooks/useUploadMutation";

// Admin > Calendar Upload (HR Admin): the weekly offs and holidays of each calendar pattern, from a CSV. Every row replaces what is stored for the same date and
// pattern; canteen is Y or N. Nothing is saved when any row is wrong.
export default function CalendarPatternUploadPage() {
  const [message, setMessage] = useState("");
  const upload = useUploadMutation(uploadCalendarPattern);

  const submit = async (file) => {
    const done = await upload.mutateAsync(file);
    setMessage(done);
    toast.success(done);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className={cardCls}>
        <UploadBox ext=".csv" name="Calendar Upload" anyOrder columns={["Date", "Day Type", "Calendar Pattern", "Canteen"]} templateName="Calendar_Upload_Template" busy={upload.isPending} onUpload={submit}
          note="Only the template format is accepted. Dates must be in yyyy-MM-dd or dd/MM/yyyy format." />
      </div>
      {message && <div className={`${cardCls} flex items-center gap-2 text-sm`}><CheckCircle size={18} className="text-green-600" /> {message}</div>}
    </div>
  );
}
