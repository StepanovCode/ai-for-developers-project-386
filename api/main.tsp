import "@typespec/http";
import "@typespec/openapi";
import "@typespec/openapi3";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

@service(#{ title: "На связи API" })
@info(#{ version: "1.0.0" })
namespace NaSvyazi;

@format("uuid")
@pattern("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
@doc("Server-generated UUID v4.")
scalar ID extends string;

@minLength(1) @maxLength(100)
@pattern("^[^\\r\\n\\u0085\\u2028\\u2029]+$")
@doc("Single line, trimmed before validating length in Unicode characters; internal text is preserved.")
scalar Name extends string;

@minLength(1) @maxLength(2000)
@doc("Plain text, not interpreted as HTML or Markdown. Trimmed before validation; internal line breaks preserved.")
scalar Description extends string;

@minValue(1) @maxValue(480)
scalar DurationMinutes extends int32;

@format("email") @minLength(1) @maxLength(254)
scalar Email extends string;

@doc("RFC 3339 instant with an explicit Z or numeric offset. Responses use UTC (Z); display in Europe/Moscow.")
@encode("rfc3339")
scalar Instant extends utcDateTime;

@doc("Calendar date YYYY-MM-DD in Europe/Moscow, not an instant or a rolling 24-hour period.")
scalar CalendarDate extends plainDate;

model Owner {
  id: "default";
  name: string;
}
model CreateEventType {
  name: Name;
  description: Description;
  durationMinutes: DurationMinutes;
}
model EventType {
  id: ID;
  name: Name;
  description: Description;
  durationMinutes: DurationMinutes;
}
@doc("Shared public/admin catalog, oldest first. Empty catalog is an empty items array.")
model EventTypeCatalog {
  owner: Owner;
  items: EventType[];
}
model EventTypeDetails {
  owner: Owner;
  eventType: EventType;
}
@doc("Half-open [startsAt, endsAt) interval; busy slots contain no guest data. Selection does not reserve time.")
model Slot {
  startsAt: Instant;
  endsAt: Instant;
  status: "available" | "busy";
}
model SlotDay {
  date: CalendarDate;
  slots: Slot[];
}
@doc("Today and the next 13 Moscow dates, inclusive, including dates with no slots. Server clock defines today. Starts follow a 15-minute grid from each configured working interval, at least 30 minutes ahead (inclusive). Entire meeting fits the working interval and window. Busy intervals reflect bookings of ALL types; invalid intervals are omitted. Default Mon–Fri 09:00–18:00; no buffers or holidays.")
model SlotWindow {
  windowStart: CalendarDate;
  windowEnd: CalendarDate;
  timeZone: "Europe/Moscow";
  @minItems(14) @maxItems(14) days: SlotDay[];
}
@doc("Server determines owner, duration and end; rechecks grid, window, schedule, 30-minute notice and overlaps. No rounding, idempotency key, reservation or recovery after a lost response.")
model CreateBooking {
  eventTypeId: ID;
  startsAt: Instant;
  guestName: Name;
  guestEmail: Email;
}
@doc("Immediately confirmed immutable booking. Public response never includes guest name/email. POST and GET share this model.")
model BookingConfirmation {
  id: ID;
  eventTypeId: ID;
  eventTypeName: Name;
  durationMinutes: DurationMinutes;
  startsAt: Instant;
  endsAt: Instant;
  timeZone: "Europe/Moscow";
  owner: Owner;
}
model Meeting {
  ...BookingConfirmation;
  guestName: Name;
  guestEmail: Email;
}
@doc("All bookings whose start is strictly after server now, earliest first, without pagination or 14-day limit. Open admin endpoint: includes guest contact details.")
model MeetingList {
  timeZone: "Europe/Moscow";
  items: Meeting[];
}
model Health { status: "ok"; }
model ErrorBody {
  code: string;
  message: string;
}
model ValidationErrorBody {
  code: "VALIDATION_ERROR";
  message: string;
  fieldErrors?: Record<string[]>;
}
@error model ValidationError { @statusCode statusCode: 422; @body body: ValidationErrorBody; }
@error model ServerError { @statusCode statusCode: 500; @body body: ErrorBody; }
@error model NotFound { @statusCode statusCode: 404; @body body: ErrorBody; }
@doc("SLOT_UNAVAILABLE: busy or no longer eligible time. Do not substitute a different slot. Guest name/email are preserved, selection cleared, slots refreshed.")
@error model SlotUnavailable { @statusCode statusCode: 400; @body body: ErrorBody; }
model OK<T> { @statusCode statusCode: 200; @body body: T; }
model Created<T> { @statusCode statusCode: 201; @body body: T; }

@route("/api/event-types") @get
op listEventTypes(): OK<EventTypeCatalog> | ServerError;
@route("/api/event-types") @post
op createEventType(@body body: CreateEventType): Created<EventType> | ValidationError | ServerError;
@route("/api/event-types/{id}") @get
op getEventType(@path id: ID): OK<EventTypeDetails> | ValidationError | NotFound | ServerError;
@route("/api/event-types/{id}/slots") @get
op getSlots(@path id: ID): OK<SlotWindow> | ValidationError | NotFound | ServerError;
@route("/api/bookings") @post
op createBooking(@body body: CreateBooking): Created<BookingConfirmation> | ValidationError | SlotUnavailable | NotFound | ServerError;
@route("/api/bookings/{id}") @get
op getBooking(@path id: ID): OK<BookingConfirmation> | ValidationError | NotFound | ServerError;
@route("/api/meetings") @get
op listMeetings(): OK<MeetingList> | ServerError;
@route("/api/health") @get
op getHealth(): OK<Health> | ServerError;
