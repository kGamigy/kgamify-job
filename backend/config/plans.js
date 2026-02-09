// Subscription plan definitions and helpers
// Durations expressed in days. Free plan has no expiration (durationDays = 0)

const plans = Object.freeze({
  free: Object.freeze({
    id: 'free',
    label: 'Free',
    durationDays: 0, // indefinite until upgraded
    jobLimit: 3,
    recommendations: false
  }),
  paid3m: Object.freeze({
    id: 'paid3m',
    label: '3 Months',
    durationDays: 90,
    jobLimit: 15,
    recommendations: true
  }),
  paid6m: Object.freeze({
    id: 'paid6m',
    label: '6 Months',
    durationDays: 180,
    jobLimit: 20,
    recommendations: true
  }),
  paid12m: Object.freeze({
    id: 'paid12m',
    label: '12 Months',
    durationDays: 365,
    jobLimit: 30,
    recommendations: true
  })
});

function getPlan(id) {
  return plans[id] || null;
}

function computeSubscriptionDates(startDate = new Date(), planId) {
  const plan = getPlan(planId);
  if (!plan) return null;
  const startedAt = new Date(startDate);
  let endsAt = null;
  if (plan.durationDays > 0) {
    endsAt = new Date(startedAt.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
  }
  return { startedAt, endsAt };
}

module.exports = { plans, getPlan, computeSubscriptionDates };