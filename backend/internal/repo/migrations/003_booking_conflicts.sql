CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap EXCLUDE USING gist (
    owner_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
);
