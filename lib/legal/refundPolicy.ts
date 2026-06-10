import type { LocalizedLegalDocument } from "@/lib/legal/types";

export const refundPolicyContent: LocalizedLegalDocument = {
  ko: {
    title: "환불 정책",
    lastUpdated: "2026년 6월 6일",
    intro:
      "본 환불 정책은 Minsub Ventures Private Limited(이하 「회사」)가 제공하는 HeresNow(이하 「서비스」)의 유료 결제에 대한 환불 기준을 정합니다.",
    sections: [
      {
        title: "1. 적용 범위",
        paragraphs: [
          "본 정책은 Razorpay 등 결제 대행사를 통해 이루어진 HeresNow 유료 구독·결제(사용자 수, 이용 기간 등)에 적용됩니다.",
        ],
      },
      {
        title: "2. 환불 불가",
        bullets: [
          "모든 유료 결제는 최종(final)이며, 전액·부분 환불을 제공하지 않습니다.",
          "단순 변심, 미사용 기간, 이용자 수·기간 선택 오류, 서비스 미이용, 약관 위반으로 인한 이용 제한 등 어떠한 사유로도 환불되지 않습니다.",
          "결제 완료 후 구독·사용자 수가 정상 반영된 경우 환불 요청은 접수하지 않습니다.",
          "차지백(카드사 분쟁)은 결제 파트너 및 관련 법령에 따르며, 본 정책상 환불 의무가 없음을 안내합니다.",
        ],
      },
      {
        title: "3. 디지털 서비스 특성",
        paragraphs: [
          "HeresNow는 결제 확인 후 즉시 구독 기간·사용자 수가 활성화되는 디지털 서비스입니다. 물리적 상품을 배송하지 않으며, 결제와 동시에 서비스 이용 권한이 제공되므로 환불 대상에서 제외됩니다.",
        ],
      },
      {
        title: "4. 결제 전 확인",
        bullets: [
          "결제 전 금액, GST, 사용자 수, 이용 기간을 확인해 주세요.",
          "결제 시 본 환불 정책, 취소 정책, 이용약관에 동의한 것으로 간주됩니다.",
        ],
      },
      {
        title: "5. 문의",
        paragraphs: [
          "정책·결제 관련 문의: info@msventures.in · 서비스 하단 「고객센터」 · https://www.msventures.in",
          "관련 문서: 이용약관(/terms) · 취소 정책(/cancellation-policy)",
        ],
      },
    ],
  },
  en: {
    title: "Refund Policy",
    lastUpdated: "6 June 2026",
    intro:
      "This Refund Policy applies to paid purchases for HeresNow, provided by Minsub Ventures Private Limited (“Company”).",
    sections: [
      {
        title: "1. Scope",
        paragraphs: [
          "This policy applies to paid HeresNow subscriptions processed via Razorpay or other payment partners (user limits, term length, etc.).",
        ],
      },
      {
        title: "2. No refunds",
        bullets: [
          "All paid transactions are final. We do not offer full or partial refunds.",
          "No refunds for change of mind, unused time, incorrect plan selection, non-use of the Service, or suspension for Terms breach.",
          "If payment succeeded and subscription or user limits were applied to your account, refund requests will not be accepted.",
          "Chargebacks are handled under payment partner rules; we have no refund obligation under this policy.",
        ],
      },
      {
        title: "3. Digital service",
        paragraphs: [
          "HeresNow is a digital service: subscription and user limits activate immediately after payment verification. No physical goods are shipped; access is granted at checkout, so purchases are non-refundable.",
        ],
      },
      {
        title: "4. Before you pay",
        bullets: [
          "Review amount, GST, user count, and term before paying.",
          "By paying you agree to this Refund Policy, our Cancellation Policy, and the Terms and Conditions.",
        ],
      },
      {
        title: "5. Contact",
        paragraphs: [
          "Questions: info@msventures.in · in-app Support · https://www.msventures.in",
          "Related: Terms (/terms) · Cancellation Policy (/cancellation-policy)",
        ],
      },
    ],
  },
};
