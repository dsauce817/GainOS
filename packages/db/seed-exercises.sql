-- GainOS Exercise Database Seed
-- Insert common exercises into the exercises table

INSERT INTO exercises (name, muscle_groups, secondary_muscles, equipment, category, force, is_active) VALUES
-- Chest Exercises
('Barbell Bench Press', ARRAY['chest'], ARRAY['triceps', 'shoulders'], 'Barbell', 'Compound', 'Push', true),
('Incline Barbell Bench Press', ARRAY['chest'], ARRAY['shoulders', 'triceps'], 'Barbell', 'Compound', 'Push', true),
('Dumbbell Bench Press', ARRAY['chest'], ARRAY['triceps', 'shoulders'], 'Dumbbell', 'Compound', 'Push', true),
('Dumbbell Incline Press', ARRAY['chest'], ARRAY['shoulders', 'triceps'], 'Dumbbell', 'Compound', 'Push', true),
('Machine Chest Press', ARRAY['chest'], ARRAY['triceps', 'shoulders'], 'Machine', 'Compound', 'Push', true),
('Chest Dip', ARRAY['chest'], ARRAY['triceps', 'shoulders'], 'Bodyweight', 'Compound', 'Push', true),
('Pec Deck Fly', ARRAY['chest'], ARRAY[]::text[], 'Machine', 'Isolation', 'Push', true),
('Dumbbell Fly', ARRAY['chest'], ARRAY[]::text[], 'Dumbbell', 'Isolation', 'Push', true),
('Cable Crossover', ARRAY['chest'], ARRAY[]::text[], 'Cable', 'Isolation', 'Push', true),

-- Back/Lats Exercises
('Barbell Deadlift', ARRAY['lats', 'back'], ARRAY['glutes', 'hamstrings'], 'Barbell', 'Compound', 'Pull', true),
('Conventional Deadlift', ARRAY['lats', 'back'], ARRAY['glutes', 'hamstrings'], 'Barbell', 'Compound', 'Pull', true),
('Lat Pulldown', ARRAY['lats'], ARRAY['back'], 'Machine', 'Compound', 'Pull', true),
('Pull-up', ARRAY['lats', 'back'], ARRAY['biceps'], 'Bodyweight', 'Compound', 'Pull', true),
('Chin-up', ARRAY['lats', 'back'], ARRAY['biceps'], 'Bodyweight', 'Compound', 'Pull', true),
('Barbell Row', ARRAY['lats', 'back'], ARRAY['biceps'], 'Barbell', 'Compound', 'Pull', true),
('Dumbbell Row', ARRAY['lats', 'back'], ARRAY['biceps'], 'Dumbbell', 'Compound', 'Pull', true),
('Chest-Supported Row', ARRAY['lats', 'back'], ARRAY['biceps'], 'Machine', 'Compound', 'Pull', true),
('Seal Row', ARRAY['lats', 'back'], ARRAY['biceps'], 'Dumbbell', 'Isolation', 'Pull', true),
('Machine Row', ARRAY['lats', 'back'], ARRAY['biceps'], 'Machine', 'Compound', 'Pull', true),

-- Shoulder Exercises
('Overhead Press', ARRAY['shoulders'], ARRAY['triceps', 'chest'], 'Barbell', 'Compound', 'Push', true),
('Dumbbell Overhead Press', ARRAY['shoulders'], ARRAY['triceps', 'chest'], 'Dumbbell', 'Compound', 'Push', true),
('Machine Shoulder Press', ARRAY['shoulders'], ARRAY['triceps', 'chest'], 'Machine', 'Compound', 'Push', true),
('Lateral Raise', ARRAY['shoulders'], ARRAY[]::text[], 'Dumbbell', 'Isolation', 'Push', true),
('Machine Lateral Raise', ARRAY['shoulders'], ARRAY[]::text[], 'Machine', 'Isolation', 'Push', true),
('Cable Lateral Raise', ARRAY['shoulders'], ARRAY[]::text[], 'Cable', 'Isolation', 'Push', true),
('Rear Delt Fly', ARRAY['shoulders'], ARRAY['back'], 'Dumbbell', 'Isolation', 'Push', true),
('Reverse Pec Deck', ARRAY['shoulders'], ARRAY['back'], 'Machine', 'Isolation', 'Push', true),
('Face Pull', ARRAY['shoulders'], ARRAY['back'], 'Cable', 'Isolation', 'Pull', true),
('Upright Row', ARRAY['shoulders'], ARRAY['traps'], 'Barbell', 'Compound', 'Pull', true),

-- Arm Exercises (Biceps)
('Barbell Curl', ARRAY['biceps'], ARRAY[]::text[], 'Barbell', 'Isolation', 'Pull', true),
('Dumbbell Curl', ARRAY['biceps'], ARRAY[]::text[], 'Dumbbell', 'Isolation', 'Pull', true),
('EZ Bar Curl', ARRAY['biceps'], ARRAY[]::text[], 'EZ-Bar', 'Isolation', 'Pull', true),
('Machine Curl', ARRAY['biceps'], ARRAY[]::text[], 'Machine', 'Isolation', 'Pull', true),
('Preacher Curl', ARRAY['biceps'], ARRAY[]::text[], 'Barbell', 'Isolation', 'Pull', true),
('Cable Curl', ARRAY['biceps'], ARRAY[]::text[], 'Cable', 'Isolation', 'Pull', true),
('Hammer Curl', ARRAY['biceps'], ARRAY['forearms'], 'Dumbbell', 'Isolation', 'Pull', true),

