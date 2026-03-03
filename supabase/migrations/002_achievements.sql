-- GainOS Achievement Definitions
-- All achievements with slugs, descriptions, and XP values

INSERT INTO achievement_definitions (slug, name, description, icon, color, category, xp_value, is_hidden) VALUES

-- MILESTONES
('first_workout',      'First Rep',           'Logged your very first workout',                                   '🏋️', '#6366f1', 'milestone',    100, false),
('workouts_10',        'Getting Consistent',  'Completed 10 workouts',                                           '🔟', '#8b5cf6', 'milestone',    200, false),
('workouts_25',        'Quarter Century',     'Completed 25 workouts',                                           '🥈', '#7c3aed', 'milestone',    500, false),
('workouts_50',        'Halfway to 100',      'Completed 50 workouts',                                           '🥇', '#6d28d9', 'milestone',    750, false),
('workouts_100',       'Century Club',        'Completed 100 workouts. Absolute unit.',                          '💯', '#5b21b6', 'milestone',   1000, false),
('workouts_365',       'Year of Gains',       'Completed 365 workouts. You are the gym.',                        '🏆', '#4c1d95', 'milestone',   2500, false),

-- STREAKS
('streak_3',           'Warm Up',             '3-day workout streak',                                            '🔥', '#f97316', 'streak',       150, false),
('streak_7',           'Week Warrior',        '7-day streak — full week, no excuses',                            '🔥', '#ea580c', 'streak',       300, false),
('streak_14',          'Two Week Terror',     '14-day streak. Your rest days are other people''s gym days.',     '🔥', '#c2410c', 'streak',       600, false),
('streak_30',          'Monthly Monster',     '30-day workout streak',                                           '🌋', '#9a3412', 'streak',      1000, false),
('streak_100',         'Centurion',           '100-day streak. Legendary.',                                      '⚡', '#7c2d12', 'streak',      2000, false),

-- STRENGTH PRs
('first_pr',           'PR Machine',          'Hit your first personal record',                                  '🎯', '#22c55e', 'strength',     200, false),
('pr_5',               'PR Collector',        'Hit 5 personal records',                                          '🎯', '#16a34a', 'strength',     400, false),
('pr_25',              'PR Factory',          'Hit 25 personal records',                                         '🎯', '#15803d', 'strength',     800, false),
('pr_100',             'PR Legend',           'Hit 100 personal records. Beast mode: permanent.',                '👑', '#166534', 'strength',    2000, false),
('big_3_club',         'Big 3 Club',          'Logged squat, bench press, and deadlift in a single week',        '🏅', '#eab308', 'strength',     500, false),
('plate_club',         'Plate Club',          'Benched 1 plate (60kg / 135lbs)',                                 '🍽️', '#ca8a04', 'strength',     750, false),
('two_plate_club',     'Two Plate Club',      'Benched 2 plates (100kg / 225lbs)',                               '🍽️🍽️', '#a16207', 'strength',  1500, false),
('bodyweight_bench',   'Bodyweight Bench',    'Benched your own bodyweight',                                     '⚖️', '#92400e', 'strength',     600, false),
('deadlift_2x',        'Double Trouble',      'Deadlifted 2× your bodyweight',                                   '🐉', '#78350f', 'strength',    1000, false),

-- VOLUME
('volume_1000',        'Ton Moved',           'Moved 1,000 kg in a single workout',                              '💪', '#3b82f6', 'volume',       300, false),
('volume_5000',        'Volume King',         'Moved 5,000 kg in a single workout',                              '🦍', '#2563eb', 'volume',       600, false),
('total_volume_100k',  '100K Club',           'Lifted 100,000 kg total lifetime volume',                         '🚀', '#1d4ed8', 'volume',      1000, false),
('total_volume_1m',    'Million Lifter',      'Lifted 1,000,000 kg total lifetime volume',                       '🌌', '#1e40af', 'volume',      5000, false),

-- CONSISTENCY
('first_checkin',      'Self Aware',          'Logged your first body check-in',                                 '📏', '#ec4899', 'consistency',  150, false),
('checkins_12',        'Tracking Machine',    '12 consecutive weekly check-ins',                                 '📊', '#db2777', 'consistency',  500, false),
('log_nutrition',      'Counting Macros',     'Logged nutrition for 7 consecutive days',                         '🥗', '#be185d', 'consistency',  300, false),
('cardio_5',           'Cardio Curious',      'Logged 5 cardio sessions',                                        '🏃', '#9d174d', 'consistency',  200, false),
('cardio_50',          'Cardio Queen',        'Logged 50 cardio sessions',                                       '🏃', '#831843', 'consistency',  800, false),
('steps_10k',          '10K Steps',           'Hit 10,000 steps in a day',                                       '👣', '#f59e0b', 'consistency',  100, false),
('steps_7_days',       'Step Streak',         '10K+ steps for 7 consecutive days',                               '👣', '#d97706', 'consistency',  400, false),

-- HIDDEN / SECRET
('early_bird',         'Early Bird',          'Logged a workout before 6 AM',                                    '🌅', '#fbbf24', 'milestone',    200, true),
('night_owl',          'Night Owl',           'Logged a workout after 10 PM',                                    '🦉', '#1e293b', 'milestone',    200, true),
('weekend_warrior',    'Weekend Warrior',     'Completed 4 workouts in a single weekend',                        '🛡️', '#7c3aed', 'milestone',    300, true),
('chat_with_coach',    'Ask the Coach',       'Had your first AI coaching session',                              '🤖', '#06b6d4', 'milestone',    150, true),
('comeback_kid',       'Comeback Kid',        'Returned to training after a 2+ week break',                      '💫', '#8b5cf6', 'milestone',    300, true);
