const DYNAMIC_SEGMENTS = [
  /^\d+$/,
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  /^[0-9a-f]{16,}$/i,
  /^(?=.*\d)(?=.*[a-z])[a-z0-9]{20,}$/i,
];

export function inferRouteTemplate(path: string): string {
  return path
    .split('/')
    .map((segment) =>
      DYNAMIC_SEGMENTS.some((pattern) => pattern.test(segment))
        ? ':id'
        : segment,
    )
    .join('/');
}
