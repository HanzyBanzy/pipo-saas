const API_URL =
  process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Typed API client for dashboard pages.
 * Handles Clerk auth tokens, organization context, and error normalization.
 *
 * Can be called from both server components (uses clerk/nextjs/server auth)
 * and client components (token must be passed via options).
 */
export async function apiRequest<T>(
  path: string,
  options: RequestInit & {
    organizationId?: string;
    /** Supply token directly when calling from client components */
    token?: string;
  } = {},
): Promise<T> {
  const { organizationId, token: suppliedToken, ...fetchOptions } = options;

  // Auth bypassed for local dev
  let token = suppliedToken ?? 'dev-token';

  const orgId =
    organizationId ??
    (typeof window === 'undefined'
      ? undefined
      : (document.cookie
          .split('; ')
          .find((row) => row.startsWith('__pipo_org='))
          ?.split('=')[1] ??
        undefined));

  const headers = new Headers(fetchOptions.headers ?? {});
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (orgId) {
    headers.set('x-organization-id', orgId);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      errorMessage = body.error ?? errorMessage;
    } catch {
      // Non-JSON error body
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json() as Promise<T>;
}
