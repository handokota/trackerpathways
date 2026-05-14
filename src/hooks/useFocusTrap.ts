"use client";

import { type RefObject, useEffect, useRef } from "react";

interface UseFocusTrapOptions {
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onEscape?: () => void;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.hasAttribute("disabled")) {
      return false;
    }
    if (element.getAttribute("aria-hidden") === "true") {
      return false;
    }
    return element.getClientRects().length > 0;
  });
}

export default function useFocusTrap({
  active,
  containerRef,
  initialFocusRef,
  returnFocusRef,
  onEscape,
}: UseFocusTrapOptions) {
  const capturedFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const returnFocusTarget = returnFocusRef?.current ?? null;
    const activeElement = document.activeElement;
    capturedFocusRef.current = returnFocusTarget ?? (activeElement instanceof HTMLElement ? activeElement : null);

    const focusInitial = () => {
      const initialTarget = initialFocusRef?.current ?? getFocusableElements(container)[0] ?? container;
      initialTarget.focus({ preventScroll: true });
    };

    focusInitial();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (onEscape) {
          event.preventDefault();
          onEscape();
        }
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements(container);
      if (focusableElements.length === 0) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const current = document.activeElement;
      const isInside = current instanceof Node && container.contains(current);

      if (event.shiftKey) {
        if (!isInside || current === first) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        }
        return;
      }

      if (!isInside || current === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (container.contains(target)) {
        return;
      }

      const nextFocus = initialFocusRef?.current ?? getFocusableElements(container)[0] ?? container;
      nextFocus.focus({ preventScroll: true });
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);

      const returnTarget = returnFocusTarget ?? capturedFocusRef.current;
      if (returnTarget && returnTarget.isConnected) {
        returnTarget.focus({ preventScroll: true });
      }
      capturedFocusRef.current = null;
    };
  }, [active, containerRef, initialFocusRef, onEscape, returnFocusRef]);
}
