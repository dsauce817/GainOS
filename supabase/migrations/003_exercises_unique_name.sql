-- Add unique constraint on exercise name so the seed can be re-run safely
ALTER TABLE exercises ADD CONSTRAINT exercises_name_key UNIQUE (name);