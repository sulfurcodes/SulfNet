import { useEffect, useRef } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "../motion";

const WORDS = ["Can't", "reach", "a", "website?", "Find", "out", "why."];
const MARK_INDEX = WORDS.length - 1;

export default function HeroTitle() {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.from(".ht-word__inner", {
        yPercent: 115,
        rotation: 4,
        duration: 0.7,
        stagger: 0.06,
        ease: "back.out(1.6)",
      });
      gsap.from(".ht-mark", {
        scaleX: 0,
        transformOrigin: "left center",
        duration: 0.5,
        delay: 0.65,
        ease: "power3.out",
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <h1 ref={ref} aria-label={WORDS.join(" ")}>
      {WORDS.map((word, i) => (
        <span
          key={i}
          className={`ht-word${i === MARK_INDEX ? " ht-word--mark" : ""}`}
          aria-hidden="true"
        >
          {i === MARK_INDEX && <span className="ht-mark" />}
          <span className="ht-word__inner">{word}</span>
        </span>
      ))}
    </h1>
  );
}