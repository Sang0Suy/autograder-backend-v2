import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Trophy, TrendingUp, Users, AlertTriangle } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface AnalyticsProps {
    results: any[];
}

export default function GradingAnalytics({ results }: AnalyticsProps) {
    // 1. XỬ LÝ DỮ LIỆU THỐNG KÊ (Data Processing)
    const stats = useMemo(() => {
        if (!results || results.length === 0) return null;

        const total = results.length;
        const validScores = results.map(r => r.totalScore !== undefined ? r.totalScore : (r.TotalScore || 0));
        const average = validScores.reduce((a, b) => a + b, 0) / total;

        const passed = validScores.filter(s => s >= 5).length;
        const passRate = (passed / total) * 100;

        // Phân loại phổ điểm cho Bar Chart
        const distribution = [
            { name: '0 - 3.9', count: validScores.filter(s => s < 4).length },
            { name: '4 - 4.9', count: validScores.filter(s => s >= 4 && s < 5).length },
            { name: '5 - 6.4', count: validScores.filter(s => s >= 5 && s < 6.5).length },
            { name: '6.5 - 7.9', count: validScores.filter(s => s >= 6.5 && s < 8).length },
            { name: '8 - 10', count: validScores.filter(s => s >= 8).length },
        ];

        // Dữ liệu cho Pie Chart (Đậu / Rớt)
        const pieData = [
            { name: 'Đạt (>= 5)', value: passed },
            { name: 'Chưa Đạt (< 5)', value: total - passed },
        ];

        return { total, average: average.toFixed(2), passRate: passRate.toFixed(1), distribution, pieData };
    }, [results]);

    if (!stats) return null;

    const COLORS = ['#10b981', '#f43f5e']; // Xanh ngọc (Đạt) - Đỏ hồng (Chưa đạt)

    return (
        <div className="space-y-6 mb-8 animate-in slide-in-from-bottom-4 duration-700">
            {/* Hàng 1: Các thẻ Widget thống kê nhanh */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 flex items-center gap-4">
                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl shadow-inner"><Users className="w-8 h-8" /></div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Tổng số bài</p>
                        <p className="text-3xl font-black text-slate-800">{stats.total}</p>
                    </div>
                </div>

                <div className="bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 flex items-center gap-4">
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl shadow-inner"><TrendingUp className="w-8 h-8" /></div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Điểm Trung Bình</p>
                        <p className="text-3xl font-black text-slate-800">{stats.average}</p>
                    </div>
                </div>

                <div className="bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 flex items-center gap-4">
                    <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl shadow-inner"><Trophy className="w-8 h-8" /></div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Tỷ lệ Đạt</p>
                        <p className="text-3xl font-black text-slate-800">{stats.passRate}%</p>
                    </div>
                </div>

                <div className="bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 flex items-center gap-4">
                    <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl shadow-inner"><AlertTriangle className="w-8 h-8" /></div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Cần chú ý</p>
                        <p className="text-3xl font-black text-slate-800">{stats.pieData[1].value} HS</p>
                    </div>
                </div>
            </div>

            {/* Hàng 2: Biểu đồ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Biểu đồ tròn: Tỷ lệ Đậu Rớt */}
                <div className="lg:col-span-1 bg-white/70 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 flex flex-col items-center">
                    <h3 className="text-lg font-black text-slate-800 mb-4 w-full text-left">Tỷ Lệ Đạt / Chưa Đạt</h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {stats.pieData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip wrapperClassName="rounded-xl border-none shadow-lg" />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Biểu đồ cột: Phổ điểm */}
                <div className="lg:col-span-2 bg-white/70 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80">
                    <h3 className="text-lg font-black text-slate-800 mb-6">Phổ Điểm Chi Tiết</h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontWeight: 600 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontWeight: 600 }} />
                                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={40} name="Số lượng bài" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}