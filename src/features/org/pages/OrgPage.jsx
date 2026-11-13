import { Info } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { useOrgQuery } from "../hooks/useOrgQuery";
import { OrgNodeCard } from "../components/OrgNodeCard";
import { Spinner } from "@/shared/components/Spinner";

export default function OrgPage() {
  const { data: tree, isLoading } = useOrgQuery();

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card rounded-lg border border-border shadow-sm p-6 overflow-auto animate-fade-in-up" style={{ animationDelay: "60ms" }}>
        {isLoading || !tree ? (
          <Spinner message="Loading organization hierarchy…"/>
        ) : (
          <div className="min-w-[600px]">
            <OrgNodeCard node={tree} level={0}/>
          </div>
        )}
      </div>
      <div className="bg-secondary/50 border border-border rounded-lg p-4 text-sm text-muted-foreground flex items-start gap-2 animate-fade-in-up" style={{ animationDelay: "120ms" }}>
        <Info size={14} className="mt-0.5 shrink-0 text-primary"/>
        <span>Click the arrow on any node to expand or collapse team members. You are viewing the chain from the <strong className="text-foreground">top of the company</strong> down to <strong className="text-foreground">you</strong>, with your own team expanded below.</span>
      </div>
    </div>
  );
}
