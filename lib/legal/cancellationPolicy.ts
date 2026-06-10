import type { LocalizedLegalDocument } from "@/lib/legal/types";

export const cancellationPolicyContent: LocalizedLegalDocument = {
  ko: {
    title: "취소 정책",
    lastUpdated: "2026년 6월 6일",
    intro:
      "본 취소 정책은 Minsub Ventures Private Limited(이하 「회사」)가 제공하는 HeresNow(이하 「서비스」)의 유료 구독·결제에 관한 취소 기준을 정합니다.",
    sections: [
      {
        title: "1. 적용 범위",
        paragraphs: [
          "HeresNow는 클라우드 SaaS(구독형 소프트웨어)입니다. 본 정책은 관리자 화면 「결제하기」를 통해 이루어진 유료 결제(사용자 수·이용 기간 등)에 적용됩니다.",
        ],
      },
      {
        title: "2. 결제 후 취소 불가",
        bullets: [
          "결제가 완료·확인된 유료 구독은 취소할 수 없습니다.",
          "이용 기간 중도 해지, 결제 취소, 구독 철회 요청은 접수하지 않습니다.",
          "결제 시 선택한 사용자 수·이용 기간은 결제 완료와 동시에 확정되며, 남은 기간에 대한 일할 정산이나 취소는 제공하지 않습니다.",
        ],
      },
      {
        title: "3. 갱신 중단",
        paragraphs: [
          "다음 결제 주기에 구독을 연장하지 않으려면 해당 기간 만료 전에 추가 결제를 하지 않으면 됩니다. 이는 기존에 결제·활성화된 기간의 「취소」가 아니며, 이미 납부한 기간 동안 서비스 이용은 구독 종료일까지 유지됩니다.",
        ],
      },
      {
        title: "4. 결제 전 확인",
        bullets: [
          "결제 전 사용자 수, 이용 기간, 금액(GST 포함)을 반드시 확인해 주세요.",
          "결제 버튼을 누르면 본 취소 정책 및 환불 정책, 이용약관에 동의한 것으로 간주됩니다.",
        ],
      },
      {
        title: "5. 문의",
        paragraphs: [
          "정책 관련 문의: info@msventures.in · 서비스 하단 「고객센터」 · https://www.msventures.in",
          "관련 문서: 이용약관(/terms) · 환불 정책(/refund-policy)",
        ],
      },
    ],
  },
  en: {
    title: "Cancellation Policy",
    lastUpdated: "6 June 2026",
    intro:
      "This Cancellation Policy applies to paid subscriptions and payments for HeresNow, provided by Minsub Ventures Private Limited (“Company”).",
    sections: [
      {
        title: "1. Scope",
        paragraphs: [
          "HeresNow is a subscription cloud SaaS. This policy applies to paid purchases made in the admin Payment menu (user limits, term length, etc.).",
        ],
      },
      {
        title: "2. No cancellation after payment",
        bullets: [
          "Once payment is completed and confirmed, the paid subscription cannot be cancelled.",
          "We do not accept mid-term termination, payment reversal, or subscription withdrawal requests.",
          "Selected user limits and term length are final at checkout. No pro-rata cancellation for unused time.",
        ],
      },
      {
        title: "3. Non-renewal",
        paragraphs: [
          "To avoid extending your subscription, simply do not purchase the next billing period before the current term expires. This is not a cancellation of an already paid term; access continues until the subscription end date shown in your account.",
        ],
      },
      {
        title: "4. Before you pay",
        bullets: [
          "Review user count, term, and total amount (including GST) before paying.",
          "By completing payment you agree to this Cancellation Policy, our Refund Policy, and the Terms and Conditions.",
        ],
      },
      {
        title: "5. Contact",
        paragraphs: [
          "Questions: info@msventures.in · in-app Support · https://www.msventures.in",
          "Related: Terms (/terms) · Refund Policy (/refund-policy)",
        ],
      },
    ],
  },
};
