import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setSubscription } from '../store/slices/subscriptionSlice';
import extractSubscriptionSnapshot from '../utils/subscriptionSnapshot';
import PropTypes from 'prop-types';
import { getPaymentConfig, createPaymentOrder, verifyPayment, getSubscriptionHistory, selectFreePlan } from '../api';
import usePlanMeta from '../hooks/usePlanMeta';
import { FaRocket, FaStar, FaUserTie } from "react-icons/fa";

// New plan definitions aligned with backend (paid3m, paid6m, paid12m)
const PLAN_DEFINITIONS = {
  free: {
    id: 'free',
    title: 'Free',
    price: '₹0',
    duration: 'Indefinite',
    limit: 3,
    features: [
      'Post up to 3 active jobs',
      'Basic listing visibility',
      'Ads displayed (support platform)',
      'Recommendations disabled'
    ]
  },
  paid3m: {
    id: 'paid3m',
    title: '3 Months',
    price: '₹1',
    duration: '90 days',
    limit: 15,
    features: [
      'Post up to 15 active jobs',
      'Higher visibility & ranking boost',
      'No ads on your dashboard',
      'Recommendations enabled'
    ]
  },
  paid6m: {
    id: 'paid6m',
    title: '6 Months',
    price: '₹1',
    duration: '180 days',
    limit: 20,
    features: [
      'Post up to 20 active jobs',
      'Priority search presence',
      'No ads + recommendations enabled',
      'Extended subscription duration'
    ]
  },
  paid12m: {
    id: 'paid12m',
    title: '12 Months',
    price: '₹1',
    duration: '365 days',
    limit: 30,
    features: [
      'Post up to 30 active jobs',
      'Maximum visibility & priority',
      'No ads + recommendations enabled',
      'Longest duration & best value'
    ]
  }
};

