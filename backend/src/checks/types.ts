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
  validTo?: string;
  issuer?: string;
}

export interface HttpResult extends BaseResult {
  status?: number;
  location?: string;
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