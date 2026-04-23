import { useEffect, useState } from "react";

import { createAdminService, deleteAdminService, updateAdminService } from "../lib/api";

const EMPTY_FORM = {
  type: "coaching",
  name: "",
  description: "",
  duration_min: "60",
  price: "0",
  capacity_default: "1",
  is_active: true,
};

export default function AdminServiceManager({ services, selectedServiceId, onSelect, onRefresh, onAuthExpired }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const selected = services.find((service) => service.id === selectedServiceId);

    if (!selected) {
      setForm(EMPTY_FORM);
      return;
    }

    setForm({
      type: selected.type,
      name: selected.name,
      description: selected.description,
      duration_min: String(selected.duration_min),
      price: String(selected.price),
      capacity_default: String(selected.capacity_default),
      is_active: selected.is_active === 1,
    });
  }, [selectedServiceId, services]);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => {
      const next = {
        ...current,
        [name]: type === "checkbox" ? checked : value,
      };

      if (name === "type" && value === "coaching") {
        next.capacity_default = "1";
      }

      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const input = {
      type: form.type,
      name: form.name,
      description: form.description,
      duration_min: Number(form.duration_min),
      price: Number(form.price),
      capacity_default: Number(form.capacity_default),
      is_active: form.is_active ? 1 : 0,
    };

    try {
      setSubmitting(true);
      setError("");
      let item;

      if (selectedServiceId) {
        item = await updateAdminService({
          serviceId: selectedServiceId,
          input,
        });
      } else {
        item = await createAdminService({ input });
      }

      onSelect(item.id);
      await onRefresh(item.id);
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
    if (!selectedServiceId) {
      return;
    }

    const confirmed = window.confirm("선택한 프로그램을 삭제할까요? 연결된 예약이나 일정이 있으면 삭제되지 않습니다.");

    if (!confirmed) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await deleteAdminService({ serviceId: selectedServiceId });
      onSelect(null);
      await onRefresh(null);
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
    onSelect(null);
    setError("");
    setForm(EMPTY_FORM);
  }

  return (
    <section className="panel admin-management-panel">
      <div className="panel-header">
        <span className="eyebrow">서비스 관리</span>
        <h2>프로그램 생성, 수정, 삭제</h2>
      </div>

      {error ? <div className="alert error inline-alert">{error}</div> : null}

      <div className="admin-management-grid">
        <div className="admin-entity-list">
          <div className="stack-actions">
            <button type="button" className="primary-button" onClick={handleCreateMode}>
              새 프로그램 만들기
            </button>
          </div>

          {services.length === 0 ? <p className="muted">등록된 프로그램이 없습니다.</p> : null}

          {services.map((service) => (
            <button
              key={service.id}
              type="button"
              className={`admin-booking-card ${selectedServiceId === service.id ? "active" : ""}`}
              onClick={() => onSelect(service.id)}
            >
              <div className="admin-booking-top">
                <strong>#{service.id}</strong>
                <span className={`status-pill ${service.is_active ? "status-confirmed" : "status-expired"}`}>
                  {service.is_active ? "운영 중" : "비활성"}
                </span>
              </div>
              <strong>{service.name}</strong>
              <span>{service.type === "coaching" ? "코칭" : "워크샵"}</span>
              <span>
                {service.duration_min}분 / {service.capacity_default}명 / {service.price.toLocaleString("ko-KR")}원
              </span>
            </button>
          ))}
        </div>

        <form className="booking-form" onSubmit={handleSubmit}>
          <label>
            <span>프로그램 유형</span>
            <select name="type" value={form.type} onChange={handleChange}>
              <option value="coaching">코칭</option>
              <option value="workshop">워크샵</option>
            </select>
          </label>
          <label>
            <span>프로그램명</span>
            <input name="name" value={form.name} onChange={handleChange} placeholder="예: 1:1 코칭" required />
          </label>
          <label>
            <span>설명</span>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows="4"
              placeholder="예약자에게 보여줄 설명을 입력하세요."
            />
          </label>
          <div className="admin-form-row">
            <label>
              <span>진행 시간(분)</span>
              <input name="duration_min" type="number" min="1" value={form.duration_min} onChange={handleChange} required />
            </label>
            <label>
              <span>가격(원)</span>
              <input name="price" type="number" min="0" value={form.price} onChange={handleChange} required />
            </label>
            <label>
              <span>기본 정원</span>
              <input
                name="capacity_default"
                type="number"
                min="1"
                value={form.capacity_default}
                onChange={handleChange}
                required
              />
            </label>
          </div>
          <label className="toggle-row">
            <input name="is_active" type="checkbox" checked={form.is_active} onChange={handleChange} />
            <span>예약 화면에 노출</span>
          </label>

          <div className="stack-actions">
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? "처리 중..." : selectedServiceId ? "프로그램 수정" : "프로그램 생성"}
            </button>
            {selectedServiceId ? (
              <button type="button" className="secondary-button" disabled={submitting} onClick={handleDelete}>
                프로그램 삭제
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}
