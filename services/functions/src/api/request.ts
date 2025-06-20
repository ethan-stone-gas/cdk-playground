export type HttpRequest = (
  url: string | URL | Request,
  options: RequestInit
) => Promise<Response>;
