import { useEffect, useRef } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "../motion";

const LANES = [
  { id: "local", y: 90, label: "YOUR NETWORK", start: "YOU" },
  { id: "ctrl", y: 210, label: "CONTROL SERVER", start: "CTRL" },
] as const;

const GATES = [
  { key: "dns", label: "DNS", x: 215, tip: "DNS: turns the name into an IP address" },
  { key: "tcp", label: "TCP", x: 355, tip: "TCP: opens a connection to that address" },
  { key: "tls", label: "TLS", x: 495, tip: "TLS: secures the connection and checks the certificate" },
  { key: "http", label: "HTTP", x: 635, tip: "HTTP: asks the site for the page" },
] as const;

const START_X = 122;
const END_X = 826;
const PKT = 20;

// blockAt is the gate index where the local packet dies, or null for a healthy run.
const SCENARIOS: { blockAt: number | null; caption: string }[] = [
  {
    blockAt: null,
    caption: "Healthy: both networks get through all four steps, so the site is fine.",
  },
  {
    blockAt: 2,
    caption:
      "Your network kills the TLS handshake. The outside server gets through, so the problem is on your side.",
  },
  {
    blockAt: 0,
    caption:
      "Your DNS never answers. The outside server resolves the name fine, so your DNS is the problem.",
  },
];

export default function NetworkHero() {
  const rootRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const caption = captionRef.current;
    if (!root || !caption) return;

    const local = root.querySelector<SVGRectElement>('[data-pkt="local"]');
    const ctrl = root.querySelector<SVGRectElement>('[data-pkt="ctrl"]');
    const site = root.querySelector<SVGGElement>("[data-site]");
    if (!local || !ctrl || !site) return;

    const gate = (lane: string, i: number) =>
      root.querySelector<SVGGElement>(`[data-gate="${lane}-${i}"]`);
    const tag = (i: number) => root.querySelector<SVGGElement>(`[data-tag="${i}"]`);

    const reset = () => {
      root
        .querySelectorAll(".nh-gategroup, .nh-sitegroup")
        .forEach((el) => el.classList.remove("is-pass", "is-fail"));
      gsap.set(root.querySelectorAll(".nh-tag"), { autoAlpha: 0 });
      gsap.set(local, { x: START_X, y: LANES[0].y - PKT / 2, autoAlpha: 1 });
      gsap.set(ctrl, { x: START_X, y: LANES[1].y - PKT / 2, autoAlpha: 1 });
    };

    if (prefersReducedMotion()) {
      reset();
      root
        .querySelectorAll(".nh-gategroup, .nh-sitegroup")
        .forEach((el) => el.classList.add("is-pass"));
      gsap.set([local, ctrl], { x: END_X });
      caption.textContent = SCENARIOS[0].caption;
      return;
    }

    const ctx = gsap.context(() => {
      reset();
      const tl = gsap.timeline({ repeat: -1 });

      SCENARIOS.forEach((scenario, si) => {
        tl.call(() => {
          reset();
          caption.textContent = scenario.caption;
        });
        tl.fromTo(caption, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3 });
        tl.to({}, { duration: 0.5 });

        GATES.forEach((g, i) => {
          const label = `s${si}g${i}`;
          const localPasses = scenario.blockAt === null || i < scenario.blockAt;
          const localBlocks = scenario.blockAt === i;

          tl.addLabel(label);
          tl.to(ctrl, { x: g.x - PKT / 2, duration: 0.55, ease: "power2.inOut" }, label);
          tl.call(() => gate("ctrl", i)?.classList.add("is-pass"), [], `${label}+=0.55`);

          if (localPasses) {
            tl.to(local, { x: g.x - PKT / 2, duration: 0.55, ease: "power2.inOut" }, label);
            tl.call(() => gate("local", i)?.classList.add("is-pass"), [], `${label}+=0.55`);
          }

          if (localBlocks) {
            tl.to(local, { x: g.x - 35 - PKT - 4, duration: 0.45, ease: "power2.in" }, label);
            tl.call(() => gate("local", i)?.classList.add("is-fail"), [], `${label}+=0.45`);
            tl.to(
              local,
              { x: "+=5", duration: 0.05, repeat: 7, yoyo: true, ease: "none" },
              `${label}+=0.45`,
            );
            const t = tag(i);
            if (t) {
              tl.fromTo(
                t,
                { autoAlpha: 0, y: -10 },
                { autoAlpha: 1, y: 0, duration: 0.25, ease: "back.out(3)" },
                `${label}+=0.45`,
              );
            }
          }
        });

        const end = `s${si}end`;
        tl.addLabel(end);
        tl.to(ctrl, { x: END_X, duration: 0.5, ease: "power2.inOut" }, end);
        if (scenario.blockAt === null) {
          tl.to(local, { x: END_X, duration: 0.5, ease: "power2.inOut" }, end);
        }
        tl.call(() => site.classList.add("is-pass"), [], `${end}+=0.5`);
        tl.to([local, ctrl], { autoAlpha: 0, duration: 0.3 }, `${end}+=${scenario.blockAt === null ? 1.6 : 2.8}`);
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef}>
      <h3 className="section-title mono">Two vantage points, one site</h3>
      <div className="nh">
        <div className="nh-scroll">
          <svg
            viewBox="0 0 960 280"
            role="img"
            aria-label="Animation: a request travels through DNS, TCP, TLS and HTTP from your network and from a control server to the same site."
          >
            {LANES.map((lane) => (
              <g key={lane.id}>
                <text className="nh-text nh-lane-label" x={20} y={lane.y - 44}>
                  {lane.label}
                </text>
                <line className="nh-line" x1={112} y1={lane.y} x2={850} y2={lane.y} />
                <rect className="nh-node" x={20} y={lane.y - 28} width={92} height={56} />
                <text
                  className="nh-text nh-node-label"
                  x={66}
                  y={lane.y + 6}
                  textAnchor="middle"
                >
                  {lane.start}
                </text>
                {GATES.map((g, i) => (
                  <g key={g.key} className="nh-gategroup" data-gate={`${lane.id}-${i}`}>
                    <title>{g.tip}</title>
                    <rect className="nh-gate" x={g.x - 35} y={lane.y - 35} width={70} height={70} />
                    <text
                      className="nh-text nh-gate-label"
                      x={g.x}
                      y={lane.y + 6}
                      textAnchor="middle"
                    >
                      {g.label}
                    </text>
                  </g>
                ))}
              </g>
            ))}

            <g className="nh-sitegroup" data-site>
              <rect className="nh-node" x={850} y={50} width={96} height={200} />
              <text className="nh-text nh-site-label" x={898} y={156} textAnchor="middle">
                SITE
              </text>
            </g>

            {GATES.map((g, i) => (
              <g key={g.key} className="nh-tag" data-tag={i}>
                <rect x={g.x - 40} y={LANES[0].y - 66} width={80} height={22} />
                <text x={g.x} y={LANES[0].y - 51} textAnchor="middle">
                  BLOCKED
                </text>
              </g>
            ))}

            <rect className="nh-pkt nh-pkt--ctrl" data-pkt="ctrl" width={PKT} height={PKT} />
            <rect className="nh-pkt nh-pkt--local" data-pkt="local" width={PKT} height={PKT} />
          </svg>
        </div>
        <p className="nh-caption mono" ref={captionRef}>
          {SCENARIOS[0].caption}
        </p>
      </div>
    </div>
  );
}