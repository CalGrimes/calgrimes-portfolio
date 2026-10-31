# Security Guide - Invoice Admin

## ✅ Implemented Security Measures

### Authentication & Authorization
- **OAuth 2.0 via Google**: Industry-standard authentication
- **Admin Allowlist**: Only whitelisted emails can access admin pages
- **Session Management**: Database-backed sessions with NextAuth
- **Server-Side Access Control**: `requireAdmin()` guard on all protected routes

### Data Protection
- **Input Validation**: Zod schema validation on all forms
- **SQL Injection Prevention**: Using Drizzle ORM (parameterized queries)
- **XSS Protection**: React escaping + security headers
- **Rate Limiting**: Per-user request limits (100 req/min, 5 auth attempts/15min)
- **Audit Logging**: All invoice operations logged with user ID and timestamp

### Security Headers
- `X-Content-Type-Options: nosniff` - Prevent MIME sniffing
- `X-Frame-Options: DENY` - Prevent clickjacking
- `X-XSS-Protection: 1; mode=block` - Browser XSS filter
- `Referrer-Policy: strict-origin-when-cross-origin` - Limit referrer data
- `Permissions-Policy: geolocation=(), microphone=(), camera=()` - Disable unnecessary APIs

### Caching
- Invoice API responses: `no-store, no-cache` (never cached)
- Public pages: Standard cache rules

---

## 🛡️ Additional Recommendations

### 1. **Database Encryption**
```bash
# Your Neon database supports encryption at rest
# Verify in Neon dashboard: Settings → Encryption → Enabled
```

### 2. **Environment Variables**
```bash
# Always use strong values for:
AUTH_SECRET=<32+ character random string>
DATABASE_URL=<secure connection string>

# Never commit .env files
# Use .env.local locally, secrets in deployment
```

### 3. **HTTPS Enforcement**
Currently configured on production. For local dev:
```
http://localhost:3001 is acceptable
```

### 4. **Two-Factor Authentication** (Optional)
To add 2FA:
```bash
npm install @react-google-recaptcha
# Then configure in lib/auth.ts callbacks
```

### 5. **Audit Log Database** (Future)
Create table for persistent logs:
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMP,
  action TEXT,
  user_id UUID,
  invoice_id UUID,
  details JSONB,
  ip_address INET
);
```

### 6. **IP Whitelisting** (Optional)
For added security, restrict admin access to specific IPs:
```typescript
// In requireAdmin():
if (!ADMIN_IPS.includes(request.ip)) {
  redirect("/unauthorized");
}
```

### 7. **Session Security**
Already configured safely:
- ✅ HTTP-only cookies (prevents XSS theft)
- ✅ Secure flag (HTTPS only in production)
- ✅ SameSite=Lax (CSRF protection)
- ✅ 30-day expiration

---

## 🚨 Security Checklist for Deployment

- [ ] Set strong `AUTH_SECRET` (run: `openssl rand -base64 32`)
- [ ] Verify DATABASE_URL uses `sslmode=require`
- [ ] Enable HTTPS on your domain
- [ ] Configure Google OAuth redirect URIs to match your domain
- [ ] Set `ADMIN_EMAIL` environment variable
- [ ] Test login flow with your email
- [ ] Test rate limiting: Create invoices quickly, confirm limit kicks in
- [ ] Review audit logs regularly
- [ ] Set up error monitoring (Sentry, LogRocket)
- [ ] Regular security updates: `npm audit fix`

---

## 📋 What's Protected

✅ Invoice list page (`/invoices`)  
✅ Create invoice page (`/invoices/new`)  
✅ Invoice detail page (`/invoices/[id]`)  
✅ Server actions (createInvoiceAction, setInvoiceStatusAction)  
✅ Export endpoints (`/api/invoices/[id]/pdf`, `.../email`)  

---

## 🔍 Monitoring

Monitor these metrics:
1. **Failed login attempts** - Check for brute force attacks
2. **Rate limit triggers** - Check audit logs
3. **Unusual invoice activity** - Large quantities or amounts
4. **API errors** - Check server logs

---

## 🔐 Security by Default

This application follows security best practices:
- No secrets in code or version control
- Principle of least privilege (only admins see invoices)
- Defense in depth (multiple layers of protection)
- Fail secure (denies by default)
- Input validation before processing
- Output encoding to prevent XSS

---

## Questions?

For security issues, DO NOT create public GitHub issues.
Instead, contact: cal.grimes@outlook.com with [SECURITY] in subject
