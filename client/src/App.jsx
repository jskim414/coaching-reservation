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
          title: "접수한 예약을 다시 확인하세요.",
          description: "이름과 전화번호로 예약을 찾고, 신청 때 만든 4자리 비밀번호로 상세 상태를 확인합니다.",
        }
      : route.name === "bookingComplete"
        ? {
            eyebrow: "예약 접수 완료",
            title: "예약 신청을 받아두었습니다.",
            description: "안내 문자를 확인한 뒤 입금을 진행해 주세요. 입금 확인 후 예약이 최종 확정됩니다.",
          }
        : route.name === "adminLogin"
          ? {
              eyebrow: "관리자 로그인",
              title: "운영자는 Google 로그인 후 접근합니다.",
              description: "관리자 화면은 공개 메뉴에 노출하지 않습니다. `/admin8630` 또는 `/admin8630/login` 경로로 직접 접속합니다.",
            }
          : route.name === "admin"
            ? {
                eyebrow: "관리자 화면",
                title: "예약 운영에 필요한 일을 한 화면에서 처리합니다.",
                description: "예약 검색, 상태 관리, 내부 메모, 메시지 로그, 서비스와 일정 관리를 한 흐름으로 확인합니다.",
              }
            : route.name === "notFound"
              ? {
                  eyebrow: "경로 오류",
                  title: "잘못된 주소로 접속했습니다.",
                  description: "예약 신청 또는 예약 조회 경로로 다시 이동해 주세요.",
                }
              : {
                  eyebrow: "예약 신청",
                  title: "나에게 맞는 코칭 시간을 골라두세요.",
                  description: "서비스와 시간을 고르고 신청 정보를 남기면 예약이 접수됩니다. 이후 문자 안내에 따라 확정 절차를 진행합니다.",
                };

  const publicActive = route.name === "publicHome" || route.name === "bookingComplete";
  const statusActive = route.name === "bookingStatus";

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <div className="hero-stamps" aria-hidden="true">
            <span>1:1</span>
            <span>Seoul time</span>
            <span>SMS guide</span>
          </div>
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
              <span className="pending-badge">원하는 시간대가 없다면</span>
              <p className="hero-help-text">
                가능한 시간이 모두 마감되었거나 맞는 시간이 없다면 예약 리스트에 남겨 주세요. 새 일정이 열릴 때 메일로 안내드립니다.
              </p>
              <div className="stack-actions hero-actions">
                <a href={PRE_REGISTER_FORM_URL} className="secondary-button" target="_blank" rel="noreferrer">
                  예약 리스트에 남기기
                </a>
              </div>
            </section>
          ) : null}
        </div>

        <div className="hero-card">
          <span>Before booking</span>
          <strong>예약 전 세 가지만 확인해 주세요.</strong>
          <ol className="hero-checklist">
            <li>
              <span>01</span>
              <p>입금자명은 신청자명과 같게 입력해 주세요.</p>
            </li>
            <li>
              <span>02</span>
              <p>예약 조회용 4자리 비밀번호를 기억해 주세요.</p>
            </li>
            <li>
              <span>03</span>
              <p>접수 후 문자 안내에 따라 입금을 진행하면 예약이 확정됩니다.</p>
            </li>
          </ol>
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
