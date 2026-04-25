# coaching-reservation 작업로그

작성일: 2026-04-22

## 1. 문서 검토 및 범위 고정

- `AGENTS.md`와 `docs/` 전체를 먼저 읽고 현재 턴의 구현 범위를 정리했다.
- 이번 저장소는 초기 상태가 거의 문서만 있는 상태였고, 한 번에 하나의 기능만 구현한다는 규칙에 맞춰 우선순위를 `예약 신청 흐름`으로 고정했다.
- DB 스키마는 문서 기준을 유지했고, 사전 승인 없는 스키마 변경은 하지 않았다.

## 2. 백엔드 초기 구현

- Node.js + Express 서버 골격 추가
- SQLite 초기화 코드 추가
- seed 데이터 추가
- 환경변수 로딩 추가
- 공용 유틸과 에러 처리 추가

구현한 주요 API:

- `GET /api/services`
- `GET /api/services/:serviceId`
- `GET /api/slots`
- `GET /api/slots/:slotId`
- `POST /api/bookings`
- `GET /api/bookings/:bookingId/public`
- `GET /api/admin/bookings`
- `GET /api/admin/bookings/:bookingId`
- `PATCH /api/admin/bookings/:bookingId/status`
- `POST /api/webhooks/solapi`

## 3. 예약 흐름 및 외부 연동

- 예약 신청 시 booking row 생성
- 예약 신청 시 Telegram 운영자 알림 연결
- 예약 신청 시 SOLAPI 입금 안내 문자 연결
- 예약 확정 시 SOLAPI 확정 문자 연결
- `message_logs` 기록 연결
- SOLAPI webhook 수신 시 `message_logs` 상태 업데이트 처리

중요 정책:

- 외부 연동 실패 때문에 예약 생성 자체는 롤백하지 않도록 유지
- 실패 시 `message_logs`에 상태를 남기도록 구현

## 4. 트러블슈팅

### 4-1. SQLite 라이브러리 이슈

- 초기에는 `better-sqlite3`를 사용하려 했으나 현재 Windows + Node 24 환경에서 네이티브 빌드가 막혔다.
- 이를 피하기 위해 Node 내장 `node:sqlite` 기반으로 DB 레이어를 변경했다.

### 4-2. SOLAPI SDK 생성자 이슈

- `SolapiMessageService is not a constructor` 오류 발생
- 설치된 `solapi` 패키지 버전의 실제 export 구조를 확인
- `config.init(...)` + `msg.send(...)` 방식으로 수정

### 4-3. Telegram 알림 실패 이슈

- SMS는 정상 발송되는데 Telegram 신규 예약 알림만 실패
- `message_logs` 확인 결과 Telegram만 `failed`
- 토큰과 `chat_id` 자체는 직접 API 호출로 정상 확인
- 예약 흐름 내부에서는 Node `fetch`가 `fetch failed`로 떨어지는 것 확인
- Telegram 전송 로직을 `fetch`에서 `https.request` 기반으로 변경
- 이후 Telegram과 SMS 모두 실수발신 확인 완료

## 5. 예약자 Front-End MVP

별도 `client/` 디렉터리에 React + Vite 프런트 추가

구현 내용:

- 서비스 선택 화면
- 슬롯 선택 화면
- 예약 신청 폼
- 예약 완료 화면
- Vite dev proxy로 `/api`를 백엔드에 연결

검증 내용:

- `vite build` 통과
- `http://localhost:5173/api/services` 프록시 응답 확인

## 6. 관리자 Front-End MVP

기존 프런트에 `Public / Admin` 전환 추가

관리자 화면 구현 내용:

- 관리자 이메일 입력
- 상태 필터
- 서비스 필터
- 예약 목록 조회
- 예약 상세 조회
- 예약 상태 변경

현재 인증 방식:

- 임시로 `x-admin-email` 헤더 사용
- 추후 Google 로그인 + 세션 인증으로 교체 예정

## 7. 현재 확인 완료 상태

- 백엔드 서버 실행 가능
- SQLite DB 자동 생성 및 seed 동작
- 예약 신청 API 동작
- 관리자 예약 목록/상태 변경 API 동작
- SOLAPI SMS 수발신 확인
- Telegram 신규 예약 알림 수발신 확인
- 예약자 Front-End MVP 빌드 확인
- 관리자 Front-End MVP 빌드 확인

## 8. 현재 남은 핵심 과제

