# Email OTP Testing Guide - Postman & cURL

## Quick Test: Resend OTP
This will help identify if SMTP credentials or delivery is the issue.

### Method 1: Postman (GUI)
1. Open Postman
2. Create a new POST request
3. Set URL: `https://kgamify-job.onrender.com/api/auth/resend-signup-otp`
4. Go to **Body** tab → select **raw** → **JSON**
5. Paste:
```json
{
  "email": "your-test-email@gmail.com"
}
```
6. Click **Send**
7. **Check Response**:
   - If `200 OK` → But no email arrives → **SMTP credentials issue**
   - If `404` → Email not registered in database
   - If `400` → Email already verified
   - If `500` → Server error (check backend logs)

### Method 2: cURL (Terminal)
```bash
curl -X POST https://kgamify-job.onrender.com/api/auth/resend-signup-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"your-test-email@gmail.com"}'
```

### Method 3: Register New Account & Get OTP
First, create a test account:
```bash
curl -X POST https://kgamify-job.onrender.com/api/auth/register-basic \
  -H "Content-Type: application/json" \
  -d '{
    "companyName":"Test Company",
    "email":"testcomp-'$(date +%s)'@gmail.com",
    "phone":"9999999999",
    "password":"TestPass123!"
  }'
```

Then resend OTP to that email (use the email from the response above).

---

## Troubleshooting Steps

### Step 1: Verify Database Record
Create account → Check if Company record exists in MongoDB
- If missing → Database issue
- If exists → SMTP issue

### Step 2: Check Backend Logs on Render
1. Go to https://dashboard.render.com
2. Select your backend service
3. Click **Logs** tab
4. Look for `[emailService]` logs
5. Expected logs (successful send):
```
[emailService] Sending email to: test@gmail.com
[emailService] SMTP Config: { SMTP_HOST: smtp.hostinger.com, SMTP_PORT: 465, hasPassword: true }
[emailService] Email sent successfully. MessageId: <xxx@hostinger.com>
```

6. **Error patterns to look for**:
   - `EAUTH` → Wrong SMTP password
   - `ECONNREFUSED` → Wrong SMTP host/port
   - `ETIMEDOUT` → Firewall/network blocking
   - `Invalid login` → Credentials mismatch

### Step 3: Test Direct SMTP Connection
From terminal, test if SMTP server is reachable:

**Windows (PowerShell):**
```powershell
$smtp = New-Object Net.Mail.SmtpClient("smtp.hostinger.com", 465)
$smtp.EnableSsl = $true
try {
  $smtp.Send("admin@kgamify.in", "test@gmail.com", "Test Subject", "Test Body")
  Write-Host "SMTP connection successful"
} catch {
  Write-Host "SMTP error: $_"
}
```

**Linux/Mac:**
```bash
openssl s_client -connect smtp.hostinger.com:465 -quit
```
Should display `Connected` (not timeout).

---

## Common Issues & Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| 200 OK but no email | SMTP credentials wrong | Verify `SMTP_PASSWORD` in backend .env |
| Timeout on endpoint | SMTP connection slow | Already increased to 15s timeout |
| Email marked as spam | Wrong sender domain | Check if admin@kgamify.in is authenticated |
| "Cannot read property of undefined" | Missing .env vars | Confirm SMTP_HOST, SMTP_PORT, SMTP_EMAIL, SMTP_PASSWORD set |

---

## Render Backend .env Checklist
Ensure these are set in Render dashboard (Settings → Environment):
- `SMTP_HOST=smtp.hostinger.com`
- `SMTP_PORT=465`
- `SMTP_SECURE=true`
- `SMTP_EMAIL=admin@kgamify.in`
- `SMTP_PASSWORD=<your-hostinger-app-password>`
- `NODE_ENV=production`

**Note:** App passwords (not account password) are required for Hostinger. If unsure, generate a new one in Hostinger control panel.

---

## Next Steps After Testing
1. **If SMTP test fails** → Fix credentials in Render .env
2. **If logs show error** → Share error pattern with team
3. **If email arrives slowly** → Monitor logs for connection pooling efficiency
