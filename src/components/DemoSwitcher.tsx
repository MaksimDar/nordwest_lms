import { Repeat } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { demoAccounts, signInAsDemo } from "@/lib/demo";

export function DemoSwitcher({ currentEmail }: { currentEmail: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 bg-accent px-4 py-2 text-xs text-accent-foreground">
      <span className="flex items-center gap-1 font-semibold">
        <Repeat className="size-3.5" /> Live demo — switch profile:
      </span>
      {demoAccounts.map((a) => {
        const active = a.email === currentEmail;
        return (
          <Button
            key={a.key}
            size="sm"
            variant={active ? "default" : "outline"}
            className="h-7 border-accent-foreground/30 bg-transparent px-3 text-xs data-[active=true]:bg-primary"
            data-active={active}
            disabled={active || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await signInAsDemo(a.key);
              } catch (e) {
                toast.error((e as Error).message);
                setBusy(false);
              }
            }}
          >
            {a.name.replace("Prof. Dr. ", "")} ({a.key === "anna" ? "Professor" : "Student"})
          </Button>
        );
      })}
    </div>
  );
}
