import React from 'react';
import PropTypes from 'prop-types';
import Footer from '../components/Footer';

const Support = ({ isDarkMode, $isDarkMode }) => {
  const dark = $isDarkMode ?? isDarkMode;
  return (
    <div className={`${dark ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-800'}`}>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-[#ff8200] mb-4">Contact Support</h1>
        <p className="text-lg mb-6 max-w-prose leading-relaxed">
          Need help? Our support team is here to assist you with technical issues, account concerns,
          and general inquiries related to the kGamify platform.
        </p>
        <div className={`rounded-lg border ${dark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'} p-6 mb-8 shadow-sm`}>
          <h2 className="text-2xl font-semibold mb-3">Reach Us Directly</h2>
          <p className="mb-2">Email: <a href="mailto:support@kgamify.in" className="font-medium text-[#ff8200] underline">support attherate kgamify dot in</a></p>
          <p className="text-sm text-gray-500 dark:text-gray-400">We aim to respond within 24 business hours.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 mb-10">
          <div className={`p-5 rounded-lg border ${dark ? 'border-gray-700 bg-gray-800' : 'border-gray-100 bg-white'} shadow`}> 
            <h3 className="font-semibold mb-2">Common Topics</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Account verification & email issues</li>
              <li>Job posting limitations</li>
              <li>Document uploads & formats</li>
              <li>Company profile edits</li>
            </ul>
          </div>
          <div className={`p-5 rounded-lg border ${dark ? 'border-gray-700 bg-gray-800' : 'border-gray-100 bg-white'} shadow`}> 
            <h3 className="font-semibold mb-2">Helpful Links</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li><a href="/privacy-policy" className="text-[#ff8200] underline">Privacy Policy</a></li>
              <li><a href="/terms-of-service" className="text-[#ff8200] underline">Terms of Service</a></li>
              <li><a href="/cookies" className="text-[#ff8200] underline">Cookie Policy</a></li>
              <li><a href="/plans" className="text-[#ff8200] underline">Subscription Plans</a></li>
            </ul>
          </div>
        </div>
        <div className={`p-5 rounded-lg border ${dark ? 'border-gray-700 bg-gray-800' : 'border-gray-100 bg-white'} shadow mb-16`}>
          <h3 className="font-semibold mb-2">When Contacting Support</h3>
            <p className="text-sm leading-relaxed">Include any relevant screenshots, error messages, and the email associated with your account. This helps us resolve your issue faster.</p>
        </div>
        <div className={`p-5 rounded-lg border ${dark ? 'border-gray-700 bg-gray-800' : 'border-gray-100 bg-white'} shadow mb-16`}>
          <h3 className="font-semibold mb-2">Merchant Legal Entity</h3>
          <div className="text-sm leading-relaxed space-y-2">
            <p><strong>Merchant Legal entity name:</strong> YANTRIKISOFT PRIVATE LIMITED</p>
            <p><strong>Registered Address:</strong> 273, SATRA PLAZA, PLOT 19, SECTOR 19D, VASHI Thane MAHARASHTRA 400703</p>
            <p><strong>Operational Address:</strong> 273, SATRA PLAZA, PLOT 19, SECTOR 19D, VASHI Thane MAHARASHTRA 400703</p>
            <p><strong>Telephone No:</strong> 8879688067</p>
            <p><strong>E-Mail ID:</strong> <a href="mailto:admin@kgamify.in" className="text-[#ff8200] underline">admin@kgamify.in</a></p>
          </div>
        </div>
      </div>
      <Footer isDarkMode={dark} $isDarkMode={dark} />
    </div>
  );
};

Support.propTypes = { isDarkMode: PropTypes.bool, $isDarkMode: PropTypes.bool };

export default Support;
