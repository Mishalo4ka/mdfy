export interface HttpRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  throw?: boolean;
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  text: string;
  json: unknown;
}

export type HttpRequester = (request: HttpRequest) => Promise<HttpResponse>;
