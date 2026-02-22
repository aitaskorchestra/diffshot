const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { auth } = require('../middleware/auth');
const analytics = require('../services/analytics');

let stripe;
try { stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); } catch (e) {}

const PLANS = {
  free: { name: 'Free', price: 0, requests: 30 },
  starter: { name: 'Starter', price: 9, requests: 500 },
  pro: { name: 'Pro', price: 29, requests: 5000 },
  business: { name: 'Business', price: 79, requests: 50000 }
};

router.get('/plans', (req, res) => {
  res.json({ success: true, plans: PLANS });
});

router.post('/checkout', auth, async (req, res) => {
  if (!stripe) return res.status(500).json({ success: false, error: 'Stripe not configured' });
  try {
    const { plan } = req.body;
    const priceId = process.env[`STRIPE_PRICE_${plan.toUpperCase()}`];
    if (!priceId) return res.status(400).json({ success: false, error: 'Invalid plan' });

    let customerId = db.prepare('SELECT stripe_customer_id FROM users WHERE id = ?').get(req.user.user_id)?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: req.user.email, metadata: { user_id: String(req.user.user_id) } });
      customerId = customer.id;
      db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customerId, req.user.user_id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.BASE_URL}/dashboard.html?billing=success`,
      cancel_url: `${process.env.BASE_URL}/dashboard.html?billing=cancel`,
    });

    analytics.track('stripe', 'checkout_created', { plan }, req.user.user_id);
    res.json({ success: true, url: session.url, session_id: session.id });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Checkout failed: ' + err.message });
  }
});

router.post('/sync', auth, async (req, res) => {
  if (!stripe) return res.status(500).json({ success: false, error: 'Stripe not configured' });
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.user_id);
    if (!user.stripe_customer_id) return res.json({ success: true, plan: 'free' });

    const subs = await stripe.subscriptions.list({ customer: user.stripe_customer_id, status: 'active', limit: 1 });
    if (subs.data.length === 0) {
      db.prepare("UPDATE users SET plan = 'free', stripe_subscription_id = NULL WHERE id = ?").run(req.user.user_id);
      return res.json({ success: true, plan: 'free' });
    }

    const sub = subs.data[0];
    const priceId = sub.items.data[0].price.id;
    let plan = 'free';
    if (priceId === process.env.STRIPE_PRICE_STARTER) plan = 'starter';
    else if (priceId === process.env.STRIPE_PRICE_PRO) plan = 'pro';
    else if (priceId === process.env.STRIPE_PRICE_BUSINESS) plan = 'business';

    db.prepare('UPDATE users SET plan = ?, stripe_subscription_id = ? WHERE id = ?').run(plan, sub.id, req.user.user_id);
    res.json({ success: true, plan });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Sync failed: ' + err.message });
  }
});

router.post('/portal', auth, async (req, res) => {
  if (!stripe) return res.status(500).json({ success: false, error: 'Stripe not configured' });
  try {
    const user = db.prepare('SELECT stripe_customer_id FROM users WHERE id = ?').get(req.user.user_id);
    if (!user?.stripe_customer_id) return res.status(400).json({ success: false, error: 'No billing account' });

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.BASE_URL}/dashboard.html`,
    });
    res.json({ success: true, url: session.url });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Portal failed: ' + err.message });
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  analytics.track('stripe', 'webhook_received', {});
  res.json({ received: true });
});

module.exports = router;
