import { useEffect, useState, useMemo } from 'react';
import usePlanMeta from '../hooks/usePlanMeta';
import PropTypes from 'prop-types';
import { formatDateDDMMYYYY } from '../utils/date';

/**
 * LimitedAccessBanner
 * Props:
 *  - company: company object
 *  - isDarkMode: boolean
 *  - className: optional extra classes
 *  Behavior:
 *   * Animates progress bar from 0 to computed profileCompletion value
 *   * Provides accessible labels & reduced-motion fallback
 */
export default function LimitedAccessBanner({ company, isDarkMode, $isDarkmode, className = '' }) {
  // Support either new styled-components friendly prop $isDarkmode or legacy isDarkMode
  const effectiveDark = typeof $isDarkmode === 'boolean' ? $isDarkmode : isDarkMode;
  const limitedAccess = typeof window !== 'undefined' && localStorage.getItem('companyLimitedAccess') === 'true';
  const status = company?.status;
  const isPending = status === 'pending';
  const loading = !company; // basic loading flag

  // Fields used by backend completion endpoint (keep in sync with /profile/complete route)
  const COMPLETION_FIELDS = useMemo(() => ([
    'companyName','contactName','website','industry','type','size','phone','address','registrationNumber','description','documents','logo'
  ]), []);

  // Extended heuristic – tolerate varied backend key naming & give a minimum visible sliver when some data exists.
  const { targetCompletion, filledFields, missingFields } = useMemo(() => {
    if (!company) return { targetCompletion: 0, filledFields: [], missingFields: COMPLETION_FIELDS };
    const filled = COMPLETION_FIELDS.filter(f => !!company[f]);
    const missing = COMPLETION_FIELDS.filter(f => !company[f]);
    let pct = Math.round((filled.length / COMPLETION_FIELDS.length) * 100);
    if (typeof company.profileCompletion === 'number' && company.profileCompletion > pct) {
      pct = Math.min(100, Math.round(company.profileCompletion));
    }
    if (pct === 0 && filled.length > 0) pct = 5; // show a sliver
    return { targetCompletion: pct, filledFields: filled, missingFields: missing };
  }, [company, COMPLETION_FIELDS]);

  const [animatedValue, setAnimatedValue] = useState(0);
  useEffect(() => {
  if (!limitedAccess || loading) return;
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) { setAnimatedValue(targetCompletion); return; }
    let frame;
    const start = performance.now();
    const duration = 1100;
    const fromVal = 0;
    const toVal = targetCompletion;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedValue(Math.round(fromVal + (toVal - fromVal) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [targetCompletion, limitedAccess, loading]);

  // Subscription CTA logic
  const needsSubscription = !!limitedAccess && ( !company?.subscriptionPlan || company?.subscriptionStatus !== 'active');

  // Active plan info (even free) when subscriptionStatus === 'active'
  const companyEmail = company?.email;
  const { planMeta } = usePlanMeta(companyEmail, { auto: !!companyEmail });
  const planInfo = useMemo(() => {
    if (!company || company.subscriptionStatus !== 'active') return null;
    if (planMeta) {
      return { plan: planMeta.plan, daysRemaining: planMeta.daysRemaining, limit: planMeta.limit, remaining: planMeta.remaining };
    }
    return null;
  }, [company, planMeta]);

  const [showFieldDetails, setShowFieldDetails] = useState(false);

  if (!limitedAccess) return null;

  return (
    <div
      className={`p-4 rounded-lg border text-sm flex flex-col gap-2 transition-colors ${
        effectiveDark
          ? 'bg-gradient-to-r from-gray-800/70 via-gray-800/60 to-gray-800/50 border-gray-700 text-gray-200'
          : 'bg-yellow-50 border-yellow-200 text-yellow-800'
      } ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="font-semibold flex flex-wrap items-center gap-2 tracking-tight">
        {isPending ? 'Awaiting approval' : 'Access limited'}
        {status && (
          <span
            className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md tracking-wide ${
              effectiveDark ? 'bg-gray-700 text-gray-200' : 'bg-yellow-200 text-yellow-900'
            }`}
          >
            {status}
          </span>
        )}
      </div>
      <div className="leading-snug">
        {isPending ? (
          <>Your company is awaiting admin approval. You can explore the dashboard but <strong>posting jobs is disabled</strong> until approval.</>
        ) : (
          <>Your account access is temporarily limited. Review <a href="/messages" className={`underline font-medium ${effectiveDark ? 'text-[#ffb347]' : 'text-[#ff8200]'}`}>Messages</a> for details.</>
        )}
      </div>
      {!company?.profileCompleted && (
        <div className="mt-1 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <div
                className={`h-2 rounded-full overflow-hidden relative ${
                  effectiveDark ? 'bg-gray-700/80' : 'bg-yellow-100'
                }`}
                aria-label="Profile completion progress bar"
              >
                {loading ? (
                  <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                ) : (
                  <div
                    className={`h-full transition-[width] duration-500 ease-out will-change-[width] ${
                      animatedValue === 100
                        ? 'bg-green-500'
                        : effectiveDark
                          ? 'bg-gradient-to-r from-[#ff8200] via-[#ff9d33] to-[#ffb347]'
                          : 'bg-gradient-to-r from-[#ff8200] to-[#ffb347]'
                    }`}
                    style={{ width: `${animatedValue}%` }}
                  />
                )}
              </div>
              <div className="mt-1 text-[11px] font-medium flex items-center gap-2 select-none">
                <span>{loading ? 'Loading…' : `${animatedValue}% complete`}</span>
                {!loading && animatedValue < 100 && (
                  <span className={effectiveDark ? 'text-gray-400' : 'text-yellow-700'}>Finish profile to speed approval.</span>
                )}
                {!loading && (
                  <button
                    type="button"
                    onClick={() => setShowFieldDetails(s => !s)}
                    className={`ml-auto underline decoration-dotted ${effectiveDark ? 'text-[#ffb347]' : 'text-[#ff8200]'} hover:opacity-80`}
                  >
                    {showFieldDetails ? 'Hide details' : 'Show details'}
                  </button>
                )}
              </div>
            </div>
            <a
              href="/Edit-Registration"
              className={`inline-flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-semibold transition shadow ${
                effectiveDark ? 'bg-[#ff8200] hover:bg-[#e57400] text-white' : 'bg-[#ff8200] hover:bg-[#e57400] text-white'
              }`}
            >
              Complete Profile
            </a>
          </div>
          {showFieldDetails && !loading && (
            <div className={`rounded-md p-2 border text-[11px] leading-relaxed space-y-1 ${effectiveDark ? 'bg-gray-800/40 border-gray-700 text-gray-200' : 'bg-white border-yellow-200 text-yellow-800'}`}> 
              <div className="font-semibold text-[11px]">Field Status</div>
              <div className="flex flex-wrap gap-1">{filledFields.map(f => (
                <span key={f} className={`px-2 py-0.5 rounded-full border ${
                  effectiveDark
                    ? 'bg-green-600/25 border-green-500 text-green-200'
                    : 'bg-green-50 border-green-400 text-green-700 font-medium'
                }`}>{f}</span>
              ))}</div>
              {missingFields.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">{missingFields.map(f => (
                  <span key={f} className={`px-2 py-0.5 rounded-full border ${
                    effectiveDark
                      ? 'bg-red-600/25 border-red-500 text-red-200'
                      : 'bg-red-50 border-red-400 text-red-700 font-medium'
                  }`}>{f}</span>
                ))}</div>
              )}
            </div>
          )}
          {needsSubscription && (
            <div className={`text-xs flex flex-col sm:flex-row sm:items-center gap-2 ${effectiveDark ? 'text-gray-300' : 'text-yellow-800'}`}>
              <span><strong>Upgrade required:</strong> Unlock full posting capacity with a subscription.</span>
              <a
                href="/plans"
                className={`inline-flex px-3 py-1.5 rounded-md font-semibold shadow text-white bg-gradient-to-r from-[#ff8200] to-[#ffb347] hover:from-[#e57400] hover:to-[#ffb347] transition text-xs`}
              >
                Choose Plan
              </a>
            </div>
          )}
        </div>
      )}
      {planInfo && (
        <div className={`mt-2 text-[11px] flex flex-col gap-1 ${effectiveDark ? 'text-gray-300' : 'text-yellow-800'}`}>
          {planInfo.plan === 'free' ? (
            <span><strong>Free plan is Live.</strong> Job post limit: {planInfo.limit}. Remaining: {planInfo.remaining}.</span>
          ) : (
            <span><strong>{planInfo.plan.charAt(0).toUpperCase()+planInfo.plan.slice(1)} plan active.</strong> {planInfo.daysRemaining !== null ? `${planInfo.daysRemaining} day${planInfo.daysRemaining === 1 ? '' : 's'} remaining.` : 'No expiry.'} Posts remaining: {planInfo.remaining}/{planInfo.limit}.</span>
          )}
          {company?.subscriptionActivatedAt && (
            <span className={effectiveDark ? 'text-gray-400' : 'text-yellow-700'}>
              {(() => {
                const started = formatDateDDMMYYYY(company.subscriptionActivatedAt);
                if (company.subscriptionExpiresAt) {
                  const exp = formatDateDDMMYYYY(company.subscriptionExpiresAt);
                  return `Started: ${started} • Expires: ${exp}`;
                }
                return `Started: ${started}`;
              })()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

LimitedAccessBanner.propTypes = {
  company: PropTypes.object,
  isDarkMode: PropTypes.bool, // legacy prop
  $isDarkmode: PropTypes.bool, // styled-components safe prop name
  className: PropTypes.string
};