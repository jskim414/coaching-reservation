function getTypeLabel(type) {
  if (type === "coaching") {
    return "1:1 코칭";
  }

  if (type === "workshop") {
    return "그룹 워크샵";
  }

  return type;
}

export default function ServiceList({ items, selectedServiceId, onSelect }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <span className="eyebrow">1단계</span>
        <h2>먼저 필요한 코칭을 고르세요.</h2>
      </div>

      {items.length === 0 ? <p className="muted">지금 열려 있는 예약 항목이 없습니다.</p> : null}

      <div className="service-grid">
        {items.map((service) => {
          const active = service.id === selectedServiceId;

          return (
            <button
              key={service.id}
              type="button"
              className={`service-card ${active ? "active" : ""}`}
              onClick={() => onSelect(service)}
            >
              <span className="service-type">{getTypeLabel(service.type)}</span>
              <strong>{service.name}</strong>
              <span className="service-description">{service.description}</span>
              <div className="service-meta">
                <span>{service.duration_min}분</span>
                <span>{service.price.toLocaleString("ko-KR")}원</span>
                <span>예약 가능 {service.capacity_default}명</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
