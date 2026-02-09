import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
// Legacy chooseSubscription removed in new plan system.
// Free plan selection now uses selectFreePlan; paid plans handled via full Plans page with Razorpay.
import { selectFreePlan } from '../api';

/*
  SubscriptionModal
  Purpose:
    Provide a lightweight, demo-friendly subscription picker without real payment integration.

  Key Behaviors:
    - Random promotional pricing for Silver & Gold generated every time the modal opens (client-side only).
    - Simulated payment: a 1.5s timeout stands in for a real processor before hitting chooseSubscription.
    - Free plan activates immediately with no delay.
    - On successful activation, updated company details merged & persisted to localStorage to prevent repeat prompting.

  Notes:
    This is intentionally minimal; replace handleChoose logic with real gateway (Stripe/Razorpay/etc) later.
*/

// Updated plan descriptions align with new duration-based subscriptions.
const PLAN_DESCRIPTIONS = {
  free: {
    title: 'Free',
    price: '₹0',
    features: ['Post up to 3 active jobs', 'Basic visibility', 'Recommendations disabled']
  },
  paid3m: {
    title: '3 Months',
    price: '₹1,499',
    features: ['15 active jobs', 'Higher visibility', 'No ads', 'Recommendations enabled']
  },
  paid6m: {
    title: '6 Months',
    price: '₹2,799',
    features: ['20 active jobs', 'Priority ranking', 'No ads', 'Recommendations enabled']
  },
  paid12m: {
    title: '12 Months',
    price: '₹4,999',
    features: ['30 active jobs', 'Max visibility', 'No ads', 'Recommendations enabled']
  }
};

export default function SubscriptionModal({ open, onClose, company, onChosen }) {
  const [loadingPlan, setLoadingPlan] = useState('');
  const [error, setError] = useState('');

  useEffect(()=>{
    if (open){
      setError('');
      setLoadingPlan('');
    }
  },[open]);

  if (!open) return null;

  async function handleChoose(plan){
    setError('');
    if (!company?.email) { setError('Login required'); return; }
    if (plan === 'free') {
      try {
        setLoadingPlan(plan);
        await selectFreePlan(company.email);
        const updated = { ...company, subscriptionPlan: 'free', subscriptionStartedAt: new Date().toISOString(), subscriptionJobLimit: 3 };
        localStorage.setItem('companyData', JSON.stringify(updated));
        onChosen && onChosen(updated);
        onClose();
      } catch (err) {
        setError(err.message||'Failed to activate free plan');
      } finally { setLoadingPlan(''); }
      return;
    }
    // For paid plans, direct user to full Plans page for Razorpay checkout.
    window.location.href = '/plans';
  }

  const plans = [
    { key:'free', color:'border-gray-300', accent:'text-gray-600' },
    { key:'paid3m', color:'border-blue-300', accent:'text-blue-600' },
    { key:'paid6m', color:'border-purple-300', accent:'text-purple-600' },
    { key:'paid12m', color:'border-amber-400', accent:'text-amber-600' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 w-full max-w-5xl rounded-2xl shadow-2xl border border-orange-200 dark:border-gray-700 p-6 md:p-10 relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-gray-700">✕</button>
        <h2 className="text-2xl md:text-3xl font-extrabold mb-2 bg-gradient-to-r from-[#ff8200] to-[#ffb347] bg-clip-text text-transparent">Choose Your Plan</h2>
        <p className="text-sm text-gray-500 mb-6">Select a subscription to unlock job posting capacity. Promotional prices are randomized on each open (demo only).</p>
        {error && <div className="mb-4 p-3 rounded bg-red-50 text-red-600 text-sm border border-red-200">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map(p=>{
            const desc = PLAN_DESCRIPTIONS[p.key];
            const active = company?.subscriptionPlan === p.key;
            return (
              <div key={p.key} className={`relative rounded-xl border ${p.color} bg-gradient-to-br from-white to-orange-50 dark:from-gray-900 dark:to-gray-800 p-6 flex flex-col shadow hover:shadow-lg transition`}> 
                <h3 className={`text-xl font-bold mb-2 ${p.accent}`}>{desc.title}</h3>
                <div className="mb-4 flex items-end gap-2">
                  <span className="text-3xl font-extrabold text-[#ff8200]">{desc.price}</span>
                </div>
                <ul className="text-sm mb-6 space-y-2 text-gray-600 dark:text-gray-300">
                  {desc.features.map(f=> <li key={f} className="flex items-start gap-2"><span className="text-[#ff8200] mt-0.5">•</span><span>{f}</span></li>)}
                </ul>
                {active && <div className="mt-auto text-green-600 font-semibold text-sm">Current Plan</div>}
                {!active && (
                  <button disabled={!!loadingPlan} onClick={()=>handleChoose(p.key)} className={`mt-auto w-full py-2.5 rounded-lg font-semibold text-white ${p.key==='free'? 'bg-gray-400 hover:bg-gray-500':'bg-gradient-to-r from-[#ff8200] to-[#ffb347] hover:from-[#e57400] hover:to-[#ffb347]'} disabled:opacity-50 flex items-center justify-center`}>
                    {loadingPlan===p.key? 'Processing...' : p.key==='free'? 'Activate Free' : `Go To Checkout`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="text-xs text-gray-400 mt-6">Demo: Payment is simulated with a timeout and no real transaction occurs.</div>
      </div>
    </div>
  );
}

SubscriptionModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  company: PropTypes.object,
  onChosen: PropTypes.func
};
