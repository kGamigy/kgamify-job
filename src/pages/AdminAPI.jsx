import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FaKey, FaPlus, FaTrash, FaCopy, FaCheck, FaToggleOn, FaToggleOff, FaSync } from 'react-icons/fa';
import { getApiUrl } from '../utils/apiUrl';
import { formatDateDDMMYYYY } from '../utils/date';

export default function AdminAPI({ isDarkMode = false }) {
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyData, setNewKeyData] = useState({ name: '', description: '' });
  const [copiedId, setCopiedId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const API_URL = getApiUrl();

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_URL}/admin/api-keys`, {
        headers: { 'x-auth-token': token }
      });
      const data = await res.json();
      if (res.ok) {
        setApiKeys(data.keys || []);
      } else {
        setError(data.error || 'Failed to fetch API keys');
      }
    } catch (err) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const createApiKey = async () => {
    if (!newKeyData.name.trim()) {
      setError('Name is required');
      return;
    }
    try {
      setCreating(true);
      setError('');
      setSuccess('');
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_URL}/admin/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify(newKeyData)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`API Key created: ${data.key}`);
        setNewKeyData({ name: '', description: '' });
        fetchApiKeys();
      } else {
        setError(data.error || 'Failed to create API key');
      }
    } catch (err) {
      setError(err.message || 'Network error');
    } finally {
      setCreating(false);
    }
  };

  const toggleApiKey = async (id, currentStatus) => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_URL}/admin/api-keys/${id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({ active: !currentStatus })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message);
        fetchApiKeys();
      } else {
        setError(data.error || 'Failed to toggle API key');
      }
    } catch (err) {
      setError(err.message || 'Network error');
    }
  };

  const deleteApiKey = async (id) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_URL}/admin/api-keys/${id}`, {
        method: 'DELETE',
        headers: { 'x-auth-token': token }
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('API Key deleted');
        fetchApiKeys();
      } else {
        setError(data.error || 'Failed to delete API key');
      }
    } catch (err) {
      setError(err.message || 'Network error');
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className={`min-h-screen p-6 ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FaKey className="text-[#ff8200]" />
            API Management
          </h1>
          <p className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Create and manage API keys for external integrations. Each key provides access to job data endpoints.
          </p>
        </div>

        {error && (
          <div className={`mb-4 p-3 rounded ${isDarkMode ? 'bg-red-900/20 border border-red-700 text-red-300' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {error}
          </div>
        )}

        {success && (
          <div className={`mb-4 p-3 rounded ${isDarkMode ? 'bg-green-900/20 border border-green-700 text-green-300' : 'bg-green-50 border border-green-200 text-green-700'}`}>
            {success}
          </div>
        )}

        {/* Create New API Key */}
        <div className={`mb-6 p-5 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
          <h2 className="text-lg font-semibold mb-3">Create New API Key</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input
                type="text"
                value={newKeyData.name}
                onChange={(e) => setNewKeyData({ ...newKeyData, name: e.target.value })}
                placeholder="e.g., Mobile App Integration"
                className={`w-full px-3 py-2 rounded border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <input
                type="text"
                value={newKeyData.description}
                onChange={(e) => setNewKeyData({ ...newKeyData, description: e.target.value })}
                placeholder="Optional description"
                className={`w-full px-3 py-2 rounded border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
          </div>
          <button
            onClick={createApiKey}
            disabled={creating}
            className="px-4 py-2 bg-[#ff8200] text-white rounded hover:bg-[#e57400] disabled:opacity-50 flex items-center gap-2"
          >
            <FaPlus /> {creating ? 'Creating...' : 'Create API Key'}
          </button>
        </div>

        {/* API Endpoints Documentation */}
        <div className={`mb-6 p-5 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
          <h2 className="text-lg font-semibold mb-3">Available Endpoints</h2>
          <div className="space-y-3 text-sm">
            <div className={`p-3 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <div className="font-mono text-xs mb-1 text-[#ff8200]">GET /api/external/jobs/company/:companyEmail</div>
              <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Fetch all jobs for a specific company (active and inactive)</p>
              <div className="mt-2 text-xs">
                <span className="font-semibold">Headers:</span> <code className="ml-2 px-1 py-0.5 rounded bg-gray-800 text-gray-200">X-API-Key: your_api_key</code>
              </div>
            </div>
            <div className={`p-3 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <div className="font-mono text-xs mb-1 text-[#ff8200]">GET /api/external/jobs/all</div>
              <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Fetch all active jobs across all companies</p>
              <div className="mt-2 text-xs">
                <span className="font-semibold">Headers:</span> <code className="ml-2 px-1 py-0.5 rounded bg-gray-800 text-gray-200">X-API-Key: your_api_key</code>
              </div>
            </div>
          </div>
        </div>

        {/* Existing API Keys */}
        <div className={`p-5 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Active API Keys</h2>
            <button
              onClick={fetchApiKeys}
              className={`px-3 py-1.5 rounded text-sm flex items-center gap-2 ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              <FaSync /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-sm opacity-70">Loading API keys...</div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-sm opacity-70">No API keys created yet. Create one above to get started.</div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <div key={key._id} className={`p-4 rounded border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">{key.name}</h3>
                        {key.active ? (
                          <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Active</span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs rounded bg-gray-300 text-gray-700 dark:bg-gray-600 dark:text-gray-300">Inactive</span>
                        )}
                      </div>
                      {key.description && (
                        <p className={`text-sm mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{key.description}</p>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <code className={`text-xs px-2 py-1 rounded font-mono ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                          {key.key.substring(0, 20)}...
                        </code>
                        <button
                          onClick={() => copyToClipboard(key.key, key._id)}
                          className={`px-2 py-1 text-xs rounded ${isDarkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-300 hover:bg-gray-400'}`}
                        >
                          {copiedId === key._id ? <FaCheck className="text-green-500" /> : <FaCopy />}
                        </button>
                      </div>
                      <div className="text-xs opacity-70">
                        Created: {formatDateDDMMYYYY(key.createdAt)} • Last used: {key.lastUsed ? formatDateDDMMYYYY(key.lastUsed) : 'Never'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => toggleApiKey(key._id, key.active)}
                        className={`px-3 py-1.5 rounded text-sm flex items-center gap-2 ${key.active ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                      >
                        {key.active ? <><FaToggleOff /> Disable</> : <><FaToggleOn /> Enable</>}
                      </button>
                      <button
                        onClick={() => deleteApiKey(key._id)}
                        className="px-3 py-1.5 rounded text-sm bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
                      >
                        <FaTrash /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

AdminAPI.propTypes = { isDarkMode: PropTypes.bool };
