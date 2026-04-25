import { useEffect, useMemo, useState } from "react";

import { createAdminSlot, deleteAdminSlot, updateAdminSlot } from "../lib/api";

function toInputValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function toIsoValue(value) {
  return new Date(value).toISOString();
}

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

function calculateEndAt(startAt, durationMin) {
  if (!startAt || !durationMin) {
    return "";
  }

  const date = new Date(startAt);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setMinutes(date.getMinutes() + Number(durationMin));
  return toInputValue(date.toISOString());
}

export default function AdminSlotManager({
  services,
  slots,
  selectedServiceId,
  selectedSlotId,
  onSelectService,
  onSelectSlot,
  onRefresh,
  onAuthExpired,
}) {
  const [form, setForm] = useState({
    service_id: "",
    start_at: "",
    end_at: "",
    capacity: "",
    is_open: true,
  });
  const [slotStatusFilter, setSlotStatusFilter] = useState("all");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const filteredSlots = useMemo(() => {
    if (slotStatusFilter === "open") {
      return slots.filter((slot) => slot.is_open);
    }

    if (slotStatusFilter === "closed") {
      return slots.filter((slot) => !slot.is_open);
    }

    return slots;
  }, [slotStatusFilter, slots]);

  useEffect(() => {
    const selectedSlot = slots.find((slot) => slot.id === selectedSlotId);

    if (selectedSlot) {
      setForm({
        service_id: String(selectedSlot.service_id),
        start_at: toInputValue(selectedSlot.start_at),
        end_at: toInputValue(selectedSlot.end_at),
        capacity: String(selectedSlot.capacity),
        is_open: selectedSlot.is_open === 1,
      });
      return;
    }

    const selectedService = services.find((service) => service.id === selectedServiceId);

    if (selectedService) {
      setForm({
        service_id: String(selectedService.id),
        start_at: "",
        end_at: "",
        capacity: String(selectedService.capacity_default),
        is_open: true,
      });
      return;
    }

    setForm({
      service_id: "",
      start_at: "",
      end_at: "",
      capacity: "",
      is_open: true,
    });
  }, [selectedServiceId, selectedSlotId, services, slots]);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setForm((current) => {
      const next = {
        ...current,
        [name]: type === "checkbox" ? checked : value,
      };

      const serviceId = Number(name === "service_id" ? value : next.service_id);
      const selectedService = services.find((service) => service.id === serviceId);

      if (name === "start_at" && selectedService) {
        next.end_at = calculateEndAt(value, selectedService.duration_min);
      }

      if (name === "service_id" && next.start_at && selectedService) {
        next.end_at = calculateEndAt(next.start_at, selectedService.duration_min);
      }

      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const input = {
      service_id: Number(form.service_id),
      start_at: toIsoValue(form.start_at),
      end_at: toIsoValue(form.end_at),
      capacity: Number(form.capacity),
      is_open: form.is_open ? 1 : 0,
    };

    try {
      setSubmitting(true);
      setError("");
      let item;

      if (selectedSlotId) {
        item = await updateAdminSlot({
          slotId: selectedSlotId,
          input,
        });
      } else {
        item = await createAdminSlot({ input });
      }

      onSelectService(item.service_id);
      onSelectSlot(item.id);
      await onRefresh(item.service_id, item.id);
    } catch (submitError) {
      if (submitError.status === 401) {
        onAuthExpired();
        return;
      }

      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!selectedSlotId) {
      return;
    }

    const confirmed = window.confirm("선택한 일정을 삭제할까요? 예약 이력이 있으면 삭제되지 않습니다.");

    if (!confirmed) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await deleteAdminSlot({ slotId: selectedSlotId });
      onSelectSlot(null);
      await onRefresh(selectedServiceId, null);
    } catch (deleteError) {
      if (deleteError.status === 401) {
        onAuthExpired();
        return;
      }

      setError(deleteError.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCreateMode() {
    onSelectSlot(null);
    setError("");
    const selectedService = services.find((service) => service.id === selectedServiceId);
    setForm({
      service_id: selectedService ? String(selectedService.id) : "",
      start_at: "",
      end_at: "",
      capacity: selectedService ? String(selectedService.capacity_default) : "",
      is_open: true,
    });
  }

  return (
    <section className="panel admin-management-panel">
      <div className="panel-header">
        <span className="eyebrow">일정 관리</span>
        <h2>코칭 및 워크샵 일정 관리</h2>
      </div>

      {error ? <div className="alert error inline-alert">{error}</div> : null}

      <div className="admin-management-grid">
        <div className="admin-entity-list">
          <label>
            <span>프로그램 선택</span>
            <select value={selectedServiceId || ""} onChange={(event) => onSelectService(Number(event.target.value) || null)}>
              <option value="">프로그램을 선택하세요.</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>일정 상태 필터</span>
            <select value={slotStatusFilter} onChange={(event) => setSlotStatusFilter(event.target.value)}>
              <option value="all">전체</option>
              <option value="open">오픈</option>
              <option value="closed">마감</option>
            </select>
          </label>

          <div className="stack-actions">
            <button type="button" className="primary-button" onClick={handleCreateMode} disabled={!selectedServiceId}>
              새 일정 만들기
            </button>
          </div>

          {selectedServiceId && filteredSlots.length === 0 ? <p className="muted">현재 필터에 맞는 일정이 없습니다.</p> : null}
          {!selectedServiceId ? <p className="muted">먼저 프로그램을 선택하세요.</p> : null}

          {filteredSlots.map((slot) => (
            <button
              key={slot.id}
              type="button"
              className={`admin-booking-card ${selectedSlotId === slot.id ? "active" : ""}`}
              onClick={() => onSelectSlot(slot.id)}
            >
              <div className="admin-booking-top">
                <strong>#{slot.id}</strong>
                <span className={`status-pill ${slot.is_open ? "status-confirmed" : "status-expired"}`}>
                  {slot.is_open ? "오픈" : "마감"}
                </span>
              </div>
              <strong>{formatTimestamp(slot.start_at)}</strong>
              <span>{formatTimestamp(slot.end_at)}</span>
              <span>
                정원 {slot.capacity}명 / 확정 {slot.reserved_count}명 / 전체 예약 {slot.booking_count}건
              </span>
            </button>
          ))}
        </div>

        <form className="booking-form" onSubmit={handleSubmit}>
          <label>
            <span>프로그램</span>
            <select name="service_id" value={form.service_id} onChange={handleChange} required>
              <option value="">프로그램을 선택하세요.</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-form-row">
            <label>
              <span>시작 시각</span>
              <input name="start_at" type="datetime-local" value={form.start_at} onChange={handleChange} required />
            </label>
            <label>
              <span>종료 시각</span>
              <input name="end_at" type="datetime-local" value={form.end_at} onChange={handleChange} required />
            </label>
          </div>
          <p className="muted form-helper">
            시작 시각을 입력하면 프로그램 진행 시간(분)을 기준으로 종료 시각을 자동 계산합니다. 이후 수동 수정도 가능합니다.
          </p>
          <label>
            <span>정원</span>
            <input name="capacity" type="number" min="1" value={form.capacity} onChange={handleChange} required />
          </label>
          <label className="toggle-row">
            <input name="is_open" type="checkbox" checked={form.is_open} onChange={handleChange} />
            <span>예약 가능 상태로 열기</span>
          </label>

          <div className="stack-actions">
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? "처리 중..." : selectedSlotId ? "일정 수정" : "일정 생성"}
            </button>
            {selectedSlotId ? (
              <button type="button" className="secondary-button" disabled={submitting} onClick={handleDelete}>
                일정 삭제
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}
