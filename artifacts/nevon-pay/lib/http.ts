export function requestId(req: Request) {
  return req.headers.get("x-request-id") || crypto.randomUUID();
}

export function json(data: unknown, status = 200, reqId?: string) {
  return Response.json(
    { ...((data as any)?.success === undefined ? { success: status < 400 } : {}), ...((data as any) || {}), request_id: reqId },
    { status, headers: { "X-Request-ID": reqId || "" } }
  );
}
