-- Seed shift blocks (22 weekly recurring classes)
insert into public.shift_blocks (title, trainer, day_of_week, start_time, end_time, capacity, enrolled, color) values
  ('Morning Strength', 'Sara',  0, '07:00', '08:00', 12, 8,  '#6C63FF'),
  ('Cardio Blast',     'Jan',   0, '09:00', '10:00', 15, 10, '#FF6584'),
  ('Powerlifting',     'Max',   0, '17:00', '18:30', 10, 6,  '#43B89C'),
  ('Yoga Flow',        'Lisa',  1, '08:00', '09:00', 12, 9,  '#F5A623'),
  ('HIIT Circuit',     'Sara',  1, '12:00', '13:00', 15, 12, '#6C63FF'),
  ('Evening Run',      'Jan',   1, '18:00', '19:00', 20, 14, '#FF6584'),
  ('Core & Stretch',   'Lisa',  2, '07:30', '08:30', 12, 7,  '#F5A623'),
  ('Olympic Lifting',  'Max',   2, '10:00', '11:30', 8,  5,  '#43B89C'),
  ('Spin Class',       'Sara',  2, '17:30', '18:30', 16, 13, '#6C63FF'),
  ('Morning Yoga',     'Lisa',  3, '07:00', '08:00', 12, 10, '#F5A623'),
  ('Strength & Power', 'Max',   3, '11:00', '12:30', 10, 8,  '#43B89C'),
  ('HIIT Circuit',     'Sara',  3, '17:00', '18:00', 15, 11, '#6C63FF'),
  ('Cardio Blast',     'Jan',   4, '09:00', '10:00', 15, 9,  '#FF6584'),
  ('Powerlifting',     'Max',   4, '12:00', '13:30', 10, 7,  '#43B89C'),
  ('Evening Yoga',     'Lisa',  4, '18:30', '19:30', 12, 8,  '#F5A623'),
  ('Bootcamp',         'Jan',   5, '08:00', '09:30', 20, 16, '#FF6584'),
  ('Open Gym',         'Sara',  5, '10:00', '12:00', 25, 18, '#6C63FF'),
  ('Stretch & Relax',  'Lisa',  5, '14:00', '15:00', 12, 6,  '#F5A623'),
  ('Sunday Run',       'Jan',   6, '09:00', '10:00', 20, 12, '#FF6584'),
  ('Mobility Class',   'Lisa',  6, '11:00', '12:00', 12, 9,  '#F5A623'),
  ('Open Lifting',     'Max',   6, '14:00', '16:00', 10, 4,  '#43B89C'),
  ('Evening Wind-Down','Sara',  6, '19:00', '20:00', 15, 7,  '#6C63FF');

-- Seed one spontaneous opening
insert into public.spontaneous_openings (title, trainer, date, start_time, end_time, capacity, enrolled) values
  ('Extra Spin Session', 'Sara', to_char(now() + interval '1 day', 'YYYY-MM-DD'), '16:00', '17:00', 16, 3);
