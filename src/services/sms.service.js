const { config, msg } = require("solapi");

const {
  CONTACT_PHONE,
  SMS_ENABLED,
  SOLAPI_API_KEY,
  SOLAPI_API_SECRET,
  SOLAPI_SENDER,
} = require("../config/env");
const { getOperationSettings } = require("./operation-settings.service");
const { formatLocalTimestamp } = require("../utils/date");
const { normalizePhone } = require("../utils/phone");

let messageService = null;

if (SOLAPI_API_KEY && SOLAPI_API_SECRET) {
  config.init({
    apiKey: SOLAPI_API_KEY,
    apiSecret: SOLAPI_API_SECRET,
  });

  messageService = msg;
}

async function sendPaymentPendingSms({ booking, service, slot }) {
  const paymentDeadline = new Date(booking.applied_at);
  paymentDeadline.setHours(paymentDeadline.getHours() + 12);
  const operationSettings = await getOperationSettings();

  const text = [
    "[코칭 예약]",
    "예약 신청이 접수되었습니다.",
    "<프로그램비 입금 안내>",
    ` - 입금 금액: ${Number(service.price || 0).toLocaleString("ko-KR")}원`,
    ` - 입금 계좌: ${operationSettings.payment_account_bank} ${operationSettings.payment_account_number} ${operationSettings.payment_account_holder}`,
    ` - 입금자명: ${booking.name}`,
    ` - 입금 기한: ${formatLocalTimestamp(paymentDeadline)}`,
    "입금 확인 후 최종 확정됩니다. 예약 최종 확정 이후에는 중복 신청 외에는 환불이 불가합니다.",
    "<신청 서비스 안내>",
    ` - 서비스: ${service.name}`,
    ` - 일시: ${formatLocalTimestamp(slot.start_at)}`,
    ` - 문의: ${CONTACT_PHONE}`,
  ].join("\n");

  return sendSms({
    to: booking.phone,
    text,
  });
}

async function sendConfirmedSms({ booking, service, slot }) {
  const text = [
    "[코칭 예약]",
    "예약이 최종 확정되었습니다.",
    ` - 신청자명: ${booking.name}`,
    ` - 서비스: ${service.name}`,
    ` - 입금 금액: ${Number(service.price || 0).toLocaleString("ko-KR")}원`,
    ` - 일시: ${formatLocalTimestamp(slot.start_at)}`,
    ` - 장소/방식: ${booking.email} 로 추후 안내 예정`,
  ].join("\n");

  return sendSms({
    to: booking.phone,
    text,
  });
}

async function sendSms({ to, text }) {
  const normalizedTo = normalizePhone(to);
  const normalizedFrom = normalizePhone(SOLAPI_SENDER);

  if (!SMS_ENABLED || !messageService || !normalizedFrom) {
    return {
      status: "skipped",
    };
  }

  if (!normalizedTo) {
    throw new Error("Recipient phone is invalid");
  }

  await messageService.send({
    messages: [
      {
        to: normalizedTo,
        from: normalizedFrom,
        text,
      },
    ],
  });

  return {
    status: "sent",
  };
}

module.exports = {
  sendConfirmedSms,
  sendPaymentPendingSms,
};
