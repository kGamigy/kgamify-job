# Email OTP Fix - Testing & Verification Guide

## Problem & Solution

**Issue:** SMTP connection timeout when Render tries to reach Hostinger SMTP server.

**Solution Deployed:**
1. ✅ Increased SMTP timeouts from 15s → 30s (accounts for Render → Hostinger latency)
2. ✅ Automatic fallback to Gmail if Hostinger fails
3. ✅ Dual-provider strategy with detailed logging

---

## Testing Steps

### Step 1: Wait for Render Deployment
After push, Render auto-deploys. Check:
- Dashboard: https://dashboard.render.com
- Select backend service
- Wait for "Deploy successful" message (usually 2-3 min)

### Step 2: Test Email Flow (Browser)

**URL:** https://kgamify-job-portal.vercel.app

1. **Register new account:**
   - Click Register
   - Fill: Company Name, Email (Gmail), Phone, Password
   - Submit
   - Expected: 201 Created response with `emailSent: true`

2. **Check email:**
   - Go to your Gmail inbox
   - Look for OTP code email from `admin@kgamify.in`
   - Should arrive in <10 seconds (much faster than before)

3. **If email doesn't arrive:**
   - Check spam folder
   - Verify email address is correct
   - Try a different email if needed

### Step 3: Test Resend OTP (API)

**Using Postman:**
```
POST https://job-portal-backend-629b.onrender.com/api/auth/resend-signup-otp
Content-Type: application/json

{
  "email": "your-test-email@gmail.com"
}
```

Expected 200 response:
```json
{
  "message": "OTP resent",
  "emailSent": true,
  "emailError": null
}
```

**If emailSent is false:**
- Check logs in Render dashboard
- Look for error code (EAUTH, ECONNREFUSED, etc.)
- Fallback provider (Gmail) should have been attempted

---

## Understanding the New Flow

### Success Path (Best Case)
```
Request → Hostinger SMTP (30s timeout)
    ↓ (success)
Email sent successfully via Hostinger
Response: { emailSent: true, provider: 'primary' }
```

### Fallback Path (If Hostinger Fails)
```
Request → Hostinger SMTP (times out after 30s)
    ↓ (fails)
Automatic fallback to Gmail SMTP
    ↓ (success)
Email sent via Gmail
Response: { emailSent: true, provider: 'fallback-gmail' }
```

### Both Fail Path (Unlikely)
```
Request → Hostinger (fails) → Gmail (fails)
    ↓
Response: { emailSent: false, emailError: "error message", code: "error code" }
Check Render logs for details
```

---

## Checking Render Backend Logs

### Location
1. https://dashboard.render.com
2. Select **kgamify-backend** service
3. Click **Logs** tab
4. Search for `[emailService]`

### What to Look For

**Success (Hostinger):**
```
[emailService:transporter] Creating Hostinger transporter
[emailService] Sending email to: user@gmail.com
[emailService] Email sent successfully via primary transporter. MessageId: <...>
provider: 'primary'
```

**Success (Gmail Fallback):**
```
[emailService:transporter] Creating Hostinger transporter
[emailService:transporter] Creating Gmail transporter as fallback
[emailService] Email sent successfully via fallback (Gmail). MessageId: <...>
provider: 'fallback-gmail'
```

**Failure:**
```
[emailService] Primary transporter failed: { code: 'EAUTH', message: 'Invalid login' }
[emailService] Email send failed (all providers exhausted): { code: 'EAUTH', ... }
```

---

## Troubleshooting If Still Not Working

| Symptom | Cause | Action |
|---------|-------|--------|
| `emailSent: false`, no logs | Logs not appearing | Refresh Render page, wait 30s, check again |
| `EAUTH / Invalid login` | Hostinger credentials wrong | Verify `SMTP_PASSWORD` in Render .env is correct app password |
| `ECONNREFUSED / ETIMEDOUT` | Network unreachable | Contact Hostinger or switch to Gmail-only (set `SMTP_PROVIDER=gmail` env var) |
| Email arrives from `natheprasad17@gmail.com` | Using Gmail fallback | Check logs - indicates Hostinger failed; may want to adjust credentials |
| No email after 60s | Both providers slow/down | Check Render logs for specific error codes |

---

## Fallback Configuration (If Needed)

**To force Gmail (skip Hostinger):**
In Render dashboard → Environment variables, set:
```
SMTP_PROVIDER=gmail
```

**To force Hostinger only (no Gmail fallback):**
In Render dashboard → Environment variables, unset:
```
SMTP_HOST=
SMTP_PORT=
SMTP_EMAIL=
SMTP_PASSWORD=
```

This will use default Gmail config.

---

## Expected Performance

| Scenario | Time | Notes |
|----------|------|-------|
| Email via Hostinger | 2-5 sec | Normal Hostinger speed |
| Email via Gmail fallback | 5-10 sec | Slightly slower, but works |
| User receives email | <1 min | After API responds |
| OTP verification page | Instant | Client-side redirect |

---

## Validation Checklist

- [ ] Render deployment complete ("Deploy successful")
- [ ] New account registration returns 201
- [ ] Response includes `emailSent: true`
- [ ] Email arrives in Gmail inbox within 1 minute
- [ ] Render logs show `[emailService]` entries
- [ ] OTP page loads successfully
- [ ] OTP verification works
- [ ] Login with verified email works

---

## Questions or Issues?

1. **Email never arrives?** → Check Render logs first (step 3 above)
2. **Wrong sender email?** → Check if using Gmail fallback (indicates Hostinger failed)
3. **Still timing out?** → May need to increase SMTP_PORT to higher value or contact Hostinger

