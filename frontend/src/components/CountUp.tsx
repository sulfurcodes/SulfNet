import { useEffect, useRef } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "../motion";

interface CountUpProps {
  value: number;
  suffix?: string;
  duration?: number;
}

export default function CountUp({ value, suffix = "", duration = 1 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (prefersReducedMotion()) {
      el.textContent = `${value}${suffix}`;
      return;
    }

    const state = { v: 0 };
    const tween = gsap.to(state, {
      v: value,
      duration,
      delay: 0.5,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = `${Math.round(state.v)}${suffix}`;
      },
    });

    return () => {
      tween.kill();
    };
  }, [value, suffix, duration]);

  return <span ref={ref}>0{suffix}</span>;
}