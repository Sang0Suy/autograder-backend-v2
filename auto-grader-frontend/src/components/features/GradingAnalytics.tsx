import { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Trophy, TrendingUp, Users, ShieldAlert, Activity } from 'lucide-react';
import axios from 'axios';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface AnalyticsProps {
    results: any[];
}

export default function GradingAnalytics({ results }: AnalyticsProps) {
    const [itemAnalysis, setItemAnalysis] = useState<any[]>([]);
    // Tách riêng việc gọi API ra một useEffect độc lập
    useEffect(() => {
        const fetchAnalysis = async () => {
            if (results && results.length > 0) {
                // Sửa allResults thành results
                const testIdToAnalyze = results[0].testId || results[0].TestId;
                if (!testIdToAnalyze) return;

                try {
                    const analysisRes = await axios.get(`/api/Stats/item-analysis/${testIdToAnalyze}`);
                    setItemAnalysis(analysisRes.data);
                } catch (e) {
                    console.error("Lỗi lấy dữ liệu phân tích câu hỏi", e);
                }
            }
        };
        fetchAnalysis();
    }, [results]); // Chạy lại khi biến results thay đổi
    // 1. XỬ LÝ DỮ LIỆU THỐNG KÊ (Data Processing)
    const stats = useMemo(() => {
        if (!results || results.length === 0) return null;

        const total = results.length;
        const validScores = results.map(r => r.totalScore !== undefined ? r.totalScore : (r.TotalScore || 0));
        const average = validScores.reduce((a, b) => a + b, 0) / total;

        const passed = validScores.filter(s => s >= 5).length;
        const passRate = (passed / total) * 100;

        // 🔥 ĐẾM SỐ BÀI THI BỊ AI CẮM CỜ (Đạo văn hoặc cần duyệt tay)
        const flaggedCount = results.filter(r =>
            r.isPlagiarized === true || r.IsPlagiarized === true ||
            r.needsManualReview === true || r.NeedsManualReview === true
        ).length;
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

        return { total, average: average.toFixed(2), passRate: passRate.toFixed(1), distribution, pieData, flaggedCount };
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

                {/* 🔥 WIDGET MỚI: THEO DÕI CẢNH BÁO TỪ AI */}
                <div className={`bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 flex items-center gap-4 ${stats.flaggedCount > 0 ? 'ring-2 ring-red-200' : ''}`}>
                    <div className={`p-4 rounded-2xl shadow-inner ${stats.flaggedCount > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}>
                        <ShieldAlert className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Cảnh Báo AI</p>
                        <p className={`text-3xl font-black ${stats.flaggedCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>{stats.flaggedCount} Bài</p>
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
            {/* BIỂU ĐỒ PHÂN TÍCH ĐỘ KHÓ CÂU HỎI */}
            {itemAnalysis && itemAnalysis.length > 0 && (
                <div className="bg-white/80 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mt-6">
                    <div className="flex items-center mb-6">
                        <Activity className="w-6 h-6 mr-3 text-emerald-600" />
                        <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">Phân Tích Độ Khó Từng Câu Hỏi</h3>
                            <p className="text-sm font-medium text-slate-500">Tỷ lệ học sinh trả lời đúng ở mỗi câu.</p>
                        </div>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={itemAnalysis}
                                margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis
                                    dataKey="QuestionNumber"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 13, fontWeight: 'bold' }}
                                    tickFormatter={(value) => `Câu ${value}`}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 13, fontWeight: 'bold' }}
                                    tickFormatter={(value) => `${value}%`}
                                    domain={[0, 100]}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px 16px', fontWeight: 'bold', color: '#1e293b' }}
                                    formatter={(value: any) => [`${value}%`, 'Tỷ lệ trả lời đúng']}
                                    labelFormatter={(label) => `Câu hỏi số ${label}`}
                                />
                                <Bar dataKey="CorrectRate" radius={[6, 6, 0, 0]} maxBarSize={50}>
                                    {itemAnalysis.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.CorrectRate < 40 ? '#ef4444' : entry.CorrectRate < 70 ? '#f59e0b' : '#10b981'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap justify-center gap-6 mt-4 pt-4 border-t border-slate-100">
                        <div className="flex items-center text-sm font-bold text-slate-600"><span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span> &lt; 40% (Rất khó)</div>
                        <div className="flex items-center text-sm font-bold text-slate-600"><span className="w-3 h-3 rounded-full bg-amber-500 mr-2"></span> 40% - 70% (Trung bình)</div>
                        <div className="flex items-center text-sm font-bold text-slate-600"><span className="w-3 h-3 rounded-full bg-emerald-500 mr-2"></span> &gt; 70% (Dễ)</div>
                    </div>
                </div>
            )}
        </div>
    );
}