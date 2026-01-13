
import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { Task } from '../types';

interface AnalyticsDashboardProps {
  tasks: Task[];
}

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

    // Daily completion trend
    const dateGroups: Record<string, { date: string, count: number, rating: number, ratedCount: number }> = {};
    tasks.forEach(task => {
      const date = task.date;
      if (!dateGroups[date]) {
        dateGroups[date] = { date, count: 0, rating: 0, ratedCount: 0 };
      }
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
      .slice(-14)
      .map(d => ({
        ...d,
        avgRating: d.ratedCount > 0 ? parseFloat((d.rating / d.ratedCount).toFixed(1)) : 0
      }));

    return { total, completed, rate, categoryData, avgRating, completionTrend, priorityData };
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
        {[
          { label: 'Total Tasks', value: stats.total, color: 'text-slate-100', icon: '📋' },
          { label: 'Completed', value: stats.completed, color: 'text-blue-400', icon: '✅' },
          { label: 'Avg. Rating', value: stats.avgRating, color: 'text-yellow-400', icon: '⭐' },
          { label: 'Efficiency', value: `${stats.rate}%`, color: 'text-green-400', icon: '⚡' }
        ].map((card, i) => (
          <div key={i} className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700/50 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{card.label}</p>
              <span className="text-xl">{card.icon}</span>
            </div>
            <h2 className={`text-3xl font-black ${card.color}`}>{card.value}</h2>
          </div>
        ))}
      </div>

      {/* Primary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Productivity Trend */}
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 h-[400px]">
          <h3 className="text-sm font-bold text-slate-300 mb-8 uppercase tracking-widest flex items-center gap-2">
            <div className="w-1 h-4 bg-blue-500 rounded-full"></div> Activity Trend
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.completionTrend}>
                <defs>
                  <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Legend verticalAlign="top" height={36}/>
                <Area name="Completed Tasks" type="monotone" dataKey="count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTrend)" strokeWidth={3} />
                <Line name="Avg Performance" type="monotone" dataKey="avgRating" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Priority Efficiency */}
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
                  cursor={{fill: 'transparent'}}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
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
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px' }} />
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
    </div>
  );
};

export default AnalyticsDashboard;
