-- Discovery test seed for Ohrny
-- Safe to run multiple times (uses handle uniqueness + upserts).

BEGIN;

-- 1) Viewer account (the one you should login as in Postman)
WITH viewer AS (
  INSERT INTO users (
    handle,
    phone,
    phone_country,
    phone_verified,
    age,
    iam,
    orientation,
    city,
    country_code,
    lat_approx,
    lng_approx,
    location_granted,
    relationship_goal,
    rel_status,
    looking,
    id_verified,
    profile_complete_pct
  )
  VALUES (
    'viewer_seed',
    '1000000001',
    '+1',
    true,
    29,
    'man',
    ARRAY['women']::text[],
    'San Francisco',
    'US',
    '37.7749',
    '-122.4194',
    true,
    'dating',
    'single',
    'Looking for a serious relationship.',
    true,
    100
  )
  ON CONFLICT (handle) DO UPDATE SET
    lat_approx = EXCLUDED.lat_approx,
    lng_approx = EXCLUDED.lng_approx,
    age = EXCLUDED.age,
    relationship_goal = EXCLUDED.relationship_goal,
    updated_at = now()
  RETURNING id
)
INSERT INTO user_discover_preferences (
  user_id,
  min_distance,
  max_distance,
  age_min,
  age_max,
  relationship_type,
  photo_blur_visibility
)
SELECT
  id,
  0,
  15,
  24,
  36,
  'dating',
  70
FROM viewer
ON CONFLICT (user_id) DO UPDATE SET
  min_distance = EXCLUDED.min_distance,
  max_distance = EXCLUDED.max_distance,
  age_min = EXCLUDED.age_min,
  age_max = EXCLUDED.age_max,
  relationship_type = EXCLUDED.relationship_type,
  photo_blur_visibility = EXCLUDED.photo_blur_visibility,
  updated_at = now();

-- 2) Nearby matchable candidates (should appear)
INSERT INTO users (
  handle, phone, phone_country, phone_verified, age, iam, orientation, city, country_code,
  lat_approx, lng_approx, location_granted, relationship_goal, rel_status, pronouns, looking,
  id_verified, profile_complete_pct
)
VALUES
  ('seed_alex', '1000000002', '+1', true, 28, 'woman', ARRAY['men']::text[], 'San Francisco', 'US',
   '37.7840', '-122.4090', true, 'dating', 'single', 'she/her', 'Slow-built and intentional', true, 100),
  ('seed_maya', '1000000003', '+1', true, 31, 'woman', ARRAY['men']::text[], 'San Francisco', 'US',
   '37.7650', '-122.4310', true, 'dating', 'single', 'she/they', 'Real connection and good conversation', true, 100)
ON CONFLICT (handle) DO NOTHING;

-- 3) Excluded-by-filter samples (for validation)
-- Too far
INSERT INTO users (
  handle, phone, phone_country, phone_verified, age, iam, orientation, city, country_code,
  lat_approx, lng_approx, location_granted, relationship_goal, rel_status, pronouns, looking,
  id_verified, profile_complete_pct
)
VALUES
  ('seed_far', '1000000004', '+1', true, 30, 'woman', ARRAY['men']::text[], 'San Jose', 'US',
   '37.3382', '-121.8863', true, 'dating', 'single', 'she/her', 'Open to dating', true, 100)
ON CONFLICT (handle) DO NOTHING;

-- Age out of range
INSERT INTO users (
  handle, phone, phone_country, phone_verified, age, iam, orientation, city, country_code,
  lat_approx, lng_approx, location_granted, relationship_goal, rel_status, pronouns, looking,
  id_verified, profile_complete_pct
)
VALUES
  ('seed_age_out', '1000000005', '+1', true, 42, 'woman', ARRAY['men']::text[], 'San Francisco', 'US',
   '37.7800', '-122.4200', true, 'dating', 'single', 'she/her', 'Looking for kind people', true, 100)
ON CONFLICT (handle) DO NOTHING;

-- Relationship mismatch
INSERT INTO users (
  handle, phone, phone_country, phone_verified, age, iam, orientation, city, country_code,
  lat_approx, lng_approx, location_granted, relationship_goal, rel_status, pronouns, looking,
  id_verified, profile_complete_pct
)
VALUES
  ('seed_rel_mismatch', '1000000006', '+1', true, 30, 'woman', ARRAY['men']::text[], 'San Francisco', 'US',
   '37.7810', '-122.4140', true, 'serious', 'single', 'she/her', 'Long term only', true, 100)
ON CONFLICT (handle) DO NOTHING;

-- 4) Add prompts + interests for visible candidates
WITH candidate_ids AS (
  SELECT id, handle
  FROM users
  WHERE handle IN ('seed_alex', 'seed_maya')
)
INSERT INTO user_prompts (user_id, position, title, answer)
SELECT id, 1, 'A PERFECT SUNDAY', 'Coffee, bookstores, and a long walk.'
FROM candidate_ids
ON CONFLICT (user_id, position) DO UPDATE SET
  title = EXCLUDED.title,
  answer = EXCLUDED.answer,
  updated_at = now();

WITH candidate_ids AS (
  SELECT id, handle
  FROM users
  WHERE handle IN ('seed_alex', 'seed_maya')
)
INSERT INTO user_interests (user_id, interest, position)
SELECT id, interest, position
FROM candidate_ids
CROSS JOIN (
  VALUES
    ('Bookstores', 0),
    ('Coffee', 1),
    ('Long walks', 2),
    ('Live music', 3)
) AS i(interest, position)
ON CONFLICT DO NOTHING;

COMMIT;

-- Optional quick check query:
-- SELECT handle, age, relationship_goal, lat_approx, lng_approx FROM users WHERE handle LIKE 'seed_%' OR handle='viewer_seed' ORDER BY handle;
