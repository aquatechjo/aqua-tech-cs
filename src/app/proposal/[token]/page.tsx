import type { Metadata } from "next"

import {
  findPublicProposalDelivery,
  serializePublicProposal,
} from "@/lib/proposal-delivery-server"

import PublicProposalClient from "./PublicProposalClient"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "عرض Aqua Tech",
  description: "صفحة آمنة لمراجعة عرض Aqua Tech والرد عليه.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  referrer: "no-referrer",
}

export default async function PublicProposalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const delivery = await findPublicProposalDelivery(token)

  if (!delivery) {
    return (
      <main className="aqua-proposal-public">
        <div className="aqua-proposal-public__invalid">
          <div className="aqua-proposal-public__invalid-card">
            <span className="aqua-proposal-public__status-mark">
              404
            </span>
            <h1>رابط العرض غير متاح</h1>
            <p>
              قد يكون الرابط منتهيًا أو أُلغي بعد إصدار نسخة أحدث.
              تواصل مع فريق Aqua Tech لطلب رابط صالح.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <PublicProposalClient
      token={token}
      initialState={serializePublicProposal(delivery)}
    />
  )
}
