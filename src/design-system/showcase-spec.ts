import { aquaDesignSystemVersion } from "./package-contracts"

export type AquaShowcaseSection = {
  id: string
  title: string
  description: string
  components: readonly string[]
}

export const aquaDesignSystemShowcase = {
  title: "Aqua.Tech Design System",
  version: aquaDesignSystemVersion,
  direction: "rtl",
  defaultDensity: "comfortable",
  sections: [
    {
      id: "foundation",
      title: "الأساس والهوية",
      description: "ألوان الـDNA، التدرجات، المسافات، الحواف، والخطوط.",
      components: ["AquaMark", "AquaCard", "AquaBadge"],
    },
    {
      id: "actions",
      title: "الإجراءات والحالات",
      description: "أزرار وتنبيهات وحالات تحميل قابلة للتنبؤ.",
      components: ["AquaButton", "AquaAlert", "AquaSpinner"],
    },
    {
      id: "forms",
      title: "النماذج والحقول",
      description: "حقول موحّدة مع إرشاد وخطأ وحالات تعطيل.",
      components: ["AquaInput", "AquaSelect", "AquaTextarea"],
    },
    {
      id: "workflows",
      title: "البيانات والـWorkflows",
      description: "Panels، تفاصيل، جداول، Tabs، وحالات صفحات.",
      components: [
        "AquaDataPanel",
        "AquaDetailList",
        "AquaTable",
        "AquaTabs",
        "AquaPageState",
      ],
    },
    {
      id: "public",
      title: "الأسطح العامة والمستندات",
      description: "استمرارية الهوية خارج الـDashboard وفي الطباعة.",
      components: ["AquaBackground", "AquaSystemDocument"],
    },
    {
      id: "governance",
      title: "الحزمة والحوكمة",
      description: "نسخة الحزمة، طبقات CSS، starter، وبوابات الإصدار.",
      components: ["PackageManifest", "VisualContract", "ReleaseGate"],
    },
  ] satisfies readonly AquaShowcaseSection[],
} as const
