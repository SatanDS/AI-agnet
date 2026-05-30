"use client";

import { X } from "lucide-react";
import clsx from "clsx";

type DialogTone = "default" | "danger" | "success";

export function AppDialog({
  title,
  description,
  tone = "default",
  children,
  footer,
  onClose,
  className,
}: {
  title: string;
  description?: string;
  tone?: DialogTone;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  className?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 px-4 py-8 backdrop-blur-md"
      onClick={onClose}
    >
      <section
        className={clsx(
          "w-[calc(100vw-2rem)] max-w-lg overflow-hidden rounded-3xl border bg-zinc-950/95 text-zinc-100 shadow-2xl shadow-black/50 sm:w-fit sm:min-w-80",
          tone === "danger"
            ? "border-red-400/25"
            : tone === "success"
              ? "border-emerald-400/25"
              : "border-white/10",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold">{title}</h3>
            {description ? (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-500">
                {description}
              </p>
            ) : null}
          </div>
          <button
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white"
            onClick={onClose}
            title="关闭"
            type="button"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {children ? <div className="px-5 py-4">{children}</div> : null}

        {footer ? (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-5 py-4">
            {footer}
          </footer>
        ) : null}
      </section>
    </div>
  );
}
