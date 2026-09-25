import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpenCheck, ChevronDown, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { summarizeMaterial } from "@/lib/ai.functions";

export function StudySummary({
  materialId,
  summary,
  status,
  canGenerate,
}: {
  materialId: string;
  summary: string | null;
  status: string | null;
  canGenerate?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const run = useServerFn(summarizeMaterial);
  const gen = useMutation({
    mutationFn: () => run({ data: { materialId } }),
    onSuccess: () => {
      toast.success("AI study summary ready");
      setOpen(true);
      qc.invalidateQueries({ queryKey: ["materials"] });
      qc.invalidateQueries({ queryKey: ["portal"] });
    },
    onError: (e: Error) => toast.error(e.message || "Summary could not be created"),
  });

  const pending = gen.isPending || status === "pending";

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        {summary ? (
          <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => setOpen(!open)}>
            <BookOpenCheck className="mr-1 size-3.5" /> AI study summary
            <ChevronDown className={`ml-1 size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </Button>
        ) : pending ? (
          <span className="text-xs text-muted-foreground">AI study summary is being written…</span>
        ) : !canGenerate ? (
          <span className="text-xs text-muted-foreground">No AI summary yet</span>
        ) : null}
        {canGenerate ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            disabled={gen.isPending}
            onClick={() => gen.mutate()}
          >
            <RefreshCw className={`mr-1 size-3.5 ${gen.isPending ? "animate-spin" : ""}`} />
            {summary ? "Regenerate" : status === "failed" ? "Retry summary" : "Create AI summary"}
          </Button>
        ) : null}
      </div>
      {open && summary ? (
        <div className="prose prose-sm mt-2 max-w-none rounded-md border border-border bg-secondary/40 p-3 text-sm">
          <p className="!mt-0 text-xs text-muted-foreground">
            Optional study aid written by AI — always check against the original material.
          </p>
          <ReactMarkdown>{summary}</ReactMarkdown>
        </div>
      ) : null}
    </div>
  );
}
