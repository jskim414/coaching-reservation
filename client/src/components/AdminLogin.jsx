import { useEffect, useRef, useState } from "react";

const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";

function loadGoogleScript() {
  const existing = document.querySelector(`script[src="${GOOGLE_SCRIPT_URL}"]`);

  if (existing) {
    if (window.google?.accounts?.id) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GOOGLE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function AdminLogin({ googleClientId, loading, onSubmit, onBackToPublic }) {
  const buttonRef = useRef(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!googleClientId || !buttonRef.current) {
      return undefined;
    }

    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id || !buttonRef.current) {
          return;
        }

        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            try {
              setSubmitting(true);
              setError("");
              await onSubmit(response.credential);
            } catch (submitError) {
              setError(submitError.message);
            } finally {
              setSubmitting(false);
            }
          },
        });

        buttonRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "signin_with",
          width: 320,
        });
      })
      .catch(() => {
        setError("Google 로그인 스크립트를 불러오지 못했습니다.");
      });

    return () => {
      cancelled = true;
    };
  }, [googleClientId, onSubmit]);

  return (
    <main className="single-column">
      <section className="panel auth-panel">
        <div className="panel-header">
          <span className="eyebrow">관리자 로그인</span>
          <h2>Google 계정으로 관리자 세션을 시작하세요.</h2>
        </div>

        <p className="muted">
          허용된 관리자 계정만 로그인할 수 있습니다. 로그인 후에는 HttpOnly 쿠키 세션으로 관리자 화면에 접근합니다.
        </p>

        {!googleClientId ? (
          <div className="alert error auth-alert">GOOGLE_CLIENT_ID가 설정되지 않아 Google 로그인을 사용할 수 없습니다.</div>
        ) : null}
        {error ? <div className="alert error auth-alert">{error}</div> : null}

        <div className="google-login-stack">
          <div ref={buttonRef} className="google-login-button" />
          {submitting || loading ? <p className="muted">로그인 상태를 확인하는 중입니다.</p> : null}
        </div>

        <div className="stack-actions">
          <button type="button" className="secondary-button" onClick={onBackToPublic}>
            예약 신청 화면으로 돌아가기
          </button>
        </div>
      </section>
    </main>
  );
}
