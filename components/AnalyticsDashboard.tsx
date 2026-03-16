
import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { Task } from '../types';

interface AnalyticsDashboardProps {
  tasks: Task[];
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

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ tasks }) => {
  const stats = useMemo(() => {
    const total = tasks.length;
    const completedTasks = tasks.filter(t => t.completed);
    const completed = completedTasks.length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Category distribution
    const categories: Record<string, { count: number, totalRating: number, ratedCount: number }> = {};
    tasks.forEach(t => {
      if (!categories[t.category]) {
        categories[t.category] = { count: 0, totalRating: 0, ratedCount: 0 };
      }
      categories[t.category].count++;
      if (t.rating) {
        categories[t.category].totalRating += t.rating;
        categories[t.category].ratedCount++;
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

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

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
    <div className="space-y-8">
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
    </div>
  );
};

export default AnalyticsDashboard;
