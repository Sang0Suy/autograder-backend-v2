import { useState, useEffect } from 'react';
import axios, { AxiosError } from 'axios';
import { Loader2, TrendingUp, Award, BookOpen, Target, AlertCircle } from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
// 🔥 Sửa lỗi TS1484: Tách riêng import type TooltipProps
import type { TooltipProps } from 'recharts';

interface ProgressItem {
    examName: string;
    score: number;
    date: string;
    shortDate?: string;
}

interface DashboardData {
    profile: {
        studentCode: string;
        fullName: string;
        className: string;
    };
    stats: {
        totalExamsTaken: number;
        averageScore: number;
        passedExams: number;
        failedExams: number;
    };
    recentProgress: ProgressItem[];
    scoreColumns?: Record<string, number>;
}

// 🔥 Sửa lỗi TS2339: Tự định nghĩa cấu trúc dữ liệu tường minh cho Tooltip
interface CustomTooltipProps extends TooltipProps<number, string> {
    payload?: {
        value: number;
        payload: {
            examName: string;
        };
    }[];
    label?: string;
}

// Áp dụng kiểu dữ liệu CustomTooltipProps vào component
const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-100">
                <p className="font-bold text-slate-800 mb-1">{payload[0].payload.examName}</p>
                <p className="text-sm text-slate-500 mb-2">Ngày thi: {label}</p>
                <div className="flex items-center">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 mr-2"></span>
                    <span className="font-black text-emerald-600 text-lg">{payload[0].value} điểm</span>
                </div>
            </div>
        );
    }
    return null;
};

