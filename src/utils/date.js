function toIsoString(value) {
  return new Date(value).toISOString();
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function createSlotWindow(baseDate, hour, minute, durationMinutes, serviceId, capacity) {
  const startAt = new Date(baseDate);
  startAt.setHours(hour, minute, 0, 0);

  const endAt = new Date(startAt);
  endAt.setMinutes(endAt.getMinutes() + durationMinutes);

  return {
    service_id: serviceId,
    start_at: toIsoString(startAt),
    end_at: toIsoString(endAt),
    capacity,
  };
}

function formatLocalTimestamp(value) {
  const date = new Date(value);

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(date);
}

module.exports = {
  addDays,
  createSlotWindow,
  formatLocalTimestamp,
  toIsoString,
};
