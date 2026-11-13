import { GraduationCap, ExternalLink } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { Btn } from "@/shared/components/Btn";
import { openExternalLink } from "@/shared/utils/teams";

// No real LMS backend exists for this feature — it's a single external launcher card, not a
// browsable course list (the old 40-row invented mock table was never real data). Update this URL
// if/when a real learning-management-system link is provided.
const LEARNING_PORTAL_URL = "https://prestige.upgradlearnpro.com";

export default function LearningPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className={cn("bg-card rounded-lg border border-border shadow-sm p-8 max-w-md flex flex-col items-center gap-4 text-center animate-fade-in-up", "hover-lift")} style={{ animationDelay: "60ms" }}>
        <div className="w-14 h-14 rounded-full bg-secondary text-primary flex items-center justify-center">
          <GraduationCap size={26}/>
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">Continue Learning</h3>
          <p className="text-sm text-muted-foreground mt-1">Access courses, training modules, and certifications on the Learning Portal.</p>
        </div>
        <Btn variant="primary" onClick={() => openExternalLink(LEARNING_PORTAL_URL)}>
          Go to Learning Portal <ExternalLink size={14} className="shrink-0"/>
        </Btn>
      </div>
    </div>
  );
}
