import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { FaFileAlt, FaSearch } from 'react-icons/fa';
import {
  getApplicationsForCompany,
  shortlistApplication,
  rejectApplication,
} from '../api';
import ResumeViewer from '../components/ResumeViewer';
import { formatDateDDMMYYYY } from '../utils/date';

export default function Applications({ isDarkMode }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('dateDesc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [skillQuery, setSkillQuery] = useState('');
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [minScore, setMinScore] = useState('');

  // Pagination
  const pageSize = 20;
  const [page, setPage] = useState(1);

  // Table / Card toggle
  const [view, setView] = useState('table');
  // AI recommendations moved to Job detail page

  useEffect(() => {
    let email = '';
    try {
      const cd = JSON.parse(localStorage.getItem('companyData') || 'null');
      if (cd?.email) email = cd.email;
  } catch { /* ignore */ }
    if (!email) email = localStorage.getItem('rememberedEmail') || '';

    if (!email) {
      setError('No company email found');
      setLoading(false);
      return;
    }

     (async () => {
      try {
        const data = await getApplicationsForCompany(email);
        const list = Array.isArray(data.applications) ? data.applications : [];
        setApps(list);
  // AI recommendations are fetched on the Job page
      } catch (e) {
        setError(
          e?.response?.data?.error || e.message || 'Failed to load applications'
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // (Loading/Error UI moved below to keep all hooks unconditionally called)

  // Sorting helpers
  const handleSort = (column) => {
    setPage(1);
    setSortBy(prev => {
      if (column === 'name') {
        return prev === 'nameAsc' ? 'nameDesc' : 'nameAsc';
      }
      if (column === 'role') {
        return prev === 'roleAsc' ? 'roleDesc' : 'roleAsc';
      }
      if (column === 'date') {
        return prev === 'dateAsc' ? 'dateDesc' : 'dateAsc';
      }
      return prev;
    });
  };

  const filtered = apps
    .filter(a => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        a.applicantName?.toLowerCase().includes(q) ||
        a.jobTitle?.toLowerCase().includes(q) ||
        a.companyName?.toLowerCase().includes(q)
      );
    })
    .filter(a =>
      statusFilter === 'all' ? true : (a.status || 'new') === statusFilter
    )
    .filter(a => {
      // Date range filter
      if (dateRange === 'all') return true;
      const applied = new Date(a.appliedAt || a.createdAt);
      if (Number.isNaN(applied.getTime())) return true;
      const now = new Date();
      const ranges = { '7d': 7, '30d': 30, '90d': 90 };
      const days = ranges[dateRange];
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      return applied >= cutoff;
    })
    .filter(a => {
      // Skills filter (selected skills OR skillQuery substring)
      const skills = (a.skills || []).map(s => String(s).toLowerCase());
      if (selectedSkills.length > 0) {
        const sel = selectedSkills.map(s => s.toLowerCase());
        const anyMatch = sel.some(s => skills.includes(s));
        if (!anyMatch) return false;
      }
      if (skillQuery.trim()) {
        const sq = skillQuery.toLowerCase();
        const anyTextMatch = skills.some(s => s.includes(sq));
        if (!anyTextMatch) return false;
      }
      return true;
    })
    .filter(a => {
      // Test score min filter
      if (minScore === '' || minScore === null) return true;
      const n = parseFloat(a.testScore);
      const min = parseFloat(minScore);
      if (Number.isNaN(min)) return true;
      if (Number.isNaN(n)) return false;
      return n >= min;
    });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'nameAsc':
        return (a.applicantName || '').localeCompare(b.applicantName || '');
      case 'nameDesc':
        return (b.applicantName || '').localeCompare(a.applicantName || '');
      case 'roleAsc': {
        const ar = (a.jobTitle || a.role || '').toLowerCase();
        const br = (b.jobTitle || b.role || '').toLowerCase();
        return ar.localeCompare(br);
      }
      case 'roleDesc': {
        const ar = (a.jobTitle || a.role || '').toLowerCase();
        const br = (b.jobTitle || b.role || '').toLowerCase();
        return br.localeCompare(ar);
      }
      case 'dateAsc':
        return (
          new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime()
        );
      case 'dateDesc':
      default:
        return (
          new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
        );
    }
  });

  // Reset infinite list when filters/sort change
  useEffect(() => { setPage(1); }, [query, sortBy, statusFilter, dateRange, skillQuery, selectedSkills, minScore]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDarkMode
            ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white'
            : 'bg-gradient-to-br from-orange-50 via-white to-orange-100 text-black'
        }`}
      >
        <div className="text-lg font-semibold">Loading applications...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDarkMode
            ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white'
            : 'bg-gradient-to-br from-orange-50 via-white to-orange-100 text-black'
        }`}
      >
        <div className="text-lg font-semibold text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen py-10 px-2 sm:px-6 lg:px-8 flex flex-col items-center ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-black'}`}
    >
      {/* Search + View toggle */}
      <div className={`w-full max-w-6xl mx-auto mb-8 rounded-2xl shadow flex flex-col items-center p-6 sm:p-8 border ${isDarkMode? 'border-gray-800 bg-gray-900':'border-gray-200 bg-white'}`}>
        <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          {/* Search */}
          <div className="relative w-full max-w-md">
            <FaSearch className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode? 'text-gray-400':'text-gray-400'}`} />
            <input
              className={`w-full rounded-lg px-10 py-2 text-sm shadow-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition border ${isDarkMode? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500':'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
              placeholder="Search by applicant or job title"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          {/* View toggle */}
          <div className="flex items-center gap-2 mt-3 sm:mt-0">
            <span className="text-xs opacity-70">View:</span>
            {['table', 'cards'].map(mode => (
              <button
                key={mode}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition shadow-sm ${view === mode ? 'bg-orange-500 text-white border-orange-500' : (isDarkMode? 'bg-gray-800 border-gray-700 text-white':'bg-white border-gray-300 text-gray-900')}`}
                onClick={() => setView(mode)}
              >
                {mode[0].toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {/* Filters below search bar */}
        <div className="w-full flex flex-wrap items-center gap-3 mb-2">
          <div className="flex gap-2">
            <select
              className={`px-3 py-2 rounded-lg border text-sm font-medium shadow-sm ${isDarkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              className={`px-3 py-2 rounded-lg border text-sm font-medium shadow-sm ${isDarkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
            >
              <option value="all">All Dates</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
          {/* Active filter chips */}
          <div className="flex flex-wrap items-center gap-2 ml-2">
            {statusFilter !== 'all' && (
              <button className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition shadow-sm ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`} onClick={() => setStatusFilter('all')}>
                Status: {statusFilter} ×
              </button>
            )}
            {dateRange !== 'all' && (
              <button className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition shadow-sm ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`} onClick={() => setDateRange('all')}>
                Date: {dateRange} ×
              </button>
            )}
            {minScore !== '' && (
              <button className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition shadow-sm ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`} onClick={() => setMinScore('')}>
                Min score: {minScore} ×
              </button>
            )}
            {skillQuery.trim() && (
              <button className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition shadow-sm ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`} onClick={() => setSkillQuery('')}>
                Skill: {skillQuery} ×
              </button>
            )}
            {selectedSkills.map(sk => (
              <button
                key={sk}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition shadow-sm ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                onClick={() =>
                  setSelectedSkills(prev => prev.filter(s => s !== sk))
                }
              >
                {sk} ×
              </button>
            ))}
            {(statusFilter !== 'all' || dateRange !== 'all' || minScore !== '' || skillQuery.trim() || selectedSkills.length > 0) && (
              <button
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition shadow-sm ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                onClick={() => {
                  setStatusFilter('all');
                  setDateRange('all');
                  setMinScore('');
                  setSkillQuery('');
                  setSelectedSkills([]);
                }}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Layout: List + Sidebar */}
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Main Section */}
        <section className="md:col-span-8 xl:col-span-9 space-y-6">
          {/* Table / Cards */}
          {sorted.length === 0 ? (
      <div className={`rounded-2xl shadow p-10 text-center flex flex-col items-center border ${isDarkMode? 'border-gray-800 bg-gray-900':'border-gray-200 bg-white'}`}>
              <FaFileAlt className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <div className="font-semibold text-lg">No applications found</div>
              <p className="text-sm opacity-70 mt-1">
                Try adjusting your search or filters.
              </p>
            </div>
          ) : (
            <div className="overflow-auto pr-1">
              {view === 'table' ? (
        <div className={`rounded-2xl shadow overflow-hidden border ${isDarkMode? 'border-gray-800 bg-gray-900':'border-gray-200 bg-white'}`}>
                  <table className="w-full border-collapse text-sm">
          <thead className={`sticky top-0 z-10 shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                      <tr>
                        <th
                          className={`px-4 py-3 text-left select-none cursor-pointer text-base font-semibold ${sortBy.startsWith('name') ? 'text-orange-600' : ''}`}
                          onClick={() => handleSort('name')}
                          title="Sort by name"
                        >
                          Name {sortBy === 'nameAsc' ? '▲' : sortBy === 'nameDesc' ? '▼' : ''}
                        </th>
                        <th
                          className={`px-4 py-3 text-left select-none cursor-pointer text-base font-semibold ${sortBy.startsWith('role') ? 'text-orange-600' : ''}`}
                          onClick={() => handleSort('role')}
                          title="Sort by role"
                        >
                          Role {sortBy === 'roleAsc' ? '▲' : sortBy === 'roleDesc' ? '▼' : ''}
                        </th>
                        <th className="px-4 py-3 text-left text-base font-semibold">Status</th>
                        <th
                          className={`px-4 py-3 text-left select-none cursor-pointer text-base font-semibold ${sortBy.startsWith('date') ? 'text-orange-600' : ''}`}
                          onClick={() => handleSort('date')}
                          title="Sort by date"
                        >
                          Date {sortBy === 'dateAsc' ? '▲' : sortBy === 'dateDesc' ? '▼' : ''}
                        </th>
                        <th className="px-4 py-3 text-left text-base font-semibold">Resume</th>
                        <th className="px-4 py-3 text-left text-base font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map(app => {
                        const status = (app.status || 'new').toLowerCase();
                        const statusStyles = (() => {
                          if (status === 'shortlisted') return isDarkMode? 'bg-green-900/30 text-green-300 border-green-700':'bg-green-100 text-green-700 border-green-200';
                          if (status === 'rejected') return isDarkMode? 'bg-red-900/30 text-red-300 border-red-700':'bg-red-100 text-red-700 border-red-200';
                          return isDarkMode? 'bg-blue-900/30 text-blue-300 border-blue-700':'bg-blue-100 text-blue-700 border-blue-200';
                        })();
                        const dateText = app.appliedAt || app.createdAt || app.date;
                        return (
                          <tr
                            key={app.id || app._id}
                            className={`align-middle transition-colors border-b last:border-0 ${isDarkMode ? 'border-gray-700 hover:bg-gray-800 odd:bg-gray-900 even:bg-gray-800' : 'border-gray-100 hover:bg-gray-50 odd:bg-white even:bg-gray-50'}`}
                          >
                            <td className="px-4 py-3 whitespace-nowrap font-medium text-orange-700">{app.applicantName || app.name}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">{app.jobTitle || app.role}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs border font-medium ${statusStyles}`}>
                                {status === 'shortlisted' ? 'Shortlisted' : status === 'rejected' ? 'Rejected' : 'New'}
                              </span>
                            </td>
                            <td className={`px-4 py-3 whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{formatDateDDMMYYYY(dateText)}</td>
                            <td className="px-4 py-3">
                              {app.resume ? (
                                <ResumeViewer resumeUrl={app.resume} applicantName={app.applicantName || app.name} variant="inline" />
                              ) : (
                                <span className="opacity-60 text-xs">No resume</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <button
                                  className="text-xs px-4 py-2 rounded-lg border border-orange-400 bg-orange-500 text-white font-medium shadow-sm hover:bg-orange-600 transition"
                                  onClick={async () => {
                                    try {
                                      await shortlistApplication(app._id || app.id);
                                      setApps(prev => prev.map(x => (x._id === (app._id || app.id) || x.id === (app._id || app.id)) ? { ...x, status: 'shortlisted' } : x));
                                    } catch { /* ignore */ }
                                  }}
                                >
                                  Shortlist
                                </button>
                                <button
                                  className="text-xs px-4 py-2 rounded-lg border border-red-300 bg-white text-red-600 font-medium shadow-sm hover:bg-red-50 transition"
                                  onClick={async () => {
                                    const ok = window.confirm('Reject this applicant?');
                                    if (!ok) return;
                                    try {
                                      await rejectApplication(app._id || app.id);
                                      setApps(prev => prev.map(x => (x._id === (app._id || app.id) || x.id === (app._id || app.id)) ? { ...x, status: 'rejected' } : x));
                                    } catch { /* ignore */ }
                                  }}
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginated.map(app => (
                    <div
                      key={app.id || app._id}
                      className={`rounded-2xl p-6 shadow flex flex-col gap-2 transition-all duration-200 hover:shadow-md hover:-translate-y-1 border ${isDarkMode? 'border-gray-800 bg-gray-900':'border-gray-200 bg-white'}`}
                    >
                      <div className="font-semibold text-base text-orange-700">{app.applicantName || app.name}</div>
                      <div className="text-sm font-medium opacity-80">{app.jobTitle || app.role}</div>
                      <div className="mt-2 flex justify-between items-center">
                        <span className={`px-3 py-1 rounded-full text-xs border font-medium ${(() => {
                          const s = (app.status || 'new').toLowerCase();
                          if (s === 'shortlisted') return isDarkMode? 'bg-green-900/30 text-green-300 border-green-700':'bg-green-100 text-green-700 border-green-200';
                          if (s === 'rejected') return isDarkMode? 'bg-red-900/30 text-red-300 border-red-700':'bg-red-100 text-red-700 border-red-200';
                          return isDarkMode? 'bg-blue-900/30 text-blue-300 border-blue-700':'bg-blue-100 text-blue-700 border-blue-200';
                        })()}`}>
                          {(app.status || 'New')}
                        </span>
                        <span className="text-xs opacity-70">{formatDateDDMMYYYY(app.appliedAt || app.createdAt || app.date)}</span>
                      </div>
                      {app.resume ? (
                        <div className="mt-3">
                          <ResumeViewer resumeUrl={app.resume} applicantName={app.applicantName || app.name} variant="inline" />
                        </div>
                      ) : (
                        <div className="mt-3 text-xs opacity-70">No resume</div>
                      )}
                      <div className="text-xs mt-3 flex gap-2">
                        <button
                          className="text-xs px-4 py-2 rounded-lg border border-orange-400 bg-orange-500 text-white font-medium shadow-sm hover:bg-orange-600 transition"
                          onClick={async () => {
                            try {
                              await shortlistApplication(app._id || app.id);
                              setApps(prev => prev.map(x => (x._id === (app._id || app.id) || x.id === (app._id || app.id)) ? { ...x, status: 'shortlisted' } : x));
                            } catch { /* ignore */ }
                          }}
                        >
                          Shortlist
                        </button>
                        <button
                          className="text-xs px-4 py-2 rounded-lg border border-red-300 bg-white text-red-600 font-medium shadow-sm hover:bg-red-50 transition"
                          onClick={async () => {
                            const ok = window.confirm('Reject this applicant?');
                            if (!ok) return;
                            try {
                              await rejectApplication(app._id || app.id);
                              setApps(prev => prev.map(x => (x._id === (app._id || app.id) || x.id === (app._id || app.id)) ? { ...x, status: 'rejected' } : x));
                            } catch { /* ignore */ }
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Pagination controls */}
              <div className="mt-6 flex flex-wrap items-center gap-2 justify-center text-xs">
                <button disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))} className={`px-3 py-1 rounded border ${page===1? 'opacity-40 cursor-not-allowed':'hover:bg-gray-100 dark:hover:bg-gray-800'} ${isDarkMode?'border-gray-700':'border-gray-300'}`}>Prev</button>
                {Array.from({ length: totalPages }).slice(0,10).map((_,i)=>(
                  <button key={i} onClick={()=>setPage(i+1)} className={`px-3 py-1 rounded border ${page===i+1? 'bg-orange-500 text-white border-orange-500':'hover:bg-gray-100 dark:hover:bg-gray-800'} ${isDarkMode?'border-gray-700':'border-gray-300'}`}>{i+1}</button>
                ))}
                {totalPages>10 && <span className="px-2">…</span>}
                <button disabled={page===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className={`px-3 py-1 rounded border ${page===totalPages? 'opacity-40 cursor-not-allowed':'hover:bg-gray-100 dark:hover:bg-gray-800'} ${isDarkMode?'border-gray-700':'border-gray-300'}`}>Next</button>
              </div>
            </div>
          )}
        </section>
        {/* Sidebar (optional, can be removed for full width) */}
      </div>
    </div>
  );
}

Applications.propTypes = {
  isDarkMode: PropTypes.bool,
};
