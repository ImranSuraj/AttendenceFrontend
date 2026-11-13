import { MessageCircle } from "lucide-react";
import { useChatbotStore } from "../hooks/useChatbot";
import { cn } from "@/shared/utils/cn";

// The assistant's button for phones: a plain icon in a page's header (the floating round button is hidden on phones because it sat on top of tables, filters and page buttons).
export function ChatLauncher({ className }) {
  const open = useChatbotStore(s => s.open);
  return (
    <button type="button" onClick={open} aria-label="Ask the Employee Connect Assistant" title="Ask the Employee Connect Assistant"
      className={cn("md:hidden flex items-center justify-center w-[32px] h-[32px] rounded-full bg-transparent border-0 cursor-pointer text-[var(--colorBrandForeground1)] hover:bg-muted", className)}>
      <MessageCircle size={20}/>
    </button>
  );
}
