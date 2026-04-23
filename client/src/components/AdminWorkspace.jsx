import { useEffect, useMemo, useState } from "react";

import AdminServiceManager from "./AdminServiceManager";
import AdminSlotManager from "./AdminSlotManager";
import {
  bulkDeleteAdminBookings,
  deleteAdminBooking,
  fetchAdminBooking,
  fetchAdminBookingMessageLogs,
  fetchAdminBookings,
  fetchAdminOperationSettings,
  fetchAdminServices,
  fetchAdminSlots,
  updateAdminOperationSettings,
  updateAdminBookingMemo,
  updateAdminBookingStatus,
} from "../lib/api";

const STATUS_OPTIONS = ["requested", "payment_pending", "confirmed", "cancelled", "expired"];

function formatTimestamp(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function formatStatusLabel(status) {
  if (status === "requested") {
    return "접수 완료";
  }

  if (status === "payment_pending") {
    return "입금 대기";
  }

  if (status === "confirmed") {
    return "예약 확정";
  }

  if (status === "cancelled") {
    return "취소";
  }

  if (status === "expired") {
    return "만료";
  }

  return status;
}

function formatMessageLogLabel(log) {
  const channel = log.channel === "sms" ? "SMS" : "Telegram";

  if (log.template_type === "new_booking") {
    return `${channel} 신규 예약 알림`;
  }

  if (log.template_type === "payment_pending") {
    return `${channel} 입금 안내`;
  }

  if (log.template_type === "confirmed") {
    return `${channel} 예약 확정`;
  }

  return `${channel} ${log.template_type}`;
}

export default function AdminWorkspace({ admin, onLogout, onAuthExpired, onPublicServicesChanged }) {
  const [services, setServices] = useState([]);
  const [slots, setSlots] = useState([]);
  const [serviceFilter, setServiceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [bookings, setBookings] = useState([]);
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedBookingIds, setSelectedBookingIds] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [bookingMemo, setBookingMemo] = useState("");
  const [messageLogs, setMessageLogs] = useState([]);
  const [operationSettings, setOperationSettings] = useState({
    payment_account_bank: "",
    payment_account_number: "",
    payment_account_holder: "",
  });
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingMessageLogs, setLoadingMessageLogs] = useState(false);
  const [loadingOperationSettings, setLoadingOperationSettings] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState("");
  const [savingMemo, setSavingMemo] = useState(false);
  const [savingOperationSettings, setSavingOperationSettings] = useState(false);
  const [deletingBooking, setDeletingBooking] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [error, setError] = useState("");

  const bookingStats = useMemo(() => {
    return {
      total: bookings.length,
      requested: bookings.filter((booking) => booking.status === "requested").length,
      paymentPending: bookings.filter((booking) => booking.status === "payment_pending").length,
      confirmed: bookings.filter((booking) => booking.status === "confirmed").length,
    };
  }, [bookings]);

  useEffect(() => {
    setBookingMemo(selectedBooking?.admin_memo || "");
  }, [selectedBooking]);

  useEffect(() => {
    setSelectedBookingIds((current) => current.filter((id) => bookings.some((booking) => booking.id === id)));
  }, [bookings]);

  async function handleProtectedRequest(task) {
    try {
      return await task();
    } catch (taskError) {
      if (taskError.status === 401) {
        onAuthExpired();
        return null;
      }

      throw taskError;
    }
  }

  async function refreshServices(nextSelectedServiceId) {
    try {
      setLoadingServices(true);
      setError("");
      const items = await handleProtectedRequest(() => fetchAdminServices());

      if (!items) {
        return;
      }

      setServices(items);

      const requestedId =
        nextSelectedServiceId != null
          ? nextSelectedServiceId
          : selectedServiceId && items.some((service) => service.id === selectedServiceId)
            ? selectedServiceId
            : null;
      const preferredId = requestedId && items.some((service) => service.id === requestedId) ? requestedId : items[0]?.id || null;

      setSelectedServiceId(preferredId);

      if (serviceFilter && !items.some((service) => String(service.id) === String(serviceFilter))) {
        setServiceFilter("");
      }

      await onPublicServicesChanged();
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoadingServices(false);
    }
  }

  async function refreshSlots(nextServiceId, nextSelectedSlotId) {
    const serviceId = nextServiceId ?? selectedServiceId;

    if (!serviceId) {
      setSlots([]);
      setSelectedSlotId(null);
      return;
    }

    try {
      setLoadingSlots(true);
      setError("");
      const items = await handleProtectedRequest(() => fetchAdminSlots({ serviceId }));

      if (!items) {
        return;
      }

      setSlots(items);

      const requestedSlotId =
        nextSelectedSlotId !== undefined
          ? nextSelectedSlotId
          : items.some((slot) => slot.id === selectedSlotId)
            ? selectedSlotId
            : null;
      const nextSlotId = requestedSlotId && items.some((slot) => slot.id === requestedSlotId) ? requestedSlotId : items[0]?.id || null;
      setSelectedSlotId(nextSlotId);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoadingSlots(false);
    }
  }

  async function refreshOperationSettings() {
    try {
      setLoadingOperationSettings(true);
      setError("");
      const item = await handleProtectedRequest(() => fetchAdminOperationSettings());

      if (!item) {
        return;
      }

      setOperationSettings(item);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoadingOperationSettings(false);
    }
  }

  useEffect(() => {
    refreshServices();
    refreshOperationSettings();
  }, []);

  useEffect(() => {
    refreshSlots(selectedServiceId);
  }, [selectedServiceId]);

  useEffect(() => {
    async function loadBookings() {
      try {
        setLoadingList(true);
        setError("");
        const items = await handleProtectedRequest(() =>
          fetchAdminBookings({
            status: statusFilter,
            serviceId: serviceFilter || undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
          })
        );

        if (!items) {
          return;
        }

        setBookings(items);

        if (items.length === 0) {
          setSelectedBookingId(null);
          setSelectedBooking(null);
          setMessageLogs([]);
          return;
        }

        const nextBookingId = items.some((item) => item.id === selectedBookingId) ? selectedBookingId : items[0].id;
        setSelectedBookingId(nextBookingId);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoadingList(false);
      }
    }

    loadBookings();
  }, [serviceFilter, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (!selectedBookingId) {
      setSelectedBooking(null);
      setMessageLogs([]);
      return;
    }

    async function loadBookingDetail() {
      try {
        setLoadingDetail(true);
        setLoadingMessageLogs(true);
        setError("");
        const [bookingItem, messageLogItems] = await Promise.all([
          handleProtectedRequest(() => fetchAdminBooking({ bookingId: selectedBookingId })),
          handleProtectedRequest(() => fetchAdminBookingMessageLogs({ bookingId: selectedBookingId })),
        ]);

        if (!bookingItem || !messageLogItems) {
          return;
        }

        setSelectedBooking(bookingItem);
        setMessageLogs(messageLogItems);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoadingDetail(false);
        setLoadingMessageLogs(false);
      }
    }

    loadBookingDetail();
  }, [selectedBookingId]);

  async function handleStatusUpdate(status) {
    if (!selectedBooking) {
      return;
    }

    try {
      setUpdatingStatus(status);
      setError("");
      const updated = await handleProtectedRequest(() =>
        updateAdminBookingStatus({
          bookingId: selectedBooking.id,
          status,
        })
      );

      if (!updated) {
        return;
      }

      setSelectedBooking(updated);
      setBookings((current) =>
        current.map((item) =>
          item.id === updated.id
            ? {
                ...item,
                status: updated.status,
                confirmed_at: updated.confirmed_at,
              }
            : item
        )
      );
      await refreshSlots(updated.service_id);
      const nextLogs = await handleProtectedRequest(() => fetchAdminBookingMessageLogs({ bookingId: updated.id }));

      if (nextLogs) {
        setMessageLogs(nextLogs);
      }
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setUpdatingStatus("");
    }
  }

  async function handleMemoSave() {
    if (!selectedBooking) {
      return;
    }

    try {
      setSavingMemo(true);
      setError("");
      const updated = await handleProtectedRequest(() =>
        updateAdminBookingMemo({
          bookingId: selectedBooking.id,
          memo: bookingMemo,
        })
      );

      if (!updated) {
        return;
      }

      setSelectedBooking(updated);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingMemo(false);
    }
  }

  async function handleDeleteBooking(bookingId) {
    const confirmed = window.confirm("선택한 예약을 DB에서 삭제할까요?");

    if (!confirmed) {
      return;
    }

    try {
      setDeletingBooking(true);
      setError("");
      const deleted = await handleProtectedRequest(() => deleteAdminBooking({ bookingId }));

      if (!deleted) {
        return;
      }

      const nextBookings = bookings.filter((item) => item.id !== deleted.id);

      setBookings(nextBookings);
      setSelectedBookingIds((current) => current.filter((id) => id !== deleted.id));

      if (selectedBookingId === deleted.id) {
        const nextBooking = nextBookings[0] || null;
        setSelectedBookingId(nextBooking?.id || null);

        if (!nextBooking) {
          setSelectedBooking(null);
          setMessageLogs([]);
        }
      }

      await refreshSlots(deleted.service_id);
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setDeletingBooking(false);
    }
  }

  async function handleBulkDelete() {
    if (selectedBookingIds.length === 0) {
      return;
    }

    const confirmed = window.confirm(`선택한 예약 ${selectedBookingIds.length}건을 DB에서 삭제할까요?`);

    if (!confirmed) {
      return;
    }

    try {
      setBulkDeleting(true);
      setError("");
      const deletedItems = await handleProtectedRequest(() =>
        bulkDeleteAdminBookings({
          bookingIds: selectedBookingIds,
        })
      );

      if (!deletedItems) {
        return;
      }

      const deletedIds = new Set(deletedItems.map((item) => item.id));
      const nextBookings = bookings.filter((item) => !deletedIds.has(item.id));

      setBookings(nextBookings);
      setSelectedBookingIds([]);

      if (selectedBookingId && deletedIds.has(selectedBookingId)) {
        const nextBooking = nextBookings[0] || null;
        setSelectedBookingId(nextBooking?.id || null);

        if (!nextBooking) {
          setSelectedBooking(null);
          setMessageLogs([]);
        }
      }

      await refreshServices();
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setBulkDeleting(false);
    }
  }

  function toggleSelectedBooking(bookingId) {
    setSelectedBookingIds((current) =>
      current.includes(bookingId) ? current.filter((id) => id !== bookingId) : [...current, bookingId]
    );
  }

  function handleResetFilters() {
    setServiceFilter("");
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
  }

  function handleOperationSettingsChange(event) {
    const { name, value } = event.target;
    setOperationSettings((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleOperationSettingsSave(event) {
    event.preventDefault();

    try {
      setSavingOperationSettings(true);
      setError("");
      const updated = await handleProtectedRequest(() =>
        updateAdminOperationSettings({
          input: operationSettings,
        })
      );

      if (!updated) {
        return;
      }

      setOperationSettings(updated);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingOperationSettings(false);
    }
  }

  return (
    <main className="admin-shell">
      <section className="panel admin-toolbar">
        <div className="panel-header">
          <span className="eyebrow">운영 화면</span>
          <h2>예약 운영 대시보드</h2>
        </div>

        <div className="admin-session">
          <div>
            <span className="result-label">로그인 계정</span>
            <strong>{admin.google_email}</strong>
          </div>
          <div className="stack-actions">
            <button type="button" className="secondary-button" onClick={() => refreshServices()}>
              운영 데이터 새로고침
            </button>
            <button type="button" className="secondary-button" onClick={handleResetFilters}>
              필터 초기화
            </button>
            <button type="button" className="secondary-button" onClick={onLogout}>
              로그아웃
            </button>
          </div>
        </div>

        <div className="toolbar-grid toolbar-grid-wide">
          <label>
            <span>프로그램 필터</span>
            <select value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)}>
              <option value="">전체 프로그램</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>상태 필터</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">전체 상태</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {formatStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>접수일 시작</span>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label>
            <span>접수일 종료</span>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <section className="admin-summary-card">
            <span className="result-label">현재 필터 기준</span>
            <strong>{bookingStats.total}건</strong>
            <span className="muted">
              접수 {bookingStats.requested}건 / 입금대기 {bookingStats.paymentPending}건 / 확정 {bookingStats.confirmed}건
            </span>
          </section>
        </div>
      </section>

      {error ? <div className="alert error">{error}</div> : null}

      <section className="panel admin-management-panel">
        <div className="panel-header">
          <span className="eyebrow">운영 안내 설정</span>
          <h2>입금 계좌 안내</h2>
        </div>

        {loadingOperationSettings ? <p className="muted">운영 안내 설정을 불러오는 중입니다.</p> : null}

        <form className="booking-form" onSubmit={handleOperationSettingsSave}>
          <div className="admin-form-row">
            <label>
              <span>은행명</span>
              <input
                name="payment_account_bank"
                value={operationSettings.payment_account_bank}
                onChange={handleOperationSettingsChange}
                placeholder="예: 예시은행"
                required
              />
            </label>
            <label>
              <span>계좌번호</span>
              <input
                name="payment_account_number"
                value={operationSettings.payment_account_number}
                onChange={handleOperationSettingsChange}
                placeholder="예: 123-456-789012"
                required
              />
            </label>
            <label>
              <span>예금주</span>
              <input
                name="payment_account_holder"
                value={operationSettings.payment_account_holder}
                onChange={handleOperationSettingsChange}
                placeholder="예: 홍길동"
                required
              />
            </label>
          </div>
          <p className="muted form-helper">
            여기서 저장한 입금 계좌 정보는 예약 신청 접수 문자에 공통으로 반영됩니다.
          </p>
          <div className="stack-actions">
            <button type="submit" className="primary-button" disabled={savingOperationSettings || loadingOperationSettings}>
              {savingOperationSettings ? "저장 중..." : "입금 계좌 저장"}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-grid">
        <section className="panel">
          <div className="panel-header">
            <span className="eyebrow">목록</span>
            <h2>예약 접수 목록</h2>
          </div>

          <div className="stack-actions">
            <button
              type="button"
              className="secondary-button danger-button"
              disabled={selectedBookingIds.length === 0 || bulkDeleting}
              onClick={handleBulkDelete}
            >
              {bulkDeleting ? "삭제 중..." : `선택 삭제 (${selectedBookingIds.length})`}
            </button>
          </div>

          {loadingList ? <p className="muted">예약 목록을 불러오는 중입니다.</p> : null}
          {!loadingList && bookings.length === 0 ? <p className="muted">현재 필터에 맞는 예약이 없습니다.</p> : null}

          <div className="admin-booking-list">
            {bookings.map((booking) => (
              <article
                key={booking.id}
                className={`admin-booking-card admin-booking-card-row ${selectedBookingId === booking.id ? "active" : ""}`}
              >
                <label className="booking-select" aria-label={`${booking.id}번 예약 선택`}>
                  <input
                    type="checkbox"
                    checked={selectedBookingIds.includes(booking.id)}
                    onChange={() => toggleSelectedBooking(booking.id)}
                  />
                </label>
                <button type="button" className="booking-card-button" onClick={() => setSelectedBookingId(booking.id)}>
                  <div className="admin-booking-top">
                    <strong>#{booking.id}</strong>
                    <span className={`status-pill status-${booking.status}`}>{formatStatusLabel(booking.status)}</span>
                  </div>
                  <strong>{booking.name}</strong>
                  <span>{booking.service_name}</span>
                  <span>{formatTimestamp(booking.slot_start_at)}</span>
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <span className="eyebrow">상세</span>
            <h2>예약 상세, 메모, 메시지 로그</h2>
          </div>

          {!selectedBookingId ? <p className="muted">왼쪽 목록에서 예약을 선택해 주세요.</p> : null}
          {selectedBookingId && loadingDetail ? <p className="muted">예약 상세 정보를 불러오는 중입니다.</p> : null}

          {selectedBooking ? (
            <div className="admin-detail">
              <div className="detail-grid">
                <div>
                  <span className="result-label">예약 번호</span>
                  <strong>#{selectedBooking.id}</strong>
                </div>
                <div>
                  <span className="result-label">현재 상태</span>
                  <strong>{formatStatusLabel(selectedBooking.status)}</strong>
                </div>
                <div>
                  <span className="result-label">프로그램</span>
                  <strong>{selectedBooking.service_name}</strong>
                </div>
                <div>
                  <span className="result-label">예약 시각</span>
                  <strong>{formatTimestamp(selectedBooking.slot_start_at)}</strong>
                </div>
                <div>
                  <span className="result-label">예약자명</span>
                  <strong>{selectedBooking.name}</strong>
                </div>
                <div>
                  <span className="result-label">전화번호</span>
                  <strong>{selectedBooking.phone}</strong>
                </div>
                <div>
                  <span className="result-label">이메일</span>
                  <strong>{selectedBooking.email || "-"}</strong>
                </div>
                <div>
                  <span className="result-label">소속</span>
                  <strong>{selectedBooking.organization || "-"}</strong>
                </div>
                <div>
                  <span className="result-label">환불 은행</span>
                  <strong>{selectedBooking.refund_bank || "-"}</strong>
                </div>
                <div>
                  <span className="result-label">환불 계좌번호</span>
                  <strong>{selectedBooking.refund_account || "-"}</strong>
                </div>
                <div>
                  <span className="result-label">환불 예금주</span>
                  <strong>{selectedBooking.refund_holder || "-"}</strong>
                </div>
                <div>
                  <span className="result-label">예약 비밀번호 설정 여부</span>
                  <strong>{selectedBooking.has_booking_password ? "설정됨" : "없음"}</strong>
                </div>
              </div>

              <div className="detail-note">
                <span className="result-label">예약자 전달 메모</span>
                <p>{selectedBooking.customer_note || "예약자가 남긴 메모가 없습니다."}</p>
              </div>

              <div className="status-actions">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={status === "confirmed" ? "primary-button" : "secondary-button"}
                    disabled={updatingStatus.length > 0 || selectedBooking.status === status}
                    onClick={() => handleStatusUpdate(status)}
                  >
                    {updatingStatus === status ? `${formatStatusLabel(status)} 처리 중...` : formatStatusLabel(status)}
                  </button>
                ))}
                <button
                  type="button"
                  className="secondary-button danger-button"
                  disabled={deletingBooking}
                  onClick={() => handleDeleteBooking(selectedBooking.id)}
                >
                  {deletingBooking ? "삭제 중..." : "예약 삭제"}
                </button>
              </div>

              <section className="admin-detail-section">
                <div className="panel-header compact">
                  <span className="eyebrow">내부 메모</span>
                  <h3>관리자 메모</h3>
                </div>
                <textarea
                  className="admin-memo-textarea"
                  value={bookingMemo}
                  onChange={(event) => setBookingMemo(event.target.value)}
                  rows="5"
                  placeholder="입금 확인 상태나 내부 운영 메모를 남겨 두세요."
                />
                <div className="stack-actions">
                  <button type="button" className="primary-button" disabled={savingMemo} onClick={handleMemoSave}>
                    {savingMemo ? "저장 중..." : "메모 저장"}
                  </button>
                </div>
              </section>

              <section className="admin-detail-section">
                <div className="panel-header compact">
                  <span className="eyebrow">메시지 로그</span>
                  <h3>예약 관련 발송 기록</h3>
                </div>
                {loadingMessageLogs ? <p className="muted">메시지 로그를 불러오는 중입니다.</p> : null}
                {!loadingMessageLogs && messageLogs.length === 0 ? (
                  <p className="muted">아직 기록된 메시지 로그가 없습니다.</p>
                ) : null}
                <div className="message-log-list">
                  {messageLogs.map((log) => (
                    <article key={log.id} className="message-log-card">
                      <div className="admin-booking-top">
                        <strong>{formatMessageLogLabel(log)}</strong>
                        <span className={`status-pill ${log.status === "sent" ? "status-confirmed" : "status-expired"}`}>
                          {log.status}
                        </span>
                      </div>
                      <span>{formatTimestamp(log.sent_at)}</span>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          ) : null}
        </section>
      </section>

      <AdminServiceManager
        services={services}
        selectedServiceId={selectedServiceId}
        onSelect={(serviceId) => {
          setSelectedServiceId(serviceId);
          setSelectedSlotId(null);
        }}
        onRefresh={refreshServices}
        onAuthExpired={onAuthExpired}
      />

      {loadingServices ? <p className="muted">프로그램 목록을 불러오는 중입니다.</p> : null}
      {loadingSlots ? <p className="muted">선택한 프로그램의 일정을 불러오는 중입니다.</p> : null}

      <AdminSlotManager
        services={services}
        slots={slots}
        selectedServiceId={selectedServiceId}
        selectedSlotId={selectedSlotId}
        onSelectService={(serviceId) => {
          setSelectedServiceId(serviceId);
          setSelectedSlotId(null);
        }}
        onSelectSlot={setSelectedSlotId}
        onRefresh={refreshSlots}
        onAuthExpired={onAuthExpired}
      />
    </main>
  );
}
