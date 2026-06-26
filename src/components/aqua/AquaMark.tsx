import { aquaBrand } from "@/lib/brand"
import { cn } from "@/lib/utils"

type AquaMarkProps = {
  showText?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}

export default function AquaMark({
  showText = true,
  size = "md",
  className,
}: AquaMarkProps) {
  const markSize = {
    sm: "h-10 w-10 text-sm rounded-xl",
    md: "h-12 w-12 text-base rounded-2xl",
    lg: "h-16 w-16 text-xl rounded-3xl",
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex items-center justify-center bg-gradient-to-br from-cyan-400 to-blue-600 font-black text-white shadow-lg shadow-cyan-500/20",
          markSize[size]
        )}
      >
        AF
      </div>

      {showText ? (
        <div>
          <div className="text-xl font-black leading-none">
            {aquaBrand.product}
          </div>
          <div className="mt-1 text-xs font-medium text-slate-500">
            {aquaBrand.language.tagline}
          </div>
        </div>
      ) : null}
    </div>
  )
}