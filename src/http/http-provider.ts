export interface HTTPProvider {
  get<ResponseType, RequestBodySchema = undefined>(url: URL, body?: RequestBodySchema): Promise<ResponseType>;
  post<RequestBodySchema, ResponseType>(url: URL, body: RequestBodySchema): Promise<ResponseType>;
  put<RequestBodySchema, ResponseType>(url: URL, body: RequestBodySchema): Promise<ResponseType>;
  patch<RequestBodySchema, ResponseType>(url: URL, body: RequestBodySchema): Promise<ResponseType>;
  delete<ResponseType, RequestBodySchema = undefined>(url: URL, body?: RequestBodySchema): Promise<ResponseType>;
}
