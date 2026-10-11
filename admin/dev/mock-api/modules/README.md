# Mock API section modules

Each file exports `register(on, { fail, page, NOW })`:

```js
export function register(on, { fail, page }) {
  on('GET', '/admin/matchmaking', ({ q }) => ({ items: [] }));
  on('POST', '/admin/matchmaking/:id/enable', ({ p, body, req }) => fail(409, 'version_conflict'));
}
```

- `on(method, pattern, handler)` — `:name` segments become `p.name`; handler gets `{ p, q, body, path, req }` and returns JSON, or `fail(status, code, message)`.
- Routes registered by the core server (events, auth, access/organizers, audit/chats/protests stubs, reference catalog) are matched first; register more specific paths in a module only for new endpoints.
- Data is synthetic. Shapes follow the client types in `admin/src` and ADMIN_API_MAP.md.
