
-- Lecturers manage files inside folders named after their own course id.
CREATE POLICY "lecturer manages course material files"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'course-materials'
  AND EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.lecturer_id = auth.uid()
      AND c.id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'course-materials'
  AND EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.lecturer_id = auth.uid()
      AND c.id::text = (storage.foldername(name))[1]
  )
);

-- Enrolled students can read files of their courses.
CREATE POLICY "enrolled student reads course material files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-materials'
  AND EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.student_id = auth.uid()
      AND e.course_id::text = (storage.foldername(name))[1]
  )
);
