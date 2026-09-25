import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — NordWest LMS" },
      {
        name: "description",
        content: "Reminders, task alerts and result announcements from your lecturers.",
      },
      { property: "og:title", content: "Notifications — NordWest LMS" },
      {
        property: "og:description",
        content: "All your NordWest LMS alerts in one list.",
      },
    ],
  }),
  component: Notifications,
});

function Notifications() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const notifications = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <AppShell title="Notifications" subtitle="Reminders, task alerts and published results.">
      <section className="panel p-6">
        {notifications.data?.length ? (
          <ul className="divide-y divide-border">
            {notifications.data.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-4 py-4">
                <div>
                  <p className="font-medium">{n.title}</p>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
                {n.read ? (
                  <Badge variant="secondary">Read</Badge>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => markRead.mutate(n.id)}>
                    Mark read
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        )}
      </section>
    </AppShell>
  );
}
