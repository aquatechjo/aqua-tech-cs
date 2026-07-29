import type { Metadata } from "next"

import {
  findPublicDiscoverySession,
  serializePublicDiscoverySession,
} from "@/lib/discovery-conversation-server"

import PublicDiscoveryConversation from "./PublicDiscoveryConversation"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "جلسة جمع المتطلبات",
  description: "جلسة آمنة لجمع متطلبات مشروعك مع Aqua Tech.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  referrer: "no-referrer",
}

export default async function PublicDiscoveryPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const session = await findPublicDiscoverySession(token)

  if (!session) {
    return (
      <main className="aqua-discovery-public">
        <div className="aqua-discovery-public__invalid">
          <div className="aqua-discovery-public__invalid-card">
            <span className="aqua-discovery-public__status-mark">
              404
            </span>
            <h1>رابط الجلسة غير متاح</h1>
            <p>
              قد تكون صلاحية الرابط انتهت أو أُلغي من فريق Aqua Tech.
              اطلب رابطًا جديدًا من الشخص الذي تواصل معك.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <PublicDiscoveryConversation
      token={token}
      initialState={serializePublicDiscoverySession(session)}
    />
  )
}
