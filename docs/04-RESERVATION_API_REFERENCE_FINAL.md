# RESERVATION_API_REFERENCE_FINAL.md

## 문서 목적

이 문서는 아래 구조를 기준으로 이 프로젝트에서 사용하는 외부 API와 내부 연동 방식을 최종 정리한 참조 문서다.

- 예약자 안내: SOLAPI SMS
- 운영자 신규 예약 알림: Telegram Bot API
- 관리자 인증: Google 로그인
- 결제: 수동 입금 확인
- 서버: Node.js + Express
- DB: SQLite

이 문서는 구현 관점에서 필요한 API, 역할, 호출 시점, 최소 구현 범위를 정리한다.

---

## 1. 외부 서비스 계정 및 준비물

### 필수
1. Google Cloud 프로젝트 및 Google OAuth 설정
2. SOLAPI 계정
3. Telegram 계정 + BotFather로 생성한 봇
4. 배포 환경 계정(Render, Railway, Fly.io 등)

### 추가 준비물
- SOLAPI 발신번호 등록 및 인증
- Telegram bot token 확보
- Telegram 알림을 받을 개인 chat_id 또는 그룹 chat_id 확보
- Google OAuth Client ID / Secret 확보

---

## 2. 이 프로젝트에서 실제 사용하는 외부 API

이 프로젝트에서 직접 연동하는 외부 API는 아래 3종이다.

1. Google OAuth / Google Identity 기반 관리자 로그인
2. SOLAPI SMS 발송 API
3. Telegram Bot API

---

## 3. 외부 API별 역할

### 3-1. Google
역할:
- 관리자 로그인
- 사전 등록된 이메일만 관리자 접근 허용

사용 위치:
- 관리자 로그인 화면
- 관리자 세션 확인

비고:
- 사용자 예약자에게는 사용되지 않음
- 회원가입 기능 없음

---

### 3-2. SOLAPI
역할:
- 예약 신청 직후 입금 안내 SMS 발송
- 예약 확정 직후 확정 안내 SMS 발송
- 선택적으로 예약 리마인드 SMS 발송

사용 위치:
- `POST /api/bookings` 내부
- `PATCH /api/admin/bookings/:bookingId/status` 내부
- `POST /api/webhooks/solapi`

비고:
- 공개용 `/api/sms/send` API는 만들지 않음
- 서버 내부 서비스 모듈에서 SDK 호출

---

### 3-3. Telegram
역할:
- 운영자에게 신규 예약 발생 알림 전송
- 필요시 예약 확정/취소/실패 알림 전송

사용 위치:
- `POST /api/bookings` 내부
- 필요시 관리자 상태 변경 로직 내부

비고:
- 공개용 `/api/notify/telegram` API는 필수 아님
- 서버 내부 서비스 함수로 처리 가능

---

## 4. Telegram Bot API 구현 기준

### 4-1. 기본 원리
Telegram Bot API는 HTTP 기반 인터페이스다.
요청 URL 형식:

`https://api.telegram.org/bot<token>/METHOD_NAME`

예:
`https://api.telegram.org/bot<token>/sendMessage`

---

### 4-2. 이 프로젝트에서 실제로 필요한 Telegram 메서드

#### A. sendMessage
용도:
- 신규 예약 발생 시 운영자에게 텍스트 알림 발송

예상 사용 예:
- 예약자 이름
- 서비스명
- 예약 일시
- 예약 상태
- 관리자 페이지 확인 유도 문구

#### B. getMe
용도:
- bot token 정상 여부 확인
- 초기 개발/디버깅 시 사용

#### C. getUpdates
용도:
- chat_id 확인
- webhook 없이 간단 테스트
- 초기 세팅 시 가장 현실적인 방법

---

### 4-3. Telegram 연동 구조

추천 방식:
- 처음에는 `getUpdates` 방식으로 chat_id를 확인
- 이후 서버 내부 `telegram.service`에서 `sendMessage` 호출

초기 MVP에서는 Telegram webhook을 만들 필요 없음.

---

### 4-4. Telegram 환경변수 예시

```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

---

### 4-5. Telegram 메시지 예시

```text
[신규 예약]
서비스: 1:1 코칭
예약자: 홍길동
일시: 2026-05-01 14:00
상태: requested
```

---

### 4-6. Telegram 서비스 함수 예시

```js
import axios from "axios";

export async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const response = await axios.post(url, {
    chat_id: chatId,
    text,
  });

  return response.data;
}
```

---

## 5. SOLAPI 구현 기준

### 5-1. 기본 역할
SOLAPI는 예약자 대상 문자 발송만 담당한다.

발송 시점:
1. 예약 신청 직후 → 입금 안내 문자
2. 예약 확정 직후 → 확정 안내 문자

---

### 5-2. 구현 방식
- Node.js SDK 사용
- 서버 내부 서비스 모듈에서만 호출
- 발송 결과는 `message_logs` 테이블 저장
- 필요시 webhook으로 최종 결과 추적

---

### 5-3. 환경변수 예시

```env
SOLAPI_API_KEY=your_solapi_api_key
SOLAPI_API_SECRET=your_solapi_api_secret
SOLAPI_SENDER=15771603
```

---

### 5-4. 번호 형식 정책
- 발신번호/수신번호는 숫자만 남긴 형식으로 정규화
- 예: `01012345678`
- `-`, `+` 같은 특수문자 제거

---

### 5-5. SOLAPI 서비스 함수 예시

```js
import { SolapiMessageService } from "solapi";

