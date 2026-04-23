async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.ok === false) {
    const error = new Error(payload?.error?.message || payload?.message || "Request failed");
    error.status = response.status;
    error.code = payload?.error?.code || "REQUEST_FAILED";
    error.details = payload?.error?.details || null;
    throw error;
  }

  return payload;
}

export async function fetchServices() {
  const payload = await request("/api/services");
  return payload.items;
}

export async function fetchSlots(serviceId) {
  const payload = await request(`/api/slots?serviceId=${serviceId}`);
  return payload.items;
}

export async function createBooking(input) {
  const payload = await request("/api/bookings", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return payload.item;
}

export async function fetchPublicBooking(bookingId) {
  const payload = await request(`/api/bookings/${bookingId}/public`);
  return payload.item;
}

export async function searchPublicBookings(input) {
  const payload = await request("/api/bookings/search", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return payload.items;
}

export async function fetchPublicBookingWithPassword({ bookingId, password }) {
  const payload = await request(`/api/bookings/${bookingId}/public-access`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });

  return payload.item;
}

export async function loginWithGoogle(credential) {
  const payload = await request("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });

  return payload.item;
}

export async function logoutAdmin() {
  await request("/api/auth/logout", {
    method: "POST",
  });
}

export async function fetchAuthMe() {
  const payload = await request("/api/auth/me");
  return payload.item;
}

export async function fetchAdminBookings({ status, serviceId, dateFrom, dateTo }) {
  const query = new URLSearchParams();

  if (status) {
    query.set("status", status);
  }

  if (serviceId) {
    query.set("serviceId", String(serviceId));
  }

  if (dateFrom) {
    query.set("dateFrom", dateFrom);
  }

  if (dateTo) {
    query.set("dateTo", dateTo);
  }

  const queryString = query.toString();
  const path = queryString ? `/api/admin/bookings?${queryString}` : "/api/admin/bookings";
  const payload = await request(path);

  return payload.items;
}

export async function fetchAdminBooking({ bookingId }) {
  const payload = await request(`/api/admin/bookings/${bookingId}`);
  return payload.item;
}

export async function updateAdminBookingStatus({ bookingId, status }) {
  const payload = await request(`/api/admin/bookings/${bookingId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

  return payload.item;
}

export async function updateAdminBookingMemo({ bookingId, memo }) {
  const payload = await request(`/api/admin/bookings/${bookingId}/memo`, {
    method: "PATCH",
    body: JSON.stringify({ memo }),
  });

  return payload.item;
}

export async function deleteAdminBooking({ bookingId }) {
  const payload = await request(`/api/admin/bookings/${bookingId}`, {
    method: "DELETE",
  });

  return payload.item;
}

export async function bulkDeleteAdminBookings({ bookingIds }) {
  const payload = await request("/api/admin/bookings/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ bookingIds }),
  });

  return payload.items;
}

export async function fetchAdminBookingMessageLogs({ bookingId }) {
  const payload = await request(`/api/admin/bookings/${bookingId}/message-logs`);
  return payload.items;
}

export async function fetchAdminServices() {
  const payload = await request("/api/admin/services");
  return payload.items;
}

export async function fetchAdminOperationSettings() {
  const payload = await request("/api/admin/settings/operation");
  return payload.item;
}

export async function updateAdminOperationSettings({ input }) {
  const payload = await request("/api/admin/settings/operation", {
    method: "PATCH",
    body: JSON.stringify(input),
  });

  return payload.item;
}

export async function createAdminService({ input }) {
  const payload = await request("/api/admin/services", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return payload.item;
}

export async function updateAdminService({ serviceId, input }) {
  const payload = await request(`/api/admin/services/${serviceId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

  return payload.item;
}

export async function deleteAdminService({ serviceId }) {
  const payload = await request(`/api/admin/services/${serviceId}`, {
    method: "DELETE",
  });

  return payload.item;
}

export async function fetchAdminSlots({ serviceId }) {
  const query = new URLSearchParams();

  if (serviceId) {
    query.set("serviceId", String(serviceId));
  }

  const queryString = query.toString();
  const path = queryString ? `/api/admin/slots?${queryString}` : "/api/admin/slots";
  const payload = await request(path);

  return payload.items;
}

export async function createAdminSlot({ input }) {
  const payload = await request("/api/admin/slots", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return payload.item;
}

export async function updateAdminSlot({ slotId, input }) {
  const payload = await request(`/api/admin/slots/${slotId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

  return payload.item;
}

export async function deleteAdminSlot({ slotId }) {
  const payload = await request(`/api/admin/slots/${slotId}`, {
    method: "DELETE",
  });

  return payload.item;
}
