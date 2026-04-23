# coaching-reservation

1인 운영 코칭/워크샵 예약 시스템입니다.

- Backend: Node.js + Express + SQLite
- Frontend: React + Vite
- 외부 연동: Google 로그인, Telegram, SOLAPI

## 현재 구현 상태

### Public
- 서비스 목록 조회
- 슬롯 목록 조회
- 예약 신청
- 예약 완료 화면
- 예약 번호 기반 조회

### Admin
- Google 로그인
- HttpOnly 쿠키 기반 관리자 세션
- 예약 목록 조회
- 예약 상세 조회
- 예약 상태 변경
- 관리자 메모 저장
- 메시지 로그 조회
- 서비스 CRUD
- 슬롯 CRUD

### 운영 연동
- Telegram 신규 예약 알림
- SOLAPI 입금 안내 / 예약 확정 SMS
- `message_logs` 기록 및 조회
- 테스트 환경 SMS 비활성화 지원 (`SMS_ENABLED=false`)

## 실행 방법

### 1. 환경변수 준비

루트에 `.env` 파일을 만들고 최소한 아래 값을 넣습니다.

```env
PORT=4000
DB_FILE=./data/app.db

GOOGLE_CLIENT_ID=your_google_client_id
SESSION_SECRET=change-this-session-secret
ADMIN_ALLOWLIST_EMAIL=admin@example.com

CONTACT_PHONE=01000000000

TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

SMS_ENABLED=false
SOLAPI_API_KEY=
SOLAPI_API_SECRET=
SOLAPI_SENDER=
```

설명:
- `GOOGLE_CLIENT_ID`: 관리자 Google 로그인용 클라이언트 ID
- `SESSION_SECRET`: 관리자 세션 서명 키
- `ADMIN_ALLOWLIST_EMAIL`: 관리자 접근 허용 이메일
- `SMS_ENABLED=false`: 개발 중 실발송 방지

### 2. 의존성 설치

```bash
npm install
npm --prefix client install
```

### 3. 서버 실행

```bash
npm start
```

서버 주소:
- `http://localhost:4000`

### 4. 프런트 실행

새 터미널에서 실행:

```bash
npm run client:dev
```

프런트 주소:
- `http://localhost:5173`

Vite dev server는 `/api` 요청을 `http://localhost:4000`으로 프록시합니다.

## Frontend 확인 방법

### 예약자 화면 확인

1. `npm start`로 서버 실행
2. 다른 터미널에서 `npm run client:dev` 실행
3. 브라우저에서 `http://localhost:5173` 접속

확인 포인트:
- 서비스 선택
- 슬롯 선택
- 예약 신청
- 예약 완료 화면
- 예약 조회 화면

### 관리자 화면 확인

1. `.env`에 `GOOGLE_CLIENT_ID` 설정
2. `.env`에 `ADMIN_ALLOWLIST_EMAIL`을 실제 로그인할 Google 이메일로 설정
3. Google Cloud Console에서 로컬 개발 origin 허용
   - `http://localhost:5173`
4. 서버와 프런트 실행
5. 브라우저에서 `http://localhost:5173/admin/login` 접속

확인 포인트:
- Google 로그인
- 관리자 세션 유지
- 예약 목록/상세 조회
- 예약 상태 변경
- 관리자 메모 저장
- 메시지 로그 조회
- 서비스 관리
- 슬롯 관리

참고:
- `GOOGLE_CLIENT_ID`가 비어 있으면 관리자 로그인 버튼이 동작하지 않습니다.
- 예약자 화면은 Google 설정 없이도 확인 가능합니다.

## 빌드

```bash
npm run client:build
```

## 테스트 방법

### 공통 확인

```bash
curl http://localhost:4000/health
curl http://localhost:4000/api/services
```

### 예약 생성 성공

```bash
curl -X POST http://localhost:4000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"serviceId":2,"slotId":3,"name":"API Test","email":"apitest@example.com","phone":"01012345678","organization":"QA","note":"test booking"}'
```

### 실패 케이스 1: 필수값 누락

```bash
curl -X POST http://localhost:4000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 실패 케이스 2: 인증 없이 관리자 API 호출

```bash
curl -i http://localhost:4000/api/admin/bookings
```

### 실패 케이스 3: 잘못된 Google credential

```bash
curl -X POST http://localhost:4000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"credential":"invalid"}'
```

## 주요 경로

- Public 홈: `http://localhost:5173/`
- 예약 조회: `http://localhost:5173/booking/status`
- 관리자 로그인: `http://localhost:5173/admin/login`
- 관리자 화면: `http://localhost:5173/admin`

## 남은 작업

- 실제 Google 로그인 성공 플로우 실검증
- 운영 계정/운영 문구 최종 확정
- 실운영 SMS/Telegram/webhook 최종 테스트
- QA 및 배포 준비
