"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Server, Bot, ChevronRight } from "lucide-react";

export interface NavSection {
  label: string;
  id: string;
}

interface DocLayoutProps {
  sdk: "publisher" | "agent";
  sections: NavSection[];
  children: React.ReactNode;
}

export function DocLayout({ sdk, sections, children }: DocLayoutProps) {
  const pathname = usePathname();
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  const isPublisher = sdk === "publisher";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-20">
      <div className="flex gap-10 min-h-screen">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-56 shrink-0 pt-10">
          {/* SDK switcher */}
          <div className="mb-6 rounded-xl border border-border bg-surface overflow-hidden">
            <Link
              href="/docs/publisher"
              className={`flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                pathname === "/docs/publisher"
                  ? "bg-accent/10 text-accent"
                  : "text-inkMuted hover:text-ink hover:bg-raised"
              }`}
            >
              <Server className="w-3.5 h-3.5 shrink-0" />
              Publisher SDK
            </Link>
            <div className="border-t border-border" />
            <Link
              href="/docs/agent"
              className={`flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                pathname === "/docs/agent"
                  ? "bg-success/10 text-success"
                  : "text-inkMuted hover:text-ink hover:bg-raised"
              }`}
            >
              <Bot className="w-3.5 h-3.5 shrink-0" />
              Agent SDK
            </Link>
          </div>

          {/* Section nav */}
          <nav className="sticky top-20 space-y-0.5">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                  activeId === s.id
                    ? isPublisher
                      ? "text-accent bg-accent/5"
                      : "text-success bg-success/5"
                    : "text-inkSubtle hover:text-inkMuted"
                }`}
              >
                {activeId === s.id && (
                  <ChevronRight className="w-3 h-3 shrink-0" />
                )}
                {activeId !== s.id && <span className="w-3 shrink-0" />}
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 pt-10">
          {children}
        </main>
      </div>
    </div>
  );
}
