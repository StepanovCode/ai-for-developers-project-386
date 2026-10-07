-- Bookings are read for availability now; public creation arrives in ticket 18.
CREATE TABLE bookings (
 id uuid PRIMARY KEY CHECK (substring(id::text,15,1) = '4'),
 event_type_id uuid NOT NULL REFERENCES event_types(id),
 owner_id text NOT NULL CHECK (owner_id = 'default'),
 guest_name text NOT NULL CHECK (char_length(guest_name) BETWEEN 1 AND 100 AND guest_name !~ E'[\r\n\u2028\u2029]'),
 guest_email text NOT NULL CHECK (char_length(guest_email) BETWEEN 1 AND 254),
 event_name text NOT NULL CHECK (char_length(event_name) BETWEEN 1 AND 100),
 duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 1 AND 480),
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (ends_at = starts_at + duration_minutes * interval '1 minute')
);
CREATE INDEX bookings_owner_time ON bookings (owner_id,starts_at,ends_at);
