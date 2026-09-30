import Magnet from "../react-bits/Magnet";
import type { Theme } from "../theme";

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
      <path
        d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="square"
        fill="none"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

export default function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const goingDark = theme === "light";

  return (
    <Magnet padding={40} magnetStrength={4}>
      <button
        type="button"
        className="theme-toggle"
        onClick={onToggle}
        aria-label={goingDark ? "Switch to dark mode" : "Switch to light mode"}
        title={goingDark ? "Dark mode" : "Light mode"}
      >
        {goingDark ? <MoonIcon /> : <SunIcon />}
      </button>
    </Magnet>
  );
}