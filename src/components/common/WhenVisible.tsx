'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Render children once the placeholder nears the viewport (defers heavy chart code). */
export function WhenVisible({
  children,
  placeholder,
  rootMargin = '200px',
}: {
  children: ReactNode;
  placeholder: ReactNode;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return <div ref={ref}>{show ? children : placeholder}</div>;
}
