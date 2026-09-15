import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Crown, Sparkles, Check, X, Loader2,
  CreditCard, Shield, Star, TrendingUp, MessageSquare,
  FileText, Brain, ArrowRight, ChevronDown, ExternalLink
} from 'lucide-react';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: 'forever',
    icon: Star,
    gradient: 'from-slate-500 to-slate-600',
    badge: null,
    description: 'Perfect for getting started',
    features: [
      { text: '5 study documents', included: true },
      { text: 'Images & PDFs (max 10 MB)', included: true },
      { text: 'Short videos (max 25 MB)', included: true },
      { text: 'Paste up to 500 words', included: true },
      { text: 'Speak up to 150 words/session', included: true },
      { text: 'Web & YouTube links (basic)', included: true },
      { text: '3 quizzes / 10 AI chats daily', included: true },
      { text: '10 flashcards per session', included: true },
      { text: 'Priority AI responses', included: false },
      { text: 'Advanced analytics', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 799,
    period: 'month',
    icon: Zap,
    gradient: 'from-indigo-500 to-purple-600',
    badge: 'Most Popular',
    description: 'For serious students',
    features: [
      { text: '50 study documents', included: true },
      { text: 'Files & PDFs (max 50 MB)', included: true },
      { text: 'Lecture videos (max 100 MB)', included: true },
      { text: 'Paste up to 4,000 words', included: true },
      { text: 'Speak up to 1,000 words/session', included: true },
      { text: 'In-depth Web & YouTube scraping', included: true },
      { text: '20 quizzes / 100 AI chats daily', included: true },
      { text: '30 flashcards per session', included: true },
      { text: 'Priority AI responses', included: true },
      { text: 'Priority support', included: true },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 1599,
    period: 'month',
    icon: Crown,
    gradient: 'from-amber-500 to-orange-600',
    badge: 'Best Value',
    description: 'For power users & teams',
    features: [
      { text: 'Unlimited study documents', included: true },
      { text: 'Large files (max 100 MB)', included: true },
      { text: 'HD videos (max 250 MB)', included: true },
      { text: 'Paste up to 15,000 words', included: true },
      { text: 'Unlimited voice dictation', included: true },
      { text: 'Deep YouTube & web transcripts', included: true },
      { text: 'Unlimited quizzes & AI chats', included: true },
      { text: '50 flashcards per session', included: true },
      { text: 'Dedicated GPU Priority AI', included: true },
      { text: 'Advanced analytics & charts', included: true },
    ],
  },
];


const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } },
};

let _razorpayPromise = null;
const loadRazorpay = () => {
  if (window.Razorpay) return Promise.resolve(true);
  if (_razorpayPromise) return _razorpayPromise;
  _razorpayPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      _razorpayPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });
  return _razorpayPromise;
};

