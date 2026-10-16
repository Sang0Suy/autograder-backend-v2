import { useState, useEffect, useMemo } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import * as XLSX from 'xlsx'
import { Loader2, Image as ImageIcon, Download, Search, ChevronLeft, ChevronRight, CheckCircle2, FileText, PlayCircle, AlertTriangle, ShieldAlert } from "lucide-react"
import { Input } from "@/components/ui/input"
import { toast } from 'sonner'
import GradingAnalytics from './GradingAnalytics';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import axios from "axios"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// 🔥 ĐỊNH NGHĨA KIỂU DỮ LIỆU
interface GradingDetail {
    questionNumber?: number;
    QuestionNumber?: number;
    awardedScore?: number;
    AwardedScore?: number;
    finalScore?: number;
    FinalScore?: number; 
    aiFeedback?: string;
    AIFeedback?: string;
    teacherCorrection?: string;
    TeacherCorrection?: string;
    isTeacherModified?: boolean;
    IsTeacherModified?: boolean;
}

interface StudentResult {
    id?: string; Id?: string;
    studentName?: string; StudentName?: string;
    studentCode?: string; StudentCode?: string;
    testId?: string; TestId?: string;
    totalScore?: number; TotalScore?: number;
    paperImageUrl?: string; PaperImageUrl?: string;
    gradedAt?: string; GradedAt?: string;
    gradingDetails?: GradingDetail[];
    GradingDetails?: GradingDetail[];

    // 🔥 BỔ SUNG CÁC TRƯỜNG DỮ LIỆU TỪ AI
    confidenceScore?: number; ConfidenceScore?: number;
    needsManualReview?: boolean; NeedsManualReview?: boolean;
    isPlagiarized?: boolean; IsPlagiarized?: boolean;
    plagiarismNote?: string; PlagiarismNote?: string;
}

interface Rubric {
    id: string;
    title: string;
    examType?: string;
}

