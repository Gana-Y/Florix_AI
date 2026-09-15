import React, { useEffect, useState, useRef } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell
} from 'recharts';
import {
  Activity, Database, Cpu, HardDrive, RefreshCw,
  Clock, Terminal, AlertCircle, CheckCircle2, ChevronRight
} from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';

const SystemMonitor = () => {
  const { addToast } = useToast();
  const [metrics, setMetrics] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const timerRef = useRef(null);

  const fetchData = async (showToast = false) => {
    setRefreshing(true);
    try {
      const [metricsRes, healthRes] = await Promise.all([
        api.get('/admin/metrics'),
        api.get('/admin/system-health')
      ]);
      setMetrics(metricsRes.data);
      setHealth(healthRes.data);
      if (showToast) {
        addToast('Monitoring data refreshed', 'success');
      }
    } catch (err) {
      console.error('Error fetching monitoring metrics:', err);
      addToast('Failed to fetch system metrics: ' + (err.response?.data?.detail || 'Forbidden/Access Denied'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      timerRef.current = setInterval(() => {
        fetchData();
      }, 5000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="w-full h-[500px] flex flex-col items-center justify-center gap-4 text-slate-500 dark:text-zinc-400">
        <RefreshCw className="animate-spin text-indigo-500" size={32} />
        <span className="font-semibold text-sm">Loading telemetry dashboard...</span>
      </div>
    );
  }

  // Format charts data
  const latencyChartData = metrics ? Object.entries(metrics.latency_by_endpoint).map(([endpoint, avgLatency]) => ({
    name: endpoint.split(' ').slice(1).join(' '), // strip method for chart
    method: endpoint.split(' ')[0],
    avgLatency,
    displayName: endpoint
  })) : [];

  const throughputChartData = metrics ? Object.entries(metrics.requests_by_endpoint).map(([endpoint, count]) => ({
    name: endpoint.split(' ').slice(1).join(' '),
    method: endpoint.split(' ')[0],
    count,
    displayName: endpoint
  })) : [];

  const COLORS = {
    GET: '#3b82f6',
    POST: '#10b981',
    DELETE: '#ef4444',
    PUT: '#f59e0b',
  };

  const getStatusColor = (code) => {
    if (code >= 200 && code < 300) return 'bg-green-500/10 text-green-500 border-green-500/20';
    if (code >= 300 && code < 400) return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    if (code >= 400 && code < 500) return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    return 'bg-red-500/10 text-red-500 border-red-500/20';
  };

  return (
    <div className="w-full flex flex-col gap-6 text-left pb-12">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-zinc-800/80 pb-5">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
            <Activity className="text-indigo-500" size={24} />
            System Metrics & Health
          </h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Real-time server telemetry, LLM token metrics, database diagnostics, and endpoint latency.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/60 px-3.5 py-2 rounded-xl">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-indigo-600 w-4 h-4 rounded"
            />
            <span>Auto Refresh (5s)</span>
          </label>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all disabled:opacity-50 shadow-md shadow-indigo-600/15"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Grid of Diagnostics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Server Uptime Card */}
        <div className="bg-white/80 dark:bg-zinc-900/80 border border-slate-200/60 dark:border-zinc-800/60 rounded-2xl p-5 flex items-start gap-4 hover:shadow-lg transition-all">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shrink-0">
            <Clock size={24} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Server Status</span>
            <span className="text-lg font-bold text-slate-800 dark:text-zinc-200 block mt-1 truncate">
              {health?.uptime_formatted || '00:00:00'}
            </span>
            <span className="text-xs text-slate-400 dark:text-zinc-500 block mt-0.5">
              Running on {health?.platform || 'Linux'}
            </span>
          </div>
        </div>

        {/* Memory Footprint Card */}
        <div className="bg-white/80 dark:bg-zinc-900/80 border border-slate-200/60 dark:border-zinc-800/60 rounded-2xl p-5 flex items-start gap-4 hover:shadow-lg transition-all">
          <div className="w-12 h-12 bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center shrink-0">
            <Cpu size={24} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Memory RSS</span>
            <span className="text-lg font-bold text-slate-800 dark:text-zinc-200 block mt-1">
              {health?.memory_usage_mb || 0} MB
            </span>
            <span className="text-xs text-slate-400 dark:text-zinc-500 block mt-0.5">
              Python {health?.python_version || '3.10'} VM
            </span>
          </div>
        </div>

        {/* Storage / SQL Database Statistics */}
        <div className="bg-white/80 dark:bg-zinc-900/80 border border-slate-200/60 dark:border-zinc-800/60 rounded-2xl p-5 flex items-start gap-4 hover:shadow-lg transition-all">
          <div className="w-12 h-12 bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 rounded-xl flex items-center justify-center shrink-0">
            <Database size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Database Rows</span>
            <span className="text-lg font-bold text-slate-800 dark:text-zinc-200 block mt-1 truncate">
              {health?.database?.total_sessions || 0} Sessions / {health?.database?.total_chunks || 0} Chunks
            </span>
            <span className="text-xs text-slate-400 dark:text-zinc-500 block mt-0.5">
              SQLite backend storage database
            </span>
          </div>
        </div>

        {/* Vector DB Chroma DB Health */}
        <div className="bg-white/80 dark:bg-zinc-900/80 border border-slate-200/60 dark:border-zinc-800/60 rounded-2xl p-5 flex items-start gap-4 hover:shadow-lg transition-all">
          <div className="w-12 h-12 bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 rounded-xl flex items-center justify-center shrink-0">
            <HardDrive size={24} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Vector Indexes</span>
            <span className="text-lg font-bold text-slate-800 dark:text-zinc-200 block mt-1 flex items-center gap-1.5">
              {health?.chromadb?.total_vectors || 0} Chunks
              <span className="inline-flex w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse" />
            </span>
            <span className="text-xs text-slate-400 dark:text-zinc-500 block mt-0.5">
              ChromaDB status: {health?.chromadb?.status || 'offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Second Row: Token Statistics */}
      <div className="bg-white/80 dark:bg-zinc-900/80 border border-slate-200/60 dark:border-zinc-800/60 rounded-2xl p-5 md:p-6 hover:shadow-lg transition-all">
        <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-4 select-none">
          Gemini AI API Token Telemetry
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-center">
          <div className="bg-slate-50 dark:bg-zinc-950/40 p-4 rounded-xl border border-slate-100 dark:border-zinc-800/40">
            <span className="text-slate-400 dark:text-zinc-500 text-xs font-bold block uppercase tracking-wider">Input Prompt Tokens</span>
            <span className="text-2xl font-black text-indigo-500 dark:text-indigo-400 block mt-2 font-mono">
              {metrics?.gemini_token_usage?.prompt_tokens?.toLocaleString() || 0}
            </span>
          </div>
          <div className="bg-slate-50 dark:bg-zinc-950/40 p-4 rounded-xl border border-slate-100 dark:border-zinc-800/40">
            <span className="text-slate-400 dark:text-zinc-500 text-xs font-bold block uppercase tracking-wider">Output Candidate Tokens</span>
            <span className="text-2xl font-black text-purple-500 dark:text-purple-400 block mt-2 font-mono">
              {metrics?.gemini_token_usage?.candidates_tokens?.toLocaleString() || 0}
            </span>
          </div>
          <div className="bg-slate-50 dark:bg-zinc-950/40 p-4 rounded-xl border border-slate-100 dark:border-zinc-800/40">
            <span className="text-slate-400 dark:text-zinc-500 text-xs font-bold block uppercase tracking-wider">Total Aggregated Tokens</span>
            <span className="text-2xl font-black text-pink-500 dark:text-pink-400 block mt-2 font-mono">
              {metrics?.gemini_token_usage?.total_tokens?.toLocaleString() || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Real-time Analytical Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latency by Endpoint */}
        <div className="bg-white/80 dark:bg-zinc-900/80 border border-slate-200/60 dark:border-zinc-800/60 rounded-2xl p-5 md:p-6 hover:shadow-lg transition-all flex flex-col h-[380px]">
          <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-5 flex items-center justify-between">
            <span>Average Latency by Endpoint (ms)</span>
            <span className="text-xs font-semibold font-mono text-zinc-500">Lower is better</span>
          </h3>
          <div className="flex-1 w-full min-h-0">
            {latencyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={latencyChartData} layout="vertical" margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.1} horizontal={false} />
                  <XAxis type="number" stroke="#71717a" fontSize={11} tickFormatter={(val) => `${val}ms`} />
                  <YAxis dataKey="name" type="category" stroke="#71717a" fontSize={11} width={130} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '12px', color: '#fff', fontFamily: 'monospace' }}
                    formatter={(value, name, props) => [`${value} ms`, `Average Latency`]}
                  />
                  <Bar dataKey="avgLatency" radius={[0, 4, 4, 0]}>
                    {latencyChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.method] || '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No latency statistics compiled yet
              </div>
            )}
          </div>
        </div>

        {/* Throughput requests count by endpoint */}
        <div className="bg-white/80 dark:bg-zinc-900/80 border border-slate-200/60 dark:border-zinc-800/60 rounded-2xl p-5 md:p-6 hover:shadow-lg transition-all flex flex-col h-[380px]">
          <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-5">
            Throughput (Requests Count by Endpoint)
          </h3>
          <div className="flex-1 w-full min-h-0">
            {throughputChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={throughputChartData} layout="vertical" margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.1} horizontal={false} />
                  <XAxis type="number" stroke="#71717a" fontSize={11} />
                  <YAxis dataKey="name" type="category" stroke="#71717a" fontSize={11} width={130} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '12px', color: '#fff', fontFamily: 'monospace' }}
                    formatter={(value) => [value, 'Hits Count']}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {throughputChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.method] || '#6366f1'} opacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No endpoint hits logged yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Request Stream Table */}
      <div className="bg-white/80 dark:bg-zinc-900/80 border border-slate-200/60 dark:border-zinc-800/60 rounded-2xl p-5 md:p-6 hover:shadow-lg transition-all flex flex-col">
        <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Terminal size={16} className="text-indigo-500" />
          Live Request Stream Log
        </h3>
        <div className="w-full overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800/60 custom-scrollbar">
          <table className="w-full border-collapse text-left text-xs font-mono">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800/80 text-slate-400 dark:text-zinc-500 font-bold uppercase select-none">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Endpoint Path</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Latency</th>
              </tr>
            </thead>
            <tbody>
              {metrics?.recent_requests_log && metrics.recent_requests_log.length > 0 ? (
                metrics.recent_requests_log.slice().reverse().map((req, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-slate-100/50 dark:border-zinc-900/60 hover:bg-slate-50/50 dark:hover:bg-zinc-950/40 text-slate-700 dark:text-zinc-300"
                  >
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400 dark:text-zinc-600">
                      {new Date(req.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className="px-2 py-0.5 rounded font-black text-[10px]"
                        style={{
                          backgroundColor: `${COLORS[req.method]}20`,
                          color: COLORS[req.method]
                        }}
                      >
                        {req.method}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-600 dark:text-zinc-400 truncate max-w-[280px]">
                      {req.path}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-bold border text-[10px] ${getStatusColor(req.status_code)}`}>
                        {req.status_code}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-500 dark:text-zinc-500">
                      {req.latency_ms} ms
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-400 dark:text-zinc-600 font-semibold select-none">
                    Waiting for requests stream...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default React.memo(SystemMonitor);