const PricingTab = () => {
  const { user, setUser } = useContext(AuthContext);
  const { addToast } = useToast();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showSandboxConfirm, setShowSandboxConfirm] = useState(false);
  const [sandboxPlanId, setSandboxPlanId] = useState(null);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    setLoading(true);
    try {
      const res = await api.get('/subscription');
      setSubscription(res.data);
    } catch (err) {
      addToast('Failed to load subscription data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId) => {
    if (planId === subscription?.plan) return;
    if (planId === 'free') {
      setShowCancelConfirm(true);
      return;
    }

    setUpgrading(planId);
    try {
      const res = await api.post('/payments/create-razorpay-order', { plan: planId });
      
      if (res.data?.sandbox) {
        // Show simulated payment dialog for Sandbox Mode
        setSandboxPlanId(planId);
        setShowSandboxConfirm(true);
      } else {
        const loaded = await loadRazorpay();
        if (!loaded) {
          addToast('Failed to load payment gateway. Check your internet connection.', 'error');
          return;
        }

        const options = {
          key: res.data.key_id,
          amount: res.data.amount,
          currency: res.data.currency,
          name: 'Florix AI',
          description: `Upgrade to ${planId.toUpperCase()}`,
          order_id: res.data.order_id,
          handler: async function (response) {
            setUpgrading(planId);
            try {
              await api.post('/payments/verify-razorpay-payment', {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                plan: planId
              });
              addToast('🎉 Payment successful! Your subscription is now active.', 'success');
              const profile = await api.get('/me');
              if (setUser) setUser(profile.data);
              await fetchSubscription();
            } catch (err) {
              addToast('Payment signature verification failed. Please contact support.', 'error');
            } finally {
              setUpgrading(null);
            }
          },
          prefill: {
            name: user?.name || '',
            email: user?.email || '',
          },
          theme: {
            color: '#6366f1',
          },
          modal: {
            ondismiss: function() {
              addToast('Payment was cancelled.', 'info');
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response) {
          addToast(response?.error?.description || 'Payment was declined. Please try again or use another payment method.', 'error');
        });
        rzp.open();
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      addToast(detail || 'Failed to start payment. Please try again.', 'error');
    } finally {
      setUpgrading(null);
    }
  };

  const handleSandboxSuccess = async () => {
    if (!sandboxPlanId) return;
    setUpgrading(sandboxPlanId);
    setShowSandboxConfirm(false);
    try {
      await api.post('/payments/verify-razorpay-payment', {
        razorpay_payment_id: `pay_sandbox_${Math.random().toString(36).substr(2, 9)}`,
        razorpay_order_id: `order_sandbox_${Math.random().toString(36).substr(2, 9)}`,
        razorpay_signature: 'sandbox_sig',
        plan: sandboxPlanId
      });
      addToast('🎉 Sandbox Payment successful! Subscription active.', 'success');
      const profile = await api.get('/me');
      if (setUser) setUser(profile.data);
      await fetchSubscription();
    } catch (err) {
      addToast('Sandbox verification failed.', 'error');
    } finally {
      setUpgrading(null);
      setSandboxPlanId(null);
    }
  };

  const handleSandboxCancel = () => {
    setShowSandboxConfirm(false);
    addToast('Sandbox Payment was cancelled.', 'info');
    setSandboxPlanId(null);
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await api.post('/subscription/cancel');
      addToast('Plan cancelled. You are now on the Free plan.', 'info');
      setShowCancelConfirm(false);
      await fetchSubscription();
      if (setUser) setUser(prev => ({ ...prev, plan: 'free' }));
    } catch (err) {
      addToast(err.response?.data?.detail || 'Cancellation failed', 'error');
    } finally {
      setCancelling(false);
    }
  };


  const currentPlan = subscription?.plan || 'free';
  const usage = subscription?.usage || {};
  const limits = subscription?.limits || {};

  const userCountry = localStorage.getItem('user_country') || 'India';
  const isIndia = userCountry.toLowerCase() === 'india';
  const currencySymbol = isIndia ? '₹' : '$';

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="max-w-5xl mx-auto pb-20 space-y-8 px-2"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="text-center pt-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-full mb-4">
          <Sparkles size={14} className="text-indigo-500" />
          <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Subscription & Plans</span>
        </div>
        <h2 className="text-4xl font-extrabold text-slate-800 dark:text-white mb-3">
          Choose Your Plan
        </h2>
        <p className="text-slate-500 dark:text-zinc-400 text-lg max-w-2xl mx-auto">
          Unlock your full learning potential with Florix AI Pro and Premium plans.
        </p>
      </motion.div>

      {/* Sandbox Mode Active Warning */}
      {!loading && subscription?.razorpay_enabled === false && (
        <motion.div
          variants={itemVariants}
          className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-3xl p-5 flex items-center justify-between gap-4 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center shrink-0">
              <Shield size={22} className="text-amber-500" />
            </div>
            <div>
              <p className="font-extrabold text-base">🛠️ Razorpay Sandbox Mode Active</p>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                Razorpay credentials are not set up. Upgrading is completely **free**! Click any plan below to open the Sandbox Simulator and instantly upgrade.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Current Plan Badge */}
      {!loading && (
        <motion.div
          variants={itemVariants}
          className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200/60 dark:border-indigo-500/20 rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Crown size={22} className="text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium">Current Plan</p>
              <p className="text-xl font-extrabold text-slate-800 dark:text-white capitalize">{currentPlan} Plan</p>
            </div>
          </div>

          {/* Usage bars */}
          <div className="flex gap-6 text-sm flex-wrap">
            <div className="text-center">
              <p className="font-bold text-slate-700 dark:text-zinc-200">
                {usage.sessions ?? 0}
                {limits.sessions !== -1 && <span className="text-slate-400 font-normal">/{limits.sessions}</span>}
              </p>
              <p className="text-slate-400 dark:text-zinc-500 text-xs">Documents</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-700 dark:text-zinc-200">
                {usage.quizzes_today ?? 0}
                {limits.quizzes_per_day !== -1 && <span className="text-slate-400 font-normal">/{limits.quizzes_per_day}</span>}
              </p>
              <p className="text-slate-400 dark:text-zinc-500 text-xs">Quizzes today</p>
            </div>
          </div>

          {subscription?.plan_expires_at && (
            <div className="text-sm text-slate-500 dark:text-zinc-400">
              Renews {new Date(subscription.plan_expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          )}
        </motion.div>
      )}

      {/* Pricing Cards */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={36} className="animate-spin text-indigo-500" />
        </div>
      ) : (
        <motion.div variants={itemVariants} className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = currentPlan === plan.id;
            const isUpgrading = upgrading === plan.id;

            return (
              <motion.div
                key={plan.id}
                whileHover={{ y: -6 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className={`relative flex flex-col bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl border shadow-xl overflow-hidden transition-all duration-300 ${
                  isCurrent
                    ? 'border-indigo-500 shadow-indigo-500/20 dark:shadow-indigo-500/10'
                    : plan.badge === 'Most Popular'
                    ? 'border-purple-400/50 dark:border-purple-500/30 shadow-purple-500/10'
                    : 'border-slate-200/60 dark:border-zinc-800/60 shadow-slate-200/20 dark:shadow-none'
                }`}
              >
                {/* Top gradient bar */}
                <div className={`h-1.5 bg-gradient-to-r ${plan.gradient}`} />

                {/* Badge */}
                {plan.badge && (
                  <div className={`absolute top-4 right-4 px-3 py-1 bg-gradient-to-r ${plan.gradient} text-white text-xs font-bold rounded-full shadow-lg`}>
                    {plan.badge}
                  </div>
                )}

                <div className="p-6 flex flex-col flex-1">
                  {/* Plan header */}
                  <div className={`w-12 h-12 bg-gradient-to-br ${plan.gradient} rounded-2xl flex items-center justify-center shadow-lg mb-4`}>
                    <Icon size={22} className="text-white" />
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-800 dark:text-white">{plan.name}</h3>
                  <p className="text-slate-500 dark:text-zinc-400 text-sm mb-4">{plan.description}</p>

                  {/* Price */}
                  <div className="mb-6">
                    <span className="text-4xl font-black text-slate-800 dark:text-white">
                      {plan.id === 'free'
                        ? 'Free'
                        : `${currencySymbol}${isIndia ? (plan.id === 'pro' ? 799 : 1599) : (plan.id === 'pro' ? 9 : 19)}`}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-slate-400 dark:text-zinc-500 text-sm ml-1">/ {plan.period}</span>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 flex-1 mb-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2.5">
                        {feature.included ? (
                          <Check size={16} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
                        ) : (
                          <X size={16} className="text-slate-300 dark:text-zinc-600 shrink-0" />
                        )}
                        <span className={`text-sm ${feature.included ? 'text-slate-700 dark:text-zinc-200' : 'text-slate-400 dark:text-zinc-600'}`}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={isCurrent || isUpgrading}
                    className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                      isCurrent
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 cursor-default'
                        : `bg-gradient-to-r ${plan.gradient} text-white shadow-lg hover:shadow-xl hover:shadow-indigo-500/20 disabled:opacity-60`
                    }`}
                  >
                    {isUpgrading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : isCurrent ? (
                      <><Check size={16} strokeWidth={2.5} /> Current Plan</>
                    ) : plan.id === 'free' ? (
                      'Downgrade to Free'
                    ) : (
                      <>Upgrade to {plan.name} <ArrowRight size={16} /></>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-zinc-800"
            >
              <div className="w-14 h-14 bg-red-100 dark:bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <X size={28} className="text-red-500" />
              </div>
              <h3 className="text-2xl font-extrabold text-center text-slate-800 dark:text-white mb-2">Cancel Plan?</h3>
              <p className="text-slate-500 dark:text-zinc-400 text-center mb-6">
                You'll lose access to {currentPlan.toUpperCase()} features immediately and revert to the Free plan (5 documents, 3 quizzes/day).
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 py-3.5 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Keep Plan
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 py-3.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {cancelling ? <Loader2 size={16} className="animate-spin" /> : 'Cancel Plan'}
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sandbox Confirmation Modal */}
      <AnimatePresence>
        {showSandboxConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-zinc-800"
            >
              <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield size={28} className="text-indigo-500" />
              </div>
              <h3 className="text-2xl font-extrabold text-center text-slate-800 dark:text-white mb-2">🛠️ Razorpay Sandbox</h3>
              <p className="text-slate-500 dark:text-zinc-400 text-center mb-6">
                You are in Developer Sandbox Mode. Simulate a successful subscription upgrade or cancel the transaction.
              </p>
              <div className="flex flex-col gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSandboxSuccess}
                  className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors flex items-center justify-center gap-2"
                >
                  Simulate Success Pay
                </motion.button>
                <button
                  onClick={handleSandboxCancel}
                  className="w-full py-3.5 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Cancel Simulation
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Trust Badges */}
      <motion.div variants={itemVariants} className="grid grid-cols-3 gap-4">
        {[
          { icon: Shield, label: 'Secure Payments', sub: 'Razorpay checkout' },
          { icon: CreditCard, label: 'Cancel Anytime', sub: 'No lock-in contracts' },
          { icon: Brain, label: 'Powered by Gemini', sub: 'Google AI infrastructure' },
        ].map((item, i) => (
          <div key={i} className="flex flex-col items-center text-center p-5 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl border border-slate-200/50 dark:border-zinc-800/50 rounded-3xl">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center mb-3">
              <item.icon size={20} className="text-indigo-500" />
            </div>
            <p className="font-bold text-sm text-slate-700 dark:text-zinc-200">{item.label}</p>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">{item.sub}</p>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
};

export default PricingTab;
