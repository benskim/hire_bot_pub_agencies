/// <reference types="vite/client" />

/**
 * Firebase Google Analytics & Web Crashlytics Integration
 * 
 * =========================================================================
 * [GA & Firebase Crashlytics 사용 목적 (Purpose of Use)]
 * 
 * 1. Google Analytics (GA):
 *    - 사용자 행동 분석: 어떤 기기, 브라우저를 쓰고 어떤 버튼을 자주 누르는지 수집합니다.
 *    - 수집 작업(Scraping) 모니터링: 언제 크롤링을 시작하고, 어떤 네트워크 타입이 자주 쓰이며, 성공/실패율은 어떤지 파악합니다.
 *    - 이탈율 및 이용 시간 분석: 서비스 활성 사용량과 개선점을 데이터를 기반으로 도출합니다.
 * 
 * 2. Firebase Crashlytics (웹 대체):
 *    - 원래 Firebase Crashlytics는 Android/iOS/Flutter 등 "모바일 앱 전용" SDK입니다.
 *    - 웹 환경(Web SPA)에서는 모바일용 Crashlytics SDK가 직접 지원되지 않으므로, 
 *      "전역 에러 핸들러(window.onerror, unhandledrejection)"를 심어 웹 앱에서 발생하는
 *      모든 미처리 오류(Crash)를 수집하고, 이를 Google Analytics의 'exception' 또는 'app_crash' 이벤트로 로깅합니다.
 *    - 이를 통해 사용자가 직면하는 런타임 오류와 크래쉬 현상을 실시간으로 모니터링하고 추적할 수 있습니다.
 * =========================================================================
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, logEvent, Analytics } from "firebase/analytics";
import { getFirestore, collection, addDoc, Firestore } from "firebase/firestore";

// =========================================================================
// [입력 정보 설정] 아래 정보를 본인의 Firebase 콘솔 설정 값으로 교체하거나
// .env 환경변수를 사용하여 주입할 수 있습니다. (Vite 환경 변수 사용 권장)
// =========================================================================
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDTujOvdssK4GJEu67c5psMX-uyMeenL-U",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "hire-noti.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "hire-noti",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "hire-noti.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "853343008574",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:853343008574:web:74e9b2f846786314cade6f",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-SK96SK9J47"
};

let app;
let analytics: Analytics | null = null;
let db: Firestore | null = null;

// Check if the configuration is using the default template values
const isPlaceholder = (val: string) => !val || val.includes("YOUR_FIREBASE_") || val.startsWith("YOUR_");
const isFirebaseConfigured = 
  !isPlaceholder(firebaseConfig.apiKey) && 
  !isPlaceholder(firebaseConfig.projectId) && 
  !isPlaceholder(firebaseConfig.appId);

// Firebase 초기화 진행
if (isFirebaseConfigured) {
  try {
    // 중복 초기화 방지
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    
    // 브라우저 환경에서만 Analytics 실행 (Server Side Rendering 방지)
    if (typeof window !== "undefined") {
      analytics = getAnalytics(app);
      db = getFirestore(app);
      console.log("🔥 Firebase Analytics, Firestore & Crashlytics initialized successfully.");
    }
  } catch (error) {
    console.error("⚠️ Firebase initialization failed:", error);
  }
} else {
  console.log("ℹ️ Firebase is running in simulation/dev mode because default placeholder credentials are used. Event tracking and simulated Crashlytics logs will be outputted to the developer console.");
}

// 3. 다른 파일에서 쓸 수 있도록 내보내기
export { app, analytics, db };

/**
 * 1. 일반 이벤트 로깅 (GA)
 */
export function trackEvent(eventName: string, params?: Record<string, any>) {
  if (analytics) {
    try {
      logEvent(analytics, eventName, params);
      console.log(`[GA Event Logged] ${eventName}`, params);
    } catch (e) {
      console.error("Failed to log event to GA:", e);
    }
  } else {
    console.log(`[GA Dev Mode (Uninitialized)] ${eventName}`, params);
  }
}

/**
 * 2. 범용 UI 액션 로깅
 */
