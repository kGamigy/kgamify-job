import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import PropTypes from 'prop-types';
import { getCompanyInfo, getCompanyMessages, sendCompanyMessage } from '../api';
import { config } from '../config/env';
import { FaComments } from "react-icons/fa";
import { formatDateDDMMYYYY } from '../utils/date';

export default function Messages({ isDarkMode }) {
  // derive email once
  const [email] = useState(() => {
    const remembered = localStorage.getItem('rememberedEmail');
    if (remembered) return remembered;
    try {
      const cd = JSON.parse(localStorage.getItem('companyData') || 'null');
      return cd?.email || '';
    } catch { return ''; }
  });

  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState([]);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef(null);
  const scrollRef = useRef(null);

  // load company profile
  useEffect(() => {
    (async () => {
      try {
        if (!email) {
          setError('Not logged in');
          setLoading(false);
          return;
        }
        const data = await getCompanyInfo(email);
        setCompany(data);
      } catch (e) {
        setError(e?.response?.data?.error || e.message || 'Failed to load messages');
      } finally {
        setLoading(false);
      }
    })();
  }, [email]);

  const status = company?.status || 'pending';
  const isApproved = status === 'approved' || company?.approved;

  // messages + socket
  useEffect(() => {
    let socket;
    let active = true;
    async function init() {
      if (!company?._id && company?.email) {
        try { const refreshed = await getCompanyInfo(company.email); setCompany(refreshed); } catch { /* ignore refresh errors */ }
      }
      if (!company?._id) return;
      try {
        const data = await getCompanyMessages(company.email); // Remove pagination to get ALL messages
        if (active) {
          const list = Array.isArray(data.messages) ? data.messages : [];
          setMessages(list);
          setTimeout(()=> bottomRef.current?.scrollIntoView({ behavior: 'auto'}), 10);
        }
      } catch (err) {
        if (active) setError(err?.response?.data?.error || err?.message || 'Failed to fetch messages');
      }

      // Connect socket to backend host derived from API_URL (strip trailing /api)
      const backendBase = (config.API_URL || '').replace(/\/?api\/?$/, '');
      socket = io(backendBase || '/', {
        path: '/socket.io',
        withCredentials: true,
        transports: ['websocket'],
        reconnection: true,
      });
      socket.on('connect', () => setConnected(true));
      socket.on('disconnect', () => setConnected(false));
      socket.emit('join', `company:${company._id}`);
      socket.on('message:new', payload => {
        if (payload?.companyId === String(company._id)) {
          setMessages(m => {
            const incoming = payload.message;
            const isDup = incoming?.clientId && m.some(x => x.clientId === incoming.clientId);
            return isDup ? m : [...m, incoming];
          });
          setTimeout(()=> bottomRef.current?.scrollIntoView({ behavior: 'smooth'}), 10);
        }
      });
    }
    init();
    return () => {
      active = false;
      try { socket?.emit('leave', `company:${company?._id}`); socket?.disconnect(); } catch { /* ignore disconnect */ }
    };
  }, [company?._id, company?.email]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if ((!text && (!files || files.length===0)) || !company?.email) return;
    setSending(true);
    try {
      const clientId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const optimistic = { message: text, type: 'info', from: 'company', createdAt: new Date().toISOString(), clientId, attachments: Array.from(files||[]).map(f=>({ name:f.name, size:f.size, type:f.type, url:'about:blank' })) };
      setMessages(m=>[...m, optimistic]);
      setInput('');
      await sendCompanyMessage(company.email, text, files);
      setFiles([]);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-[60vh] flex items-center justify-center ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Loading…</div>
    );
  }
  if (error) {
    const lower = error.toLowerCase?.() || '';
    return (
      <div className={`min-h-[60vh] flex items-center justify-center px-4 text-center ${isDarkMode ? 'text-red-300' : 'text-red-600'}`}>
        <div>
          <div className="font-semibold mb-2">{error}</div>
          {(lower.includes('auth') || lower.includes('token') || lower.includes('login')) && (
            <div className="text-sm opacity-80">Please sign in again and try opening Messages.
              <div className="mt-3">
                <a href="/" className="inline-block px-4 py-2 rounded bg-[#ff8200] text-white text-sm hover:bg-[#e57400]">Go to Login</a>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col items-center ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Gradient header */}
      <div className="w-full bg-gradient-to-r from-[#ff8200] to-[#ffb347] py-10 mb-8 flex flex-col items-center shadow-lg">
        <FaComments className="text-5xl text-white mb-3" />
        <h1 className="text-3xl font-extrabold text-white drop-shadow-lg mb-1">Messages</h1>
        <p className="text-base text-white/90 font-medium">Chat with kGamify admins. Get help, updates, and support.</p>
      </div>
      <div className="w-full max-w-3xl px-4 flex flex-col flex-1">
        {/* Status card */}
        <div className={`p-5 rounded-2xl shadow-xl border mb-6 flex items-center justify-between ${
          status === 'hold'
            ? (isDarkMode? 'bg-yellow-900/20 border-yellow-700 text-yellow-200':'bg-yellow-50 border-yellow-200 text-yellow-900')
            : status === 'denied'
              ? (isDarkMode? 'bg-red-900/20 border-red-700 text-red-200':'bg-red-50 border-red-200 text-red-900')
              : isApproved
                ? (isDarkMode? 'bg-green-900/20 border-green-700 text-green-200':'bg-green-50 border-green-200 text-green-900')
                : (isDarkMode? 'bg-blue-900/20 border-blue-700 text-blue-200':'bg-blue-50 border-blue-200 text-blue-900')
        }`}>
          <div>
            <div className="font-semibold text-lg">Account Status: {(isApproved ? 'Approved' : status.charAt(0).toUpperCase() + status.slice(1))}</div>
            <div className="text-xs opacity-80">Messages are visible to kGamify admins. Avoid sharing sensitive credentials.</div>
          </div>
          <div className={`text-xs font-medium px-3 py-1 rounded-full shadow ${
            connected ? (isDarkMode? 'bg-green-900/40 text-green-200':'bg-green-100 text-green-700') : (isDarkMode? 'bg-gray-800 text-gray-300':'bg-gray-100 text-gray-600')
          }`}>
            {connected ? 'Connected' : 'Offline'}
          </div>
        </div>
        {/* Messages list */}
        <div ref={scrollRef} className={`flex-1 overflow-y-auto rounded-3xl shadow-xl border ${isDarkMode? 'bg-gray-800 border-gray-700':'bg-white border-gray-200'} p-6 space-y-4 mb-6`} style={{minHeight: 350}}>
          {messages.length === 0 && (
            <div className={`text-sm ${isDarkMode? 'text-gray-400':'text-gray-500'}`}>No messages yet. Start the conversation below.</div>
          )}
          {messages.map((m,i)=>{
            const when = (()=>{ try { return formatDateDDMMYYYY(m.createdAt||Date.now()); } catch { return ''; } })();
            const mine = m.from === 'company';
            const bubbleCommon = 'max-w-[80%] rounded-2xl px-5 py-3 text-base shadow border';
            const mineStyle = isDarkMode? 'bg-[#ff8200] text-white border-[#ff9200]' : 'bg-[#ff8200] text-white border-[#ff8200]';
            const otherStyle = isDarkMode? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200';
            return (
              <div key={i} className={`flex ${mine? 'justify-end':'justify-start'}`}>
                <div className={`${bubbleCommon} ${mine? mineStyle : otherStyle}`}>
                  <div className={`text-xs mb-1 opacity-70 ${mine? 'text-white':(isDarkMode? 'text-gray-300':'text-gray-500')}`}>{mine? 'You':'Admin'} • {when}</div>
                  <div className="whitespace-pre-wrap break-words leading-snug">{m.message}</div>
                  {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {m.attachments.map((a, idx) => (
                        <AttachmentPreview key={idx} a={a} dark={isDarkMode} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        {/* Composer */}
        <form onSubmit={handleSend} className="mt-2 flex flex-col gap-3">
          <input
            type="text"
            value={input}
            onChange={(e)=>setInput(e.target.value)}
            placeholder="Type a message…"
            className={`flex-1 rounded-full border px-5 py-3 text-base shadow ${isDarkMode? 'bg-gray-800 border-gray-600 placeholder-gray-500':'bg-white border-gray-300 placeholder-gray-400'}`}
            maxLength={2000}
          />
          {files && files.length > 0 && (
            <div className={`flex flex-wrap gap-2 text-xs ${isDarkMode? 'text-gray-200':'text-gray-700'}`}>
              {Array.from(files).map((f, idx) => (
                <div key={idx} className={`px-2 py-1 rounded border ${isDarkMode? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-100'}`}>
                  {f.name} <span className="opacity-60">({Math.round(f.size/1024)} KB)</span>
                </div>
              ))}
              <button type="button" onClick={()=>setFiles([])} className="text-xs underline">Clear</button>
            </div>
          )}
          <div className="flex gap-3 items-center">
            <label className={`cursor-pointer px-4 py-2 rounded-full border text-sm ${isDarkMode? 'bg-gray-800 border-gray-600':'bg-gray-50 border-gray-300'}`}>
              Attach
              <input type="file" multiple onChange={e=>setFiles(e.target.files)} className="hidden" accept="image/*,.jpg,.jpeg,.png,.pdf,.doc,.docx" />
            </label>
            <button disabled={sending || (!input.trim() && (!files || files.length===0))} className={`px-7 py-3 rounded-full font-bold text-lg text-white shadow-lg ${
              sending||(!input.trim() && (!files || files.length===0))? 'bg-gray-400 cursor-not-allowed':'bg-gradient-to-r from-[#ff8200] to-[#ffb347] hover:from-[#e57400] hover:to-[#ffb347]'
            } transition-all duration-200`}>
              {sending? 'Sending…':'Send'}
            </button>
          </div>
          <div className={`text-xs mt-1 ${isDarkMode? 'text-gray-400':'text-gray-500'}`}>
            Supported file types: .pdf, .jpg, .jpeg, .png, .doc, .docx
          </div>
        </form>
      </div>
    </div>
  );
}

Messages.propTypes = { isDarkMode: PropTypes.bool };

function AttachmentPreview({ a, dark }) {
  const isImage = (a?.type || '').startsWith('image/');
  const name = a?.name || a?.url?.split('/')?.slice(-1)[0] || 'file';
  const url = a?.url || '';
  return (
    <div className={`rounded border ${dark? 'border-gray-500 bg-gray-800/40':'border-gray-200 bg-white/80'} p-2`}>
      {isImage ? (
        url && url.startsWith('http') ? (
          <a href={url} target="_blank" rel="noreferrer" className="block">
            <img src={url} alt={name} className="max-h-40 rounded" />
          </a>
        ) : (
          <div className="text-xs">{name}</div>
        )
      ) : (
        url && url.startsWith('http') ? (
          <a href={url} target="_blank" rel="noreferrer" className="underline">{name}</a>
        ) : (
          <div className="text-xs">{name}</div>
        )
      )}
    </div>
  );
}

AttachmentPreview.propTypes = {
  a: PropTypes.shape({ url: PropTypes.string, type: PropTypes.string, name: PropTypes.string, size: PropTypes.number }),
  dark: PropTypes.bool
};
