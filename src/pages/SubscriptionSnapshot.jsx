import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import usePlanMeta from '../hooks/usePlanMeta';
import { getSubscriptionHistory } from '../api';

export default function SubscriptionSnapshot({ isDarkMode = false }) {
  const [company, setCompany] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const email = company?.email;
  const { planMeta, refreshPlanMeta } = usePlanMeta(email || null);

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
                <div className="font-medium">{planMeta.endsAt ? planMeta.endsAt.toLocaleDateString() : '—'}</div>
              </div>
              <div className={`p-3 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="opacity-70">Active jobs</div>
                <div className="font-medium">{planMeta.used} / {planMeta.limit}</div>
              </div>
            </div>
          )}

          <div className="mt-6">
            <div className="text-sm font-semibold mb-2">Billing History</div>
            {loading ? (
              <div className={`p-3 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>Loading...</div>
            ) : history.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      <th className="text-left py-2 pr-4">Invoice</th>
                      <th className="text-left py-2 pr-4">Plan</th>
                      <th className="text-left py-2 pr-4">Amount</th>
                      <th className="text-left py-2 pr-4">Start</th>
                      <th className="text-left py-2 pr-4">End</th>
                      <th className="text-left py-2 pr-4">Status</th>
                      <th className="text-left py-2 pr-4">Payment ID</th>
                      <th className="text-left py-2 pr-4">Order ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.invoiceId || h.startAt || Math.random()} className={isDarkMode ? 'border-t border-gray-700' : 'border-t border-gray-200'}>
                        <td className="py-2 pr-4 font-mono">{h.invoiceId || '—'}</td>
                        <td className="py-2 pr-4">{h.plan}</td>
                        <td className="py-2 pr-4">{typeof h.amount === 'number' ? new Intl.NumberFormat('en-IN',{ style:'currency', currency: h.currency || 'INR' }).format(h.amount) : '—'}</td>
                        <td className="py-2 pr-4">{h.startAt ? new Date(h.startAt).toLocaleString() : '—'}</td>
                        <td className="py-2 pr-4">{h.endAt ? new Date(h.endAt).toLocaleString() : '—'}</td>
                        <td className="py-2 pr-4">
                          <span className={`px-2 py-0.5 rounded text-xs ${h.status==='active' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>{h.status || '—'}</span>
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs">{h.paymentId || '—'}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{h.orderId || '—'}</td>
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
      </div>
    </div>
  );
}

SubscriptionSnapshot.propTypes = { isDarkMode: PropTypes.bool };
