import { cn } from "../utils/cn";

// A page's filters: the controls sit on the page inside a <div className={className}> (pass the classes the page used for its filter card), followed by the page's `toolbar`
// (search / export). On a narrow screen the row wraps onto more lines. The other props (activeCount, onReset, title ...) are accepted so existing pages keep working, and are not used.
export function FilterPanel({ children, className, toolbar }) {
  return <div className={cn(className)}>{children}{toolbar}</div>;
}