export function bookingDetailsUrl(id: string, date: string, startsAt: string) {
  return `/book/${id}/details?${new URLSearchParams({ date, slot: startsAt })}`
}
