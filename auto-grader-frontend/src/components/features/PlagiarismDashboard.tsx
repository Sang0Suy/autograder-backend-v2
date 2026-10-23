import { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, Ban, ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import axios from 'axios';

interface StudentResult {
    id?: string; Id?: string;
    studentName?: string; StudentName?: string;
    studentCode?: string; StudentCode?: string;
    testId?: string; TestId?: string;
    totalScore?: number; TotalScore?: number;
    paperImageUrl?: string; PaperImageUrl?: string;
    gradedAt?: string; GradedAt?: string;
    confidenceScore?: number; ConfidenceScore?: number;
    needsManualReview?: boolean; NeedsManualReview?: boolean;
    isPlagiarized?: boolean; IsPlagiarized?: boolean;
    plagiarismNote?: string; PlagiarismNote?: string;
}

export default function PlagiarismDashboard() {
    const [flaggedResults, setFlaggedResults] = useState<StudentResult[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const fetchFlaggedResults = async () => {
        try {
            setIsLoading(true);
            const response = await axios.get('/api/StudentResults?pageSize=1000');
            const allResults: StudentResult[] = Array.isArray(response.data)
                ? response.data
                : response.data?.Data || response.data?.data || response.data?.items || [];

            // Chỉ lọc ra những bài bị cờ đỏ hoặc cờ vàng
            const flagged = allResults.filter(item =>
                item.isPlagiarized || item.IsPlagiarized ||
                item.needsManualReview || item.NeedsManualReview
            );

            setFlaggedResults(flagged);
        } catch (error) {
            console.error("Lỗi tải dữ liệu kiểm duyệt:", error);
            toast.error("Không thể tải danh sách kiểm duyệt!");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Khai báo một hàm async ngay bên trong useEffect
        const loadData = async () => {
            await fetchFlaggedResults();
        };

        // Gọi hàm đó
        loadData();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleResolve = async (result: StudentResult, action: 'penalize' | 'ignore') => {
        const id = result.id || result.Id;
        if (!id) return;

        const confirmMsg = action === 'penalize'
            ? `Phạt 0 ĐIỂM bài của ${result.studentName || result.StudentName}?`
            : `Đánh dấu bài của ${result.studentName || result.StudentName} là HỢP LỆ?`;

        if (!window.confirm(confirmMsg)) return;

        setProcessingId(id);
        try {
            const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
            const res = await axios.put(`/api/Grading/${id}/resolve-flag`, { Action: action }, config);

            toast.success(res.data.message);
            // Xóa thẻ bài làm này khỏi danh sách màn hình (Hiệu ứng bay màu)
            setFlaggedResults(prev => prev.filter(item => (item.id || item.Id) !== id));
        } catch (error) {
            toast.error("Lỗi xử lý hệ thống!");
            console.error(error);
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-700 p-2 md:p-4">
            {/* HEADER */}
            <div className="bg-white/80 backdrop-blur-2xl p-6 md:p-8 rounded-[2rem] shadow-[0_10px_40px_rgb(0,0,0,0.06)] border border-red-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-red-100 to-amber-50 rounded-full blur-3xl -z-10 opacity-70 translate-x-1/3 -translate-y-1/3"></div>
                <div>
                    <h2 className="text-3xl font-black text-slate-800 flex items-center tracking-tight">
                        <ShieldAlert className="w-8 h-8 mr-3 text-red-600" /> Trạm Kiểm Duyệt AI
                    </h2>
                    <p className="text-base text-slate-500 mt-2 font-medium">Nơi tập trung các bài thi có dấu hiệu gian lận hoặc độ tin cậy thấp cần giáo viên quyết định.</p>
                </div>
                <div className="bg-red-50 text-red-700 border border-red-200 px-6 py-3 rounded-full font-black text-lg shadow-sm">
                    {flaggedResults.length} bài cần duyệt
                </div>
            </div>

            {/* DANH SÁCH THẺ BÀI VI PHẠM */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64">
                    <Loader2 className="w-10 h-10 animate-spin text-red-500 mb-4" />
                    <span className="text-slate-500 font-medium">Đang quét toàn bộ hệ thống...</span>
                </div>
            ) : flaggedResults.length === 0 ? (
                <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] p-16 text-center shadow-sm border border-emerald-100">
                    <div className="bg-emerald-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ShieldCheck className="w-12 h-12 text-emerald-500" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 mb-2">Tuyệt vời! Hệ thống trong sạch.</h3>
                    <p className="text-slate-500 font-medium">Không phát hiện bài thi nào có dấu hiệu gian lận hoặc cần kiểm duyệt lại.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {flaggedResults.map((result, idx) => {
                        const id = result.id || result.Id;
                        const isPlagiarized = result.isPlagiarized || result.IsPlagiarized;
                        const confScore = result.confidenceScore || result.ConfidenceScore;
                        const imgUrl = result.paperImageUrl || result.PaperImageUrl;

                        return (
                            <div key={id || idx} className={`bg-white/90 backdrop-blur-md rounded-3xl p-6 border shadow-sm transition-all hover:shadow-lg flex flex-col justify-between h-full ${isPlagiarized ? 'border-red-200' : 'border-amber-200'}`}>
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center border ${isPlagiarized ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                            {isPlagiarized ? <><ShieldAlert className="w-3.5 h-3.5 mr-1.5" /> Đạo Văn</> : <><AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> Cần Duyệt ({confScore}%)</>}
                                        </div>
                                        <div className="font-black text-2xl text-slate-800">{result.totalScore ?? result.TotalScore} đ</div>
                                    </div>

                                    <h4 className="font-black text-slate-800 text-lg mb-1">{result.studentName || result.StudentName}</h4>
                                    <p className="text-sm font-medium text-slate-500 mb-4 truncate">{result.testId || result.TestId}</p>

                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6 min-h-[80px]">
                                        <p className="text-sm font-medium text-slate-700 leading-relaxed italic">
                                            "{result.plagiarismNote || result.PlagiarismNote || 'AI không chắc chắn về bài làm này do chất lượng ảnh hoặc nét chữ.'}"
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3 mt-auto">
                                    {imgUrl && !imgUrl.includes('(Đang chờ') && (
                                        <Button
                                            variant="outline"
                                            className="w-full rounded-xl font-bold bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                            onClick={() => window.open(imgUrl, '_blank')}
                                        >
                                            <ExternalLink className="w-4 h-4 mr-2" /> Xem ảnh bài làm gốc
                                        </Button>
                                    )}

                                    <div className="flex gap-2">
                                        <Button
                                            onClick={() => handleResolve(result, 'ignore')}
                                            disabled={processingId === id}
                                            className="flex-1 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 border border-slate-200 transition-colors"
                                        >
                                            {processingId === id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />} Bỏ qua
                                        </Button>
                                        <Button
                                            onClick={() => handleResolve(result, 'penalize')}
                                            disabled={processingId === id}
                                            className="flex-1 rounded-xl font-bold bg-red-500 hover:bg-red-600 text-white shadow-md border-none"
                                        >
                                            {processingId === id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4 mr-1.5" />} Phạt 0đ
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
}