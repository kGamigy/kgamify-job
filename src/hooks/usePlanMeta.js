import { useEffect, useState, useCallback, useRef } from 'react';
import { getCompanyInfo } from '../api';

// In-memory cache (module scoped)
const memoryCache = new Map(); // email -> { planMeta, timestamp }
const PLAN_LIMITS = { free: 3, paid3m: 15, paid6m: 20, paid12m: 30 };
const TTL_MS = 5 * 60 * 1000; // 5 minutes

function computePlanMeta(company) {
  if (!company) return null;
  const plan = company.subscriptionPlan || 'free';
  const started = company.subscriptionStartedAt ? new Date(company.subscriptionStartedAt) : null;
  const endsAt = company.subscriptionEndsAt ? new Date(company.subscriptionEndsAt) : null;
  // Prefer explicit job limit stored on company, fallback to plan mapping.
  const limit = company.subscriptionJobLimit || PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const used = company.activeJobCount || 0;
  const remaining = Math.max(0, limit - used);
  const daysRemaining = endsAt ? Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;
  // Flags for feature gating
  const adsEnabled = plan === 'free';
  const recommendationsEnabled = plan !== 'free';
  const paid = plan !== 'free';
  return {
    plan,
    started,
    endsAt,
    limit,
    used,
    remaining,
    daysRemaining,
    adsEnabled,
    recommendationsEnabled,
    paid
  };
}

function hydratePlanMeta(meta) {
  if (!meta || typeof meta !== 'object') return meta;
  const started = meta.started ? new Date(meta.started) : null;
  const endsAt = meta.endsAt ? new Date(meta.endsAt) : null;
  return {
    ...meta,
    started: started && !isNaN(started.getTime()) ? started : null,
    endsAt: endsAt && !isNaN(endsAt.getTime()) ? endsAt : null
  };
}

export default function usePlanMeta(email, { auto = true } = {}) {
  const [planMeta, setPlanMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const emailRef = useRef(email);
  emailRef.current = email;

  const load = useCallback(async (force = false) => {
    if (!emailRef.current) return null;
    const key = `planMeta::${emailRef.current}`;
    const now = Date.now();
    if (!force) {
      const mem = memoryCache.get(emailRef.current);
      if (mem && (now - mem.timestamp) < TTL_MS) {
        const hydrated = hydratePlanMeta(mem.planMeta);
        setPlanMeta(hydrated);
        return hydrated;
      }
      try {
        const raw = sessionStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.timestamp && (now - parsed.timestamp) < TTL_MS) {
            const hydrated = hydratePlanMeta(parsed.planMeta);
            memoryCache.set(emailRef.current, { planMeta: hydrated, timestamp: parsed.timestamp });
            setPlanMeta(hydrated);
            return hydrated;
          }
        }
      } catch { /* ignore */ }
    }
    setLoading(true); setError('');
    try {
      const company = await getCompanyInfo(emailRef.current);
      const meta = computePlanMeta(company);
      setPlanMeta(meta);
      const payload = { planMeta: meta, timestamp: Date.now() };
      memoryCache.set(emailRef.current, payload);
      try { sessionStorage.setItem(key, JSON.stringify(payload)); } catch { /* ignore */ }
      return meta;
    } catch (e) {
      setError(e?.message || 'Failed to load plan meta');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (auto && email) { load(false); } }, [email, auto, load]);

  return { planMeta, loading, error, refreshPlanMeta: (force = true) => load(force) };
}

export { computePlanMeta };