import { MeshGradient } from "@paper-design/shaders-react"
import { useEffect, useState } from "react"

interface MeshGradientBgProps {
  colors?: string[]
  distortion?: number
  swirl?: number
  speed?: number
  offsetX?: number
  veilOpacity?: string
  className?: string
  children?: React.ReactNode
}

export function MeshGradientBg({
  colors = ["#0a1628", "#132e5b", "#0d2244", "#1a3a6b", "#0f2a4a", "#162f55"],
  distortion = 1.2,
  swirl = 0.6,
  speed = 0.8,
  offsetX = 0.08,
  veilOpacity = "bg-black/30",
  className = "",
  children,
}: MeshGradientBgProps) {
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const update = () =>
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  return (
    <div className={`relative w-full min-h-screen overflow-hidden bg-[#0a1628] ${className}`}>
      <div className="fixed inset-0 w-screen h-screen">
        {mounted && (
          <>
            <MeshGradient
              width={dimensions.width}
              height={dimensions.height}
              colors={colors}
              distortion={distortion}
              swirl={swirl}
              grainMixer={0}
              grainOverlay={0}
              speed={speed}
              offsetX={offsetX}
            />
            <div className={`absolute inset-0 pointer-events-none ${veilOpacity}`} />
          </>
        )}
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  )
}
