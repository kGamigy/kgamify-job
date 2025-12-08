import PropTypes from 'prop-types';
import Klogo from '../assets/KLOGO.png';
import { FaLinkedinIn, FaInstagram, FaFacebookF, FaXTwitter } from 'react-icons/fa6';

function Footer({ isDarkMode, $isDarkMode }) {
  const dark = $isDarkMode ?? isDarkMode;
  const linkCls = "text-gray-300 hover:text-white transition-colors";
  const sectionTitle = "text-white font-semibold mb-3";
  const year = new Date().getFullYear();
  return (
    <footer className={`${dark ? 'bg-[#0f172a] text-gray-100' : 'bg-[#0f172a] text-gray-100'} mt-8 border-t border-white`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Top: responsive grid (3 equal columns on lg) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 gap-y-12 items-start">
          {/* Brand + About */}
          <div>
            <div className="flex items-center gap-3">
              <img src={Klogo} alt="kGamify" className="w-12 h-12 rounded" />
              <div className="text-xl font-semibold">kGamify</div>
            </div>
            <p className="mt-4 text-gray-300 leading-relaxed max-w-prose">
              Transforming knowledge and skill-building through the power of gamification — making it fun, competitive, and rewarding.
            </p>
            <div className="mt-4 flex items-center gap-3 text-gray-300">
              <a href="https://www.linkedin.com/company/kgamify" target="_blank" rel="noreferrer" aria-label="LinkedIn" className="p-2 rounded bg-white/5 hover:bg-white/10"><FaLinkedinIn /></a>
              <a href="https://www.instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram" className="p-2 rounded bg-white/5 hover:bg-white/10"><FaInstagram /></a>
              <a href="https://www.facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook" className="p-2 rounded bg-white/5 hover:bg-white/10"><FaFacebookF /></a>
              <a href="https://twitter.com" target="_blank" rel="noreferrer" aria-label="X" className="p-2 rounded bg-white/5 hover:bg-white/10"><FaXTwitter /></a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <div className={sectionTitle}>Quick Links</div>
            <ul className="space-y-2">
              <li><a className={linkCls} href="/">Home</a></li>
              <li><a className={linkCls} href="/features">Feature</a></li>
              <li><a className={linkCls} href="/gallery">Gallery</a></li>
              <li><a className={linkCls} href="/contact">Contact</a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <div className={sectionTitle}>Support</div>
            <ul className="space-y-2">
              <li><a className={linkCls} href="/help">Help Center</a></li>
              <li><a className={linkCls} href="/support">Contact Support</a></li>
              <li><a className={linkCls} href="/privacy-policy">Privacy Policy</a></li>
              <li><a className={linkCls} href="/terms-of-service?from=login">Terms of Service</a></li>
              <li><a className={linkCls} href="/cookies?from=login">Cookie Policy</a></li>
              <li><a className={linkCls} href="/cancellations-refunds">Cancellations & Refunds</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 flex flex-col sm:flex-row gap-3 items-center justify-between text-sm text-gray-300">
          <p>© {year} Yantrikisoft. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a className={linkCls} href="/privacy-policy?from=login">Privacy Policy</a>
            <span className="opacity-30">|</span>
            <a className={linkCls} href="/terms-of-service?from=login">Terms of Service</a>
            <span className="opacity-30">|</span>
            <a className={linkCls} href="/cookies?from=login">Cookie Policy</a>
            <span className="opacity-30">|</span>
            <a className={linkCls} href="/support">Support</a>
            <span className="opacity-30">|</span>
            <a className={linkCls} href="/cancellations-refunds">Cancellations & Refunds</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

Footer.propTypes = {
  isDarkMode: PropTypes.bool,
  $isDarkMode: PropTypes.bool
};

export default Footer;
