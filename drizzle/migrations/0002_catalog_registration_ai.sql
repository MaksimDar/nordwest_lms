ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS credits integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS discipline text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS professor_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS max_seats integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS registration_open boolean NOT NULL DEFAULT true;

ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS ai_summary text;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS summary_status text NOT NULL DEFAULT 'none';

CREATE TABLE IF NOT EXISTS public.program_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program text NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'core',
  recommended_semester integer NOT NULL DEFAULT 1,
  UNIQUE (program, course_id)
);
GRANT SELECT ON public.program_requirements TO authenticated;
GRANT ALL ON public.program_requirements TO service_role;
ALTER TABLE public.program_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated reads program requirements" ON public.program_requirements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "student drops own enrolment" ON public.enrollments
  FOR DELETE TO authenticated USING (auth.uid() = student_id);

CREATE OR REPLACE FUNCTION public.course_seat_counts()
RETURNS TABLE(course_id uuid, enrolled bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT course_id, count(*) FROM public.enrollments GROUP BY course_id $$;
GRANT EXECUTE ON FUNCTION public.course_seat_counts() TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_course_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE cap integer; open boolean; taken bigint;
BEGIN
  SELECT max_seats, registration_open INTO cap, open FROM public.courses WHERE id = NEW.course_id;
  SELECT count(*) INTO taken FROM public.enrollments WHERE course_id = NEW.course_id;
  IF taken >= cap THEN RAISE EXCEPTION 'This course is full'; END IF;
  IF NOT open AND NEW.student_id = auth.uid() THEN RAISE EXCEPTION 'Registration for this course is closed'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS enrollments_capacity ON public.enrollments;
CREATE TRIGGER enrollments_capacity BEFORE INSERT ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_course_capacity();
CREATE UNIQUE INDEX IF NOT EXISTS enrollments_course_student_uniq ON public.enrollments(course_id, student_id);

DROP POLICY IF EXISTS "enrolled student reads released exams" ON public.exams;
CREATE POLICY "enrolled student reads released exams" ON public.exams FOR SELECT TO authenticated
  USING (status <> 'draft' AND EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = exams.course_id AND e.student_id = auth.uid()));
DROP POLICY IF EXISTS "enrolled student reads materials" ON public.materials;
CREATE POLICY "enrolled student reads materials" ON public.materials FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = materials.course_id AND e.student_id = auth.uid()));
DROP POLICY IF EXISTS "enrolled student reads tasks" ON public.tasks;
CREATE POLICY "enrolled student reads tasks" ON public.tasks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = tasks.course_id AND e.student_id = auth.uid()));