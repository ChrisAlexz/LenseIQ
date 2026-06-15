"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export interface BentoItem {
    title: string;
    description: string;
    icon: React.ReactNode;
    status?: string;
    tags?: string[];
    meta?: string;
    cta?: string;
}

interface BentoGridProps {
    items: BentoItem[];
}

function BentoGrid({ items }: BentoGridProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {items.map((item, index) => (
                <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.5, delay: index * 0.12, ease: "easeOut" }}
                    whileHover={{ y: -4, transition: { duration: 0.25 } }}
                    className={cn(
                        "group relative p-6 rounded-xl overflow-hidden",
                        "border border-white/[0.08] bg-[#161b22]",
                        "hover:shadow-[0_4px_20px_rgba(0,210,110,0.06)]",
                        "hover:border-emerald-500/20",
                        "transition-[box-shadow,border-color] duration-300",
                    )}
                >
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:4px_4px]" />
                    </div>

                    <div className="relative flex flex-col space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 group-hover:bg-emerald-500/15 transition-all duration-300">
                                {item.icon}
                            </div>
                            {item.status && (
                                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/[0.06] text-gray-400 group-hover:bg-white/[0.1] transition-colors duration-300">
                                    {item.status}
                                </span>
                            )}
                        </div>

                        <div className="space-y-2">
                            <h3 className="font-semibold text-[#e6edf3] tracking-tight text-base">
                                {item.title}
                                {item.meta && (
                                    <span className="ml-2 text-xs text-[#e6edf3]/40 font-normal">
                                        {item.meta}
                                    </span>
                                )}
                            </h3>
                            <p className="text-sm text-[#e6edf3]/45 leading-relaxed">
                                {item.description}
                            </p>
                        </div>

                        {item.tags && item.tags.length > 0 && (
                            <div className="flex items-center justify-between mt-1">
                                <div className="flex items-center space-x-2 text-xs text-gray-500">
                                    {item.tags.map((tag, i) => (
                                        <span
                                            key={i}
                                            className="px-2 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.1] transition-all duration-200"
                                        >
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                                <span className="text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {item.cta || "Explore →"}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="absolute inset-0 -z-10 rounded-xl p-px bg-gradient-to-br from-transparent via-white/[0.06] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </motion.div>
            ))}
        </div>
    );
}

export { BentoGrid };
