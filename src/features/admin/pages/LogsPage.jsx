import LogsSection from "../components/LogsSection";

// Admin > Logs (ITAdmin only): download the server's daily log files for a date range as one zip.
export default function LogsPage() {
  return (
    <div className="flex flex-col gap-4">
      <LogsSection/>
    </div>
  );
}