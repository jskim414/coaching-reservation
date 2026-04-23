import { useEffect, useState } from "react";

import AdminLogin from "./components/AdminLogin";
import AdminWorkspace from "./components/AdminWorkspace";
import BookingForm from "./components/BookingForm";
import BookingResult from "./components/BookingResult";
import PublicBookingLookup from "./components/PublicBookingLookup";
import ServiceList from "./components/ServiceList";
import SlotList from "./components/SlotList";
import {
  createBooking,
  fetchAuthMe,
  fetchPublicBooking,
  fetchServices,
  fetchSlots,
  loginWithGoogle,
  logoutAdmin,
} from "./lib/api";

const ROUTES = {
  publicHome: "/",
  bookingStatus: "/booking/status",
  bookingComplete: "/booking/complete",
  adminLogin: "/admin8630/login",
  admin: "/admin8630",
};
const PRE_REGISTER_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSd-SQnLssP7Of6kZP9CCD7X5M6V15H0WyJEbe5GRDJHJ6m1EA/viewform";

function normalizePathname(pathname) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function getRouteStateFromLocation() {
  const url = new URL(window.location.href);
  const pathname = normalizePathname(url.pathname);
  const bookingId = url.searchParams.get("bookingId")?.trim() || "";

  switch (pathname) {
    case ROUTES.publicHome:
      return { name: "publicHome", bookingId: "" };
    case ROUTES.bookingStatus:
      return { name: "bookingStatus", bookingId };
    case ROUTES.bookingComplete:
      return { name: "bookingComplete", bookingId };
    case ROUTES.adminLogin:
      return { name: "adminLogin", bookingId: "" };
    case ROUTES.admin:
      return { name: "admin", bookingId: "" };
    default:
      return { name: "notFound", bookingId: "" };
  }
}

function navigateTo(href) {
  const nextUrl = new URL(href, window.location.origin);
  const targetPath = `${normalizePathname(nextUrl.pathname)}${nextUrl.search}`;
  const currentPath = `${normalizePathname(window.location.pathname)}${window.location.search}`;

  if (targetPath === currentPath) {
    return;
  }

  window.history.pushState({}, "", targetPath);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function buildBookingHref(pathname, bookingId) {
  const params = new URLSearchParams();
  params.set("bookingId", String(bookingId));
  return `${pathname}?${params.toString()}`;
}

function RouteLink({ href, active, children }) {
  return (
    <a
      href={href}
      className={active ? "route-link active" : "route-link"}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
          return;
        }

        event.preventDefault();
        navigateTo(href);
      }}
    >
      {children}
    </a>
  );
}

