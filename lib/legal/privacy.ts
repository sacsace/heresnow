import type { LocalizedLegalDocument } from "@/lib/legal/types";

export const privacyContent: LocalizedLegalDocument = {
  ko: {
    title: "개인정보 처리방침",
    lastUpdated: "2026년 6월 6일",
    intro:
      "Minsub Ventures Private Limited(이하 「회사」)는 HeresNow(이하 「서비스」) 이용과 관련하여 이용자의 개인정보를 보호하기 위해 본 방침을 수립·공개합니다.",
    sections: [
      {
        title: "1. 수집하는 개인정보",
        bullets: [
          "회사·계정 정보: 회사명, 관리자·직원 이름, 이메일, 비밀번호(해시 저장), 역할, 부서",
          "출퇴근 정보: 출근·퇴근 버튼을 누른 시점의 GPS 좌표(위도·경도), 정확도, 시각, 근무지·지오펜스 관련 정보",
          "안면 인식(선택): 로그인 또는 출근 확인용 얼굴 특징값(embedding). 원본 얼굴 사진은 서비스 정책에 따라 최소한으로 처리",
          "기기·접속 정보: 브라우저 User-Agent, IP, 세션·인증 토큰, 오류 로그",
          "결제 정보: Razorpay 등 결제 대행사를 통한 거래 ID, 금액, 인보이스·GST 정보(카드 번호 등 민감 결제 정보는 당사 서버에 저장하지 않음)",
          "선택 항목: 출퇴근 메모, 사진 URL, 회사가 설정한 추가 필드",
        ],
      },
      {
        title: "2. 수집하지 않는 정보",
        bullets: [
          "실시간 위치 추적 또는 이동 경로",
          "출퇴근 버튼을 누르지 않은 상태의 백그라운드 GPS",
          "서비스 제공에 불필요한 연락처·주소록 전체",
        ],
      },
      {
        title: "3. 이용 목적",
        bullets: [
          "회원 가입·인증, 출퇴근 기록·근태 통계 제공",
          "회사별 설정(근무지, 스케줄, 지오펜스) 적용 및 예외 승인",
          "안면 인식 로그인·출근 확인(이용자·회사가 활성화한 경우)",
          "요금 결제, 구독·인보이스·GST e-Invoice 발행",
          "보안, 부정 이용 방지, 장애 대응, 서비스 개선",
          "법령상 의무 이행 및 분쟁 대응",
        ],
      },
      {
        title: "4. 보관 기간",
        paragraphs: [
          "계정·출퇴근 기록은 고객사(테넌트)와의 계약 기간 동안 보관하며, 해지 후에는 관련 법령·회사 내부 정책에 따라 일정 기간 보관 후 파기합니다.",
          "결제·세금 관련 기록은 인도 GST 등 관련 법령이 요구하는 기간 동안 보관할 수 있습니다.",
        ],
      },
      {
        title: "5. 제3자 제공 및 처리 위탁",
        bullets: [
          "결제: Razorpay — 결제 처리",
          "호스팅·DB: 클라우드 인프라(Railway 등) — 서비스 운영",
          "지도: Google Maps 등 — 위치 표시(해당 기능 사용 시)",
          "GST e-Invoice: GSP(승인된 서비스 제공자) — IRN 발행(설정된 경우)",
          "법령에 따른 요청, 이용자 동의, 또는 서비스 제공에 필수적인 경우에 한해 제공합니다.",
        ],
      },
      {
        title: "6. 국외 이전",
        paragraphs: [
          "서비스 인프라 또는 제3자 처리자가 인도 외 지역에 위치할 수 있습니다. 이 경우 적용 법령이 요구하는 보호 조치를 따릅니다.",
        ],
      },
      {
        title: "7. 이용자의 권리",
        bullets: [
          "개인정보 열람·정정·삭제를 요청할 수 있습니다(회사 관리자 또는 info@msventures.in).",
          "출퇴근·위치 수집 동의는 서비스 내 동의 화면에서 관리되며, 필수 동의 거부 시 일부 기능이 제한될 수 있습니다.",
          "안면 인식은 회사 정책 및 이용자 등록에 따르며, 삭제 요청은 관리자 또는 회사에 문의하세요.",
        ],
      },
      {
        title: "8. 보안",
        paragraphs: [
          "비밀번호 해시, HTTPS 전송, 접근 통제, 테넌트 격리 등 합리적인 기술·관리적 보호 조치를 적용합니다.",
          "100% 안전을 보장할 수는 없으며, 계정 정보 유출 의심 시 즉시 비밀번호 변경 및 관리자에게 알려 주세요.",
        ],
      },
      {
        title: "9. 쿠키 및 로컬 저장",
        bullets: [
          "로그인 세션, 언어 설정, PWA 설치 등 서비스 운영에 필요한 쿠키·localStorage를 사용할 수 있습니다.",
          "브라우저 설정으로 일부 저장을 거부할 수 있으나, 로그인 등 기능이 제한될 수 있습니다.",
        ],
      },
      {
        title: "10. 아동",
        paragraphs: [
          "서비스는 기업 근로자 대상이며, 법정 연령 미만 아동을 대상으로 하지 않습니다.",
        ],
      },
      {
        title: "11. 방침 변경",
        paragraphs: [
          "본 방침이 변경되면 서비스 내 공지 및 본 페이지에 게시합니다. 중요한 변경은 시행일 이전에 안내합니다.",
        ],
      },
      {
        title: "12. 문의",
        paragraphs: [
          "개인정보 관련 문의: Minsub Ventures Private Limited · info@msventures.in · https://www.msventures.in",
        ],
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    lastUpdated: "6 June 2026",
    intro:
      "Minsub Ventures Private Limited (“we”, “Company”) describes how we collect, use, and protect personal data when you use HeresNow (the “Service”).",
    sections: [
      {
        title: "1. Data we collect",
        bullets: [
          "Account & profile: company name, admin/employee name, email, password (hashed), role, department",
          "Attendance: GPS coordinates, accuracy, and timestamp when you tap check-in/out; worksite/geofence context",
          "Face recognition (optional): face embeddings for sign-in or verification; raw photos are minimised per policy",
          "Device & access: browser user-agent, IP, session/auth tokens, error logs",
          "Billing: transaction IDs, amounts, invoice/GST details via Razorpay (we do not store full card numbers)",
          "Optional: attendance notes, photo URLs, additional fields configured by your employer",
        ],
      },
      {
        title: "2. What we do not collect",
        bullets: [
          "Continuous real-time location or movement history",
          "Background GPS when you are not checking in/out",
          "Full address books or contacts unrelated to the Service",
        ],
      },
      {
        title: "3. Purposes",
        bullets: [
          "Registration, authentication, attendance records and analytics",
          "Applying company settings (worksites, schedules, geofences) and exception approvals",
          "Face sign-in/verification when enabled",
          "Subscription billing, invoices, and GST e-Invoice where configured",
          "Security, fraud prevention, support, and product improvement",
          "Legal compliance and dispute handling",
        ],
      },
      {
        title: "4. Retention",
        paragraphs: [
          "We retain tenant and attendance data for the subscription period and for a limited time afterward per law and internal policy.",
          "Payment and tax records may be kept for periods required under Indian GST and other applicable rules.",
        ],
      },
      {
        title: "5. Processors and sharing",
        bullets: [
          "Razorpay — payment processing",
          "Cloud hosting/DB (e.g. Railway) — service operation",
          "Google Maps — map display when used",
          "GST e-Invoice GSP — IRN issuance when enabled",
          "We share data only with consent, legal requirement, or where necessary to provide the Service.",
        ],
      },
      {
        title: "6. International transfers",
        paragraphs: [
          "Infrastructure or subprocessors may be located outside India. We apply safeguards required by applicable law.",
        ],
      },
      {
        title: "7. Your rights",
        bullets: [
          "You may request access, correction, or deletion via your company admin or info@msventures.in.",
          "Location/attendance consent is managed in-product; refusing required consent may limit features.",
          "Face data depends on employer policy; contact your admin or us for deletion requests.",
        ],
      },
      {
        title: "8. Security",
        paragraphs: [
          "We use password hashing, HTTPS, access controls, and tenant isolation.",
          "No method is 100% secure; change passwords and notify your admin if you suspect compromise.",
        ],
      },
      {
        title: "9. Cookies and local storage",
        bullets: [
          "We use cookies/localStorage for sessions, language, and PWA install where needed.",
          "You may restrict storage in browser settings, but some features may not work.",
        ],
      },
      {
        title: "10. Children",
        paragraphs: [
          "The Service is for workforce use and is not directed at children below the legal working age.",
        ],
      },
      {
        title: "11. Changes",
        paragraphs: [
          "We will post updates on this page and in the Service. Material changes will be announced before they take effect where practicable.",
        ],
      },
      {
        title: "12. Contact",
        paragraphs: [
          "Minsub Ventures Private Limited · info@msventures.in · https://www.msventures.in",
        ],
      },
    ],
  },
};