- Google 로그인 및 관리자 인증 정식화
- 관리자 서비스 CRUD
- 관리자 슬롯 CRUD
- 예약 메모 API
- 메시지 로그 조회 API
- 관리자 화면 기능 확장
- 운영/배포 준비

## 9. Public / Admin 페이지 분리 작업

- 작업일: 2026-04-22
- 범위: 프런트엔드 라우팅 구조 1차 분리

구현 내용:

- 기존 단일 화면 내 `Public / Admin` 토글 방식을 제거
- `/` 경로는 예약자 전용 화면으로 유지
- `/admin` 경로는 관리자 전용 화면으로 직접 진입 가능하도록 변경
- 별도 라우터 라이브러리 추가 없이 `window.history` 기반으로 최소 변경 적용
- 상단 이동 UI를 경로 기반 링크로 교체
- 화면 문구는 추후 수정 가능하도록 `App.jsx` 내에서 정리

검증 내용:

- `npm run client:build` 통과
- `http://localhost:5173/` 에서 예약 화면 진입 확인 기준 반영
- `http://localhost:5173/admin` 직접 진입 가능하도록 구조 반영

이번 작업에서 변경한 파일:

- `client/src/App.jsx`
- `client/src/styles.css`

메모:

- 이번 턴은 to-do 우선순위 1번의 첫 단계만 처리
- Google 로그인 및 관리자 세션 인증은 아직 미구현

## 10. 2026-04-23 추가 작업 요약

- Google 로그인 검증 로직을 공식 라이브러리 기반으로 보강했다.
- 예약 신청 필수항목을 `이름, 이메일, 전화번호, 환불 계좌 정보, 예약 조회 비밀번호`로 정리했다.
- 예약 조회를 이름 + 전화번호 + 비밀번호 흐름으로 단순화했다.
- 관리자 화면에서 예약 삭제, 일괄 삭제, 기간 필터를 추가했다.
- 코칭 1인 정원 슬롯은 예약 신청 시 즉시 홀드되고, 12시간 안에 확정되지 않으면 만료로 복구되도록 처리했다.
- 예약 신청 문자와 예약 확정 문자 문구를 운영 문안 기준으로 정리했다.
- 입금 계좌 정보는 관리자 화면의 운영 안내 설정에서 관리하도록 분리했다.
- 공개 예약 화면 문구를 실제 고객용으로 단순화했고, 사전 신청 링크를 연결했다.
- 관리자 진입 경로는 `/admin8630`, 로그인 경로는 `/admin8630/login`으로 변경했다.
- 서비스 설명 줄바꿈 렌더링을 보강했다.

## 11. 작업로그 폴더 정리

- `working-logs/daily/`: 날짜별 작업 로그
- `working-logs/orders/`: order 요청 원문
- 루트에는 `work-log.md`, `to-do-list.md`만 남기도록 정리했다.

## 12. 배포 전 보안 점검 메모

- 프런트에서 읽는 환경변수 범위를 `VITE_*`로 제한하고, Google Client ID만 명시적으로 주입하도록 조정했다.
- 현재 코드 기준으로 SOLAPI, Telegram, 세션 시크릿 문자열이 프런트 소스와 빌드 산출물에 직접 포함되는 흔적은 확인하지 못했다.
- 다만 Vercel 배포를 사용할 경우 SQLite 파일과 `data/operation-settings.json` 쓰기 방식은 지속성 문제가 있어 별도 대안이 필요하다.

## 13. 2026-04-25 공개 홈페이지 디자인 개편

- `docs/benchmark/clay` 디자인 가이드를 기준으로 공개 홈페이지의 시각 스타일을 개편했다.
- warm cream 배경, oat border, dashed border, matcha/lemon/ube 계열 swatch, hard shadow hover를 적용했다.
- 예약 신청/조회/완료 화면의 사용자 문구를 짧고 행동 중심으로 정리했다.
- 초록색 히어로 카드는 단순 경로 안내 대신 `예약 전 체크` 카드로 변경했다.
- 기능, API, DB 변경 없이 프론트엔드 디자인과 문구만 수정했다.
- `npm --prefix client run build` 통과를 확인했다.
- 민감정보 패턴 스캔 후 Git commit `7bcac70`으로 `main`에 푸시했다.
- Vercel production 배포를 완료했고 alias는 `https://coaching-reservation.vercel.app`이다.
