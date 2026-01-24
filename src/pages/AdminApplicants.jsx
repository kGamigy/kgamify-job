import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import axios from 'axios';
import { getBaseUrl } from '../utils/apiUrl';

export default function AdminApplicants({ isDarkMode }) {
  const { companyId } = useParams();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) { navigate('/admin-login'); return; }
    async function fetchData() {
      try {
        setLoading(true);
        // Determine company email from any admin list endpoint
        const base = getBaseUrl();
        const headers = { 'x-auth-token': token };
        const tryLists = [
          axios.get(`${base}/api/admin/companies?status=approved`, { headers }).catch(()=>({ data: [] })),
          axios.get(`${base}/api/admin/pending-companies`, { headers }).catch(()=>({ data: [] })),
          axios.get(`${base}/api/admin/companies?status=hold`, { headers }).catch(()=>({ data: [] })),
          axios.get(`${base}/api/admin/companies?status=denied`, { headers }).catch(()=>({ data: [] })),
        ];
        const results = await Promise.all(tryLists);
        const allCompanies = results.flatMap(r => Array.isArray(r.data) ? r.data : []);
        let comp = allCompanies.find(c => String(c._id) === String(companyId));
        // Optional: attempt a direct fetch if available
        if (!comp) {
          try {
            const one = await axios.get(`${base}/api/admin/company/${companyId}`, { headers });
            comp = one.data;
          } catch { /* ignore if not available */ }
        }
        const companyEmail = comp?.email || comp?.companyEmail || comp?.contactEmail;
        if (!companyEmail) { setError('Company email not found'); setLoading(false); return; }
        const appsResp = await axios.get(`${base}/api/application/company?email=${encodeURIComponent(companyEmail)}`);
        const list = (appsResp.data?.applications) || (Array.isArray(appsResp.data) ? appsResp.data : []);
        setApps(list);
        setError('');
      } catch (e) {
        setError(e?.response?.data?.error || 'Failed to load applications');
      } finally { setLoading(false); }
    }
    fetchData();
  }, [companyId, navigate]);

  const slice = apps.slice((page-1)*pageSize, page*pageSize);
  const total = Math.max(1, Math.ceil(apps.length / pageSize));

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Applicants</h1>
          <button onClick={()=> navigate('/admin')} className="px-3 py-1.5 rounded bg-[#ff8200] text-white text-sm">Back to Admin</button>
        </div>
        {loading ? (
          <div className="p-6 border rounded">Loading…</div>
        ) : error ? (
          <div className="p-6 border rounded text-red-600">{error}</div>
        ) : (
          <div className="space-y-4">
            {slice.length === 0 ? (
              <div className={`p-6 rounded border text-sm ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>No applications found for this company.</div>
            ) : slice.map(a => (
              <div key={a.id || a._id} className={`p-4 rounded border ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{a.applicantName || a.name || 'Applicant'}</div>
                    <div className="text-xs opacity-70">Applied for: {a.jobTitle || '-'}</div>
                  </div>
                  {a.resume && (
                    <a href={a.resume} target="_blank" rel="noreferrer" className="px-3 py-1 text-sm rounded bg-blue-600 text-white">View Resume</a>
                  )}
                </div>
              </div>
            ))}
            {total > 1 && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <button disabled={page===1} onClick={()=> setPage(p=>p-1)} className={`px-3 py-1 rounded border ${page===1?'opacity-40 cursor-not-allowed':''}`}>Prev</button>
                {Array.from({ length: total }).map((_,i)=>(
                  <button key={i} onClick={()=> setPage(i+1)} className={`px-3 py-1 rounded border ${page===i+1? 'bg-[#ff8200] text-white border-[#ff8200]' : ''}`}>{i+1}</button>
                ))}
                <button disabled={page===total} onClick={()=> setPage(p=>p+1)} className={`px-3 py-1 rounded border ${page===total?'opacity-40 cursor-not-allowed':''}`}>Next</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

AdminApplicants.propTypes = { isDarkMode: PropTypes.bool, $isDarkMode: PropTypes.bool };
