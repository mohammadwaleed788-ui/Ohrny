CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE INDEX "users_location_geog_gist_idx"
ON "users"
USING gist (
  (
    ST_SetSRID(
      ST_MakePoint(
        CAST("lng_approx" AS double precision),
        CAST("lat_approx" AS double precision)
      ),
      4326
    )::geography
  )
)
WHERE "lat_approx" IS NOT NULL
  AND "lng_approx" IS NOT NULL
  AND "lat_approx" ~ '^-?[0-9]+(\.[0-9]+)?$'
  AND "lng_approx" ~ '^-?[0-9]+(\.[0-9]+)?$';
