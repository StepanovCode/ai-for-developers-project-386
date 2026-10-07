CREATE TABLE event_types (
    id uuid PRIMARY KEY CHECK (substring(id::text, 15, 1) = '4'),
    sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
    name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100 AND name !~ E'[\\r\\n]'),
    description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 2000),
    duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 1 AND 480)
);
