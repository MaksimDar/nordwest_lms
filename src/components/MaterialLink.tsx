import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function MaterialLink({
  url,
  filePath,
}: {
  url: string | null;
  filePath: string | null;
}) {
  if (url) {
    return (
      <Button asChild size="sm" variant="ghost" aria-label="Open material">
        <a href={url} target="_blank" rel="noreferrer">
          <ExternalLink className="size-4" />
        </a>
      </Button>
    );
  }
  if (!filePath) return null;

  async function open() {
    const { data, error } = await supabase.storage
      .from("course-materials")
      .createSignedUrl(filePath!, 3600);
    if (error || !data) return toast.error("This file could not be opened");
    window.open(data.signedUrl, "_blank", "noreferrer");
  }

  return (
    <Button size="sm" variant="ghost" onClick={open} aria-label="Open file">
      <ExternalLink className="size-4" />
    </Button>
  );
}
