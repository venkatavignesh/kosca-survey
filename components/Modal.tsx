'use client';
import { useCallback, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Reusable modal/dialog primitive.
 *
 * Compliant with design-system §5 (modal anatomy), §7 (open/close pattern —
 * outside-click + Escape both close), §9 (ARIA: role=dialog, aria-modal,
 * aria-labelledby; focus moves into the dialog on open and returns to the
 * triggering element on close).
 *
 * Card uses rounded-xl (12 px) per spec §4 — content cards. Footer buttons
 * are right-aligned by convention (every other form in the app does this).
 */
export function Modal({
  title,
  children,
  onClose,
  size = 'lg',
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: 'md' | 'lg' | 'xl';
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  // Snapshot the element that opened the dialog so we can restore focus on close.
  const triggerRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    onClose();
  }, [onClose]);

  // Escape key closes (§7). Body scroll lock while open. Focus enters dialog.
  useEffect(() => {
    triggerRef.current = (document.activeElement as HTMLElement) ?? null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog after the next paint.
    const t = setTimeout(() => {
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      const first = focusables?.[0];
      if (first) first.focus();
      else dialogRef.current?.focus();
    }, 0);

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
      // Restore focus to the trigger on close.
      triggerRef.current?.focus?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxW = size === 'md' ? 'max-w-md' : size === 'xl' ? 'max-w-3xl' : 'max-w-xl';

  // Render via portal so the dialog escapes any clipping ancestor.
  if (typeof window === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-start justify-center p-4 z-50 overflow-auto"
      onClick={close}
      aria-hidden="false"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`bg-[var(--surface-primary)] rounded-xl shadow-lg w-full ${maxW} mt-12 p-6 outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3 gap-2">
          <h2 id={titleId} className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close dialog"
            className="p-1 rounded transition-colors hover:bg-[var(--accent-hover)]"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
