import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, FileText, Plus, Trash2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth";
import { useMyCourses, materialKinds } from "@/lib/lms";

export const Route = createFileRoute("/_authenticated/teach")({
  head: () => ({
    meta: [
      { title: "teachMyStudent — NordWest LMS" },
      {
        name: "description",
        content:
          "Course descriptions and slide sets: upload PDFs, videos, links, glossaries and literature.",
      },
      { property: "og:title", content: "teachMyStudent — NordWest LMS" },
      {
        property: "og:description",
        content: "Your teaching material library for every NordWest course.",
      },
    ],
  }),
  component: TeachMyStudent,
});

function TeachMyStudent() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const courses = useMyCourses(user?.id);
  const [courseId, setCourseId] = useState("");
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const activeCourse = courses.data?.find((c) => c.id === courseId) ?? courses.data?.[0];
  const activeId = activeCourse?.id;

  const materials = useQuery({
    queryKey: ["materials", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .eq("course_id", activeId!)
        .order("lecture_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveDescription = useMutation({
    mutationFn: async (form: FormData) => {
      const { error } = await supabase
        .from("courses")
        .update({
          description: String(form.get("description") ?? ""),
          name: String(form.get("name") ?? ""),
        })
        .eq("id", activeId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Course description saved");
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMaterial = useMutation({
    mutationFn: async (form: FormData) => {
      const file = form.get("file") as File | null;
      let filePath: string | null = null;
      let url = (form.get("url") as string) || null;

      if (file && file.size > 0) {
        setUploading(true);
        const path = `${activeId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error: upErr } = await supabase.storage
          .from("course-materials")
          .upload(path, file);
        setUploading(false);
        if (upErr) throw upErr;
        filePath = path;
        url =
          supabase.storage.from("course-materials").getPublicUrl(path).data.publicUrl ?? url;
      }

      const { error } = await supabase.from("materials").insert({
        course_id: activeId!,
        title: String(form.get("title") ?? ""),
        kind: String(form.get("kind") ?? "slides"),
        lecture_date: (form.get("lecture_date") as string) || null,
        notes: String(form.get("notes") ?? ""),
        url,
        file_path: filePath,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Material uploaded");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["materials"] });
    },
    onError: (e: Error) => {
      setUploading(false);
      toast.error(e.message);
    },
  });

  const removeMaterial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["materials"] }),
  });

  return (
    <AppShell
      title="teachMyStudent"
      subtitle="Course descriptions and slide sets — everything your students need to learn."
      actions={
        <div className="flex items-center gap-2">
          <Select value={activeId ?? ""} onValueChange={setCourseId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select course" />
            </SelectTrigger>
            <SelectContent>
              {(courses.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.code} · {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={!activeId}>
                <Plus className="mr-1 size-4" /> Upload material
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload teaching material</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  addMaterial.mutate(new FormData(e.currentTarget));
                }}
              >
                <div>
                  <Label htmlFor="m-title">Title</Label>
                  <Input id="m-title" name="title" required placeholder="Lecture 1 — Introduction" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Format</Label>
                    <Select name="kind" defaultValue="slides">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {materialKinds.map((k) => (
                          <SelectItem key={k} value={k} className="capitalize">
                            {k}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="m-date">Lecture date</Label>
                    <Input id="m-date" name="lecture_date" type="date" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="m-file">File (PDF, video, document)</Label>
                  <Input id="m-file" name="file" type="file" />
                </div>
                <div>
                  <Label htmlFor="m-url">…or a link</Label>
                  <Input id="m-url" name="url" placeholder="https://" />
                </div>
                <div>
                  <Label htmlFor="m-notes">Notes for students</Label>
                  <Textarea id="m-notes" name="notes" rows={3} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={addMaterial.isPending || uploading}>
                    {uploading ? "Uploading…" : "Add material"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <div className="space-y-6">
        {activeCourse ? (
          <section className="panel p-6">
            <p className="eyebrow text-muted-foreground">Course description</p>
            <form
              className="mt-4 grid gap-4 md:grid-cols-[auto_1fr]"
              onSubmit={(e) => {
                e.preventDefault();
                saveDescription.mutate(new FormData(e.currentTarget));
              }}
            >
              <div className="hero-surface flex size-20 items-center justify-center rounded-xl font-display text-2xl font-bold">
                {activeCourse.code.slice(0, 2).toUpperCase()}
              </div>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="c-name">Course name</Label>
                  <Input id="c-name" name="name" defaultValue={activeCourse.name} key={activeCourse.id + "n"} />
                </div>
                <div>
                  <Label htmlFor="c-desc">Short description</Label>
                  <Textarea
                    id="c-desc"
                    name="description"
                    rows={3}
                    defaultValue={activeCourse.description}
                    key={activeCourse.id + "d"}
                  />
                </div>
                <Button type="submit" variant="secondary" disabled={saveDescription.isPending}>
                  Save description
                </Button>
              </div>
            </form>
          </section>
        ) : (
          <div className="panel p-8 text-center text-sm text-muted-foreground">
            Create a course on your dashboard first.
          </div>
        )}

        <section className="panel p-6">
          <h2 className="font-display text-lg font-bold">Slide sets & materials</h2>
          {materials.data?.length ? (
            <ul className="mt-4 divide-y divide-border">
              {materials.data.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-4 py-4">
                  <div className="flex gap-3">
                    <FileText className="mt-1 size-5 text-accent" />
                    <div>
                      <p className="font-medium">{m.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {m.lecture_date ? `Lecture ${m.lecture_date}` : "No lecture date"}
                      </p>
                      {m.notes ? <p className="mt-1 text-sm">{m.notes}</p> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {m.kind}
                    </Badge>
                    {m.url ? (
                      <Button asChild size="sm" variant="ghost">
                        <a href={m.url} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-4" />
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeMaterial.mutate(m.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No material yet. Upload slides, PDFs, videos, links, glossaries or literature.
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
