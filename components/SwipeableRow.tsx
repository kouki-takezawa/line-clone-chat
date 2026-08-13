"use client";

import { useRef, useState } from "react";

const ACTION_WIDTH = 144;

type Action = {
  label: string;
  onClick: () => void;
  className?: string;
};

type Props = {
  children: React.ReactNode;
  onTap: () => void;
  actions: Action[];
};

// A list row that can be swiped left to reveal action buttons (pin/delete),
// built on pointer events so it works for both touch and mouse. A tap
// navigates via onTap; a tap while actions are revealed just closes them.
export default function SwipeableRow({ children, onTap, actions }: Props) {
  const [x, setX] = useState(0);
  // isDragging affects the render (it toggles the CSS transition), so it
  // must be state, not a ref — reading a ref during render is unsafe.
  const [isDragging, setIsDragging] = useState(false);
  const draggingRef = useRef(false);
  const startX = useRef(0);
  const startTranslate = useRef(0);
  const moved = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    draggingRef.current = true;
    setIsDragging(true);
    moved.current = false;
    startX.current = e.clientX;
    startTranslate.current = x;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    const delta = e.clientX - startX.current;
    if (Math.abs(delta) > 4) moved.current = true;
    const next = Math.max(-ACTION_WIDTH, Math.min(0, startTranslate.current + delta));
    setX(next);
  }

  function onPointerUp() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);
    setX((current) => (current < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0));
  }

  function handleRowClick() {
    if (moved.current) return;
    if (x !== 0) {
      setX(0);
      return;
    }
    onTap();
  }

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: ACTION_WIDTH }}>
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => {
              action.onClick();
              setX(0);
            }}
            className={`flex flex-1 items-center justify-center text-xs font-medium text-white ${
              action.className ?? "bg-neutral-500"
            }`}
          >
            {action.label}
          </button>
        ))}
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={handleRowClick}
        className="relative bg-white dark:bg-neutral-950"
        style={{
          transform: `translateX(${x}px)`,
          transition: isDragging ? "none" : "transform 0.2s ease-out",
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}
