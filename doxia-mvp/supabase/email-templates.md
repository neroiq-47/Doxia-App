# Supabase email templates

Doxia verifies email links on the server at `/auth/confirm` using a token hash, so a link works in any
browser or device and is not broken by resending. Set these in **Supabase → Authentication → Emails → Templates**.
`{{ .SiteURL }}` must be the app origin (Authentication → URL Configuration → Site URL).

## Magic Link

Subject: `Your Doxia sign-in link`

```html
<h2>Sign in to Doxia</h2>
<p>Tap the link below to sign in. It expires shortly and works once.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Sign in to Doxia</a></p>
<p>If you didn't request this, you can ignore this email.</p>
```

## Confirm signup

Subject: `Confirm your Doxia account`

```html
<h2>Welcome to Doxia</h2>
<p>Tap the link below to confirm your email and sign in.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm and sign in</a></p>
<p>If you didn't request this, you can ignore this email.</p>
```

Until the templates are changed, Supabase's default links go to `/auth/callback`, which still works when the
link is opened in the same browser that requested it.
