-- ============================================================
-- CAMPUSLEARN — Fix Resource Types & Move Handouts
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. First, we must remove the strict CHECK constraint on the "type" column
--    (Previously, it only allowed 'note', 'ppt', 'extra')
ALTER TABLE public.resources DROP CONSTRAINT IF EXISTS resources_type_check;

-- 2. Move Handouts to the "handout" tab
UPDATE public.resources 
SET type = 'handout' 
WHERE title ILIKE '%handout%';

-- 3. Move Assignments to the "assignment" tab
UPDATE public.resources 
SET type = 'assignment' 
WHERE title ILIKE '%assignment%';

-- 4. Move Books to the "book" tab
UPDATE public.resources 
SET type = 'book' 
WHERE title ILIKE '%book%';

-- 5. Move Experiential Learning to the "experiential" tab
UPDATE public.resources 
SET type = 'experiential' 
WHERE title ILIKE '%experiential%';

-- 6. Move Lesson Plans / Syllabus to the "lesson_plan" tab
UPDATE public.resources 
SET type = 'lesson_plan' 
WHERE title ILIKE '%lesson plan%' OR title ILIKE '%syllabus%';

-- ============================================================
-- DONE
-- ============================================================