const messageService = new SolapiMessageService(
  process.env.SOLAPI_API_KEY,
  process.env.SOLAPI_API_SECRET
);

export async function sendSms({ to, text }) {
  return await messageService.send({
    to,
    from: process.env.SOLAPI_SENDER,
    text,
  });
}
```

---

### 5-6. 문자 템플릿 예시

#### 예약 신청 후 입금 안내
```text
[코칭 예약]
예약 신청이 접수되었습니다.
입금 확인 후 최종 확정됩니다.
서비스: {serviceName}
일시: {slotDateTime}
문의: {contactPhone}
```

#### 예약 확정
```text
[코칭 예약]
예약이 최종 확정되었습니다.
서비스: {serviceName}
일시: {slotDateTime}
장소/방식: {locationOrMethod}
```

---

## 6. 이 프로젝트의 내부 API 목록

### 6-1. Public API
1. `GET /api/services`
2. `GET /api/services/:serviceId`
3. `GET /api/slots?serviceId=`
4. `GET /api/slots/:slotId`
5. `POST /api/bookings`
6. `GET /api/bookings/:bookingId/public`

---

### 6-2. Auth API
7. `POST /api/auth/google`
8. `POST /api/auth/logout`
9. `GET /api/auth/me`

---

### 6-3. Admin Booking API
10. `GET /api/admin/bookings`
11. `GET /api/admin/bookings/:bookingId`
12. `PATCH /api/admin/bookings/:bookingId/status`
13. `PATCH /api/admin/bookings/:bookingId/memo`

---

### 6-4. Admin Service API
14. `GET /api/admin/services`
15. `GET /api/admin/services/:serviceId`
16. `POST /api/admin/services`
17. `PATCH /api/admin/services/:serviceId`
18. `DELETE /api/admin/services/:serviceId`

---

### 6-5. Admin Slot API
19. `GET /api/admin/slots`
20. `GET /api/admin/slots/:slotId`
21. `POST /api/admin/slots`
22. `PATCH /api/admin/slots/:slotId`
23. `DELETE /api/admin/slots/:slotId`

---

### 6-6. Webhook
24. `POST /api/webhooks/solapi`

---

## 7. 실제 이벤트별 호출 흐름

### 7-1. 예약 신청 발생 시

1. 사용자가 `POST /api/bookings` 호출
2. 서버가 booking row 생성
3. 서버가 Telegram으로 운영자 알림 발송
4. 서버가 SOLAPI로 입금 안내 SMS 발송
5. 메시지 로그 저장

---

### 7-2. 예약 확정 시

1. 운영자가 `PATCH /api/admin/bookings/:bookingId/status` 호출
2. 상태를 `confirmed`로 변경
3. 슬롯 정원 차감
4. SOLAPI로 확정 안내 SMS 발송
5. 메시지 로그 저장

---

### 7-3. SOLAPI 발송 결과 반영 시

1. SOLAPI가 `POST /api/webhooks/solapi` 호출
2. 서버가 즉시 200 응답
3. 비동기로 `message_logs` 상태 업데이트

---

## 8. 구현 시 중요한 정책

### 8-1. Telegram
- 신규 예약 알림은 Telegram 하나로 고정
- 초기에는 webhook 불필요
- `sendMessage` 중심으로 구현

### 8-2. SOLAPI
- 공개 SMS 발송 API는 만들지 않음
- 예약/상태변경 로직 내부에서만 호출
- 발신번호 활성화 먼저 확인

### 8-3. 공통
- 외부 API 실패 때문에 예약 생성 자체를 롤백하지 않음
- 대신 발송 실패 로그를 저장하고 운영자 확인 가능하게 함

---

## 9. 환경변수 최종 목록 예시

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
ADMIN_ALLOWLIST_EMAIL=you@example.com

SOLAPI_API_KEY=your_solapi_api_key
SOLAPI_API_SECRET=your_solapi_api_secret
SOLAPI_SENDER=15771603

TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

---

## 10. Codex / CLI 에이전트용 작업 요약

```text
목표:
예약 시스템 외부 연동 구현

적용 서비스:
- 관리자 로그인: Google
- 예약자 문자: SOLAPI
- 운영자 신규 예약 알림: Telegram

제약:
- Node.js + Express 유지
- SQLite 유지
- 공개 SMS API 만들지 말 것
- 공개 Telegram 알림 API 만들지 말 것
- 외부 연동은 모두 서버 내부 서비스 함수로 구현
- SOLAPI webhook만 공개 route 허용

필수 구현:
1. telegram.service 생성
2. solapi.client / sms.service 생성
3. booking 생성 시 telegram + sms 트리거 연결
4. booking confirmed 시 sms 트리거 연결
5. solapi webhook route 추가
6. message_logs 기록

검증:
- Telegram sendMessage 테스트
- SOLAPI 발송 테스트
- webhook 수신 테스트
- 실패 케이스 로그 확인
```

---

## 11. 한 줄 정리

이 프로젝트의 외부 연동 구조는 아래처럼 단순하다.

- 관리자 로그인: Google
- 예약자 안내: SOLAPI SMS
- 운영자 신규 예약 알림: Telegram
- 외부 공개 webhook: SOLAPI 결과 수신 1개만 허용
