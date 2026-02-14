import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import PropTypes from 'prop-types';
import { getAdminCompanyMessages, sendAdminCompanyMessage } from '../api';
import { config } from '../config/env';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDateDDMMYYYY } from '../utils/date';

export default function AdminMessages({ isDarkMode }) {
  const { companyId } = useParams();
  const [data, setData] = useState(null); // { company, messages }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState([]);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef(null);
  const navigate = useNavigate();
  const adminToken = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;

  // Simple admin auth guard
  useEffect(() => {
    if (!adminToken) {
      setError('Admin authentication required');
      setLoading(false);
      const t = setTimeout(()=> navigate('/admin-login'), 1200);
      return () => clearTimeout(t);
    }
  }, [adminToken, navigate]);

  useEffect(() => {
    if (!companyId) { setError('Missing company id'); setLoading(false); return; }
    if (!/^[a-fA-F0-9]{24}$/.test(companyId)) { setError('Invalid company id'); setLoading(false); return; }
    let socket;
    let active = true;
    async function init() {
      try {
        const resp = await getAdminCompanyMessages(companyId);
        if (active) {
          setData(resp);
          setError('');
          setTimeout(()=> bottomRef.current?.scrollIntoView({ behavior: 'auto'}), 30);
        }
      } catch (e) {
        if (active) {
          if (e?.response?.status === 404) {
            setError('Company not found');
          } else if (e?.response?.status === 401) {
            setError('Unauthorized – please login as admin');
            setTimeout(()=> navigate('/admin-login'), 1200);
          } else {
            setError(e?.response?.data?.message || 'Failed to load');
          }
        }
      } finally { if (active) setLoading(false); }
      const backendBase = (config.API_URL || '').replace(/\/?api\/?$/, '');
      socket = io(backendBase || '/', {
        path: '/socket.io',
        withCredentials: true,
        transports: ['websocket'],
        reconnection: true,
      });
      socket.on('connect', () => setConnected(true));
      socket.on('disconnect', () => setConnected(false));
      socket.emit('join', `company:${companyId}`);
      socket.on('message:new', payload => {
        if (payload?.companyId === String(companyId)) {
          setData(d => {
            if (!d) return d;
            const existing = d.messages || [];
            const incoming = payload.message;
            // Deduplicate by clientId + createdAt
            const isDup = incoming?.clientId && existing.some(m => m.clientId === incoming.clientId);
            if (isDup) return d;
            return { ...d, messages: [...existing, incoming] };
          });
          setTimeout(()=> bottomRef.current?.scrollIntoView({ behavior: 'smooth'}), 30);
        }
      });
    }
    init();
    return () => {
      active = false;
      try { socket?.emit('leave', `company:${companyId}`); socket?.disconnect(); } catch { /* ignore disconnect */ }
    };
  }, [companyId, navigate]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text && (!files || files.length === 0)) return;
    try {
      setSending(true);
      const clientId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const optimistic = { message:text, from:'admin', createdAt:new Date().toISOString(), type:'info', clientId, attachments: Array.from(files||[]).map(f=>({ name:f.name, size:f.size, type:f.type, url:'about:blank' })) };
      setData(d=> d ? { ...d, messages:[...d.messages, optimistic]} : d);
      setInput('');
  await sendAdminCompanyMessage(companyId, text, files);
      setFiles([]);
    } catch (e) {
      setError(e?.response?.data?.message || 'Send failed');
    } finally { setSending(false); }
  };

  if (loading) return <div className={`p-6 ${isDarkMode? 'text-white':'text-gray-800'}`}>Loading...</div>;
  if (error) return <div className={`p-6 ${isDarkMode? 'text-red-300':'text-red-600'}`}>{error}</div>;
  if (!data) return null;

  const { company, messages } = data;

  return (
    <div className={`p-4 sm:p-6 min-h-[60vh] ${isDarkMode? 'text-white':'text-gray-900'}`}>
      <div className="max-w-5xl mx-auto flex flex-col h-[70vh]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Messages • {company.companyName}</h2>
            <p className="text-xs opacity-70 break-all">{company.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2 py-1 rounded ${connected ? (isDarkMode? 'bg-green-900/40 text-green-200':'bg-green-100 text-green-700') : (isDarkMode? 'bg-gray-800 text-gray-300':'bg-gray-100 text-gray-600')}`}>{connected ? 'Connected':'Offline'}</span>
            <button onClick={()=>navigate('/admin')} className="px-3 py-1.5 rounded bg-[#ff8200] text-white text-sm">Back</button>
          </div>
        </div>
        <div className={`flex-1 overflow-y-auto rounded border ${isDarkMode? 'bg-gray-800 border-gray-700':'bg-white border-gray-200'} p-4 space-y-3`}>
          {messages.length===0 && <div className={`text-sm ${isDarkMode? 'text-gray-400':'text-gray-500'}`}>No messages yet.</div>}
          {messages.map((m,i)=>{
            const when = (()=>{ try { return formatDateDDMMYYYY(m.createdAt||Date.now()); } catch { return ''; } })();
            const mine = m.from === 'admin';
            const bubbleCommon = 'max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow border';
            const mineStyle = isDarkMode? 'bg-[#ff8200] text-white border-[#ff9200]' : 'bg-[#ff8200] text-white border-[#ff8200]';
            const otherStyle = isDarkMode? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200';
            return (
              <div key={i} className={`flex ${mine? 'justify-end':'justify-start'}`}>
                <div className={`${bubbleCommon} ${mine? mineStyle : otherStyle}`}>
                  <div className={`text-[10px] mb-1 opacity-70 ${mine? 'text-white':(isDarkMode? 'text-gray-300':'text-gray-500')}`}>{mine? 'Admin':'Company'} • {when}</div>
                  <div className="whitespace-pre-wrap break-words leading-snug">{m.message}</div>
                  {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
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
        <form onSubmit={handleSend} className="mt-4 flex flex-col gap-2">
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
          <div className="flex gap-2 items-center">
          <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Write a reply..." className={`flex-1 rounded-full border px-4 py-2 ${isDarkMode? 'bg-gray-800 border-gray-600 placeholder-gray-500':'bg-white border-gray-300 placeholder-gray-400'}`} />
          <label className={`cursor-pointer px-3 py-2 rounded-full border text-sm ${isDarkMode? 'bg-gray-800 border-gray-600':'bg-gray-50 border-gray-300'}`}>
            Attach
            <input type="file" multiple onChange={e=>setFiles(e.target.files)} className="hidden" accept="image/*,.pdf,.doc,.docx" />
          </label>
          <button disabled={sending || (!input.trim() && (!files || files.length===0))} className={`px-5 py-2 rounded-full font-medium text-white ${sending||(!input.trim() && (!files || files.length===0))? 'bg-gray-400 cursor-not-allowed':'bg-[#ff8200] hover:bg-[#e57400]'}`}>{sending? 'Sending...':'Send'}</button>
          </div>
        </form>
        <p className="mt-1 text-xs opacity-60">Only admins and this company can see these messages.</p>
      </div>
    </div>
  );
}

AdminMessages.propTypes = { isDarkMode: PropTypes.bool, $isDarkMode: PropTypes.bool };

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
  a: PropTypes.shape({
    url: PropTypes.string,
    type: PropTypes.string,
    name: PropTypes.string,
    size: PropTypes.number
  }),
  dark: PropTypes.bool
};
