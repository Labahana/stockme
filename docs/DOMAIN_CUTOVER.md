# Domain cutover — leave stocky-* hosts

Shopify owns the “Stocky” product name. Do not submit or leave Partner URLs on `stocky-rho.vercel.app`.

## Target (until gentletap DNS is ready)

| Use | URL |
|-----|-----|
| Production | `https://stockme.gentletap.co` |
| App URL | `https://stockme.gentletap.co/app` |
| OAuth redirect | `https://stockme.gentletap.co/api/auth/callback` |
| Webhooks / GDPR | `https://stockme.gentletap.co/api/webhooks` |
| Privacy | `https://stockme.gentletap.co/privacy` |
| Website | `https://stockme.gentletap.co/` |

Code fallbacks and docs already use `stockme.gentletap.co`.

## What you must do in dashboards (agent cannot without Vercel login)

### 1. Rename Vercel project
1. Open [Vercel Dashboard](https://vercel.com/dashboard) → project **stocky**
2. **Settings → General → Project Name** → set to **`stockme`** → Save  
3. Confirm the Production domain is `stockme.gentletap.co` (or note the exact alias if `stockme` is taken)
4. **Settings → Environment Variables** → Production:  
   `NEXT_PUBLIC_APP_URL=https://stockme.gentletap.co`
5. **Deployments → … → Redeploy** production (or push a commit)

### 2. Update Shopify Partner URLs
Partner Dashboard → your Stockme app → **Versions** / **App setup**:

- App URL → `https://stockme.gentletap.co/app`
- Allowed redirection URL(s) → `https://stockme.gentletap.co/api/auth/callback`
- Privacy policy URL → `https://stockme.gentletap.co/privacy`
- GDPR / compliance webhooks → `https://stockme.gentletap.co/api/webhooks`
- App listing **Website** → `https://stockme.gentletap.co/`

Remove any `stocky-rho.vercel.app` entries.

### 3. Smoke test
1. Uninstall old install on a dev store (optional clean slate)
2. Install via Partner / custom install link
3. Confirm redirect lands on `/app` embedded
4. Settings → subscribe to Starter (test charge)
5. Hit privacy page in a normal browser tab

When `stockme.gentletap.co` DNS is ready later, repeat the same URL swap and set `NEXT_PUBLIC_APP_URL` to that host.
