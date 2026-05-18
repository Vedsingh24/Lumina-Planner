
import React, { useMemo, useState, useEffect } from 'react';
import { geminiService } from '../services/geminiService';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { Task } from '../types';

interface AnalyticsDashboardProps {
  tasks: Task[];
  aiInsights?: { date: string, data: any[] }[];
  onUpdateInsights?: (insights: { date: string, data: any[] }[]) => void;
}

// --- Reusable Paginated Chart Wrapper with Hover Arrows ---
interface PaginatedChartProps {
  title: string;
  accentColor: string;
  data: any[];
  pageSize: number;
  subtitle?: string;
  renderChart: (pageData: any[], pageKey: string) => React.ReactNode;
}

const PaginatedChart: React.FC<PaginatedChartProps> = ({ title, accentColor, data, pageSize, subtitle, renderChart }) => {
  const [page, setPage] = useState(0);
  const maxPage = Math.max(0, Math.ceil(data.length / pageSize) - 1);
  
  // page 0 = most recent, page 1 = previous window, etc.
  const startIdx = Math.max(0, data.length - pageSize * (page + 1));
  const endIdx = data.length - pageSize * page;
  const pageData = data.slice(startIdx, endIdx);
  
  const canGoBack = page < maxPage;
  const canGoForward = page > 0;

  const colorMap: Record<string, string> = { blue: '#3b82f6', violet: '#8b5cf6', emerald: '#10b981' };
  const accent = colorMap[accentColor] || '#3b82f6';

  return (
    <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 h-[400px] relative group/chart">
      <h3 className="text-sm font-bold text-slate-300 mb-8 uppercase tracking-widest flex items-center gap-2">
        <div className="w-1 h-4 rounded-full" style={{ backgroundColor: accent }}></div> {title}
        {page > 0 && <span className="text-[10px] text-slate-500 font-normal normal-case ml-2">({pageSize * page}d ago)</span>}
      </h3>
      
      {/* Hover Navigation Arrows */}
      {canGoBack && (
        <button 
          onClick={() => setPage(p => p + 1)}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-600 flex items-center justify-center opacity-0 group-hover/chart:opacity-100 transition-all duration-300 backdrop-blur-sm shadow-lg"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
      )}
      {canGoForward && (
        <button 
          onClick={() => setPage(p => p - 1)}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-600 flex items-center justify-center opacity-0 group-hover/chart:opacity-100 transition-all duration-300 backdrop-blur-sm shadow-lg"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      )}

      <div className="h-64">
        {renderChart(pageData, `${title}-page-${page}`)}
      </div>
      {subtitle && <p className="text-[10px] text-slate-500 mt-4 text-center">{subtitle}</p>}
    </div>
  );
};

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ tasks, aiInsights, onUpdateInsights }) => {
  const stats = useMemo(() => {
    const total = tasks.length;
    const completedTasks = tasks.filter(t => t.completed);
    const completed = completedTasks.length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Category distribution
    const validCategories = ['Health', 'Personal', 'General', 'Work', 'Travel', 'Finance', 'Learning'];
    const categories: Record<string, { count: number, totalRating: number, ratedCount: number }> = {};
    tasks.forEach(t => {
      const cat = validCategories.includes(t.category) ? t.category : 'General';
      if (!categories[cat]) {
        categories[cat] = { count: 0, totalRating: 0, ratedCount: 0 };
      }
      categories[cat].count++;
      if (t.rating) {
        categories[cat].totalRating += t.rating;
        categories[cat].ratedCount++;
      }
    });

    const categoryData = Object.entries(categories).map(([name, data]) => ({
      name,
      value: data.count,
      avgRating: data.ratedCount > 0 ? (data.totalRating / data.ratedCount).toFixed(1) : 0
    }));

    // Priority completion data
    const priorityStats = {
      high: { total: 0, done: 0 },
      medium: { total: 0, done: 0 },
      low: { total: 0, done: 0 }
    };
    tasks.forEach(t => {
      if (priorityStats[t.priority]) {
        priorityStats[t.priority].total++;
        if (t.completed) priorityStats[t.priority].done++;
      }
    });
    const priorityData = Object.entries(priorityStats).map(([name, data]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      rate: data.total > 0 ? Math.round((data.done / data.total) * 100) : 0,
      count: data.total
    }));

    // Ratings data
    const ratings = completedTasks.filter(t => t.rating !== null).map(t => t.rating as number);
    const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : 'N/A';

    // Daily completion trend & Month stats
    const dateGroups: Record<string, { date: string, count: number, rating: number, ratedCount: number, assigned: number }> = {};
    const monthCounts: Record<string, { name: string, assigned: number }> = {};

    tasks.forEach(task => {
      const date = task.date;

      const d = new Date(date);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const monthName = d.toLocaleDateString('en-US', { month: 'short' });
      if (!monthCounts[monthName]) monthCounts[monthName] = { name: monthName, assigned: 0 };
      monthCounts[monthName].assigned++;

      if (!dateGroups[date]) {
        dateGroups[date] = { date, count: 0, rating: 0, ratedCount: 0, assigned: 0 };
      }
      dateGroups[date].assigned++;
      if (task.completed) {
        dateGroups[date].count++;
        if (task.rating) {
          dateGroups[date].rating += task.rating;
          dateGroups[date].ratedCount++;
        }
      }
    });

    const completionTrend = Object.values(dateGroups)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        avgRating: d.ratedCount > 0 ? parseFloat((d.rating / d.ratedCount).toFixed(1)) : 0,
        efficiency: d.assigned > 0 ? Math.round((d.count / d.assigned) * 100) : 0
      }));

    const monthData = Object.values(monthCounts).sort((a, b) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return months.indexOf(a.name) - months.indexOf(b.name);
    });

    return { total, completed, rate, categoryData, avgRating, completionTrend, priorityData, monthData };
  }, [tasks]);

  const [view, setView] = useState<'stats' | 'insights'>('stats');
  
  const today = new Date().toISOString().split('T')[0];
  const todayInsights = useMemo(() => {
    return aiInsights?.find(i => i.date === today)?.data || [];
  }, [aiInsights, today]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);

  const fetchInsights = async (forceRefetch = false) => {
    const usageKey = `lumina_insights_usage_${today}`;
    const count = parseInt(localStorage.getItem(usageKey) || '0', 10);

    if (count >= 2) {
      setUsageError("You have reached your daily limit of 2 AI Insight generations. Please try again tomorrow.");
      return;
    }

    setIsGenerating(true);
    setUsageError(null);
    try {
      // Pass today's existing insights so the LLM doesn't repeat them
      const generated = await geminiService.generateInsights(stats, todayInsights);
      if (generated && generated.length > 0) {
        if (onUpdateInsights) {
            const filtered = aiInsights?.filter(i => i.date !== today) || [];
            onUpdateInsights([...filtered, { date: today, data: generated }]);
        }
        localStorage.setItem(usageKey, (count + 1).toString());
      }
    } catch (e: any) {
      console.error(e);
      setUsageError(e.message || "I couldn't generate insights right now due to an API limit or connection issue.");
    } finally {
      setIsGenerating(false);
    }
  };

  // RESET LIMIT FOR TODAY
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const usageKey = `lumina_insights_usage_${today}`;
    localStorage.removeItem(usageKey);
  }, []);

  useEffect(() => {
    // Auto-fetch if no insights for today exist yet and we open the view
    if (view === 'insights' && todayInsights.length === 0 && !usageError && !isGenerating) {
      fetchInsights();
    }
  }, [view, todayInsights.length]);

  const getColorClasses = (colorStr: string) => {
    const c = colorStr?.toLowerCase() || '';
    if (c.includes('red') || c.includes('rose')) return 'text-red-500 border-red-500/30 bg-red-500/10';
    if (c.includes('orange') || c.includes('amber')) return 'text-amber-500 border-amber-500/30 bg-amber-500/10';
    if (c.includes('emerald') || c.includes('green')) return 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10';
    if (c.includes('cyan') || c.includes('teal')) return 'text-cyan-500 border-cyan-500/30 bg-cyan-500/10';
    if (c.includes('blue')) return 'text-blue-500 border-blue-500/30 bg-blue-500/10';
    if (c.includes('violet') || c.includes('purple')) return 'text-violet-500 border-violet-500/30 bg-violet-500/10';
    if (c.includes('pink')) return 'text-pink-500 border-pink-500/30 bg-pink-500/10';
    return 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10';
  };

  const IconMap: Record<string, React.ReactNode> = {
    clipboard: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>,
    check: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
    star: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>,
    lightning: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>,
    target: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>,
    flame: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>,
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-slate-800/30 rounded-3xl border border-slate-800 text-slate-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-6 opacity-20"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>
        <h3 className="text-xl font-semibold mb-2 text-slate-200">No data to analyze yet</h3>
        <p className="max-w-xs text-center">Your productivity insights will appear here once you start creating and completing tasks.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-end mb-4">
        <div className="flex bg-slate-900/80 p-1.5 rounded-2xl border border-white/5 gap-1.5 shadow-lg backdrop-blur-md">
          <button
            onClick={() => setView('stats')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${view === 'stats' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 ring-1 ring-blue-500/50' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="16" y1="12" x2="16" y2="16"></line><line x1="8" y1="10" x2="8" y2="16"></line></svg>
            Stats
          </button>
          <button
            onClick={() => setView('insights')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${view === 'insights' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 ring-1 ring-indigo-500/50' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            AI Insights
          </button>
        </div>
      </div>

      {view === 'stats' ? (
        <>
          {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tasks Card */}
        <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700/50 shadow-sm group hover:border-blue-500/30 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Tasks</p>
            <div className="text-blue-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="2" /><path d="M9 14h6" /><path d="M9 18h6" /><path d="M9 10h2" /></svg>
            </div>
          </div>
          <h2 className="text-3xl font-black text-slate-100">{stats.total}</h2>
        </div>

        {/* Completed Card */}
        <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700/50 shadow-sm group hover:border-emerald-500/30 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Completed</p>
            <div className="text-emerald-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /></svg>
            </div>
          </div>
          <h2 className="text-3xl font-black text-emerald-400">{stats.completed}</h2>
        </div>

        {/* Avg Rating Card */}
        <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700/50 shadow-sm group hover:border-amber-500/30 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Avg. Rating</p>
            <div className="text-amber-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
            </div>
          </div>
          <h2 className="text-3xl font-black text-amber-400">{stats.avgRating}</h2>
        </div>

        {/* Efficiency Card */}
        <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700/50 shadow-sm group hover:border-violet-500/30 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Efficiency</p>
            <div className="text-violet-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
            </div>
          </div>
          <h2 className="text-3xl font-black text-violet-400">{stats.rate}%</h2>
        </div>
      </div>

      {/* Primary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Productivity Trend */}
        <PaginatedChart
          title="Activity Trend"
          accentColor="blue"
          data={stats.completionTrend}
          pageSize={14}
          renderChart={(pageData, pageKey) => (
            <ResponsiveContainer width="100%" height="100%" key={pageKey}>
              <AreaChart data={pageData}>
                <defs>
                  <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                  itemStyle={{ color: '#f8fafc' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Legend verticalAlign="top" height={36} />
                <Area name="Completed Tasks" type="monotone" dataKey="count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTrend)" strokeWidth={3} />
                <Line name="Avg Performance" type="monotone" dataKey="avgRating" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        />

        {/* Day Efficiency */}
        <PaginatedChart
          title="Day Efficiency"
          accentColor="violet"
          data={stats.completionTrend}
          pageSize={14}
          subtitle="Percentage of assigned tasks completed per day."
          renderChart={(pageData, pageKey) => (
            <ResponsiveContainer width="100%" height="100%" key={pageKey}>
              <AreaChart data={pageData}>
                <defs>
                  <linearGradient id="colorEfficiency" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                  itemStyle={{ color: '#f8fafc' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Legend verticalAlign="top" height={36} />
                <Area name="Efficiency (%)" type="monotone" dataKey="efficiency" stroke="#a78bfa" fillOpacity={1} fill="url(#colorEfficiency)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        />
      </div>

      {/* Secondary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Category Share */}
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 lg:col-span-1">
          <h3 className="text-sm font-bold text-slate-300 mb-6 uppercase tracking-widest">Focus Areas</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.categoryData}
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                >
                  {stats.categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Performance Radar */}
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-300 mb-6 uppercase tracking-widest">Category Performance Score</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={stats.categoryData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="name" stroke="#64748b" fontSize={10} />
                <PolarRadiusAxis angle={30} domain={[0, 5]} stroke="#64748b" fontSize={8} />
                <Radar
                  name="Avg Rating"
                  dataKey="avgRating"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.4}
                />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tertiary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        {/* Priority Breakdown */}
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 h-[400px]">
          <h3 className="text-sm font-bold text-slate-300 mb-8 uppercase tracking-widest flex items-center gap-2">
            <div className="w-1 h-4 bg-red-500 rounded-full"></div> Priority Breakdown
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.priorityData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                <XAxis type="number" stroke="#64748b" fontSize={10} domain={[0, 100]} />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={60} />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                  itemStyle={{ color: '#f8fafc' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Bar name="Completion Rate (%)" dataKey="rate" radius={[0, 4, 4, 0]}>
                  {stats.priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.name === 'High' ? '#ef4444' : entry.name === 'Medium' ? '#f59e0b' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-500 mt-4 text-center">Shows percentage of tasks completed per priority level.</p>
        </div>

        {/* Monthly Tasks */}
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 h-[400px]">
          <h3 className="text-sm font-bold text-slate-300 mb-8 uppercase tracking-widest flex items-center gap-2">
            <div className="w-1 h-4 bg-emerald-500 rounded-full"></div> Monthly Tasks
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: '#334155', opacity: 0.4 }}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                  itemStyle={{ color: '#f8fafc' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Bar name="Assigned Tasks" dataKey="assigned" radius={[4, 4, 0, 0]} fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-500 mt-4 text-center">Total number of tasks assigned across different months.</p>
        </div>
      </div>
        </>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                </span>
                Automated Insights
              </h3>
              <p className="text-slate-400 text-sm mt-2">Personalized AI feedback based on your recent activity.</p>
            </div>
            <button
              onClick={fetchInsights}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-sm transition-all shadow-md group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-500 ${isGenerating ? 'animate-spin' : 'group-hover:rotate-180'}`}><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.6 5.6"/></svg>
              Refresh Insights
            </button>
          </div>

          {usageError && (
            <div className="mb-6 bg-slate-800 border border-indigo-500/30 text-indigo-300 p-4 rounded-2xl flex items-center gap-4 text-sm font-medium shadow-[0_0_15px_rgba(99,102,241,0.1)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-indigo-400"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              {usageError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {isGenerating ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-slate-800/40 border border-slate-700/50 p-6 rounded-3xl h-[120px] animate-pulse"></div>
              ))
            ) : (
              todayInsights.map((insight, index) => (
                <div
                  key={insight.title + index}
                  className={`bg-slate-800/60 border border-slate-700 p-6 rounded-3xl shadow-lg flex gap-5 items-start animate-in fade-in slide-in-from-left-8 hover:border-indigo-500/40 transition-colors group relative overflow-hidden`}
                  style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'both' }}
                >
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-colors"></div>
                  
                  <div className={`w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center text-3xl border shadow-inner ${getColorClasses(insight.color)}`}>
                    {IconMap[insight.icon] || IconMap['star']}
                  </div>
                  <div className="flex-1 min-w-0 z-10">
                    <h4 className="text-lg font-bold text-slate-100 mb-2">{insight.title}</h4>
                    <p className="text-sm text-slate-400 leading-relaxed">{insight.reason}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
