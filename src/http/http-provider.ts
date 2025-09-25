export interface HTTPProvider {
  get<ResponseType>(url: URL): Promise<ResponseType>;
  post<RequestBodySchema, ResponseType>(url: URL, body: RequestBodySchema): Promise<ResponseType>;
  put<RequestBodySchema, ResponseType>(url: URL, body: RequestBodySchema): Promise<ResponseType>;
  patch<RequestBodySchema, ResponseType>(url: URL, body: RequestBodySchema): Promise<ResponseType>;
  delete<ResponseType>(url: URL): Promise<ResponseType>;
}
