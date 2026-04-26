const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = require("../config/env");
const https = require("https");
const { formatLocalTimestamp } = require("../utils/date");

async function sendTelegramNewBooking({ booking, service, slot }) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return {
      status: "skipped",
    };
  }

  const payload = await postJson(`/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    chat_id: TELEGRAM_CHAT_ID,
    text: [
      "[신규 예약]",
      `서비스: ${service.name}`,
      `예약자: ${booking.name}`,
      `일시: ${formatLocalTimestamp(slot.start_at)}`,
      `상태: ${booking.status}`,
    ].join("\n"),
  });

  if (!payload.ok) {
    throw new Error("Telegram API returned ok=false");
  }

  return {
    status: "sent",
  };
}

function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const request = https.request(
      {
        hostname: "api.telegram.org",
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (response) => {
        let raw = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`Telegram request failed with ${response.statusCode}`));
            return;
          }

          try {
            resolve(JSON.parse(raw));
          } catch (error) {
            reject(new Error("Telegram response JSON parse failed"));
          }
        });
      }
    );

    request.on("error", (error) => {
      reject(error);
    });

    request.write(data);
    request.end();
  });
}

module.exports = {
  sendTelegramNewBooking,
};
