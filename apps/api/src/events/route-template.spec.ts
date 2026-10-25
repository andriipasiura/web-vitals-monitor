import { inferRouteTemplate } from './route-template.js';

describe('inferRouteTemplate', () => {
  it.each([
    ['/', '/'],
    ['/about', '/about'],
    ['/products/123', '/products/:id'],
    ['/users/42/orders/7', '/users/:id/orders/:id'],
    ['/orders/3f1c9a52-7d4e-4b1a-9c3e-2a6f8d0b5e71/items', '/orders/:id/items'],
    ['/posts/507f1f77bcf86cd799439011', '/posts/:id'],
    ['/commits/9fceb02d0ae598e95dc970b74767f19372d61af8', '/commits/:id'],
    ['/items/01ARZ3NDEKTSV4RRFFQ69G5FAV', '/items/:id'],
    [
      '/blog/my-long-blog-post-title-2024',
      '/blog/my-long-blog-post-title-2024',
    ],
    ['/docs/v2/getting-started', '/docs/v2/getting-started'],
    ['/products/123/', '/products/:id/'],
  ])('maps %s to %s', (path, expected) => {
    expect(inferRouteTemplate(path)).toBe(expected);
  });
});
