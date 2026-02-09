import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setSubscription } from '../store/slices/subscriptionSlice';
import extractSubscriptionSnapshot from '../utils/subscriptionSnapshot';
import { useNavigate, Link } from 'react-router-dom';
import { FaEye, FaEyeSlash, FaSpinner, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import Klogo from '../assets/KLOGO.png';
import SplitText from '../components/SplitText.jsx';
import { loginCompany, resendSignupOtp } from '../api';
import PropTypes from 'prop-types';
import { quickEmail, quickPassword } from '../utils/validation';

const Login = ({ setLoggedInEmail }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [formData, setFormData] = useState({
    // Load identifier from persistent rememberMe (localStorage) first, else session for this tab
    identifier: localStorage.getItem("rememberedIdentifier") || sessionStorage.getItem('loginIdentifier') || "",
    password: "",
  });
  // rememberMe: persistent across browser restarts
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem("rememberedEmail"));
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [touched, setTouched] = useState({});
  // Email verification flow state
  const [needsVerification, setNeedsVerification] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [otpResendTimer, setOtpResendTimer] = useState(0);
  const [otpResendLoading, setOtpResendLoading] = useState(false);

  // Real-time validation via shared validators
  const runValidation = (field, value) => {
    if (field === 'identifier') {
      // Allow username OR email; treat presence as required, validate email format only if it contains '@'
      if (!value) return 'Username or Email is required';
      if (value.includes('@')) {
        const err = quickEmail(value);
        return err; // quickEmail returns message or null
      }
      return null;
    }
    if (field === 'password') {
      return quickPassword(value, 6);
    }
    return null;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prevDetails) => ({
      ...prevDetails,
      [name]: value,
    }));
    // For identifier field, always store the in-progress value in sessionStorage so a refresh keeps it (even if not yet logged in)
    if (name === 'identifier') {
      try { sessionStorage.setItem('loginIdentifier', value); } catch { /* ignore quota errors */ }
    }
    
    // Clear error message when user starts typing
    if (errorMessage) setErrorMessage("");
    
    // Real-time validation
    if (touched[name]) {
      const err = runValidation(name, value);
      setValidationErrors(prev => ({ ...prev, [name]: err }));
    }
  };

  const handleBlur = (event) => {
    const { name, value } = event.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    
    const err = runValidation(name, value);
    setValidationErrors(prev => ({ ...prev, [name]: err }));
  };

  const handleRememberMeChange = (event) => {
    const checked = event.target.checked;
    setRememberMe(checked);
    // If user just enabled rememberMe and has typed an identifier, persist it immediately
    if (checked && formData.identifier) {
      try { localStorage.setItem('rememberedIdentifier', formData.identifier); } catch { /* ignore */ }
    } else if (!checked) {
      // User disabled rememberMe: remove persistent identifier/email, keep session copy
      localStorage.removeItem('rememberedIdentifier');
      localStorage.removeItem('rememberedEmail');
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Password strength indicator (for future registration forms)
  // password strength reserved for future use

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage(""); // Clear previous errors
    
    // Validate all fields
    const identifierErr = runValidation('identifier', formData.identifier);
    const passwordErr = runValidation('password', formData.password);
    const merged = { identifier: identifierErr, password: passwordErr };
    const hasErrors = Object.values(merged).some(Boolean);
    if (hasErrors) {
      setValidationErrors(merged);
      setTouched({ identifier: true, password: true });
      return;
    }
    
    setIsLoading(true);
    try {
  const response = await loginCompany({ identifier: formData.identifier, password: formData.password });
      
      if (response.success) {
        // Persist limited access flag (pending or hold) for UI banners
        if (response.limitedAccess) {
          localStorage.setItem('companyLimitedAccess', 'true');
        } else {
          localStorage.removeItem('companyLimitedAccess');
        }
        // If email not verified, block normal login and trigger resend
        if (response.company && response.company.emailVerified === false) {
          setNeedsVerification(true);
          setPendingEmail(response.company.email || formData.identifier);
          setErrorMessage("Your email is not verified. Limited features until verification.");
          // Fire OTP resend silently (best-effort)
          try {
            setOtpResendLoading(true);
            await resendSignupOtp(response.company.email || formData.identifier);
            setOtpResendTimer(60);
          } catch { /* ignore */ } finally { setOtpResendLoading(false); }
          // Persist flag so dashboard can show banner
          localStorage.setItem('companyNeedsEmailVerification', 'true');
          localStorage.setItem('pendingVerifyEmail', response.company.email || formData.identifier);
        } else {
          localStorage.removeItem('companyNeedsEmailVerification');
          localStorage.removeItem('pendingVerifyEmail');
        }
        if (rememberMe) {
          // Persistent storage (long-lived)
          try { localStorage.setItem("rememberedIdentifier", formData.identifier); } catch { /* ignore */ }
          if (response.company?.email) {
            try { localStorage.setItem("rememberedEmail", response.company.email); } catch { /* ignore */ }
          }
        } else {
          // Session-only: keep identifier/email in sessionStorage for refresh within this tab
          try { sessionStorage.setItem('loginIdentifier', formData.identifier); } catch { /* ignore */ }
          if (response.company?.email) {
            try { sessionStorage.setItem('sessionEmail', response.company.email); } catch { /* ignore */ }
          }
          localStorage.removeItem("rememberedIdentifier");
          localStorage.removeItem("rememberedEmail");
        }
        setLoggedInEmail(response.company?.email || "");
        localStorage.setItem('companyType', response.type);
        if (response.token) {
          if (rememberMe) {
            localStorage.setItem('companyToken', response.token);
          } else {
            // Store token only for current session
            try { sessionStorage.setItem('companyToken', response.token); } catch { /* ignore */ }
          }
        }
        // Capture subscription snapshot (if provided by backend company object)
        if (response.company) {
          try { dispatch(setSubscription(extractSubscriptionSnapshot(response.company))); } catch { /* ignore dispatch errors */ }
          try {
            const existing = JSON.parse(localStorage.getItem('companyData') || 'null');
            const merged = { ...(existing||{}), ...response.company };
            localStorage.setItem('companyData', JSON.stringify(merged));
          } catch { /* ignore */ }
        }
        navigate("/dashboard");
      }
    } catch (error) {
      const errText = error?.error || error?.message || '';
      if (errText === 'Verify your email first' || /not verified/i.test(errText)) {
        setErrorMessage("Your email is not verified. Please check your inbox for the OTP.");
        setNeedsVerification(true);
        setPendingEmail(formData.identifier);
      } else if (/on hold/i.test(errText) || /not approved/i.test(errText)) {
        // Treat pending/hold as informational, not blocking
        localStorage.setItem('companyLimitedAccess','true');
        setErrorMessage("Your company is awaiting approval. You can explore the dashboard, but posting jobs is disabled until approval.");
        // Auto navigate after a brief delay to show message context
        setTimeout(()=>navigate('/dashboard'), 600);
      } else if (errText === 'Invalid credentials' || /invalid email or password/i.test(errText) || /invalid.*password/i.test(errText)) {
        setErrorMessage("Invalid username/email or password. Please try again.");
      } else if (/company not found/i.test(errText)) {
        setErrorMessage("Company not found. Please register first.");
      } else if (errText) {
        setErrorMessage(errText);
      } else {
        setErrorMessage("An error occurred during login. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (otpResendTimer <= 0) return;
    const t = setTimeout(() => setOtpResendTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [otpResendTimer]);

  const handleResend = async () => {
    if (!pendingEmail || otpResendTimer > 0) return;
    try {
      setOtpResendLoading(true);
      await resendSignupOtp(pendingEmail);
      setOtpResendTimer(60);
      setErrorMessage("OTP resent. Please verify your email.");
    } catch (err) {
      setErrorMessage(err.message || 'Failed to resend OTP. Try again shortly.');
    } finally {
      setOtpResendLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center py-8 px-2 sm:px-6 lg:px-8 relative overflow-hidden"
    >
      {/* Modern animated gradient background with subtle pattern overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "linear-gradient(120deg, #fff7e6 0%, #ffecd2 40%, #ffe3b3 100%)",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 80% 20%, #ffb34733 0%, transparent 60%), radial-gradient(circle at 20% 80%, #ff820033 0%, transparent 60%)",
            opacity: 0.7,
          }}
        />
        <div
          className="absolute inset-0 animate-gradient-move"
          style={{
            background:
              "linear-gradient(120deg, #ffecd2 0%, #ffb347 100%)",
            opacity: 0.15,
            mixBlendMode: "multiply",
          }}
        />
        <style>
          {`
            @keyframes gradient-move {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            .animate-gradient-move {
              background-size: 200% 200%;
              animation: gradient-move 10s ease-in-out infinite;
            }
            /* Hide native Edge password reveal/clear to avoid double eye */
            input.hide-native-reveal::-ms-reveal,
            input.hide-native-reveal::-ms-clear {
              display: none;
            }
          `}
        </style>
      </div>
  <div className="w-full max-w-md mx-auto rounded-3xl shadow-2xl border bg-white border-orange-200 p-6 sm:p-10 relative z-10">
        {/* Logo Section */}
        <div className="text-center mb-6">
          <img
            src={Klogo}
            alt="kGamify Logo"
            className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-2 sm:mb-3 object-contain drop-shadow-lg"
          />
          <SplitText
            text="Welcome Back"
            tag="h1"
            className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#ff8200] to-[#ffb347] bg-clip-text text-transparent drop-shadow-lg mb-1"
            delay={80}
            duration={0.5}
            ease="power3.out"
            splitType="chars"
            from={{ opacity: 0, y: 30 }}
            to={{ opacity: 1, y: 0 }}
            threshold={0.05}
            rootMargin="-50px"
            scroll={false}
            charClassName="bg-gradient-to-r from-[#ff8200] to-[#ffb347] bg-clip-text text-transparent"
          />
          <p className="text-black text-base sm:text-lg">
            Sign in to your kGamify account
          </p>
        </div>

        {/* Login Form Card */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username or Email Field */}
          <div>
            <label className="block font-semibold text-black mb-2">
              Username or Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                name="identifier"
                value={formData.identifier}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Enter your username or email address"
                autoComplete="username email"
                className={`w-full px-4 py-3 rounded-xl border text-base font-medium bg-white border-gray-900 text-black focus:ring-2 focus:ring-[#ff8200] outline-none transition ${
                  validationErrors.identifier
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                    : touched.identifier && !validationErrors.identifier
                      ? 'border-green-500 focus:ring-green-500 focus:border-green-500'
                      : ''
                } caret-black placeholder-gray-400`}
                aria-describedby={validationErrors.identifier ? "identifier-error" : undefined}
                required
                style={{ color: '#111', background: '#fff', caretColor: '#111' }}
              />
              {touched.identifier && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  {validationErrors.identifier ? (
                    <FaTimesCircle className="text-red-500" />
                  ) : (
                    <FaCheckCircle className="text-green-500" />
                  )}
                </div>
              )}
            </div>
            {validationErrors.identifier && (
              <p id="identifier-error" className="mt-1 text-sm text-red-600" role="alert">
                {validationErrors.identifier}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label className="block font-semibold text-black mb-2">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Enter your password"
                autoComplete="current-password"
                className={`w-full px-4 py-3 rounded-xl border text-base font-medium bg-white border-gray-900 text-black focus:ring-2 focus:ring-[#ff8200] outline-none transition hide-native-reveal ${
                  validationErrors.password
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                    : touched.password && !validationErrors.password
                      ? 'border-green-500 focus:ring-green-500 focus:border-green-500'
                      : ''
                } caret-black placeholder-gray-400`}
                aria-describedby={validationErrors.password ? "password-error" : undefined}
                required
                style={{ WebkitTextSecurity: showPassword ? 'none' : 'disc', color: '#111', background: '#fff', caretColor: '#111' }}
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-black hover:text-[#ff8200] focus:outline-none transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {validationErrors.password && (
              <p id="password-error" className="mt-1 text-sm text-red-600" role="alert">
                {validationErrors.password}
              </p>
            )}
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={handleRememberMeChange}
                className="w-4 h-4 text-[#ff8200] bg-white border-gray-900 rounded focus:ring-[#ff8200] focus:ring-2"
              />
              <span className="ml-2 text-sm text-black">
                Remember me
              </span>
            </label>
            <Link
              to="/forgot-password"
              className="text-sm text-[#ff8200] hover:text-[#e57400] font-semibold transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          {/* Error / Info Message */}
          {errorMessage && (
            <div className={`border rounded-lg p-3 ${needsVerification ? 'bg-amber-50/90 border-amber-300' : 'bg-red-50/90 border-red-200'}`} role="alert">
              <p className={`text-sm font-medium ${needsVerification ? 'text-amber-700' : 'text-red-600'}`}>{errorMessage}</p>
              {needsVerification && pendingEmail && (
                <div className="mt-2 text-xs text-amber-700 space-y-1">
                  <p>Please open the verification email we sent to <span className="font-semibold">{pendingEmail}</span> and enter the OTP on the verification page.</p>
                  <p>If you didn&apos;t receive it, you can resend below.</p>
                  <button type="button" onClick={handleResend} disabled={otpResendTimer>0 || otpResendLoading} className="inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold bg-[#ff8200] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#e57400] transition">
                    {otpResendLoading ? <><FaSpinner className="animate-spin mr-1"/>Sending...</> : otpResendTimer>0 ? `Resend in ${otpResendTimer}s` : 'Resend OTP'}
                  </button>
                  <a href={`/verify-email?email=${encodeURIComponent(pendingEmail)}`} className="inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition">Verify Email</a>
                  <p className="text-[11px] text-amber-600">Still stuck? Check spam, or register again to receive a fresh code.</p>
                </div>
              )}
            </div>
          )}

          {/* Login Button */}
          <button
            type="submit"
            disabled={isLoading || otpResendLoading}
            className="w-full py-3 rounded-xl font-bold text-lg shadow-lg transition duration-300 bg-gradient-to-r from-[#ff8200] to-[#ffb347] text-white hover:from-[#e57400] hover:to-[#ffb347] flex items-center justify-center disabled:opacity-70"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <FaSpinner className="animate-spin mr-2" />
                Signing in...
              </span>
            ) : needsVerification ? 'Awaiting Verification' : 'Sign In'}
          </button>

          {/* Terms & Policies */}
          <p className="text-[12px] leading-5 text-center text-black/70">
            By signing in, you agree to our
            {' '}<a
              href="/terms-of-service?from=login"
              className="text-[#ff8200] hover:text-[#e57400] font-semibold"
            >
              Terms of Service
            </a>
            {' '}and acknowledge our{' '}
            <a
              href="/privacy-policy?from=login"
              className="text-[#ff8200] hover:text-[#e57400] font-semibold"
            >
              Privacy Policy
            </a>
            {' '}and{' '}
            <a
              href="/cookies?from=login"
              className="text-[#ff8200] hover:text-[#e57400] font-semibold"
            >
              Cookie Policy
            </a>.
            {' '}For support, visit{' '}
            <a
              href="/support"
              className="text-[#ff8200] hover:text-[#e57400] font-semibold"
            >
              Contact Us
            </a>.
          </p>

          {/* Register Link */}
          <div className="text-center pt-4 border-t border-gray-200/50">
            <p className="text-black text-sm">
              Don&apos;t have an account?{" "}
              <Link
                to="/register"
                className="text-[#ff8200] hover:text-[#e57400] font-semibold transition-colors"
              >
                Create account
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;

Login.propTypes = {
  setLoggedInEmail: PropTypes.func,
};