export default function GradingHistory() {
    const [history, setHistory] = useState<StudentResult[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedResult, setSelectedResult] = useState<StudentResult | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [rubrics, setRubrics] = useState<Rubric[]>([])

    const userRole = localStorage.getItem('role') || '';
    const myStudentCode = localStorage.getItem('ReferenceId') || '';
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    const getRubricTitle = (testId: string) => {
        if (!testId) return "Không rõ đề thi"
        const found = rubrics.find(r => r.id === testId)
        return found ? found.title : "Đề thi đã bị xóa"
    }

    const fetchHistory = async () => {
        try {
            const response = await axios.get('/api/StudentResults?pageSize=1000')

            let actualArray: StudentResult[] = Array.isArray(response.data)
                ? response.data
                : response.data?.Data || response.data?.data || response.data?.items || [];

            if (userRole === 'Student' && myStudentCode) {
                actualArray = actualArray.filter((item: StudentResult) =>
                    (item.studentCode || item.StudentCode || "").toLowerCase() === myStudentCode.toLowerCase()
                );
            }

            const sortedArray = actualArray.sort((a: StudentResult, b: StudentResult) => {
                const dateA = new Date(a.gradedAt || a.GradedAt || 0).getTime()
                const dateB = new Date(b.gradedAt || b.GradedAt || 0).getTime()
                return dateB - dateA
            })

            setHistory(sortedArray)
        } catch (error) {
            console.error("Lỗi khi tải lịch sử chấm bài:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const fetchRubrics = async () => {
        try {
            const res = await axios.get('/api/Rubrics')
            setRubrics(Array.isArray(res.data) ? res.data : [])
        } catch (error) {
            console.error("Lỗi tải đề thi:", error)
        }
    }

    const removeAccents = (str: string) => {
        if (!str) return ""
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    }

    const filteredHistory = useMemo(() => {
        if (!searchTerm.trim()) return history;

        const searchLower = removeAccents(searchTerm)

        return history.filter(item => {
            const name = removeAccents(item.studentName || item.StudentName || "Khách")
            const testTitle = removeAccents(getRubricTitle(item.testId || item.TestId || ""))
            return name.includes(searchLower) || testTitle.includes(searchLower)
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [history, searchTerm, rubrics])

    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
    const currentHistoryData = filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => {
        const initData = setTimeout(() => {
            fetchHistory()
            fetchRubrics()
        }, 0);
        return () => clearTimeout(initData);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        const backendUrl = "https://autograder-backend-sang.onrender.com/gradingHub";
        const connection = new HubConnectionBuilder()
            .withUrl(backendUrl, {
                accessTokenFactory: () => localStorage.getItem('token') || ""
            })
            .configureLogging(LogLevel.Information)
            .withAutomaticReconnect()
            .build();

        let isStarting = true;

        connection.start()
            .then(() => {
                isStarting = false;
                console.log("🟢 Đã kết nối mượt mà với Trạm phát sóng SignalR!");
                connection.on("ReceiveGradingUpdate", () => {
                    toast.success("🤖 AI vừa cập nhật dữ liệu mới!", { icon: '✨' });
                });
            })
            .catch(e => {
                isStarting = false;
                console.log("🔴 Lỗi kết nối SignalR: ", e);
            });

        return () => {
            if (!isStarting) {
                connection.stop();
            }
        };
    }, []);

    const formatDate = (dateString?: string) => {
        if (!dateString) return "Chưa cập nhật"
        const date = new Date(dateString)
        return date.toLocaleString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        })
    }

    const handleExportExcel = () => {
        if (history.length === 0) {
            toast.warning("Chưa có dữ liệu để xuất Excel!")
            return
        }
        try {
            const dataToExport = history.map((item, index) => ({
                "STT": index + 1,
                "Tên Học Sinh": item.studentName || item.StudentName || "Khách",
                "Tên Đề Thi": getRubricTitle(item.testId || item.TestId || ""),
                "Điểm Số": item.totalScore !== undefined ? item.totalScore : (item.TotalScore !== undefined ? item.TotalScore : 0),
                "Độ Tin Cậy (%)": item.confidenceScore || item.ConfidenceScore || 100,
                "Trạng Thái": item.isPlagiarized || item.IsPlagiarized ? "Đạo văn" : (item.needsManualReview || item.NeedsManualReview ? "Cần Duyệt Lại" : "Bình Thường"),
                "Thời Gian Chấm": formatDate(item.gradedAt || item.GradedAt),
                "Link Ảnh Bài Làm": item.paperImageUrl || item.PaperImageUrl || "Không có"
            }))

            const worksheet = XLSX.utils.json_to_sheet(dataToExport)
            const workbook = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(workbook, worksheet, "BangDiem")
            worksheet['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 40 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 50 }]

            XLSX.writeFile(workbook, "Bang_Diem_AutoGrader.xlsx")
            toast.success("Đã xuất file Excel thành công! 📊")
        } catch (error) {
            console.error("Lỗi khi xuất Excel:", error)
            toast.error("Có lỗi xảy ra khi xuất file!")
        }
    }

    const downloadFileWithCustomName = async (fileUrl: string, studentName: string) => {
        try {
            toast.info("Đang chuẩn bị file tải về...");
            const response = await fetch(fileUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const extMatch = fileUrl.match(/\.(doc|docx|txt|pdf|rar|zip)/i);
            const ext = extMatch ? extMatch[0] : ".docx";
            const fileName = `${studentName} - Bài Làm${ext}`;

            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();

            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success("Tải file hoàn tất!");
        } catch {
            window.open(fileUrl, '_blank');
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-700 p-2 md:p-4 relative min-h-screen">
            <div className="fixed inset-0 -z-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-50 via-slate-50 to-teal-50/50 pointer-events-none"></div>
            <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] bg-emerald-300/20 rounded-full blur-[120px] -z-10 pointer-events-none animate-pulse"></div>
            <div className="fixed bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-teal-400/20 rounded-full blur-[120px] -z-10 pointer-events-none animate-pulse delay-1000"></div>

            <div className="sticky top-2 md:top-4 z-40 space-y-4">
                <div className="bg-white/80 backdrop-blur-2xl p-6 md:p-8 rounded-[2rem] shadow-[0_10px_40px_rgb(0,0,0,0.06)] border border-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden transition-all">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-100 to-teal-50 rounded-full blur-3xl -z-10 opacity-70 translate-x-1/3 -translate-y-1/3"></div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 flex items-center tracking-tight">
                            <FileText className="w-8 h-8 mr-3 text-emerald-600" /> {userRole === 'Student' ? 'Lịch Sử Của Tôi' : 'Lịch Sử Chấm Bài'}
                        </h2>
                        <p className="text-base text-slate-500 mt-2 font-medium">Theo dõi điểm số, xem lại ảnh bài làm và phản hồi chi tiết từ AI</p>
                    </div>
                </div>

                <div className="bg-white/80 backdrop-blur-2xl p-4 rounded-[2rem] border border-white shadow-[0_10px_30px_rgb(0,0,0,0.04)] flex flex-col lg:flex-row items-center justify-between gap-4">
                    <div className="relative w-full lg:w-[450px]">
                        <Search className="absolute left-5 top-3.5 h-5 w-5 text-slate-400" />
                        <Input
                            placeholder={userRole === 'Student' ? "Tìm kiếm theo tên đề thi..." : "Tìm học sinh, tên đề thi..."}
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="pl-14 h-12 bg-white/50 border-white/60 focus-visible:ring-emerald-500 focus-visible:bg-white rounded-full transition-all text-base shadow-sm backdrop-blur-sm"
                        />
                    </div>
                    <div className="flex w-full lg:w-auto space-x-3">
                        <Button
                            variant="outline"
                            onClick={handleExportExcel}
                            className="flex-1 lg:flex-none h-12 rounded-full bg-white/50 text-emerald-700 hover:bg-emerald-50 border-white/60 font-bold px-6 shadow-sm backdrop-blur-sm transition-all"
                        >
                            <Download className="w-5 h-5 mr-2" /> Xuất Excel
                        </Button>
                        <Button variant="outline" onClick={() => { setIsLoading(true); fetchHistory(); }} className="flex-1 lg:flex-none h-12 rounded-full bg-white/50 text-slate-700 hover:bg-white border-white/60 font-bold px-6 shadow-sm backdrop-blur-sm transition-all">
                            🔄 Làm mới
                        </Button>
                    </div>
                </div>
            </div>

            {filteredHistory.length > 0 && <GradingAnalytics results={filteredHistory} />}

            <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-100/50 backdrop-blur-md">
                            <TableRow className="border-b border-slate-200/60">
                                <TableHead className="w-[80px] font-bold text-slate-700 pl-8 py-5">STT</TableHead>
                                <TableHead className="font-bold text-slate-700 py-5">Thời Gian Chấm</TableHead>
                                <TableHead className="font-bold text-slate-700 py-5 min-w-[200px]">Tên Học Sinh</TableHead>
                                <TableHead className="font-bold text-slate-700 py-5 max-w-[250px]">Tên Đề Thi</TableHead>
                                <TableHead className="text-center font-bold text-slate-700 py-5">Điểm Số</TableHead>
                                <TableHead className="text-right font-bold text-slate-700 pr-8 py-5">Xem Bài</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-48 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-3">
                                            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                                            <span className="font-medium text-base text-slate-500">Đang tải lịch sử từ hệ thống...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : currentHistoryData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-72 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-4 max-w-md mx-auto">
                                            <span className="text-6xl drop-shadow-md">🤷‍♂️</span>
                                            <p className="text-slate-500 font-bold text-lg">
                                                {searchTerm
                                                    ? "Tìm mỏi mắt không thấy bài nào giống vậy luôn á!"
                                                    : (userRole === 'Student' ? "Trống trơn! Chưa có bài nào được chấm cả. Trốn học đi net hả em? 🎮😂" : "Chưa có bài nào được chấm trên hệ thống.")}
                                            </p>
                                            {userRole === 'Student' && !searchTerm && (
                                                <Button
                                                    onClick={() => toast.info("Nhìn lên thanh Menu phía trên cùng, bấm 'Vào Phòng Thi' lẹ lên! Thầy cô đang chờ! 👨‍‍🏫💨", { icon: '🚨', duration: 4000 })}
                                                    className="mt-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-full font-black text-base shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 px-8 h-12 border-none"
                                                >
                                                    <PlayCircle className="w-5 h-5 mr-2" /> Điểm danh vào thi chuộc lỗi!
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                currentHistoryData.map((result, index) => {
                                    const displayId = result.id || result.Id || `temp-${index}`
                                    const name = result.studentName || result.StudentName || "Khách"
                                    const testId = result.testId || result.TestId || "N/A"
                                    const score = result.totalScore !== undefined ? result.totalScore : (result.TotalScore !== undefined ? result.TotalScore : 0)
                                    const date = result.gradedAt || result.GradedAt
                                    const imgUrl = result.paperImageUrl || result.PaperImageUrl
                                    const stt = (currentPage - 1) * itemsPerPage + index + 1;

                                    // Bắt các cờ cảnh báo từ AI
                                    const isPlagiarized = result.isPlagiarized || result.IsPlagiarized;
                                    const needsReview = result.needsManualReview || result.NeedsManualReview;
                                    const confScore = result.confidenceScore || result.ConfidenceScore;

                                    return (
                                        <TableRow key={displayId} className={`transition-all duration-200 border-b border-slate-100/60 last:border-0 ${isPlagiarized ? 'bg-red-50/50 hover:bg-red-50' : needsReview ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-white/80'}`}>
                                            <TableCell className="font-medium text-slate-600 pl-8">{stt}</TableCell>
                                            <TableCell className="text-slate-500 text-sm">
                                                <span className="bg-white/80 px-3 py-1.5 rounded-lg border border-slate-200/60 text-xs shadow-sm font-medium">{formatDate(date)}</span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-bold text-slate-800 text-base">{name}</div>
                                                {isPlagiarized && (
                                                    <div className="flex items-center mt-1 text-[11px] font-bold text-red-600 bg-red-100 border border-red-200 w-fit px-2 py-0.5 rounded-full shadow-sm">
                                                        <ShieldAlert className="w-3 h-3 mr-1" /> Phát hiện đạo văn!
                                                    </div>
                                                )}
                                                {!isPlagiarized && needsReview && (
                                                    <div className="flex items-center mt-1 text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-200 w-fit px-2 py-0.5 rounded-full shadow-sm">
                                                        <AlertTriangle className="w-3 h-3 mr-1" /> Cần duyệt lại ({confScore}%)
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell
                                                className="font-medium text-emerald-700 max-w-[250px] truncate"
                                                title={getRubricTitle(testId)}
                                            >
                                                {getRubricTitle(testId)}
                                            </TableCell>
                                            <TableCell className="text-center font-black text-xl text-emerald-600 bg-slate-50/30 backdrop-blur-sm">
                                                {score}
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                {imgUrl ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-full px-5 py-2 h-auto font-bold transition-colors shadow-sm bg-white/50 border border-white"
                                                        onClick={() => setSelectedResult(result)}
                                                    >
                                                        <ImageIcon className="w-4 h-4 mr-2" /> Xem Bài
                                                    </Button>
                                                ) : (
                                                    <span className="text-slate-400 text-xs italic font-medium px-4">Không có dữ liệu</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {filteredHistory.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between px-8 py-5 bg-slate-50/30 border-t border-slate-200/60 gap-4 backdrop-blur-md">
                        <div className="text-sm text-slate-500 font-medium text-center sm:text-left">
                            Hiển thị <span className="font-bold text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</span> đến <span className="font-bold text-slate-800">{Math.min(currentPage * itemsPerPage, filteredHistory.length)}</span> trong tổng số <span className="font-bold text-emerald-600">{filteredHistory.length}</span> kết quả
                        </div>
                        <div className="flex items-center space-x-2 bg-white/60 border border-white p-1.5 rounded-full shadow-sm backdrop-blur-sm">
                            <Button variant="ghost" size="sm" className="rounded-full hover:bg-white" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                                <ChevronLeft className="w-5 h-5" />
                            </Button>
                            <div className="text-sm font-bold text-slate-700 px-4">Trang {currentPage} / {totalPages || 1}</div>
                            <Button variant="ghost" size="sm" className="rounded-full hover:bg-white" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}>
                                <ChevronRight className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL PHÓNG TO CHI TIẾT */}
            <Dialog open={!!selectedResult} onOpenChange={() => setSelectedResult(null)}>
                {/* 🔥 SỬA LỖI TRÀN MÀN HÌNH TẠI ĐÂY: Thêm max-h-[90vh] và flex flex-col */}
                <DialogContent className="!max-w-5xl !w-[95vw] max-h-[90vh] flex flex-col bg-white/95 backdrop-blur-xl p-0 overflow-hidden border border-white/60 shadow-2xl rounded-3xl">

                    {/* THANH MÀU TRÊN CÙNG (Cố định - shrink-0) */}
                    <div className={`shrink-0 h-3 w-full ${selectedResult?.isPlagiarized || selectedResult?.IsPlagiarized ? 'bg-gradient-to-r from-red-500 to-rose-600' : 'bg-gradient-to-r from-emerald-500 to-teal-500'}`}></div>

                    {/* HEADER MODAL (Cố định - shrink-0) */}
                    <DialogHeader className="shrink-0 p-6 md:p-8 pb-4 bg-white/80 border-b border-slate-200/60 backdrop-blur-md z-10">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full gap-4">
                            <div>
                                <DialogTitle className="text-2xl font-black text-slate-800 tracking-tight flex items-center">
                                    <CheckCircle2 className="w-7 h-7 mr-3 text-emerald-600" />
                                    Chi Tiết Bài Làm - {(selectedResult?.studentName || selectedResult?.StudentName)}
                                </DialogTitle>

                                {/* HIỂN THỊ CẢNH BÁO CHI TIẾT */}
                                {(selectedResult?.isPlagiarized || selectedResult?.IsPlagiarized) && (
                                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start">
                                        <ShieldAlert className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
                                        <div>
                                            <h4 className="text-red-800 font-bold text-sm">Cảnh báo Đạo văn!</h4>
                                            <p className="text-red-600 text-xs mt-0.5">{selectedResult?.plagiarismNote || selectedResult?.PlagiarismNote}</p>
                                        </div>
                                    </div>
                                )}
                                {!(selectedResult?.isPlagiarized || selectedResult?.IsPlagiarized) && (selectedResult?.needsManualReview || selectedResult?.NeedsManualReview) && (
                                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center">
                                        <AlertTriangle className="w-5 h-5 text-amber-600 mr-2" />
                                        <span className="text-amber-800 font-bold text-sm">AI chấm điểm với độ tin cậy thấp ({selectedResult?.confidenceScore || selectedResult?.ConfidenceScore}%). Vui lòng giáo viên duyệt lại!</span>
                                    </div>
                                )}
                            </div>

                            {/* KHỐI ĐIỂM SỐ NỔI BẬT */}
                            <div className="bg-gradient-to-br from-indigo-600 to-blue-600 text-white px-8 py-4 rounded-2xl shadow-lg flex flex-col items-center justify-center min-w-[140px]">
                                <span className="font-black text-4xl leading-none">{selectedResult?.totalScore ?? selectedResult?.TotalScore}</span>
                                <span className="text-sm font-bold opacity-80 mt-1 uppercase tracking-wider">Điểm số</span>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* 🔥 BODY MODAL: CÓ THỂ CUỘN (flex-1 overflow-y-auto) */}
                    <div className="flex-1 overflow-y-auto bg-slate-100/50 p-4 md:p-8 custom-scrollbar">
                        {selectedResult && (() => {
                            const rawUrl = selectedResult.paperImageUrl || selectedResult.PaperImageUrl || "";

                            const isWait = rawUrl.includes("Đang chờ");
                            const isOnlineExam = rawUrl.includes("Thi Trực Tuyến") || rawUrl.includes("Online Exam");
                            const isDocument = rawUrl.match(/\.(doc|docx|txt|pdf|rar|zip)\$/i) != null || rawUrl.includes("📄 File");
                            const isImage = rawUrl.match(/\.(jpeg|jpg|gif|png|webp|bmp)(\?.*)?\$/i) != null || rawUrl.includes("firebasestorage") || rawUrl.includes("res.cloudinary");

                            const details = selectedResult.gradingDetails || selectedResult.GradingDetails || [];

                            if (isWait) {
                                return (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-500 font-medium min-h-[300px]">
                                        <Loader2 className="w-10 h-10 animate-spin mb-4 text-emerald-500" />
                                        Hệ thống đang chờ AI phân tích dữ liệu...
                                    </div>
                                );
                            }

                            // Nếu có bảng phân tích (Ưu tiên hiển thị bảng)
                            if (details.length > 0) {
                                return (
                                    <div className="w-full bg-white/80 backdrop-blur-sm rounded-3xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                                        <div className="sticky top-0 bg-white/95 backdrop-blur-md p-6 border-b border-slate-100 z-20 flex justify-between items-start sm:items-center flex-col sm:flex-row gap-4 rounded-t-3xl">
                                            <div>
                                                <h3 className="font-black text-emerald-700 text-xl">Phân tích bài làm chi tiết</h3>
                                                {isDocument && <p className="text-sm text-slate-500 font-medium mt-1">Học sinh đã nộp Tệp tin đính kèm.</p>}
                                                {isOnlineExam && <p className="text-sm text-slate-500 font-medium mt-1">Học sinh đã làm bài trực tiếp trên hệ thống.</p>}
                                            </div>
                                            {(isDocument || isImage) && rawUrl.startsWith("http") && (
                                                <button onClick={() => downloadFileWithCustomName(rawUrl, selectedResult.studentName || selectedResult.StudentName || "Học_Sinh")} className="inline-flex items-center px-4 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-sm font-bold transition-all border border-indigo-200 shadow-sm">
                                                    <Download className="w-4 h-4 mr-2" /> Tải Xuống Bài Gốc
                                                </button>
                                            )}
                                        </div>

                                        <div className="p-6 space-y-4">
                                            {details.map((detail: GradingDetail, idx: number) => {
                                                const qNum = detail.questionNumber ?? detail.QuestionNumber ?? (idx + 1);
                                                const aScore = detail.awardedScore ?? detail.AwardedScore ?? 0;
                                                const fScore = detail.finalScore ?? detail.FinalScore;
                                                const aiFeed = detail.aiFeedback ?? detail.AIFeedback;
                                                const tCorrect = detail.teacherCorrection ?? detail.TeacherCorrection;
                                                const isMod = detail.isTeacherModified ?? detail.IsTeacherModified;

                                                const isCorrect = aScore > 0;
                                                const displayScore = fScore !== undefined && fScore !== null ? fScore : aScore;

                                                return (
                                                    <div key={idx} className={`bg-white/95 backdrop-blur-sm p-5 rounded-2xl border flex flex-col shadow-sm transition-all hover:shadow-md ${isCorrect ? 'border-emerald-200' : 'border-red-200'} ${isMod ? 'ring-2 ring-indigo-300' : ''}`}>
                                                        <div className="flex flex-col md:flex-row gap-5 justify-between items-start md:items-center w-full">
                                                            <div className="flex-1 space-y-3 w-full">
                                                                <div className="flex items-center gap-3">
                                                                    <span className={`font-bold text-xs px-3 py-1.5 rounded-lg border uppercase tracking-wider ${isCorrect ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                                        Câu số {qNum}
                                                                    </span>
                                                                    {isMod && <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200">Đã sửa</span>}
                                                                </div>
                                                                <p className="text-base text-slate-700 font-medium leading-relaxed">
                                                                    <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded mr-2 text-xs border border-slate-200 uppercase">AI Nhận xét:</span>
                                                                    {aiFeed || "Chính xác, không có sai sót."}
                                                                </p>
                                                                {tCorrect && (
                                                                    <p className="text-sm text-blue-800 font-medium bg-blue-50/50 p-3 rounded-xl border border-blue-200 shadow-inner">
                                                                        <span className="font-black mr-2 uppercase tracking-wide">Giáo viên chữa:</span> {tCorrect}
                                                                    </p>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                                                                <div className={`font-black px-6 py-3 rounded-xl text-2xl min-w-[100px] text-center shadow-inner border ${isCorrect ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-500 border-red-100'}`}>
                                                                    {displayScore} đ
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                );
                            }

                            // Nếu không có bảng phân tích AI nhưng có ảnh
                            if (isImage && !isDocument && !isOnlineExam) {
                                return (
                                    <div className="flex flex-col items-center justify-center w-full min-h-[300px]">
                                        <div className="flex justify-end w-full mb-4 pr-2">
                                            <button onClick={() => downloadFileWithCustomName(rawUrl, selectedResult.studentName || selectedResult.StudentName || "Học_Sinh")} className="inline-flex items-center px-4 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-sm font-bold transition-all border border-indigo-200 shadow-sm">
                                                <Download className="w-4 h-4 mr-2" /> Tải Xuống Ảnh Bài Làm
                                            </button>
                                        </div>
                                        <div className="bg-white p-2 rounded-3xl shadow-sm border border-slate-100 w-full flex justify-center">
                                            <img
                                                src={rawUrl}
                                                alt="Bài làm"
                                                className="max-w-full h-auto object-contain rounded-2xl"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                    e.currentTarget.parentElement!.innerHTML = '<div class="text-center p-10 text-red-500 bg-red-50 rounded-2xl w-full font-bold">❌ Không thể hiển thị trực tiếp. Vui lòng sử dụng nút Tải Xuống bên trên.</div>';
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            }

                            // Nếu chỉ là Document hoặc File thường
                            return (
                                <div className="flex flex-col items-center justify-center h-full min-h-[300px] bg-white p-10 rounded-3xl border border-slate-100 shadow-sm text-center">
                                    <FileText className="w-16 h-16 text-indigo-400 mb-4" />
                                    <h3 className="font-bold text-xl text-slate-800 mb-2">Bài Làm {isDocument ? 'Đính Kèm' : 'Trực Tuyến'}</h3>
                                    <p className="text-slate-500 mb-6 max-w-sm">Học sinh không nộp ảnh. Không thể hiển thị trực tiếp nội dung bài làm này.</p>
                                    {rawUrl.startsWith("http") && (
                                        <Button onClick={() => downloadFileWithCustomName(rawUrl, selectedResult.studentName || selectedResult.StudentName || "Học_Sinh")} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold px-8 h-12">
                                            <Download className="w-5 h-5 mr-2" /> Bấm vào đây để Tải File Về
                                        </Button>
                                    )}
                                </div>
                            );
                        })()}
                    </div>

                    {/* 🔥 FOOTER MODAL (Cố định ở đáy - shrink-0) */}
                    <div className="shrink-0 p-4 md:p-5 bg-white/95 backdrop-blur-md border-t border-slate-200/60 flex flex-wrap justify-end gap-3 rounded-b-3xl">
                        {selectedResult && (selectedResult.paperImageUrl !== "💻 Thi Trực Tuyến (Online Exam)" && selectedResult.PaperImageUrl !== "💻 Thi Trực Tuyến (Online Exam)") ? (
                            <Button variant="outline" className="rounded-full font-bold px-6 border-slate-300 h-11 text-sm w-full sm:w-auto hover:bg-slate-100 bg-white shadow-sm" onClick={() => window.open((selectedResult.paperImageUrl || selectedResult.PaperImageUrl)!, '_blank')}>
                                Mở file trên tab khác
                            </Button>
                        ) : null}
                        <Button className="rounded-full font-bold px-8 bg-slate-900 hover:bg-slate-800 text-white shadow-md h-11 text-sm w-full sm:w-auto" onClick={() => setSelectedResult(null)}>
                            Đóng cửa sổ
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
