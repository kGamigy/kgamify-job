# Mailgun Email Service Configuration

## Environment Variables for Render

Add these to your Render backend service environment:

```
MAILGUN_API_KEY=<your_mailgun_api_key>
MAILGUN_DOMAIN=<your_mailgun_domain>
MAILGUN_URL=https://api.mailgun.net
MAILGUN_FROM=kGamify Job Portal <postmaster@YOUR_DOMAIN>
```

**Get your values from:** https://app.mailgun.com/app/sending/domains

## Sandbox Limitations

**Important:** Mailgun sandbox domains can only send to **authorized recipients**.

### Add Authorized Recipients

1. Go to: https://app.mailgun.com/app/sending/domains/sandbox58accba1f1594720a5f9a39420e89671.mailgun.org
2. Click **Authorized Recipients**
3. Add each email address that needs to receive OTPs:
   - tarunpatil09876@gmail.com
   - tarunpatil1110@gmail.com
   - Any other test emails
4. Each recipient will get a confirmation email - they must click the link to authorize

### Upgrade to Production Domain

For production (sending to any email):

1. **Add Custom Domain:**
   - Settings → Domains → Add New Domain
   - Use your domain: `mail.kgamify.in` or `kgamify.in`

2. **Verify Domain:**
   - Add DNS records (TXT, MX, CNAME) to your domain DNS
   - Mailgun will provide the records
   - Verification takes 24-48 hours

3. **Update Environment:**
   ```
   MAILGUN_DOMAIN=mail.kgamify.in
   MAILGUN_FROM=kGamify Job Portal <noreply@kgamify.in>
   ```

4. **Pricing:**
   - Free tier: 5,000 emails/month for 3 months
   - Pay-as-you-go: $1.00 per 1,000 emails after free tier

## Testing

### Test Mailgun Connection
```bash
curl https://job-portal-backend-629b.onrender.com/api/auth/test-smtp
```

Expected response:
```json
{
  "success": true,
  "message": "Mailgun connection verified",
  "domain": "sandbox58accba1f1594720a5f9a39420e89671.mailgun.org",
  "state": "active"
}
```

### Test OTP Email
```bash
curl -X POST https://job-portal-backend-629b.onrender.com/api/auth/resend-signup-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"tarunpatil09876@gmail.com"}'
```

**Note:** Email must be authorized in Mailgun sandbox first!

## Advantages Over Hostinger SMTP

✅ **Cloud-friendly:** No IP blocking from Render/Vercel  
✅ **Fast delivery:** <1 second API calls  
✅ **Better logging:** Detailed delivery tracking in Mailgun dashboard  
✅ **Higher reliability:** 99.99% uptime SLA  
✅ **Analytics:** Open/click tracking, bounce management  
✅ **Scalable:** Handle high volume easily  

## Migration Steps

1. ✅ Install dependencies: `mailgun.js` + `form-data`
2. ✅ Update `backend/utils/emailService.js` to use Mailgun
3. ⏳ Add environment variables in Render
4. ⏳ Authorize recipient emails in Mailgun
5. ⏳ Test connection endpoint
6. ⏳ Test OTP send
7. 🔄 (Later) Add custom domain for production

## Rollback Plan

If Mailgun doesn't work, the old Hostinger code is still available. To rollback:

```bash
git revert HEAD
git push origin main
```

Then re-add Hostinger environment variables in Render.
