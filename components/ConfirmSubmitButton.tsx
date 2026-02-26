"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ConfirmSubmitButtonProps = {
  label: string;
  className?: string;
  confirmMessage: string;
};

export function ConfirmSubmitButton({
  label,
  className,
  confirmMessage,
}: ConfirmSubmitButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const canUseDOM = typeof window !== "undefined";

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  function handleConfirmDelete() {
    const form = triggerRef.current?.form;
    if (!form) {
      setIsOpen(false);
      return;
    }

    setIsSubmitting(true);
    setIsOpen(false);
    form.requestSubmit();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={className}
        onClick={() => setIsOpen(true)}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Deleting..." : label}
      </button>

      {canUseDOM && isOpen
        ? createPortal(
            <div
              className="confirm-modal-backdrop"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            >
              <div
                className="confirm-modal"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                onClick={(event) => event.stopPropagation()}
              >
                <h3 id={titleId}>Confirm deletion</h3>
                <p id={descriptionId}>{confirmMessage}</p>
                <div className="confirm-modal-actions">
                  <button
                    type="button"
                    className="admin-outline-button"
                    onClick={() => setIsOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="pill-button confirm-modal-confirm"
                    onClick={handleConfirmDelete}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
