import { useState } from "react";
import { ChevronUp, ChevronDown, Mail, AlertTriangle } from "lucide-react";
import { cn } from "@/shared/utils/cn";

export function OrgNodeCard({ node, level = 0 }) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = node.children && node.children.length > 0;

  const colors = ["bg-[#5B5FC7]","bg-[#038387]","bg-[#107C10]","bg-[#937700]","bg-[#5C2E91]","bg-[#C50F1F]"];
  const color = colors[level % colors.length];

  return (
    <div className="flex flex-col items-start">
      <div className={cn("flex items-start gap-3 pl-6 relative", level > 0 && "before:content-[''] before:absolute before:left-0 before:top-5 before:w-6 before:h-px before:bg-border")}>
        {level > 0 && <div className="absolute left-0 top-0 bottom-0 w-px bg-border"/>}
        <div className="bg-card border border-border rounded-xl shadow-sm p-4 flex items-start gap-3 transition-shadow min-w-[300px] max-w-[340px] hover:shadow-md hover-lift animate-fade-in-up" style={{ animationDelay: `${level*60}ms` }}>
          <div className={cn("w-10 h-10 rounded-md flex items-center justify-center text-white text-sm font-bold shrink-0 animate-pop-in", color)}>
            {node.name.split(" ").map(n=>n[0]).join("").slice(0,2)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-foreground whitespace-nowrap overflow-hidden text-ellipsis">{node.name}</p>
            <p className="text-xs text-primary whitespace-nowrap overflow-hidden text-ellipsis">{node.designation}</p>
            <p className="text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">{node.department}</p>
            <p className="text-[0.625rem] text-muted-foreground mt-0.5 flex items-center gap-1">
              <Mail size={9}/> {node.email}
            </p>
            {node.managerUnresolved && (
              <p className="text-[0.625rem] text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                <AlertTriangle size={9}/> Manager not on record
              </p>
            )}
          </div>
          {hasChildren && (
            <button onClick={() => setExpanded(v=>!v)}
              className="p-1 rounded-sm transition-colors shrink-0 mt-0.5 bg-transparent border-none cursor-pointer hover:bg-muted">
              {expanded ? <ChevronUp size={14} className="text-muted-foreground"/> : <ChevronDown size={14} className="text-muted-foreground"/>}
            </button>
          )}
        </div>
      </div>
      {hasChildren && expanded && (
        <div className="ml-6 mt-1 pl-6 relative flex flex-col gap-1 border-l border-border">
          {node.children.map(child => (
            <div key={child.id} className="mt-2">
              <OrgNodeCard node={child} level={level+1}/>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