-- Arm Exercises (Triceps)
('Close Grip Bench Press', ARRAY['triceps'], ARRAY['chest'], 'Barbell', 'Compound', 'Push', true),
('Tricep Dip', ARRAY['triceps'], ARRAY['chest'], 'Bodyweight', 'Compound', 'Push', true),
('Tricep Pushdown', ARRAY['triceps'], ARRAY[]::text[], 'Cable', 'Isolation', 'Push', true),
('Rope Pushdown', ARRAY['triceps'], ARRAY[]::text[], 'Cable', 'Isolation', 'Push', true),
('Dumbbell Overhead Extension', ARRAY['triceps'], ARRAY[]::text[], 'Dumbbell', 'Isolation', 'Push', true),
('EZ Bar Skullcrusher', ARRAY['triceps'], ARRAY[]::text[], 'EZ-Bar', 'Isolation', 'Push', true),
('Machine Tricep Extension', ARRAY['triceps'], ARRAY[]::text[], 'Machine', 'Isolation', 'Push', true),

-- Leg Exercises (Quads)
('Barbell Squat', ARRAY['quads'], ARRAY['glutes', 'hamstrings'], 'Barbell', 'Compound', 'Push', true),
('Goblet Squat', ARRAY['quads'], ARRAY['glutes', 'hamstrings'], 'Dumbbell', 'Compound', 'Push', true),
('Leg Press', ARRAY['quads'], ARRAY['glutes', 'hamstrings'], 'Machine', 'Compound', 'Push', true),
('Smith Machine Squat', ARRAY['quads'], ARRAY['glutes', 'hamstrings'], 'Machine', 'Compound', 'Push', true),
('Hack Squat', ARRAY['quads'], ARRAY['glutes', 'hamstrings'], 'Machine', 'Compound', 'Push', true),
('Leg Extension', ARRAY['quads'], ARRAY[]::text[], 'Machine', 'Isolation', 'Push', true),
('V-Squat', ARRAY['quads'], ARRAY['glutes', 'hamstrings'], 'Machine', 'Compound', 'Push', true),

-- Leg Exercises (Hamstrings/Glutes)
('Romanian Deadlift', ARRAY['hamstrings', 'glutes'], ARRAY['lats', 'back'], 'Barbell', 'Compound', 'Pull', true),
('Leg Curl', ARRAY['hamstrings'], ARRAY[]::text[], 'Machine', 'Isolation', 'Pull', true),
('Lying Leg Curl', ARRAY['hamstrings'], ARRAY[]::text[], 'Machine', 'Isolation', 'Pull', true),
('Single Leg Curl', ARRAY['hamstrings'], ARRAY[]::text[], 'Machine', 'Isolation', 'Pull', true),
('Hip Thrust', ARRAY['glutes'], ARRAY['hamstrings'], 'Barbell', 'Compound', 'Push', true),
('Smith Machine Hip Thrust', ARRAY['glutes'], ARRAY['hamstrings'], 'Machine', 'Compound', 'Push', true),
('Machine Hip Thrust', ARRAY['glutes'], ARRAY['hamstrings'], 'Machine', 'Compound', 'Push', true),
('Cable Pull Through', ARRAY['glutes', 'hamstrings'], ARRAY[]::text[], 'Cable', 'Isolation', 'Pull', true),

-- Core Exercises
('Barbell Ab Wheel', ARRAY['core'], ARRAY[]::text[], 'Barbell', 'Isolation', 'Push', true),
('Ab Wheel Rollout', ARRAY['core'], ARRAY[]::text[], 'Bodyweight', 'Isolation', 'Push', true),
('Machine Ab Crunch', ARRAY['core'], ARRAY[]::text[], 'Machine', 'Isolation', 'Push', true),
('Cable Crunch', ARRAY['core'], ARRAY[]::text[], 'Cable', 'Isolation', 'Push', true),
('Rope Crunch', ARRAY['core'], ARRAY[]::text[], 'Cable', 'Isolation', 'Push', true),
('Hanging Leg Raise', ARRAY['core'], ARRAY[]::text[], 'Bodyweight', 'Isolation', 'Push', true),
('Decline Sit-up', ARRAY['core'], ARRAY[]::text[], 'Bodyweight', 'Isolation', 'Push', true),
('Weighted Crunch', ARRAY['core'], ARRAY[]::text[], 'Plate', 'Isolation', 'Push', true),

-- Cardio/Functional
('Treadmill Running', ARRAY['cardio'], ARRAY[]::text[], 'Treadmill', 'Cardio', NULL, true),
('Stationary Bike', ARRAY['cardio'], ARRAY[]::text[], 'Machine', 'Cardio', NULL, true),
('Rowing Machine', ARRAY['cardio'], ARRAY['back', 'lats'], 'Machine', 'Cardio', NULL, true),
('Stair Climber', ARRAY['cardio'], ARRAY['quads', 'glutes'], 'Machine', 'Cardio', NULL, true),
('Jump Rope', ARRAY['cardio'], ARRAY['quads', 'calves'], 'Rope', 'Cardio', NULL, true),
('Battle Ropes', ARRAY['cardio'], ARRAY['shoulders', 'core'], 'Rope', 'Cardio', NULL, true);
