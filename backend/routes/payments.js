const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Company = require('../models/Company');
const { sendEmail } = require('../utils/emailService');
const { plans, getPlan, computeSubscriptionDates } = require('../config/plans');

const router = express.Router();

// Initialize Razorpay instance
function getRazorpay() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error('Razorpay keys are missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment');
  }
  return new Razorpay({ key_id, key_secret });
}

// Pricing map aligned with new plan ids (INR). Free handled separately.
const PLAN_PRICING = { free: 0, paid3m: 1, paid6m: 1, paid12m: 1 };

function appendSubscriptionHistory(company, { plan, startedAt, endsAt, amount, currency, invoiceId, paymentId, orderId, provider }) {
  if (!company) return false;
  company.subscriptionHistory = company.subscriptionHistory || [];
  const exists = company.subscriptionHistory.some(h =>
    (paymentId && h.paymentId === paymentId) || (orderId && h.orderId === orderId)
  );
  if (exists) return false;
  company.subscriptionHistory.push({
    plan,
    status: 'active',
    startAt: startedAt,
    endAt: endsAt,
    invoiceId,
    amount,
    currency,
    paymentId,
    orderId,
    paymentProvider: provider
  });
  return true;
}

// GET /api/payments/config -> publishable key for frontend
router.get('/config', (req, res) => {
  res.json({ keyId: process.env.RAZORPAY_KEY_ID || '' });
});

// POST /api/payments/order { email, plan }
// Creates an order in Razorpay with notes carrying email & plan
router.post('/order', async (req, res) => {
  try {
    const { email, plan } = req.body || {};
    if (!email || !plan) return res.status(400).json({ error: 'email and plan required' });
    if (!Object.keys(plans).includes(plan)) return res.status(400).json({ error: 'Invalid plan' });
    const company = await Company.findOne({ email }, { email:1, companyName:1 });
    if (!company) return res.status(404).json({ error: 'Company not found' });
    // Free plan does not require payment: activate directly
    if (plan === 'free') {
      // Set free plan subscription
      company.subscriptionPlan = 'free';
      company.subscriptionStartedAt = new Date();
      company.subscriptionEndsAt = undefined;
      company.subscriptionJobLimit = getPlan('free').jobLimit;
      await company.save({ validateModifiedOnly: true });
      return res.json({ message: 'Free plan activated', plan: 'free' });
    }
    const amountInINR = PLAN_PRICING[plan];
    const amountPaise = amountInINR * 100; // Razorpay uses smallest unit

    const instance = getRazorpay();
    const order = await instance.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes: { email, plan }
    });

    return res.json({ orderId: order.id, amount: order.amount, currency: order.currency, email, plan, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('Create order error:', err);
    return res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// POST /api/payments/verify { razorpay_order_id, razorpay_payment_id, razorpay_signature, email?, plan? }
// Verify client-side signature, as an optional fallback when webhooks are unavailable.
router.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, email, plan } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment verification fields' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const expected = hmac.digest('hex');

    if (expected !== razorpay_signature) return res.status(400).json({ error: 'Invalid signature' });

    // Activation using new subscription fields if we have email & plan
    if (email && plan && Object.keys(plans).includes(plan)) {
      const company = await Company.findOne({ email });
      if (company) {
        const { startedAt, endsAt } = computeSubscriptionDates(new Date(), plan);
        company.subscriptionPlan = plan;
        company.subscriptionStartedAt = startedAt;
        company.subscriptionEndsAt = endsAt;
        company.subscriptionJobLimit = getPlan(plan).jobLimit;
        const amount = PLAN_PRICING[plan];
        const currency = 'INR';
        const invoiceId = `INV-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
        appendSubscriptionHistory(company, {
          plan,
          startedAt,
          endsAt,
          amount,
          currency,
          invoiceId,
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          provider: 'razorpay'
        });
        await company.save({ validateModifiedOnly: true });
        const amountFormatted = amount === 0 ? 'FREE' : new Intl.NumberFormat('en-IN',{style:'currency',currency}).format(amount);
        sendEmail(company.email, 'subscriptionInvoice', {
          invoiceId,
          plan,
          planLabel: getPlan(plan).label,
          startAt: startedAt,
          endAt: endsAt || startedAt,
          companyName: company.companyName,
          companyEmail: company.email,
          billingAddress: [company.addressLine1, company.addressLine2, company.address].filter(Boolean).join(', ') || company.address || '',
          amountFormatted,
          amount,
          currency,
          jobLimit: getPlan(plan).jobLimit,
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          orderDate: new Date(),
          paymentMethod: 'Razorpay'
        }).catch(()=>{});
      }
    }

    return res.json({ success: true });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('Verify error:', err);
    return res.status(500).json({ error: 'Verification failed' });
  }
});

// Webhook: must be mounted with express.raw({ type: 'application/json' }) BEFORE global json parser; we export a handler for server.js to use.
async function webhookHandler(req, res) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) return res.status(500).json({ error: 'Webhook secret not set' });

    const body = req.body; // raw buffer provided by express.raw
    const signature = req.headers['x-razorpay-signature'];

    const expected = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
    if (expected !== signature) return res.status(400).json({ error: 'Invalid webhook signature' });

    const payload = JSON.parse(body.toString('utf8'));
    const event = payload.event;

    if (event === 'payment.captured' || event === 'order.paid') {
      const payment = payload.payload?.payment?.entity;
      const order = payload.payload?.order?.entity;
      const notes = (payment && payment.notes) || (order && order.notes) || {};
      const email = notes.email;
      const plan = notes.plan;
      if (email && plan && Object.keys(plans).includes(plan)) {
        const company = await Company.findOne({ email });
        if (company) {
          const { startedAt, endsAt } = computeSubscriptionDates(new Date(), plan);
          company.subscriptionPlan = plan;
          company.subscriptionStartedAt = startedAt;
          company.subscriptionEndsAt = endsAt;
          company.subscriptionJobLimit = getPlan(plan).jobLimit;
          const amount = PLAN_PRICING[plan];
          const currency = 'INR';
          const invoiceId = `INV-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
          appendSubscriptionHistory(company, {
            plan,
            startedAt,
            endsAt,
            amount,
            currency,
            invoiceId,
            paymentId: payment?.id,
            orderId: order?.id || payment?.order_id,
            provider: 'razorpay'
          });
          await company.save({ validateModifiedOnly: true });
          const amountFormatted = amount === 0 ? 'FREE' : new Intl.NumberFormat('en-IN',{style:'currency',currency}).format(amount);
          sendEmail(company.email, 'subscriptionInvoice', {
            invoiceId,
            plan,
            planLabel: getPlan(plan).label,
            startAt: startedAt,
            endAt: endsAt || startedAt,
            companyName: company.companyName,
            companyEmail: company.email,
            billingAddress: [company.addressLine1, company.addressLine2, company.address].filter(Boolean).join(', ') || company.address || '',
            amountFormatted,
            amount,
            currency,
            jobLimit: getPlan(plan).jobLimit,
            paymentId: payment?.id,
            orderId: order?.id || payment?.order_id,
            orderDate: new Date(),
            paymentMethod: 'Razorpay'
          }).catch(()=>{});
        }
      }
    }

    return res.json({ status: 'ok' });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

// Export both the router (JSON endpoints) and the webhook handler
const paymentsModule = router;
paymentsModule.webhook = webhookHandler;
module.exports = paymentsModule;
