// Copy this file into BOTH backend/src/ and frontend/src/ (same as your shared types).

export type ProofTestId =
  | "ipv4_v6"
  | "control_tls"
  | "cert_compare"
  | "doh_dns"
  | "asn_compare";

/** "local"        = this test points to a problem on the user's network
 *  "neutral"      = this test shows no sign of a local problem
 *  "inconclusive" = couldn't run or not enough data (not counted) */
export type Leaning = "local" | "neutral" | "inconclusive";

export interface TlsProbe {
  ok: boolean;
  ip?: string;
  ms?: number;
  authorized?: boolean;
  authError?: string;
  fingerprint?: string;
  issuer?: string;
  subject?: string;
  protocol?: string;
  error?: string;
}

export interface AsnInfo {
  ip: string;
  asn: string;
  name: string;
}

/** Everything one vantage point (local agent or control server) observes. */
export interface ProbeSet {
  vantage: "local" | "control";
  hostname: string;
  port: number;
  systemAddresses: string[];
  systemError?: string;
  dohAddresses: string[];
  dohError?: string;
  ipv4: TlsProbe;
  ipv6: TlsProbe;
  asn?: AsnInfo;
}

export interface ProofTest {
  id: ProofTestId;
  label: string;
  leaning: Leaning;
  local: string;
  control: string;
  conclusion: string;
}

export interface ProofResponse {
  tests: ProofTest[];
  supporting: number; // tests pointing at the local network
  total: number; // tests that gave a usable answer
  likelyCause: string;
  why: string;
  explanation: string | null;
  explanationSource: "gemma" | "fallback";
  localProbes: ProbeSet;
  controlProbes: ProbeSet;
}