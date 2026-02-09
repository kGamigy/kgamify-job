import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import usePlanMeta from '../hooks/usePlanMeta';
import { getSubscriptionHistory } from '../api';

export default function SubscriptionSnapshot({ isDarkMode = false }) {
  const [company, setCompany] = useState(null);
  const [history, setHistory] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const email = company?.email;
  const { planMeta, refreshPlanMeta } = usePlanMeta(email || null);
  const PLAN_DURATIONS = { paid3m: 90, paid6m: 180, paid12m: 365 };
  const computedEndsAt = planMeta?.endsAt
    ? planMeta.endsAt
    : (planMeta?.started && PLAN_DURATIONS[planMeta.plan])
      ? new Date(planMeta.started.getTime() + PLAN_DURATIONS[planMeta.plan] * 24 * 60 * 60 * 1000)
      : null;
  const daysRemaining = computedEndsAt
    ? Math.max(0, Math.ceil((computedEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('companyData') || 'null');
      if (cached) setCompany(cached);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    (async () => {
      if (!email) { setLoading(false); return; }
      setLoading(true);
      setError('');
      try {
        const h = await getSubscriptionHistory(email);
        setHistory(Array.isArray(h.history) ? h.history : []);
        await refreshPlanMeta(true);
      } catch (e) {
        setError(e?.message || 'Failed to load subscription history');
      } finally {
        setLoading(false);
      }
    })();
  }, [email, refreshPlanMeta]);

  return (
    <div className={`min-h-screen px-4 py-10 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-5xl mx-auto">
        <div className={`rounded-xl border p-6 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold">Subscription Snapshot</h1>
              <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Overview of your current plan and billing history.</p>
            </div>
            {planMeta && (
              <span className={`text-xs px-3 py-1 rounded-full ${isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}>
                Plan: <strong>{planMeta.plan}</strong>
              </span>
            )}
          </div>

          {error && (
            <div className={`mb-4 p-3 rounded border text-sm ${isDarkMode ? 'bg-red-900/40 border-red-800 text-red-200' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {error}
            </div>
          )}

          {planMeta && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className={`p-3 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="opacity-70">Started</div>
                <div className="font-medium">{planMeta.started ? planMeta.started.toLocaleDateString() : '—'}</div>
              </div>
              <div className={`p-3 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="opacity-70">Ends</div>
                <div className="font-medium">{computedEndsAt ? computedEndsAt.toLocaleDateString() : '—'}</div>
                {!planMeta.endsAt && computedEndsAt && (
                  <div className="text-xs opacity-60 mt-1">Auto-calculated from plan duration</div>
                )}
              </div>
              <div className={`p-3 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="opacity-70">Active jobs</div>
                <div className="font-medium">{planMeta.used} / {planMeta.limit}</div>
              </div>
            </div>
          )}

          {planMeta && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mt-4">
              <div className={`p-3 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="opacity-70">Days remaining</div>
                <div className="font-medium">{daysRemaining !== null ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'}` : '—'}</div>
              </div>
              <div className={`p-3 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="opacity-70">Job limit</div>
                <div className="font-medium">{planMeta.limit}</div>
              </div>
              <div className={`p-3 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="opacity-70">AI Features</div>
                <div className="font-medium">{planMeta.recommendationsEnabled ? 'Enabled' : 'Paid plans only'}</div>
              </div>
            </div>
          )}

          <div className="mt-6">
            <div className="text-sm font-semibold mb-2">Billing History</div>
            {loading ? (
              <div className={`p-3 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>Loading...</div>
            ) : history.length ? (
              <div className="space-y-3">
                {history.map((h) => {
                  const id = h.invoiceId || h.startAt || `${h.plan}-${h.createdAt}`;
                  const isOpen = expandedId === id;
                  return (
                    <div key={id} className={`rounded-lg border p-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <div className="text-sm opacity-70">{h.plan?.toUpperCase() || 'PLAN'}</div>
                          <div className="font-semibold">{typeof h.amount === 'number' ? new Intl.NumberFormat('en-IN',{ style:'currency', currency: h.currency || 'INR' }).format(h.amount) : '—'}</div>
                          <div className="text-xs opacity-70">Invoice: {h.invoiceId || '—'}</div>
                        </div>
                        <div className="text-sm">
                          <div>Start: {h.startAt ? new Date(h.startAt).toLocaleDateString() : '—'}</div>
                          <div>End: {h.endAt ? new Date(h.endAt).toLocaleDateString() : '—'}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded text-xs ${h.status==='active' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>{h.status || '—'}</span>
                          <button
                            type="button"
                            onClick={() => setExpandedId(isOpen ? null : id)}
                            className={`text-sm font-medium ${isDarkMode ? 'text-orange-300' : 'text-[#ff8200]'}`}
                          >
                            {isOpen ? 'View less' : 'View more'}
                          </button>
                        </div>
                      </div>
                      {isOpen && (
                        <div className={`mt-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          <div>Payment ID: <span className="font-mono">{h.paymentId || '—'}</span></div>
                          <div>Order ID: <span className="font-mono">{h.orderId || '—'}</span></div>
                          <div>Created: {h.createdAt ? new Date(h.createdAt).toLocaleString() : '—'}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={`p-3 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>No history yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

SubscriptionSnapshot.propTypes = { isDarkMode: PropTypes.bool };
