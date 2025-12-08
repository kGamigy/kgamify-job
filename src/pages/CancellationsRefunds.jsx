import PropTypes from 'prop-types';

export default function CancellationsRefunds({ isDarkMode = false }) {
  const dark = isDarkMode;
  return (
    <div className={`min-h-screen ${dark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      <div className={`w-full ${dark ? 'bg-gray-800' : 'bg-white'} border-b ${dark ? 'border-gray-700' : 'border-gray-200'} py-10 mb-8`}> 
        <div className="max-w-5xl mx-auto px-4">
          <h1 className="text-3xl font-extrabold">Cancellations & Refunds</h1>
          <p className="mt-2 text-sm opacity-80">Our policy for subscription plan cancellations and refunds.</p>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 pb-20">
        <div className={`${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-2xl p-6 shadow-sm`}>
          <h2 className="text-xl font-semibold mb-3">Eligibility</h2>
          <ul className="list-disc ml-6 space-y-2 text-sm">
            <li>You can request a cancellation and refund within <strong>48 hours</strong> of buying a plan.</li>
            <li>After 48 hours, <strong>no refund</strong> will be provided.</li>
            <li>Refunds, when approved, typically take <strong>7 to 14 days</strong> to be credited back to your account.</li>
          </ul>

          <h2 className="text-xl font-semibold mt-6 mb-3">How to Request</h2>
          <p className="text-sm">Please email our support team from your registered company email with the subject “Cancellation & Refund Request”. Include your <strong>company name</strong>, <strong>registered email</strong>, <strong>plan</strong>, and <strong>payment reference</strong>.</p>
          <div className={`mt-3 p-3 rounded ${dark ? 'bg-gray-700' : 'bg-gray-100'}`}>
            <div className="text-sm">Official email: <a href="mailto:support@kgamify.com" className="font-semibold text-[#ff8200]">support@kgamify.com</a></div>
          </div>

          <h2 className="text-xl font-semibold mt-6 mb-3">Important Notes</h2>
          <ul className="list-disc ml-6 space-y-2 text-sm">
            <li>Refunds are <strong>non-transferable</strong> and applied to the original payment method wherever possible.</li>
            <li>We may decline refunds in cases of <strong>policy violations</strong>, <strong>fraud</strong>, or <strong>excessive usage</strong> within the refund window.</li>
            <li>Subscription time already consumed is not recoverable; upon cancellation, access is revoked and plan changes take effect immediately.</li>
            <li>Taxes, bank fees, or gateway charges may affect net credit amounts.</li>
          </ul>

          <h2 className="text-xl font-semibold mt-6 mb-3">Contact</h2>
          <p className="text-sm">For any questions, please reach out to our support at <a href="mailto:support@kgamify.com" className="font-semibold text-[#ff8200]">support@kgamify.com</a>.</p>
        </div>
      </div>
    </div>
  );
}

CancellationsRefunds.propTypes = { isDarkMode: PropTypes.bool };
