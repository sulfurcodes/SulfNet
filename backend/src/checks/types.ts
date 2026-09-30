export interface CheckError {
  code?: string;
  message: string;
}

export interface BaseResult {
  ok: boolean;
  ms?: number;
  skipped?: boolean;
  error?: CheckError;
}

export interface ResolverAnswer {
  name: string;
  server: string;
  ok: boolean;
  ms: number;
  addresses?: string[];
  error?: CheckError;
}

export interface DnsResult extends BaseResult {
  addresses?: string[];
  resolvers?: ResolverAnswer[];
}

export interface TlsResult extends BaseResult {
  protocol?: string | null;
  subject?: string;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysLeft?: number;
}

export interface RedirectHop {
  url: string;
  status: number;
  ms: number;
}

export interface HttpResult extends BaseResult {
  status?: number;
  finalUrl?: string;
  hops?: RedirectHop[];
}

export interface CheckReport {
  input: string;
  invalid?: boolean;
  url?: string;
  hostname?: string;
  port?: number;
  dns?: DnsResult;
  tcp?: BaseResult;
  tls?: TlsResult;
  http?: HttpResult;
}