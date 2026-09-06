# Routing

The app uses `createBrowserRouter`, so URLs are clean paths:

    /library/overview
    /library/platforms
    /deck/oddfox

## What that requires from a host

Any path the server does not recognise must return `index.html`, so the router
can resolve it client-side. Vite's dev server does this automatically.

If this is ever deployed as static files, add the equivalent rewrite. On
Firebase Hosting that is:

```json
"rewrites": [{ "source": "**", "destination": "/index.html" }]
```

Without it, a deep link or a refresh on `/library/platforms` returns 404.

`notes.html` is a second entry point and is not routed — it keeps its own
`#<deck-id>` hash, which is unaffected.
