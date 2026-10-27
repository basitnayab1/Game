# N5 Part 37 — Settings & Localization Backend

Foundation for server-owned player settings and supported locales.

Supported locales: English, Urdu, Arabic, Hindi, Bengali, Persian, Turkish and Chinese.
The mobile app remains responsible for rendering translated resources; the backend stores the selected locale and settings.

Production: use parameterized DB queries, authentication-derived user IDs, audit sensitive setting changes, and never trust a client-supplied user ID.