export function trackUIAction(action: string, details?: Record<string, any>) {
  trackEvent("ui_action", {
    action,
    ...details,
  });
}

export function trackFormSubmission(formName: string, details?: Record<string, any>) {
  trackEvent("form_submit", {
    form_name: formName,
    ...details,
  });
}

export function trackInputInteraction(fieldName: string, valueLength: number, details?: Record<string, any>) {
  trackEvent("input_interaction", {
    field_name: fieldName,
    value_length: valueLength,
    ...details,
  });
}

export function trackNavigation(section: string, details?: Record<string, any>) {
  trackEvent("navigation", {
    section,
    ...details,
  });
}

/**
 * 3. 특정 버튼 클릭 이벤트 로깅
 */
export function trackButtonClick(buttonId: string, label: string) {
  trackEvent("button_click", {
    button_id: buttonId,
    button_label: label,
  });
}

/**
 * 3. 수집 동작(Scrape Action) 분석 이벤트 로깅
 */
export function trackScrapeAction(networkType: string, success: boolean, count: number, errorMsg?: string) {
  trackEvent("scrape_action", {
    network_type: networkType,
    success: success ? "yes" : "no",
    item_count: count,
    error_message: errorMsg || ""
  });
}

/**
 * 4. 기기 에러 및 예외 모니터링 (Crashlytics 역할의 예외 수집)
 */
export function trackException(errorDescription: string, fatal: boolean = false, stack?: string) {
  trackEvent("exception", {
    description: errorDescription,
    fatal: fatal,
    stack_trace: stack || "No stack trace available",
    url: typeof window !== "undefined" ? window.location.href : "unknown"
  });
}

/**
 * [자동 전역 에러 트래커 설치 (Automated Global Crash Tracker)]
 * 이 스크립트가 로드되면 자동으로 window 상의 에러를 구독하여 예외 상황을 수집합니다.
 */
if (typeof window !== "undefined") {
  // 일반 런타임 오류 캡처
  window.addEventListener("error", (event) => {
    const errorMsg = event.message || "Unknown error";
    const source = event.filename || "unknown";
    const line = event.lineno || 0;
    const col = event.colno || 0;
    const stack = event.error?.stack || "";
    
    const formattedError = `[Crash] ${errorMsg} at ${source}:${line}:${col}`;
    console.warn("💥 Automatically capturing uncaught error for Crashlytics simulation:", formattedError);
    
    trackException(formattedError, true, stack);
  });

  // 비동기 처리 안 된 Promise Rejection (unhandledrejection) 오류 캡처
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const errorMsg = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : "";
    
    const formattedError = `[Unhandled Promise Rejection] ${errorMsg}`;
    console.warn("💥 Automatically capturing unhandled rejection for Crashlytics simulation:", formattedError);
    
    trackException(formattedError, true, stack);
  });
}

/**
 * 5. 추가 완료 버튼 클릭시 기관명, url을 Firestore에 저장
 */
export async function saveAddedAgencyToFirebase(name: string, url: string) {
  if (db) {
    try {
      await addDoc(collection(db, "added_agencies"), {
        agencyName: name,
        url: url,
        timestamp: new Date().toISOString()
      });
      console.log(`💾 Saved added agency to Firestore: ${name} (${url})`);
    } catch (e) {
      console.error("Failed to save added agency to Firestore:", e);
    }
  } else {
    console.log(`💾 [Firestore Simulation] Added agency saved: ${name} (${url})`);
  }
}

/**
 * 6. 수집대상사이트 삭제할 때 삭제한 기관명, url을 Firestore에 저장
 */
export async function saveDeletedAgencyToFirebase(name: string, url: string) {
  if (db) {
    try {
      await addDoc(collection(db, "deleted_agencies"), {
        agencyName: name,
        url: url,
        timestamp: new Date().toISOString()
      });
      console.log(`💾 Saved deleted agency to Firestore: ${name} (${url})`);
    } catch (e) {
      console.error("Failed to save deleted agency to Firestore:", e);
    }
  } else {
    console.log(`💾 [Firestore Simulation] Deleted agency saved: ${name} (${url})`);
  }
}