export default function StudentDashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setIsLoading(true);
                const response = await axios.get('/api/Students/my-grades');

                const formattedData: DashboardData = {
                    ...response.data,
                    recentProgress: response.data.recentProgress.map((item: ProgressItem) => ({
                        ...item,
                        shortDate: new Date(item.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
                    }))
                };

                setData(formattedData);
            } catch (err: unknown) {
                console.error("Lỗi tải dashboard:", err);
                if (err instanceof AxiosError) {
                    setError(typeof err.response?.data === 'string' ? err.response.data : "Không thể tải dữ liệu học tập. Vui lòng thử lại sau.");
                } else {
                    setError("Đã xảy ra lỗi không xác định.");
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    if (isLoading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
                <p className="text-slate-500 font-bold animate-pulse">Đang tổng hợp dữ liệu học tập...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-[50vh] flex items-center justify-center">
                <div className="bg-red-50/80 backdrop-blur-md p-8 rounded-3xl border border-red-200 text-center max-w-lg">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h3 className="text-xl font-black text-red-700 mb-2">Úi, có lỗi xảy ra!</h3>
                    <p className="text-red-600 font-medium">{error}</p>
                </div>
            </div>
        );
    }

    const { profile, stats, recentProgress, scoreColumns } = data;

    return (
        <div className="space-y-6 animate-in fade-in duration-700">

            {/* LỜI CHÀO & THÔNG TIN HỌC SINH */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-[2rem] p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10">
                    <h2 className="text-3xl md:text-4xl font-black mb-2 tracking-tight">
                        Chào mừng, {profile.fullName}! 🎉
                    </h2>
                    <p className="text-emerald-50 font-medium text-lg opacity-90">
                        Học sinh lớp <span className="font-bold text-white bg-white/20 px-3 py-1 rounded-lg ml-1">{profile.className}</span>
                        <span className="mx-3 opacity-50">|</span>
                        Mã HS: <span className="font-bold text-white">{profile.studentCode}</span>
                    </p>
                </div>
            </div>

            {/* CÁC THẺ THỐNG KÊ TỔNG QUAN */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">

                <div className="bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-transform duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                            <BookOpen className="w-6 h-6" />
                        </div>
                    </div>
                    <h3 className="text-slate-500 font-bold text-sm mb-1 uppercase tracking-wider">Tổng Bài Đã Làm</h3>
                    <p className="text-4xl font-black text-slate-800">{stats.totalExamsTaken}</p>
                </div>

                <div className="bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-transform duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
                            <Award className="w-6 h-6" />
                        </div>
                    </div>
                    <h3 className="text-slate-500 font-bold text-sm mb-1 uppercase tracking-wider">Điểm Trung Bình</h3>
                    <div className="flex items-baseline space-x-1">
                        <p className="text-4xl font-black text-amber-500">{stats.averageScore}</p>
                        <span className="text-slate-400 font-bold">/10</span>
                    </div>
                </div>

                <div className="bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-transform duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                            <Target className="w-6 h-6" />
                        </div>
                        <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg text-xs font-bold border border-emerald-100">Đạt (≥ 5.0)</span>
                    </div>
                    <h3 className="text-slate-500 font-bold text-sm mb-1 uppercase tracking-wider">Vượt Qua</h3>
                    <p className="text-4xl font-black text-emerald-600">{stats.passedExams}</p>
                </div>

                <div className="bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-transform duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                    </div>
                    <h3 className="text-slate-500 font-bold text-sm mb-1 uppercase tracking-wider">Tỷ lệ Hoàn Thành</h3>
                    <p className="text-4xl font-black text-indigo-600">
                        {stats.totalExamsTaken > 0 ? Math.round((stats.passedExams / stats.totalExamsTaken) * 100) : 0}%
                    </p>
                </div>

            </div>

            {/* KHU VỰC BIỂU ĐỒ PHONG ĐỘ */}
            <div className="bg-white/80 backdrop-blur-2xl p-6 md:p-8 rounded-[2rem] shadow-[0_10px_40px_rgb(0,0,0,0.06)] border border-white">
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center">
                            Biểu Đồ Phong Độ 📈
                        </h3>
                        <p className="text-slate-500 font-medium mt-1">Lịch sử điểm số 5 bài kiểm tra gần nhất của bạn</p>
                    </div>
                </div>

                {recentProgress.length > 0 ? (
                    <div className="h-[350px] w-full mt-8">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={recentProgress} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis
                                    dataKey="shortDate"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontWeight: 600 }}
                                    dy={10}
                                />
                                <YAxis
                                    domain={[0, 10]}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontWeight: 600 }}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Line
                                    type="monotone"
                                    dataKey="score"
                                    stroke="#10b981"
                                    strokeWidth={4}
                                    dot={{ r: 6, fill: '#10b981', strokeWidth: 3, stroke: '#fff' }}
                                    activeDot={{ r: 8, strokeWidth: 0, fill: '#059669' }}
                                    animationDuration={1500}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-[300px] flex flex-col items-center justify-center bg-slate-50/50 rounded-3xl border border-slate-100 border-dashed">
                        <span className="text-6xl mb-4">🤷‍♂️</span>
                        <p className="text-slate-500 font-bold text-lg">Chưa có đủ dữ liệu để vẽ biểu đồ.</p>
                        <p className="text-slate-400 font-medium">Hãy làm bài kiểm tra đầu tiên để xem phong độ nhé!</p>
                    </div>
                )}
            </div>

            {/* BẢNG ĐIỂM CHI TIẾT */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">

                {/* CỘT BÊN TRÁI: ĐIỂM TỔNG KẾT */}
                <div className="bg-white/80 backdrop-blur-2xl p-6 md:p-8 rounded-[2rem] shadow-[0_10px_40px_rgb(0,0,0,0.06)] border border-white lg:col-span-1">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight mb-6 flex items-center">
                        Điểm Tổng Kết 🎯
                    </h3>
                    {scoreColumns && Object.keys(scoreColumns).length > 0 ? (
                        <div className="space-y-3">
                            {Object.entries(scoreColumns).map(([key, val]) => (
                                <div key={key} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:shadow-md transition-shadow">
                                    <span className="font-bold text-slate-600">{key}</span>
                                    <span className="font-black text-2xl text-indigo-600">{val}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-slate-400 font-medium bg-slate-50/50 rounded-2xl border border-slate-100 border-dashed flex flex-col items-center">
                            <span className="text-5xl block mb-3">📭</span>
                            Chưa có điểm tổng kết
                        </div>
                    )}
                </div>

                {/* CỘT BÊN PHẢI: BẢNG LỊCH SỬ LÀM BÀI */}
                <div className="bg-white/80 backdrop-blur-2xl p-6 md:p-8 rounded-[2rem] shadow-[0_10px_40px_rgb(0,0,0,0.06)] border border-white lg:col-span-2">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">
                            Bảng Điểm Gần Đây 📝
                        </h3>
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">Tối đa 5 bài</span>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
                        <table className="w-full text-left border-collapse min-w-[500px]">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-100">
                                    <th className="py-4 px-5 font-bold text-slate-600 whitespace-nowrap">Ngày Thi</th>
                                    <th className="py-4 px-5 font-bold text-slate-600">Tên Bài Kiểm Tra</th>
                                    <th className="py-4 px-5 font-bold text-slate-600 text-center">Điểm Số</th>
                                    <th className="py-4 px-5 font-bold text-slate-600 text-center">Đánh Giá</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentProgress.length > 0 ? (
                                    recentProgress.map((item, index) => (
                                        <tr key={index} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                                            <td className="py-4 px-5 text-slate-500 font-medium whitespace-nowrap">{item.shortDate}</td>
                                            <td className="py-4 px-5 text-slate-800 font-bold max-w-[250px] truncate" title={item.examName}>{item.examName}</td>
                                            <td className="py-4 px-5 text-center">
                                                <span className={`font-black text-xl ${item.score >= 5 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                    {item.score}
                                                </span>
                                            </td>
                                            <td className="py-4 px-5 text-center">
                                                {item.score >= 8 ? (
                                                    <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">Giỏi 🎉</span>
                                                ) : item.score >= 6.5 ? (
                                                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-200">Khá 👍</span>
                                                ) : item.score >= 5 ? (
                                                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold border border-amber-200">TB 😐</span>
                                                ) : (
                                                    <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-200">Yếu 😢</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                                            Chưa có dữ liệu bài làm để hiển thị bảng điểm.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

        </div>
    );
}