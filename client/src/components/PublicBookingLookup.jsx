import { useState } from "react";

import { fetchPublicBookingWithPassword, searchPublicBookings } from "../lib/api";

function formatTimestamp(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
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

export default function PublicBookingLookup({ onStartBooking }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
  });
  const [results, setResults] = useState([]);
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [password, setPassword] = useState("");
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSearch(event) {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setDetailError("");
      setBooking(null);
      setSelectedBookingId(null);
      setPassword("");
      const items = await searchPublicBookings(form);
      setHasSearched(true);
      setResults(items);
    } catch (searchError) {
      setHasSearched(true);
      setResults([]);
      setError(searchError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDetailSubmit(event) {
    event.preventDefault();

    if (!selectedBookingId) {
      return;
    }

    try {
      setDetailLoading(true);
      setDetailError("");
      const item = await fetchPublicBookingWithPassword({
        bookingId: selectedBookingId,
        password,
      });
      setBooking(item);
    } catch (loadError) {
      setBooking(null);
      setDetailError(loadError.message);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <main className="single-column">
      <section className="panel lookup-panel">
        <div className="panel-header">
          <span className="eyebrow">예약 조회</span>
          <h2>접수한 예약을 찾아보세요.</h2>
        </div>

        <form className="lookup-form" onSubmit={handleSearch}>
          <label>
            <span>이름</span>
            <input name="name" value={form.name} onChange={handleChange} placeholder="홍길동" />
          </label>
          <label>
            <span>전화번호</span>
            <input name="phone" value={form.phone} onChange={handleChange} placeholder="휴대폰 번호" />
          </label>
          <div className="stack-actions">
            <button type="submit" className="primary-button">
              조회하기
            </button>
            <button type="button" className="secondary-button" onClick={onStartBooking}>
              다른 예약 신청하기
            </button>
          </div>
        </form>
      </section>

      {loading ? (
        <section className="panel state-panel">
          <div className="panel-header">
            <span className="eyebrow">조회 중</span>
            <h2>예약 목록을 찾는 중입니다.</h2>
          </div>
          <p className="muted">잠시만 기다려 주세요.</p>
        </section>
      ) : null}

      {error ? (
        <section className="panel state-panel">
          <div className="panel-header">
            <span className="eyebrow">조회 실패</span>
            <h2>입력한 조건으로 예약을 찾지 못했습니다.</h2>
          </div>
          <p className="muted">{error}</p>
        </section>
      ) : null}

      {!loading && !error && results.length === 0 && !hasSearched ? (
        <section className="panel state-panel">
          <div className="panel-header">
            <span className="eyebrow">조회 안내</span>
            <h2>신청자 이름과 전화번호를 입력하세요.</h2>
          </div>
          <p className="muted">예약을 선택한 뒤 4자리 비밀번호를 입력하면 상세 내용을 확인할 수 있습니다.</p>
        </section>
      ) : null}

      {!loading && !error && results.length === 0 && hasSearched ? (
        <section className="panel state-panel">
          <div className="panel-header">
            <span className="eyebrow">조회 결과 없음</span>
            <h2>일치하는 예약이 없습니다.</h2>
          </div>
          <p className="muted">이름 철자와 전화번호를 다시 확인해 주세요.</p>
        </section>
      ) : null}

      {!loading && results.length > 0 ? (
        <section className="panel">
          <div className="panel-header">
            <span className="eyebrow">조회 결과</span>
            <h2>조회된 예약</h2>
          </div>
          <div className="lookup-result-list">
            {results.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`admin-booking-card ${selectedBookingId === item.id ? "active" : ""}`}
                onClick={() => {
                  setSelectedBookingId(item.id);
                  setPassword("");
                  setDetailError("");
                  setBooking(null);
                }}
              >
                <div className="admin-booking-top">
                  <strong>#{item.id}</strong>
                  <span className={`status-pill status-${item.status}`}>{formatStatusLabel(item.status)}</span>
                </div>
                <strong>{item.service_name}</strong>
                <span>{formatTimestamp(item.slot_start_at)}</span>
                <span>접수일 {formatTimestamp(item.applied_at)}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {selectedBookingId ? (
        <section className="panel">
          <div className="panel-header">
            <span className="eyebrow">상세 확인</span>
            <h2>4자리 비밀번호를 입력하세요.</h2>
          </div>

          <form className="lookup-form" onSubmit={handleDetailSubmit}>
            <label>
              <span>예약 비밀번호</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="예약 신청 때 입력한 4자리 숫자"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
              />
            </label>
            <div className="stack-actions">
              <button type="submit" className="primary-button" disabled={detailLoading}>
                {detailLoading ? "확인 중..." : "상세 확인"}
              </button>
            </div>
          </form>

          {detailError ? <div className="alert error inline-alert">{detailError}</div> : null}
        </section>
      ) : null}

      {booking ? (
        <section className="panel">
          <div className="panel-header">
            <span className="eyebrow">예약 상세</span>
            <h2>예약 정보</h2>
          </div>

          <div className="result-grid">
            <div>
              <span className="result-label">예약 번호</span>
              <strong>#{booking.id}</strong>
            </div>
            <div>
              <span className="result-label">현재 상태</span>
              <strong>{formatStatusLabel(booking.status)}</strong>
            </div>
            <div>
              <span className="result-label">서비스</span>
              <strong>{booking.service_name}</strong>
            </div>
            <div>
              <span className="result-label">예약 시간</span>
              <strong>{formatTimestamp(booking.slot_start_at)}</strong>
            </div>
            <div>
              <span className="result-label">예약자명</span>
              <strong>{booking.name}</strong>
            </div>
            <div>
              <span className="result-label">접수 시각</span>
              <strong>{formatTimestamp(booking.applied_at)}</strong>
            </div>
          </div>

          <div className="detail-note">
            <span className="result-label">안내</span>
            <p>입금 확인 전에는 예약이 최종 확정되지 않습니다. 문의가 필요하면 예약 번호를 함께 알려 주세요.</p>
          </div>
        </section>
      ) : null}
    </main>
  );
}
