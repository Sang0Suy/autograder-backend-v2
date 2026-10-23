import { useState } from 'react';
import { Cloud, RefreshCw, Download, Upload, ShieldCheck, CheckCircle2, AlertCircle, Link2, Link2Off } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';

interface Platform {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    isConnected: boolean;
    lastSync?: string;
}

export default function EcosystemSync() {
    const [isSyncing, setIsSyncing] = useState(false);

    // Quản lý trạng thái kết nối các nền tảng
    const [platforms, setPlatforms] = useState<Platform[]>([
        {
            id: 'google_classroom',
            name: 'Google Classroom',
            description: 'Đồng bộ danh sách lớp và đẩy điểm trực tiếp lên Google Classroom.',
            icon: '📚',
            color: 'from-green-500 to-emerald-600',
            isConnected: true,
            lastSync: 'Vừa xong'
        },
        {
            id: 'ms_teams',
            name: 'Microsoft Teams',
            description: 'Liên kết Assignment, thông báo điểm qua kênh chat Teams.',
            icon: '👥',
            color: 'from-indigo-500 to-blue-600',
            isConnected: false
        },
        {
            id: 'moodle',
            name: 'Moodle LMS',
            description: 'Đẩy điểm chuẩn LTI 1.3 và đồng bộ bài tập chuẩn SCORM.',
            icon: '🎓',
            color: 'from-orange-500 to-amber-600',
            isConnected: false
        }
    ]);

    const handleToggleConnect = (id: string) => {
        setPlatforms(prev => prev.map(p => {
            if (p.id === id) {
                const newStatus = !p.isConnected;
                if (newStatus) toast.success(`Đã kết nối thành công với ${p.name}!`);
                else toast.info(`Đã ngắt kết nối với ${p.name}.`);
                return { ...p, isConnected: newStatus, lastSync: newStatus ? 'Chưa đồng bộ' : undefined };
            }
            return p;
        }));
    };

    const handleSync = async (type: 'pull' | 'push') => {
        const connectedCount = platforms.filter(p => p.isConnected).length;
        if (connectedCount === 0) {
            toast.error("Vui lòng kết nối ít nhất 1 nền tảng trước khi đồng bộ!");
            return;
        }

        setIsSyncing(true);
        const toastId = toast.loading(type === 'pull' ? "Đang kéo danh sách học sinh từ các hệ sinh thái..." : "Đang đẩy điểm số lên hệ thống LMS...");

        try {
            // Giả lập thời gian call API (Thực tế sẽ gọi axios.post('/api/Integration/Sync'))
            await new Promise(resolve => setTimeout(resolve, 2500));

            toast.success(type === 'pull' ? "Đồng bộ danh sách lớp thành công!" : "Đã cập nhật bảng điểm lên toàn bộ hệ sinh thái!", { id: toastId });

            // Cập nhật thời gian Last Sync
            const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            setPlatforms(prev => prev.map(p => p.isConnected ? { ...p, lastSync: `Hôm nay lúc ${now}` } : p));
        } catch {
            toast.error("Lỗi đồng bộ. Vui lòng kiểm tra lại API Key.", { id: toastId });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500">

            {/* HEADER */}
            <div className="bg-white/80 backdrop-blur-2xl p-6 md:p-8 rounded-[2rem] shadow-[0_10px_40px_rgb(0,0,0,0.06)] border border-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 flex items-center tracking-tight">
                        <Cloud className="w-8 h-8 mr-3 text-indigo-600" /> Hệ Sinh Thái Giáo Dục
                    </h2>
                    <p className="text-base text-slate-500 mt-2 font-medium">Liên kết API không viền (Headless LMS) với các nền tảng đào tạo hàng đầu.</p>
                </div>

                <div className="flex gap-3">
                    <Button
                        disabled={isSyncing} onClick={() => handleSync('pull')}
                        className="bg-white text-indigo-600 hover:bg-indigo-50 border border-indigo-200 shadow-sm rounded-xl font-bold h-12 px-6"
                    >
                        {isSyncing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                        Kéo Danh Sách
                    </Button>
                    <Button
                        disabled={isSyncing} onClick={() => handleSync('push')}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md rounded-xl font-bold h-12 px-6"
                    >
                        {isSyncing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        Đẩy Điểm Lên LMS
                    </Button>
                </div>
            </div>

            {/* DANH SÁCH CÁC NỀN TẢNG TÍCH HỢP */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {platforms.map(platform => (
                    <div key={platform.id} className="bg-white/90 backdrop-blur-xl rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col h-full hover:shadow-md transition-shadow relative overflow-hidden">

                        {/* Background Decoration */}
                        <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${platform.color} rounded-full blur-3xl opacity-10 -translate-y-1/2 translate-x-1/2 pointer-events-none`}></div>

                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl bg-gradient-to-br ${platform.color} shadow-lg text-white`}>
                                {platform.icon}
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-black flex items-center border ${platform.isConnected ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                                {platform.isConnected ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Đã Liên Kết</> : <><AlertCircle className="w-3 h-3 mr-1" /> Ngắt Kết Nối</>}
                            </span>
                        </div>

                        <h3 className="text-xl font-black text-slate-800 mb-2">{platform.name}</h3>
                        <p className="text-slate-500 font-medium text-sm leading-relaxed mb-6 flex-1">
                            {platform.description}
                        </p>

                        <div className="mt-auto space-y-4 relative z-10">
                            {platform.isConnected && (
                                <div className="flex items-center text-xs font-bold text-slate-400 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <RefreshCw className="w-3 h-3 mr-2" /> Đồng bộ lần cuối: {platform.lastSync}
                                </div>
                            )}

                            <Button
                                onClick={() => handleToggleConnect(platform.id)}
                                variant={platform.isConnected ? 'outline' : 'default'}
                                className={`w-full rounded-xl font-bold h-11 ${platform.isConnected ? 'text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200' : `bg-gradient-to-r ${platform.color} text-white border-none shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all`}`}
                            >
                                {platform.isConnected ? <><Link2Off className="w-4 h-4 mr-2" /> Hủy Liên Kết</> : <><Link2 className="w-4 h-4 mr-2" /> Kết Nối Ngay</>}
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            {/* BẢNG TÓM TẮT KIẾN TRÚC API (Mockup hiển thị dữ liệu) */}
            <div className="bg-slate-900 rounded-[2rem] p-8 shadow-xl text-white mt-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3"></div>
                <div className="relative z-10">
                    <h3 className="text-xl font-black flex items-center mb-4 text-indigo-400">
                        <ShieldCheck className="w-6 h-6 mr-2" /> API & Webhook Security
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                            <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Phương thức Xác thực</div>
                            <div className="font-medium text-lg">OAuth 2.0 (Google)</div>
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                            <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Cơ chế đồng bộ</div>
                            <div className="font-medium text-lg">REST API & Webhooks</div>
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                            <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Mã hóa dữ liệu</div>
                            <div className="font-medium text-lg text-emerald-400">AES-256 (Mức Ngân hàng)</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}