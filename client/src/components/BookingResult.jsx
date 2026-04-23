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

export default function BookingResult({ booking, onReset, onLookup }) {
  return (
    <main className="single-column">
      <section className="panel panel-success">
        <div className="panel-header">
          <span className="eyebrow">접수 완료</span>
          <h2>예약 신청이 접수되었습니다.</h2>
        </div>

        <div className="result-grid">
          <div>
            <span className="result-label">예약 번호</span>
            <strong>#{booking.id}</strong>
          </div>
          <div>
            <span className="result-label">신청 서비스</span>
            <strong>{booking.service_name}</strong>
          </div>
          <div>
            <span className="result-label">예약 시간</span>
            <strong>{formatTimestamp(booking.slot_start_at)}</strong>
          </div>
          <div>
            <span className="result-label">현재 상태</span>
            <strong>{formatStatusLabel(booking.status)}</strong>
          </div>
        </div>

        <section className="payment-guide">
          <div>
            <span className="result-label">안내</span>
            <strong>안내 문자를 확인한 뒤 입금을 진행해 주세요.</strong>
          </div>
          <p className="muted">
            예약 조회는 이름, 전화번호, 예약 비밀번호로 확인할 수 있습니다.
          </p>
          <ul className="guide-list">
            <li>입금 확인 후 예약이 확정됩니다.</li>
            <li>예약 번호는 문의 시 함께 전달해 주세요.</li>
            <li>문자를 받지 못한 경우 예약 조회에서 다시 확인할 수 있습니다.</li>
          </ul>
        </section>

        <div className="stack-actions">
          <button type="button" className="primary-button" onClick={onLookup}>
            예약 조회로 이동
          </button>
          <button type="button" className="secondary-button" onClick={onReset}>
            새 예약 신청하기
          </button>
        </div>
      </section>
    </main>
  );
}
