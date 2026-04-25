import { useEffect, useState } from "react";

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  organization: "",
  note: "",
  refundBank: "",
  refundAccount: "",
  refundHolder: "",
  bookingPassword: "",
};

export default function BookingForm({ disabled, selectedService, selectedSlot, onSubmit, submitting }) {
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    setForm(EMPTY_FORM);
  }, [selectedService?.id, selectedSlot?.id]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    onSubmit({
      serviceId: selectedService.id,
      slotId: selectedSlot.id,
      ...form,
    });
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <span className="eyebrow">3단계</span>
        <h2>마지막으로 신청 정보를 남겨 주세요.</h2>
      </div>

      <div className="inline-note">
        <strong>{selectedService.name}</strong>
        <span>{new Date(selectedSlot.start_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</span>
      </div>

      <form className="booking-form" onSubmit={handleSubmit}>
        <label>
          <span>이름 (입금자 명과 동일해야 합니다)</span>
          <input name="name" value={form.name} onChange={handleChange} placeholder="홍길동" required minLength={2} disabled={disabled} />
        </label>
        <label>
          <span>이메일</span>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="name@example.com"
            required
            disabled={disabled}
          />
        </label>
        <label>
          <span>전화번호</span>
          <input
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="휴대폰 번호"
            required
            disabled={disabled}
          />
        </label>
        <label>
          <span>소속 (선택)</span>
          <input
            name="organization"
            value={form.organization}
            onChange={handleChange}
            placeholder="회사명 또는 팀명"
            disabled={disabled}
          />
        </label>
        <label>
          <span>코칭 전에 전할 내용 (선택)</span>
          <textarea
            name="note"
            value={form.note}
            onChange={handleChange}
            placeholder="상황, 기대하는 변화, 미리 전할 내용을 적어 주세요."
            rows="4"
            disabled={disabled}
          />
        </label>

        <section className="sub-form-section">
          <div className="panel-header compact">
            <span className="eyebrow">정산 정보</span>
            <h3>환불 계좌 정보</h3>
          </div>
          <div className="admin-form-row">
            <label>
              <span>은행</span>
              <input
                name="refundBank"
                value={form.refundBank}
                onChange={handleChange}
                placeholder="은행명"
                required
                disabled={disabled}
              />
            </label>
            <label>
              <span>계좌번호</span>
              <input
                name="refundAccount"
                value={form.refundAccount}
                onChange={handleChange}
                placeholder="숫자 또는 하이픈 포함"
                required
                disabled={disabled}
              />
            </label>
            <label>
              <span>예금주</span>
              <input
                name="refundHolder"
                value={form.refundHolder}
                onChange={handleChange}
                placeholder="홍길동"
                required
                disabled={disabled}
              />
            </label>
          </div>
        </section>

        <label>
          <span>예약 조회용 비밀번호</span>
          <input
            name="bookingPassword"
            type="password"
            value={form.bookingPassword}
            onChange={handleChange}
            placeholder="4자리 숫자"
            required
            minLength={4}
            maxLength={4}
            inputMode="numeric"
            pattern="\d{4}"
            disabled={disabled}
          />
        </label>

        <button type="submit" className="primary-button" disabled={disabled || submitting}>
          {submitting ? "예약을 접수하는 중입니다..." : "이 시간으로 예약하기"}
        </button>
      </form>
    </section>
  );
}
