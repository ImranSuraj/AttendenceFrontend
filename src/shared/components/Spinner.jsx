import { cn } from "../utils/cn";

// Shared loading state for any section fetching real backend data. The spinner is the Fluent (Teams) one: a thin
// neutral ring with a brand-coloured arc turning around it. Use whenever a query's own isLoading/isFetching should
// show more than a blank/empty table, especially for listings that can grow (Employees, Attendance, Leave).
export function Spinner({ message = "Loading…", size = 32, className = "" }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-10 text-center", className)} role="status" aria-live="polite">
      <span
        className="inline-block rounded-full border-solid animate-spin"
        style={{
          width: size, height: size, borderWidth: 3,
          borderColor: "var(--colorNeutralStroke2)", borderTopColor: "var(--colorBrandStroke1)",
          animationDuration: "1.1s", animationTimingFunction: "linear",
        }}
      />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}