"use client"

import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { useRouter } from "next/router"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  name: string
  url: string
  icon: LucideIcon
  onClick?: () => void
  label?: React.ReactNode
  isCTA?: boolean
}

interface NavBarProps {
  items: NavItem[]
  logo?: React.ReactNode
  className?: string
}

export function NavBar({ items, logo, className }: NavBarProps) {
  const router = useRouter()
  const [isScrolled, setIsScrolled] = useState(false)

  // Sync active tab with current route
  const activeTab = items.find((item) => {
    if (item.url === "#" || item.url.startsWith("#")) return false
    return router.pathname === item.url
  })?.name || ""

  useEffect(() => {
    // rAF-throttle + a cached boolean so the scroll listener is a
    // ~zero-cost callback during fast scrolling. We also mark it
    // passive so the browser never has to wait for JS before
    // compositor-scrolling the page.
    let ticking = false
    let lastScrolled = window.scrollY > 50
    setIsScrolled(lastScrolled)

    const handleScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const next = window.scrollY > 50
        if (next !== lastScrolled) {
          lastScrolled = next
          setIsScrolled(next)
        }
        ticking = false
      })
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div
      className={cn(
        "fixed bottom-0 sm:top-0 left-1/2 -translate-x-1/2 z-50 mb-4 sm:mb-6 sm:pt-6 pointer-events-none transition-all duration-500 ease-in-out max-w-[calc(100vw-1rem)]",
        className,
      )}
    >
        <div
          className={cn(
          "flex items-center rounded-full border text-[#1d1d1f] sm:backdrop-blur-lg shadow-lg pointer-events-auto transition-all duration-500 ease-in-out",
          isScrolled
            ? "gap-1 sm:gap-2 bg-white/88 px-1 py-1 border-[#d2d2d7]/70 shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
            : "gap-2 sm:gap-6 bg-white/72 px-2 py-2 sm:px-5 sm:py-3 border-[#d2d2d7]/50 shadow-[0_18px_48px_rgba(15,23,42,0.12)]"
        )}
      >
        {logo && (
          <div className={cn(
            "flex items-center shrink-0 transition-all duration-500",
            isScrolled ? "pl-2 pr-1 sm:pl-3" : "pl-2 pr-1 sm:pl-5 sm:pr-3"
          )}>
            {logo}
          </div>
        )}
        {items.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.name

          return (
            <Link
              key={item.name}
              href={item.url}
              onClick={item.onClick ? (e: React.MouseEvent) => { e.preventDefault(); item.onClick!(); } : undefined}
              className={cn(
                "relative cursor-pointer text-sm font-semibold rounded-full transition-all duration-500 whitespace-nowrap",
                "text-[#424245] hover:text-[#2563eb]",
                isActive && "bg-[#eef4ff] text-[#2563eb]",
                isScrolled ? "px-3 py-2 sm:px-5" : "px-4 py-2.5 sm:px-10 sm:py-3.5",
              )}
            >
              <span className="hidden md:inline">{item.label ?? item.name}</span>
              <span className="md:hidden">
                <Icon size={18} strokeWidth={2.5} />
              </span>
              {isActive && (
                <motion.div
                  layoutId="lamp"
                  className="absolute inset-0 w-full bg-primary/5 rounded-full -z-10"
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                >
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-t-full">
                    <div className="absolute w-12 h-6 bg-primary/20 rounded-full blur-md -top-2 -left-2" />
                    <div className="absolute w-8 h-6 bg-primary/20 rounded-full blur-md -top-1" />
                    <div className="absolute w-4 h-4 bg-primary/20 rounded-full blur-sm top-0 left-2" />
                  </div>
                </motion.div>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
