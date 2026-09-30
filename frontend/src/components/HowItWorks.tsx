import { useEffect, useRef } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "../motion";

const STEPS = [
  {
    key: "dns",
    n: "01",
    title: "DNS",
    line: "Turns the name into an IP address.",
    breaks: "Fails when the domain is blocked or missing.",
  },
  {
    key: "tcp",
    n: "02",
    title: "TCP",
    line: "Opens a connection to that address.",
    breaks: "Breaks when a firewall or ISP drops the traffic.",
  },
  {
    key: "tls",
    n: "03",
    title: "TLS",
    line: "Secures connection & checks certificate.",
    breaks: "Fails when the certificate is invalid or tampered.",
  },
  {
    key: "http",
    n: "04",
    title: "HTTP",
    line: "Asks the site for the page.",
    breaks: "Breaks when the server errors or refuses you.",
  },
];

export default function HowItWorks() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;

    const cards = root.querySelectorAll(".hiw-card");
    const ctx = gsap.context(() => {}, root);
    ctx.add(() => gsap.set(cards, { autoAlpha: 0, y: 32 }));

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        ctx.add(() =>
          gsap.to(cards, {
            autoAlpha: 1,
            y: 0,
            duration: 0.55,
            stagger: 0.1,
            ease: "power3.out",
            clearProps: "transform,opacity,visibility",
          }),
        );
        io.disconnect();
      },
      { threshold: 0.2 },
    );
    io.observe(root);

    return () => {
      io.disconnect();
      ctx.revert();
    };
  }, []);

  return (
    <div ref={rootRef}>
      <h3 className="section-title mono">How a page loads</h3>
      <p className="hiw-intro">
        Every visit is four steps, and the page only loads if all four work. SulfNet runs them from
        your network and from an outside server, so it can tell you which step broke and whether the
        problem is you or the site.
      </p>
      <div className="hiw-grid">
        {STEPS.map((s) => (
          <article className="hiw-card" key={s.key} tabIndex={0}>
            <span className="hiw-num mono">{s.n}</span>
            <h4>{s.title}</h4>
            <p>{s.line}</p>
            <div className="hiw-more">
              <div>
                <p className="mono">{s.breaks}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}