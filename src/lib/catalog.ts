import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

export function useCatalog() {
  return useQuery({
    queryKey: ["catalog"],
    queryFn: async () => {
      const [{ data: courses, error }, { data: seats }] = await Promise.all([
        supabase.from("courses").select("*").order("code"),
        supabase.rpc("course_seat_counts"),
      ]);
      if (error) throw error;
      const taken = new Map((seats ?? []).map((s) => [s.course_id, Number(s.enrolled)]));
      return (courses ?? []).map((c) => ({ ...c, enrolled: taken.get(c.id) ?? 0 }));
    },
  });
}

export function useMyEnrollments(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-enrollments", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*")
        .eq("student_id", userId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRegistration(userId: string | undefined, semester: number) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["catalog"] });
    qc.invalidateQueries({ queryKey: ["my-enrollments"] });
    qc.invalidateQueries({ queryKey: ["portal"] });
  };
  const register = useMutation({
    mutationFn: async (course: { id: string; code: string }) => {
      const { error } = await supabase
        .from("enrollments")
        .insert({ course_id: course.id, student_id: userId!, semester_level: semester });
      if (error) throw new Error(error.message);
      return course;
    },
    onSuccess: (c) => {
      toast.success(`Registered for ${c.code}`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const drop = useMutation({
    mutationFn: async (course: { id: string; code: string }) => {
      const { error } = await supabase
        .from("enrollments")
        .delete()
        .eq("course_id", course.id)
        .eq("student_id", userId!);
      if (error) throw new Error(error.message);
      return course;
    },
    onSuccess: (c) => {
      toast.success(`Dropped ${c.code}`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return { register, drop };
}