export default function Plans({ isDarkMode = false }) {
  const dispatch = useDispatch();
  const [company, setCompany] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [history, setHistory] = useState({ company: null, history: [] });
  const email = company?.email;
  const { planMeta, refreshPlanMeta } = usePlanMeta(email || null);

  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('companyData') || 'null');
      if (cached) setCompany(cached);
    } catch { /* ignore */ }
  }, []);

  // Load history when company available
  useEffect(() => {
    (async () => {
      try {
        if (company?.email) {
          const h = await getSubscriptionHistory(company.email);
          setHistory({ company: h.company, history: Array.isArray(h.history) ? h.history : [] });
        }
      } catch { /* ignore */ }
    })();
  }, [company?.email]);

  // Dynamically load Razorpay if needed
  function ensureRazorpayLoaded() {
    return new Promise((resolve, reject) => {
      if (window.Razorpay) return resolve();
      const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay')));
        return;
      }
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load Razorpay'));
      document.body.appendChild(s);
    });
  }

  async function processPaidPlan(planId) {
    const cfg = await getPaymentConfig();
    const order = await createPaymentOrder(email, planId);
    try { await ensureRazorpayLoaded(); } catch { setError('Failed to load payment SDK'); return; }
    await new Promise((resolve, reject) => {
      const rzp = new window.Razorpay({
        key: cfg.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'kGamify',
        description: `${PLAN_DEFINITIONS[planId].title} Subscription`,
        order_id: order.orderId,
        notes: { email, plan: planId },
        prefill: { email, name: company?.companyName || email },
        theme: { color: '#ff8200' },
        handler: async (resp) => {
          try {
            await verifyPayment({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
              email,
              plan: planId
            });
            // Refresh metadata & history
            try {
              const hist = await getSubscriptionHistory(email);
              if (hist?.company) {
                const updated = {
                  ...company,
                  subscriptionPlan: hist.company.plan,
                  subscriptionStartedAt: hist.company.startAt || hist.company.startedAt || hist.company.subscriptionStartedAt || new Date().toISOString(),
                  subscriptionEndsAt: hist.company.endAt || hist.company.subscriptionEndsAt || null,
                  subscriptionJobLimit: hist.company.jobLimit || hist.company.subscriptionJobLimit || PLAN_DEFINITIONS[planId]?.limit || company?.subscriptionJobLimit,
                  downgradedFromPlan: hist.company.downgradedFromPlan || null
                };
                localStorage.setItem('companyData', JSON.stringify(updated));
                setCompany(updated);
                setHistory({ company: hist.company, history: Array.isArray(hist.history) ? hist.history : [] });
                dispatch(setSubscription(extractSubscriptionSnapshot(updated)));
              }
            } catch { /* ignore */ }
            await refreshPlanMeta(true);
            setSuccess(`${PLAN_DEFINITIONS[planId].title} plan activated`);
            resolve();
          } catch (e) {
            setError(e.message || 'Payment verification failed');
            reject(e);
          }
        },
        modal: { ondismiss: () => { setError('Payment cancelled'); reject(new Error('cancelled')); } }
      });
      rzp.open();
    });
  }

  async function handleSelect(planId) {
    setError(''); setSuccess('');
    if (!email) { setError('Please login to choose a plan.'); return; }
    try {
      setLoadingPlan(planId);
      if (planId === 'free') {
        await selectFreePlan(email);
        // refresh company cache
        const updated = { ...company, subscriptionPlan: 'free', subscriptionStartedAt: new Date().toISOString(), subscriptionEndsAt: undefined, subscriptionJobLimit: PLAN_DEFINITIONS.free.limit };
        localStorage.setItem('companyData', JSON.stringify(updated));
        setCompany(updated);
        // Dispatch snapshot
        dispatch(setSubscription(extractSubscriptionSnapshot(updated)));
        await refreshPlanMeta(true);
        setSuccess('Free plan activated');
        return;
      }
      await processPaidPlan(planId);
    } catch (err) {
      setError(err.message || 'Failed to process subscription');
    } finally {
      setLoadingPlan('');
    }
  }

  async function handleUpgrade(targetPlan) {
    setError(''); setSuccess('');
    if (!email) { setError('Login required'); return; }
    try {
      setLoadingPlan(targetPlan);
      await processPaidPlan(targetPlan);
    } catch (e) {
      setError(e.message || 'Upgrade failed');
    } finally {
      setLoadingPlan('');
    }
  }

  async function handleRenew() {
    setError(''); setSuccess('');
    if (!email || !planMeta?.plan || planMeta.plan === 'free') { setError('No paid plan to renew'); return; }
    try {
      setLoadingPlan(planMeta.plan);
      await processPaidPlan(planMeta.plan);
    } catch (e) {
      setError(e.message || 'Renewal failed');
    } finally {
      setLoadingPlan('');
    }
  }

  const cards = [
    { key:'free', def: PLAN_DEFINITIONS.free, color:'border-gray-200', accent:'text-gray-600', icon: <FaUserTie className="text-2xl text-gray-400" /> },
    { key:'paid3m', def: PLAN_DEFINITIONS.paid3m, color:'border-blue-200', accent:'text-blue-600', icon: <FaRocket className="text-2xl text-blue-400" /> },
    { key:'paid6m', def: PLAN_DEFINITIONS.paid6m, color:'border-purple-300', accent:'text-purple-600', icon: <FaStar className="text-2xl text-purple-400" /> },
    { key:'paid12m', def: PLAN_DEFINITIONS.paid12m, color:'border-amber-300', accent:'text-amber-600', icon: <FaStar className="text-2xl text-amber-400" /> }
  ];

  return (
    <div className={`min-h-screen py-0 px-0 flex flex-col items-center ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header Section */}
      <div className={`w-full bg-gradient-to-r from-[#ff8200] to-[#ffb347] py-12 mb-10 flex flex-col items-center ${isDarkMode ? 'bg-gray-900' : ''}`}>
        <FaRocket className="text-5xl text-white mb-4" />
        <h1 className="text-4xl font-extrabold mb-2 text-white drop-shadow-lg">Choose Your Plan</h1>
        <p className="text-lg opacity-90 mb-2 text-white font-medium">Select a subscription to post jobs, boost visibility, and access premium hiring features.</p>
      </div>
      <div className="w-full max-w-7xl px-4 flex flex-col">
        {error && <div className={`mb-4 p-3 rounded ${isDarkMode ? 'bg-red-900 text-red-200 border-red-700' : 'bg-red-50 text-red-600 border-red-200'} text-sm border`}>{error}</div>}
        {success && <div className={`mb-4 p-3 rounded ${isDarkMode ? 'bg-green-900 text-green-200 border-green-700' : 'bg-green-50 text-green-700 border-green-200'} text-sm border`}>{success}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-stretch mb-8">
          {cards.map(card => {
            const { def } = card;
            const active = planMeta?.plan === card.key;
            // Determine button label & action
            let actionType = 'select'; // select | upgrade | renew
            let label = 'Activate';
            const order = ['free','paid3m','paid6m','paid12m'];
            const currentIdx = order.indexOf(planMeta?.plan || 'free');
            const targetIdx = order.indexOf(card.key);
            if (active) {
              if (card.key !== 'free') label = 'Renew';
              actionType = 'renew';
            } else if (targetIdx > currentIdx && planMeta?.plan && planMeta.plan !== 'free') {
              actionType = 'upgrade';
              label = 'Upgrade';
            } else if (card.key === 'free') {
              label = 'Activate';
            } else {
              label = 'Purchase';
            }
            const processing = loadingPlan === card.key;
            return (
              <div key={card.key} className={`relative rounded-3xl border ${card.color} ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'} p-8 flex flex-col shadow-xl hover:shadow-2xl transition-all duration-200 hover:-translate-y-1`} style={{ minHeight: 420 }}>
                <div className="flex items-center gap-3 mb-2">
                  {card.icon}
                  <h3 className={`text-2xl font-bold ${card.accent}`}>{def.title}</h3>
                </div>
                <div className="mb-4 flex flex-col gap-1">
                  <span className="text-4xl font-extrabold text-[#ff8200]">{def.price}</span>
                  <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{def.duration} • {def.limit} jobs/month</span>
                </div>
                <ul className="text-sm mb-8 space-y-3 opacity-95">
                  {def.features.map(f => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="text-[#ff8200] mt-0.5 font-bold">•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  disabled={processing}
                  onClick={() => {
                    if (actionType === 'select') handleSelect(card.key);
                    else if (actionType === 'upgrade') handleUpgrade(card.key);
                    else if (actionType === 'renew') handleRenew();
                  }}
                  className={`mt-auto w-full py-3 rounded-xl font-bold text-lg text-white shadow-lg disabled:opacity-50 ${
                    card.key==='free'
                      ? isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-400 hover:bg-gray-500'
                      : 'bg-gradient-to-r from-[#ff8200] to-[#ffb347] hover:from-[#e57400] hover:to-[#ffb347]'
                  } transition-all duration-200`}
                >
                  {processing ? 'Processing...' : active && card.key !== 'free' ? 'Renew' : label}
                </button>
                {active && <div className="absolute top-4 right-4 px-3 py-1 bg-green-600 text-white rounded-full text-xs font-bold shadow">Current</div>}
              </div>
            );
          })}
        </div>
        {/* ...footer or any content below cards... */}
        {/* Subscription history */}
        {email && planMeta && (
          <div className={`mt-4 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-5`}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold">Subscription Snapshot</h4>
              <div className="flex items-center gap-3 text-sm opacity-80">
                <span>Plan: <strong>{planMeta.plan}</strong>{planMeta.endsAt && ` • Ends: ${planMeta.endsAt.toISOString().slice(0,10)}`}</span>
                <Link to="/subscription" className="underline text-[#ff8200]">Open full snapshot</Link>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className={`p-3 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="opacity-70">Started</div>
                <div className="font-medium">{planMeta.started ? planMeta.started.toLocaleDateString() : '—'}</div>
              </div>
              <div className={`p-3 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="opacity-70">Ends</div>
                <div className="font-medium">{planMeta.endsAt ? planMeta.endsAt.toLocaleDateString() : 'Indefinite'}</div>
              </div>
              <div className={`p-3 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="opacity-70">Active jobs</div>
                <div className="font-medium">{planMeta.used} / {planMeta.limit}</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm font-semibold mb-2">Billing History</div>
              {Array.isArray(history.history) && history.history.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        <th className="text-left py-2 pr-4">Invoice</th>
                        <th className="text-left py-2 pr-4">Plan</th>
                        <th className="text-left py-2 pr-4">Start</th>
                        <th className="text-left py-2 pr-4">End</th>
                        <th className="text-left py-2 pr-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.history.map((h) => (
                        <tr key={h.invoiceId || h.startAt} className={isDarkMode ? 'border-t border-gray-700' : 'border-t border-gray-200'}>
                          <td className="py-2 pr-4 font-mono">{h.invoiceId || '—'}</td>
                          <td className="py-2 pr-4">{h.plan}</td>
                          <td className="py-2 pr-4">{h.startAt ? new Date(h.startAt).toLocaleString() : '—'}</td>
                          <td className="py-2 pr-4">{h.endAt ? new Date(h.endAt).toLocaleString() : '—'}</td>
                          <td className="py-2 pr-4">
                            <span className={`px-2 py-0.5 rounded text-xs ${h.status==='active' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>{h.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={`p-3 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>No history yet.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

Plans.propTypes = { isDarkMode: PropTypes.bool };