function PublicBookingHome({ loadingServices, serviceError, services, onBookingCreated }) {
  const [selectedService, setSelectedService] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (services.length === 0) {
      setSelectedService(null);
      return;
    }

    setSelectedService((current) => services.find((service) => service.id === current?.id) || services[0]);
  }, [services]);

  useEffect(() => {
    if (!selectedService) {
      setSlots([]);
      setSelectedSlot(null);
      return;
    }

    async function loadSlots() {
      try {
        setLoadingSlots(true);
        setError("");
        const slotItems = await fetchSlots(selectedService.id);
        const availableSlots = slotItems.filter((slot) => slot.capacity - slot.reserved_count > 0);
        setSlots(slotItems);
        setSelectedSlot((current) => {
          const currentAvailable = availableSlots.find((slot) => slot.id === current?.id);
          return currentAvailable || availableSlots[0] || null;
        });
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoadingSlots(false);
      }
    }

    loadSlots();
  }, [selectedService]);

  async function handleBookingSubmit(form) {
    try {
      setSubmitting(true);
      setError("");
      const createdBooking = await createBooking(form);
      onBookingCreated(createdBooking.id);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {serviceError ? <div className="alert error">{serviceError}</div> : null}
      {error ? <div className="alert error">{error}</div> : null}

      <main className="content-grid">
        <section className="content-main">
          {loadingServices ? (
            <section className="panel state-panel">
              <div className="panel-header">
                <span className="eyebrow">불러오는 중</span>
                <h2>예약 가능한 항목을 불러오고 있습니다.</h2>
              </div>
              <p className="muted">잠시만 기다려 주세요.</p>
            </section>
          ) : (
            <ServiceList
              items={services}
              selectedServiceId={selectedService?.id}
              onSelect={(service) => {
                setSelectedService(service);
                setSelectedSlot(null);
              }}
            />
          )}

          <SlotList loading={loadingSlots} items={slots} selectedSlotId={selectedSlot?.id} onSelect={setSelectedSlot} />
        </section>

        <aside className="content-side">
          <section className="panel panel-summary">
            <div className="panel-header">
              <span className="eyebrow">현재 선택</span>
              <h2>선택 내용</h2>
            </div>

            <div className="summary-row">
              <span>서비스</span>
              <strong>{selectedService?.name || "아직 선택하지 않았습니다."}</strong>
            </div>
            <div className="summary-row">
              <span>시간</span>
              <strong>
                {selectedSlot
                  ? new Date(selectedSlot.start_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
                  : "아직 선택하지 않았습니다."}
              </strong>
            </div>
            <div className="summary-row">
              <span>안내</span>
              <strong>접수 후 문자 안내에 따라 입금을 진행해 주세요.</strong>
            </div>
          </section>

          {selectedService && selectedSlot ? (
            <BookingForm
              disabled={!selectedService || !selectedSlot}
              selectedService={selectedService}
              selectedSlot={selectedSlot}
              onSubmit={handleBookingSubmit}
              submitting={submitting}
            />
          ) : (
            <section className="panel state-panel">
              <div className="panel-header">
                <span className="eyebrow">다음 단계</span>
                <h2>예약 정보 입력</h2>
              </div>
              <p className="muted">서비스와 시간을 선택하면 신청 정보를 입력할 수 있습니다.</p>
            </section>
          )}
        </aside>
      </main>
    </>
  );
}

function PublicBookingComplete({ bookingId, onStartOver, onLookupBooking }) {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadBooking() {
      if (!bookingId) {
        setBooking(null);
        setError("예약 완료 화면을 열기 위한 예약 번호가 없습니다.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const item = await fetchPublicBooking(Number(bookingId));
        setBooking(item);
      } catch (loadError) {
        setBooking(null);
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadBooking();
  }, [bookingId]);

  if (loading) {
    return (
      <main className="single-column">
        <section className="panel state-panel">
          <div className="panel-header">
            <span className="eyebrow">확인 중</span>
            <h2>예약 정보를 확인하고 있습니다.</h2>
          </div>
          <p className="muted">잠시만 기다려 주세요.</p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="single-column">
        <section className="panel state-panel">
          <div className="panel-header">
            <span className="eyebrow">확인 실패</span>
            <h2>예약 정보를 불러오지 못했습니다.</h2>
          </div>
          <p className="muted">{error}</p>
          <div className="stack-actions">
            <button type="button" className="primary-button" onClick={onStartOver}>
              예약 신청으로 이동
            </button>
            <button type="button" className="secondary-button" onClick={onLookupBooking}>
              예약 조회로 이동
            </button>
          </div>
        </section>
      </main>
    );
  }

  return <BookingResult booking={booking} onReset={onStartOver} onLookup={onLookupBooking} />;
}

function NotFoundState() {
  return (
    <main className="single-column">
      <section className="panel state-panel">
        <div className="panel-header">
          <span className="eyebrow">잘못된 경로</span>
          <h2>요청한 화면을 찾을 수 없습니다.</h2>
        </div>
        <p className="muted">예약 신청 또는 예약 조회 화면으로 이동해 주세요.</p>
        <div className="stack-actions">
          <button type="button" className="primary-button" onClick={() => navigateTo(ROUTES.publicHome)}>
            예약 신청 화면
          </button>
          <button type="button" className="secondary-button" onClick={() => navigateTo(ROUTES.bookingStatus)}>
            예약 조회 화면
          </button>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [route, setRoute] = useState(() => getRouteStateFromLocation());
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [serviceError, setServiceError] = useState("");
  const [authState, setAuthState] = useState({
    loading: true,
    admin: null,
  });

  const googleClientId = __GOOGLE_CLIENT_ID__ || "";

  async function loadServices() {
    try {
      setLoadingServices(true);
      setServiceError("");
      const serviceItems = await fetchServices();
      setServices(serviceItems);
    } catch (loadError) {
      setServiceError(loadError.message);
    } finally {
      setLoadingServices(false);
    }
  }

  async function loadAuthMe() {
    try {
      const admin = await fetchAuthMe();
      setAuthState({
        loading: false,
        admin,
      });
    } catch (loadError) {
      if (loadError.status === 401) {
        setAuthState({
          loading: false,
          admin: null,
        });
        return;
      }

      setAuthState({
        loading: false,
        admin: null,
      });
    }
  }

  useEffect(() => {
    const handlePopState = () => {
      setRoute(getRouteStateFromLocation());
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    loadServices();
    loadAuthMe();
  }, []);

  useEffect(() => {
    if (authState.loading) {
      return;
    }

    if (route.name === "admin" && !authState.admin) {
      navigateTo(ROUTES.adminLogin);
      return;
    }

    if (route.name === "adminLogin" && authState.admin) {
      navigateTo(ROUTES.admin);
    }
  }, [route.name, authState.loading, authState.admin]);

  function handleBookingCreated(bookingId) {
    navigateTo(buildBookingHref(ROUTES.bookingComplete, bookingId));
  }

  function handleLookupBooking() {
    navigateTo(ROUTES.bookingStatus);
  }

  async function handleAdminLogin(credential) {
    const admin = await loginWithGoogle(credential);
    setAuthState({
      loading: false,
      admin,
    });
    navigateTo(ROUTES.admin);
  }

  async function handleAdminLogout() {
    await logoutAdmin();
    setAuthState({
      loading: false,
      admin: null,
    });
    navigateTo(ROUTES.adminLogin);
  }

  async function handleAuthExpired() {
    setAuthState({
      loading: false,
      admin: null,
    });
    navigateTo(ROUTES.adminLogin);
  }

  const heroContent =
    route.name === "bookingStatus"
      ? {
          eyebrow: "예약 조회",
          title: "예약 내역을 조회해 주세요.",
          description: "이름, 전화번호, 예약 비밀번호로 예약 상태를 확인할 수 있습니다.",
          cardLabel: "조회 안내",
          cardTitle: "예약 상태 확인",
          cardSubtitle: "예약 비밀번호 4자리를 준비해 주세요.",
        }
      : route.name === "bookingComplete"
        ? {
            eyebrow: "예약 접수 완료",
            title: "예약 신청이 접수되었습니다.",
            description: "안내 문자를 확인한 뒤 입금을 진행해 주세요. 예약 조회는 이름, 전화번호, 예약 비밀번호로 확인할 수 있습니다.",
            cardLabel: "다음 단계",
            cardTitle: "문자 안내 확인",
            cardSubtitle: "입금 확인 후 예약이 확정됩니다.",
          }
        : route.name === "adminLogin"
          ? {
              eyebrow: "관리자 로그인",
              title: "관리자 전용 화면은 Google 로그인 뒤에 접근합니다.",
              description: "메인 화면 메뉴에서는 관리자 링크를 노출하지 않으며, `/admin8630` 또는 `/admin8630/login` 경로로 직접 접속합니다.",
              cardLabel: "접근 방식",
              cardTitle: "직접 URL 입력",
              cardSubtitle: "허용된 관리자 계정만 로그인할 수 있습니다.",
            }
          : route.name === "admin"
            ? {
                eyebrow: "관리자 화면",
                title: "예약 검색, 삭제, 메모, 서비스와 일정 관리를 한 화면에서 처리합니다.",
                description: "관리자는 기간 필터, 예약 일괄 삭제, 상세 삭제, 내부 메모, 메시지 로그, 서비스와 일정 관리를 모두 사용할 수 있습니다.",
                cardLabel: "운영 포인트",
                cardTitle: "수동 운영 최적화",
                cardSubtitle: "예약 관리 편의 기능을 강화했습니다.",
              }
            : route.name === "notFound"
              ? {
                  eyebrow: "경로 오류",
                  title: "잘못된 주소로 접속했습니다.",
                  description: "예약 신청 또는 예약 조회 경로로 다시 이동해 주세요.",
                  cardLabel: "바로가기",
                  cardTitle: "유효한 경로로 이동 필요",
                  cardSubtitle: "관리자 화면은 직접 URL로 접속할 수 있습니다.",
                }
              : {
                  eyebrow: "예약 신청",
                  title: "원하는 시간대를 선택하고 예약을 신청해 주세요.",
                  description: "서비스와 시간을 선택한 뒤 신청 정보를 입력하면 예약이 접수됩니다.",
                  cardLabel: "진행 순서",
                  cardTitle: "서비스 선택 후 정보 입력",
                  cardSubtitle: "접수 후 문자 안내에 따라 예약을 진행합니다.",
                };

  const publicActive = route.name === "publicHome" || route.name === "bookingComplete";
  const statusActive = route.name === "bookingStatus";

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <span className="eyebrow">{heroContent.eyebrow}</span>
          <h1>{heroContent.title}</h1>
          <p>{heroContent.description}</p>

          <nav className="route-nav" aria-label="Application sections">
            <RouteLink href={ROUTES.publicHome} active={publicActive}>
              예약 신청
            </RouteLink>
            <RouteLink href={ROUTES.bookingStatus} active={statusActive}>
              예약 조회
            </RouteLink>
          </nav>

          {route.name === "publicHome" ? (
            <section className="hero-help">
              <span className="pending-badge">만약 원하시는 시간대가 없다면?</span>
              <p className="hero-help-text">
                만약 원하시는 시간대가 없거나 마감되셨다면, 미리 예약리스트에 등록해주십시오. 새로운 일정이 업데이트될
                때마다 메일로 안내드리겠습니다.
              </p>
              <div className="stack-actions hero-actions">
                <a href={PRE_REGISTER_FORM_URL} className="secondary-button" target="_blank" rel="noreferrer">
                  예약 리스트 등록
                </a>
              </div>
            </section>
          ) : null}
        </div>

        <div className="hero-card">
          <span>{heroContent.cardLabel}</span>
          <strong>{heroContent.cardTitle}</strong>
          <p>{heroContent.cardSubtitle}</p>
          <code className="route-path">
            {route.name === "bookingStatus"
              ? ROUTES.bookingStatus
              : route.name === "bookingComplete"
                ? ROUTES.bookingComplete
                : route.name === "adminLogin"
                  ? ROUTES.adminLogin
                  : route.name === "admin"
                    ? ROUTES.admin
                    : ROUTES.publicHome}
          </code>
        </div>
      </header>

      {route.name === "publicHome" ? (
        <PublicBookingHome
          loadingServices={loadingServices}
          serviceError={serviceError}
          services={services}
          onBookingCreated={handleBookingCreated}
        />
      ) : null}

      {route.name === "bookingStatus" ? (
        <PublicBookingLookup onStartBooking={() => navigateTo(ROUTES.publicHome)} />
      ) : null}

      {route.name === "bookingComplete" ? (
        <PublicBookingComplete
          bookingId={route.bookingId}
          onStartOver={() => navigateTo(ROUTES.publicHome)}
          onLookupBooking={handleLookupBooking}
        />
      ) : null}

      {route.name === "adminLogin" ? (
        <AdminLogin
          googleClientId={googleClientId}
          loading={authState.loading}
          onSubmit={handleAdminLogin}
          onBackToPublic={() => navigateTo(ROUTES.publicHome)}
        />
      ) : null}

      {route.name === "admin" ? (
        authState.loading ? (
          <main className="single-column">
            <section className="panel state-panel">
              <div className="panel-header">
                <span className="eyebrow">인증 확인</span>
                <h2>관리자 세션을 확인하고 있습니다.</h2>
              </div>
              <p className="muted">잠시만 기다려 주세요.</p>
            </section>
          </main>
        ) : authState.admin ? (
          <>
            {serviceError ? <div className="alert error">{serviceError}</div> : null}
            <AdminWorkspace
              admin={authState.admin}
              onLogout={handleAdminLogout}
              onAuthExpired={handleAuthExpired}
              onPublicServicesChanged={loadServices}
            />
          </>
        ) : null
      ) : null}

      {route.name === "notFound" ? <NotFoundState /> : null}
    </div>
  );
}
