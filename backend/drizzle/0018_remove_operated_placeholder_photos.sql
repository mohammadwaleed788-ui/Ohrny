DELETE FROM "user_photos"
WHERE "storage_key" ~ '^operated/[^/]+/photo-[0-9]+\.jpg$';
