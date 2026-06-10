import type { LocalizedLegalDocument } from "@/lib/legal/types";

export const termsContent: LocalizedLegalDocument = {
  ko: {
    title: "이용약관",
    lastUpdated: "2026년 6월 6일",
    intro:
      "본 약관은 Minsub Ventures Private Limited(이하 「회사」)가 제공하는 HeresNow(이하 「서비스」)의 이용과 관련하여 회사와 이용자(회사 관리자, 직원 등) 간의 권리·의무를 정합니다.",
    sections: [
      {
        title: "1. 서비스 개요",
        paragraphs: [
          "HeresNow는 기업·조직(테넌트) 단위로 가입하여 출퇴근 기록, 근태 통계, 예외 승인, 안면 인식 로그인 등을 제공하는 클라우드 SaaS입니다.",
          "서비스는 웹 브라우저 및 PWA 형태로 제공되며, 회사별로 독립된 데이터 공간(멀티 테넌트)으로 운영됩니다.",
        ],
      },
      {
        title: "2. 약관의 동의",
        paragraphs: [
          "회사 가입, 로그인 또는 서비스 이용 시 본 약관 및 개인정보 처리방침에 동의한 것으로 간주합니다.",
          "회사 관리자는 소속 직원에게 서비스 이용을 안내하고, 필요한 법적 동의(위치·안면 등)를 받을 책임이 있습니다.",
        ],
      },
      {
        title: "3. 계정 및 가입",
        bullets: [
          "회사(테넌트) 단위로 가입하며, 최초 가입 이메일은 해당 회사의 관리자 계정이 됩니다.",
          "관리자는 직원 계정 생성, 역할 부여, 부서 관리 등을 수행할 수 있습니다.",
          "이용자는 정확한 정보를 제공해야 하며, 계정·비밀번호 관리 책임은 이용자에게 있습니다.",
          "타인의 계정을 무단 사용하거나 허위 정보로 가입해서는 안 됩니다.",
        ],
      },
      {
        title: "4. 서비스 이용",
        bullets: [
          "출퇴근 기록은 이용자가 출근·퇴근 버튼을 누른 시점의 GPS 좌표와 시간 등을 저장합니다. 실시간 위치 추적은 하지 않습니다.",
          "회사는 근무지(지오펜스), 근무 시간, 휴일 등 운영 정책을 설정할 수 있으며, 직원은 해당 정책을 준수해야 합니다.",
          "서비스 기능·화면·API는 운영상 필요에 따라 변경·중단될 수 있으며, 중요한 변경은 가능한 한 사전에 안내합니다.",
        ],
      },
      {
        title: "5. 요금 및 결제",
        bullets: [
          "유료 기능(로그인 사용자 수 등)은 관리자 화면의 「결제하기」 메뉴에서 확인·결제할 수 있습니다.",
          "회사 관리자 및 HR 담당자는 결제·사용자 수 산정에서 제외되며, 해당 역할은 무료로 관리 기능을 이용할 수 있습니다.",
          "결제는 Razorpay 및 회사의 은행·결제 파트너를 통해 처리되며, 일부 업종·사업 카테고리는 파트너 심사에 따라 승인까지 약 30영업일이 소요될 수 있습니다.",
          "결제 완료 후 구독 기간·사용자 수 상한은 관리자 화면과 납부 기록에 반영됩니다. 세금계산서(GST) 및 e-Invoice는 관련 법령과 설정에 따라 발행됩니다.",
          "취소·환불·서비스 제공 방식은 별도 「취소 정책」(/cancellation-policy), 「환불 정책」(/refund-policy) 및 아래 조항을 따릅니다.",
        ],
      },
      {
        title: "6. 취소 및 환불 (Cancellation and Refund)",
        paragraphs: [
          "HeresNow 유료 구독에 대한 상세 기준은 전용 정책 페이지에 게시합니다. 요약하면 결제 완료 후 취소 및 환불은 불가합니다.",
        ],
        bullets: [
          "취소 정책: https://heresnow.in/cancellation-policy — 결제 확인 후 구독 취소·중도 해지 불가. 갱신을 원하지 않을 경우 다음 결제 주기에 추가 결제하지 않으면 됩니다.",
          "환불 정책: https://heresnow.in/refund-policy — 모든 유료 결제는 최종이며 전액·부분 환불 불가.",
          "결제 전 사용자 수·기간·금액을 확인해 주세요. 결제 시 위 정책 및 본 약관에 동의한 것으로 간주됩니다.",
        ],
      },
      {
        title: "7. 서비스 제공 및 교환 (Shipping and Exchange)",
        paragraphs: [
          "HeresNow는 클라우드 소프트웨어(SaaS)로, 택배·물류 배송이 없습니다. 본 조항은 디지털 서비스의 제공 방식과 플랜 변경에 관한 사항입니다.",
        ],
        bullets: [
          "서비스 제공(배송): 결제 검증이 완료되면 즉시(통상 수 분 이내) 해당 회사(테넌트)의 구독 종료일·유료 사용자 수 상한이 갱신되며, 관리자는 「결제하기」·「납부 기록」 메뉴에서 확인할 수 있습니다. 별도 배송비·물류비는 없습니다.",
          "제공 범위: 웹 브라우저 및 PWA를 통한 출퇴근·근태 관리 기능. 인터넷 연결 및 지원 브라우저가 필요합니다.",
          "플랜·인원 변경: 이용 기간 중 추가 사용자 수 또는 기간 연장이 필요한 경우 관리자 화면에서 추가 결제를 진행할 수 있습니다. 이미 결제한 기간의 다운그레이드(인원 감소)에 대한 환불은 제공하지 않습니다.",
          "교환: 물리적 상품 교환은 해당 없음. 서비스 장애로 이용이 불가한 경우 고객센터로 연락해 주시면 기술 지원을 검토합니다.",
        ],
      },
      {
        title: "8. 관련 정책 및 문의 (Contact Us)",
        paragraphs: [
          "결제 파트너(Razorpay 등) 및 관련 규정 준수를 위해 아래 정책·문의 채널을 웹사이트에 게시합니다.",
        ],
        bullets: [
          "이용약관: https://heresnow.in/terms",
          "개인정보 처리방침: https://heresnow.in/privacy",
          "취소 정책: https://heresnow.in/cancellation-policy",
          "환불 정책: https://heresnow.in/refund-policy",
          "서비스 제공(배송) 및 교환: 본 약관 제7조",
          "문의(Contact Us): info@msventures.in · 웹사이트 하단 「고객센터」 · https://www.msventures.in",
          "사업자: Minsub Ventures Private Limited, 24/1, Doddanekundi, Ferns City Road, Outer Ring Road, Marathahalli, Bengaluru, Karnataka 560037, India",
        ],
      },
      {
        title: "9. 이용자 콘텐츠 및 데이터",
        paragraphs: [
          "회사 및 직원이 입력·생성한 출퇴근 기록, 프로필, 설정 등(이하 「이용자 데이터」)의 소유권은 해당 고객사(테넌트)에 귀속됩니다.",
          "회사(운영자)는 서비스 제공, 장애 대응, 보안, 법령 준수 목적 범위 내에서 이용자 데이터를 처리합니다.",
        ],
      },
      {
        title: "10. 금지 행위",
        bullets: [
          "서비스의 무단 접근, 역공학, 자동화된 과도한 요청, 타인 정보 도용",
          "악성 코드 유포, 서비스 운영 방해, 허위 출퇴근 기록 조작",
          "관련 법령 또는 본 약관을 위반하는 행위",
        ],
      },
      {
        title: "11. 지적 재산권",
        paragraphs: [
          "HeresNow 소프트웨어, UI, 로고, 문서 등에 대한 권리는 Minsub Ventures Private Limited 또는 정당한 권리자에게 있습니다.",
          "이용자는 서비스 이용에 필요한 범위를 넘어 복제·배포·2차적 저작물 작성을 할 수 없습니다.",
        ],
      },
      {
        title: "12. 면책 및 책임 제한",
        bullets: [
          "서비스는 「있는 그대로(as is)」 제공되며, GPS 정확도, 네트워크, 기기, 제3자 결제·지도 서비스 등에 따른 오차·장애에 대해 법령이 허용하는 범위에서 책임을 제한합니다.",
          "간접·특별·결과적 손해, 영업 손실 등에 대해서는 관련 법령이 허용하는 범위 내에서 책임을 부담하지 않습니다.",
          "이용자 또는 고객사의 설정 오류, 직원 관리 소홀, 동의 미흡 등으로 발생한 분쟁은 해당 주체의 책임 범위에 따릅니다.",
        ],
      },
      {
        title: "13. 계약 해지 및 이용 제한",
        bullets: [
          "고객사는 서비스 이용 중단을 요청할 수 있으며, 미결제·약관 위반·장기 미사용 등의 경우 이용이 제한되거나 계약이 해지될 수 있습니다.",
          "해지 후에도 법령상 보관 의무가 있는 정보는 해당 기간 동안 보관될 수 있습니다.",
        ],
      },
      {
        title: "14. 약관 변경",
        paragraphs: [
          "회사는 필요 시 본 약관을 개정할 수 있으며, 개정 내용과 시행일을 서비스 내 공지합니다.",
          "변경 후에도 서비스를 계속 이용하면 개정 약관에 동의한 것으로 봅니다.",
        ],
      },
      {
        title: "15. 준거법 및 분쟁",
        paragraphs: [
          "본 약관은 인도 법률을 준거법으로 하며, 분쟁은 Bengaluru, Karnataka 관할 법원을 제1심 관할로 합니다. (다른 강행 규정이 있는 경우 해당 규정을 따릅니다.)",
        ],
      },
      {
        title: "16. 문의",
        paragraphs: [
          "본 약관·결제·환불·서비스 이용 관련 문의: Minsub Ventures Private Limited · info@msventures.in · https://www.msventures.in · 서비스 하단 「고객센터」",
        ],
      },
    ],
  },
  en: {
    title: "Terms and Conditions",
    lastUpdated: "6 June 2026",
    intro:
      "These Terms govern use of HeresNow (the “Service”) provided by Minsub Ventures Private Limited (“we”, “us”, “Company”) by customers (tenants), administrators, and employees.",
    sections: [
      {
        title: "1. Service overview",
        paragraphs: [
          "HeresNow is a multi-tenant cloud SaaS for attendance records, workforce analytics, exception approvals, and optional face sign-in.",
          "The Service is delivered via web browser and PWA. Each customer organisation operates in an isolated tenant space.",
        ],
      },
      {
        title: "2. Acceptance",
        paragraphs: [
          "By registering, signing in, or using the Service, you agree to these Terms and our Privacy Policy.",
          "Company administrators must inform employees about the Service and obtain any legally required consents (location, biometrics, etc.).",
        ],
      },
      {
        title: "3. Accounts",
        bullets: [
          "Sign-up is per company (tenant). The first admin email becomes the initial company administrator.",
          "Administrators may create employee accounts, assign roles, and manage departments.",
          "You must provide accurate information and keep credentials secure.",
          "You must not impersonate others or create fraudulent accounts.",
        ],
      },
      {
        title: "4. Use of the Service",
        bullets: [
          "Check-in/out stores GPS coordinates and timestamps only when you tap the button. We do not perform continuous location tracking.",
          "Each company may configure worksites, schedules, and policies; users must comply.",
          "Features may change or be discontinued where reasonably necessary; material changes will be communicated when practicable.",
        ],
      },
      {
        title: "5. Fees and payment",
        bullets: [
          "Paid features (login user limits, etc.) are shown and purchased in the admin Payment menu after sign-in.",
          "Company admins and HR managers are excluded from billing and user limits and may use admin features at no charge.",
          "Payments are processed via Razorpay and our banking/payment partners. Some business categories may require partner review; approval can take approximately 30 working days.",
          "After successful payment, subscription end date and user limits are reflected in the admin Payment and payment history screens. GST tax invoices and e-Invoices are issued as required by law and configuration.",
          "Cancellation, refunds, and service delivery follow our Cancellation Policy (/cancellation-policy), Refund Policy (/refund-policy), and Sections below.",
        ],
      },
      {
        title: "6. Cancellation and Refund",
        paragraphs: [
          "Detailed rules are published on dedicated policy pages. In summary: no cancellation or refunds after payment is confirmed.",
        ],
        bullets: [
          "Cancellation Policy: https://heresnow.in/cancellation-policy — no cancellation or mid-term termination after payment. To avoid renewal, do not purchase the next billing period.",
          "Refund Policy: https://heresnow.in/refund-policy — all paid transactions are final; no full or partial refunds.",
          "Review user count, term, and amount before paying. Payment constitutes acceptance of those policies and these Terms.",
        ],
      },
      {
        title: "7. Shipping and Exchange (Service delivery)",
        paragraphs: [
          "HeresNow is cloud software (SaaS). There is no courier or physical delivery. This section describes digital service delivery and plan changes.",
        ],
        bullets: [
          "Delivery: Once payment is verified (usually within minutes), the tenant’s subscription end date and paid user limit are updated. Admins can confirm under Payment and payment history. No shipping or logistics fees apply.",
          "Scope: Attendance features via web browser and PWA. Internet access and a supported browser are required.",
          "Plan changes: Additional users or term extensions may be purchased in the admin Payment menu. No refunds for downgrades on an already paid term.",
          "Exchange: Not applicable to physical goods. Contact Support for technical assistance if the Service is unavailable due to a fault on our side.",
        ],
      },
      {
        title: "8. Related policies and Contact Us",
        paragraphs: [
          "For payment partner (e.g. Razorpay) compliance, the following policies and contact channels are published on our website:",
        ],
        bullets: [
          "Terms and Conditions: https://heresnow.in/terms",
          "Privacy Policy: https://heresnow.in/privacy",
          "Cancellation Policy: https://heresnow.in/cancellation-policy",
          "Refund Policy: https://heresnow.in/refund-policy",
          "Shipping and Exchange (service delivery): Section 7 of these Terms",
          "Contact Us: info@msventures.in · Support link in the site footer · https://www.msventures.in",
          "Merchant: Minsub Ventures Private Limited, 24/1, Doddanekundi, Ferns City Road, Outer Ring Road, Marathahalli, Bengaluru, Karnataka 560037, India",
        ],
      },
      {
        title: "9. Customer data",
        paragraphs: [
          "Attendance records, profiles, and settings created by a tenant remain attributable to that customer.",
          "We process data only to provide, secure, and support the Service and to comply with law.",
        ],
      },
      {
        title: "10. Prohibited conduct",
        bullets: [
          "Unauthorized access, reverse engineering, abusive automation, or identity misuse",
          "Malware, disruption, or falsification of attendance records",
          "Any violation of applicable law or these Terms",
        ],
      },
      {
        title: "11. Intellectual property",
        paragraphs: [
          "HeresNow software, UI, branding, and documentation are owned by Minsub Ventures Private Limited or licensors.",
          "You may not copy, distribute, or create derivative works beyond what is necessary to use the Service.",
        ],
      },
      {
        title: "12. Disclaimer and liability",
        bullets: [
          "The Service is provided “as is”. To the extent permitted by law, we are not liable for GPS/network/device/third-party payment inaccuracies or outages.",
          "We exclude indirect, special, or consequential damages where permitted by law.",
          "Disputes arising from tenant configuration, workforce management, or missing employee consent remain the responsibility of the relevant party.",
        ],
      },
      {
        title: "13. Suspension and termination",
        bullets: [
          "We may suspend or terminate access for non-payment, breach, or prolonged inactivity.",
          "Data may be retained where required by law after termination.",
        ],
      },
      {
        title: "14. Changes",
        paragraphs: [
          "We may update these Terms and will publish the effective date in the Service.",
          "Continued use after changes constitutes acceptance.",
        ],
      },
      {
        title: "15. Governing law",
        paragraphs: [
          "These Terms are governed by the laws of India. Courts in Bengaluru, Karnataka shall have primary jurisdiction, subject to mandatory local rules.",
        ],
      },
      {
        title: "16. Contact",
        paragraphs: [
          "For Terms, billing, refunds, or support: Minsub Ventures Private Limited · info@msventures.in · https://www.msventures.in · in-app Support",
        ],
      },
    ],
  },
};
