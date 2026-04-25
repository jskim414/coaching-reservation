function formatSlotRange(startAt, endAt) {
  const start = new Date(startAt);
  const end = new Date(endAt);

  const dateText = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul",
  }).format(start);

  const timeText = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(start);

  const endText = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(end);

  return `${dateText} ${timeText} - ${endText}`;
}

export default function SlotList({ loading, items, selectedSlotId, onSelect }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <span className="eyebrow">2단계</span>
        <h2>이어 가능한 시간을 선택하세요.</h2>
      </div>

      {loading ? <p className="muted">선택 가능한 시간을 확인하고 있습니다.</p> : null}

      {!loading && items.length === 0 ? <p className="muted">이 항목에는 현재 열려 있는 시간이 없습니다.</p> : null}

      <div className="slot-list">
        {items.map((slot) => {
          const remaining = Math.max(slot.capacity - slot.reserved_count, 0);
          const active = slot.id === selectedSlotId;
          const disabled = remaining === 0;

          return (
            <button
              key={slot.id}
              type="button"
              className={`slot-card ${active ? "active" : ""}`}
              onClick={() => onSelect(slot)}
              disabled={disabled}
            >
              <strong>{formatSlotRange(slot.start_at, slot.end_at)}</strong>
              <span>{remaining > 0 ? `예약 가능 ${remaining}명` : "마감"}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
