import { useState, useEffect, useMemo } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import * as XLSX from 'xlsx'
import { Loader2, Image as ImageIcon, Download, Search, ChevronLeft, ChevronRight, CheckCircle2, FileText, PlayCircle, AlertTriangle, ShieldAlert, Bot } from "lucide-react"
import { Input } from "@/components/ui/input"
import { toast } from 'sonner'
import GradingAnalytics from './GradingAnalytics';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import axios from "axios"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import AITutorModal from './AITutorModal'; // Import Component vừa tạo
import html2pdf from 'html2pdf.js';
import VoiceRecorder from '@/components/ui/VoiceRecorder';
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
    recognizedText?: string;
    RecognizedText?: string;
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
    overallFeedback?: string;
    OverallFeedback?: string;
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
interface TutorContextData {
    questionNumber: number;
    studentAnswer: string;
    aiFeedback: string;
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
    const [isResolving, setIsResolving] = useState(false);
    const [feedbackText, setFeedbackText] = useState("");
    const handleResolveFlag = async (action: 'penalize' | 'ignore') => {
        if (!selectedResult || (!selectedResult.id && !selectedResult.Id)) return;
        const resultId = selectedResult.id || selectedResult.Id;

        const confirmMsg = action === 'penalize'
            ? "⚠️ Bạn có chắc chắn muốn hủy kết quả và phạt 0 điểm bài làm này vì gian lận?"
            : "✅ Bỏ qua cảnh báo và công nhận bài làm này hợp lệ?";

        if (!window.confirm(confirmMsg)) return;

        setIsResolving(true);
        try {
            const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
            const res = await axios.put(`/api/Grading/${resultId}/resolve-flag`, { Action: action }, config);

            toast.success(res.data.message);

            // Cập nhật lại UI ngay lập tức
            const updatedData = res.data.data;
            setSelectedResult(updatedData);
            setHistory(prev => prev.map(h => ((h.id || h.Id) === resultId ? updatedData : h)));
        } catch (error) {
            toast.error("Lỗi khi xử lý cảnh báo!");
            console.error(error);
        } finally {
            setIsResolving(false);
        }
    };
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
    const exportPdfReport = () => {
        if (!selectedResult) return;

        toast.info("⏳ Đang tạo báo cáo PDF. Vui lòng đợi...");

        // 1. Lấy thông tin cần thiết
        const studentName = selectedResult.studentName || selectedResult.StudentName || "Khách";
        const testTitle = getRubricTitle(selectedResult.testId || selectedResult.TestId || "");
        const totalScore = selectedResult.totalScore ?? selectedResult.TotalScore ?? 0;
        const aiFeedback = selectedResult.overallFeedback || selectedResult.OverallFeedback || "Đã hoàn thành bài kiểm tra.";
        // 2. Tạo một khung HTML ảo (Virtual DOM) để thiết kế giao diện tờ báo cáo
        const reportElement = document.createElement('div');
        reportElement.innerHTML = `
            <div style="padding: 40px; font-family: 'Times New Roman', serif; color: #1e293b; background: white;">
                <!-- Header -->
                <div style="text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px;">
                    <h1 style="font-size: 28px; color: #4338ca; margin: 0; text-transform: uppercase; letter-spacing: 1px;">HỆ THỐNG ĐÁNH GIÁ AUTOGRADER</h1>
                    <h2 style="font-size: 22px; color: #334155; margin: 10px 0 0 0;">PHIẾU BÁO CÁO KẾT QUẢ HỌC TẬP</h2>
                </div>

                <!-- Thông tin học sinh -->
                <div style="display: flex; justify-content: space-between; background: #f8fafc; padding: 20px; border-radius: 12px; margin-bottom: 30px; border: 1px solid #e2e8f0;">
                    <div style="line-height: 1.8;">
                        <div style="font-size: 16px;"><b>Họ và tên học sinh:</b> ${studentName}</div>
                        <div style="font-size: 16px;"><b>Mã bài thi:</b> ${selectedResult.testId || selectedResult.TestId || "N/A"}</div>
                        <div style="font-size: 16px;"><b>Tên bài thi:</b> ${testTitle}</div>
                        <div style="font-size: 16px;"><b>Thời gian chấm:</b> ${formatDate(selectedResult.gradedAt || selectedResult.GradedAt)}</div>
                    </div>
                    <div style="text-align: center; background: white; padding: 15px 30px; border-radius: 12px; border: 2px solid #4338ca; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                        <div style="font-size: 14px; font-weight: bold; color: #64748b; text-transform: uppercase;">Tổng Điểm</div>
                        <div style="font-size: 48px; font-weight: 900; color: #4338ca; line-height: 1;">${totalScore}</div>
                    </div>
                </div>

                <!-- Nhận xét tổng quan của AI -->
                <div style="margin-bottom: 30px;">
                    <h3 style="font-size: 18px; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 15px;">1. NHẬN XÉT TỔNG QUAN TỪ TRỢ GIẢNG AI</h3>
                    <div style="background: #eef2ff; padding: 15px; border-left: 4px solid #6366f1; border-radius: 0 8px 8px 0; font-size: 15px; font-style: italic; line-height: 1.6;">
                        "${aiFeedback}"
                    </div>
                </div>

                <!-- Bảng điểm chi tiết -->
                <div>
                    <h3 style="font-size: 18px; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 15px;">2. PHÂN TÍCH ĐIỂM SỐ CHI TIẾT TỪNG CÂU</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                        <thead>
                            <tr style="background-color: #f1f5f9;">
                                <th style="border: 1px solid #cbd5e1; padding: 12px; text-align: center; width: 10%;">Câu</th>
                                <th style="border: 1px solid #cbd5e1; padding: 12px; text-align: left; width: 30%;">Câu trả lời của học sinh</th>
                                <th style="border: 1px solid #cbd5e1; padding: 12px; text-align: left; width: 50%;">AI Phân tích & Gợi ý</th>
                                <th style="border: 1px solid #cbd5e1; padding: 12px; text-align: center; width: 10%;">Điểm</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(selectedResult.gradingDetails || selectedResult.GradingDetails || []).map((d: GradingDetail, i: number) => {
            const qNum = d.questionNumber ?? d.QuestionNumber ?? (i + 1);
            const aScore = d.finalScore ?? d.FinalScore ?? d.awardedScore ?? d.AwardedScore ?? 0;
            const isCorrect = aScore > 0;
            const feedback = d.teacherCorrection || d.TeacherCorrection || d.aiFeedback || d.AIFeedback || "";

            return `
                               <tr>
                                <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-weight: bold;">${qNum}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 10px; color: ${isCorrect ? '#15803d' : '#b91c1c'};">${d.recognizedText || d.RecognizedText || 'Bỏ trống'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 10px; font-size: 14px; color: #475569;">${feedback}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-weight: bold; color: ${isCorrect ? '#15803d' : '#b91c1c'};">${aScore}</td>
                            </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Lời khuyên cuối trang -->
                <div style="text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px dashed #cbd5e1; color: #64748b; font-size: 14px;">
                    <p>Báo cáo này được tự động tạo và phân tích bởi Hệ thống Trí tuệ nhân tạo AutoGrader.</p>
                    <p>Quý phụ huynh vui lòng theo dõi và đồng hành cùng sự tiến bộ của con em mình.</p>
                </div>
            </div>
        `;

        // 3. Cấu hình cho thư viện html2pdf
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const opt: Record<string, any> = {
            margin: 10,
            filename: `Bao_Cao_Diem_${studentName.replace(/\s+/g, '_')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // 4. Sinh file và tự động tải xuống
        html2pdf().set(opt).from(reportElement).save().then(() => {
            toast.success("✅ Đã xuất báo cáo PDF thành công!");
        }).catch(() => {
            toast.error("❌ Có lỗi xảy ra khi tạo PDF.");
        });
    };
    const [tutorContext, setTutorContext] = useState<TutorContextData | null>(null);
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

                                {/* HIỂN THỊ CẢNH BÁO CHI TIẾT (ĐÃ NÂNG CẤP NÚT BẤM) */}
                                {(selectedResult?.isPlagiarized || selectedResult?.IsPlagiarized) && (
                                    <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                                        <div className="flex items-start">
                                            <ShieldAlert className="w-5 h-5 text-red-600 mr-2 mt-0.5 shrink-0" />
                                            <div>
                                                <h4 className="text-red-800 font-black text-sm uppercase tracking-wide">Cảnh báo Đạo văn!</h4>
                                                <p className="text-red-600 text-sm mt-0.5 font-medium leading-snug">{selectedResult?.plagiarismNote || selectedResult?.PlagiarismNote}</p>
                                            </div>
                                        </div>
                                        {userRole !== 'Student' && (
                                            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                                                <Button
                                                    variant="outline" size="sm" disabled={isResolving} onClick={() => handleResolveFlag('ignore')}
                                                    className="bg-white hover:bg-red-100 text-slate-600 border-red-200 font-bold w-full sm:w-auto h-9"
                                                >
                                                    Bỏ qua
                                                </Button>
                                                <Button
                                                    size="sm" disabled={isResolving} onClick={() => handleResolveFlag('penalize')}
                                                    className="bg-red-600 hover:bg-red-700 text-white shadow-md font-bold w-full sm:w-auto h-9 border-none"
                                                >
                                                    Phạt 0 điểm
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {!(selectedResult?.isPlagiarized || selectedResult?.IsPlagiarized) && (selectedResult?.needsManualReview || selectedResult?.NeedsManualReview) && (
                                    <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                                        <div className="flex items-start">
                                            <AlertTriangle className="w-5 h-5 text-amber-600 mr-2 shrink-0 mt-0.5" />
                                            <div>
                                                <h4 className="text-amber-800 font-black text-sm uppercase tracking-wide">Cần duyệt lại</h4>
                                                <p className="text-amber-700 font-medium text-sm mt-0.5 leading-snug">AI chấm điểm với độ tin cậy thấp ({selectedResult?.confidenceScore || selectedResult?.ConfidenceScore}%).</p>
                                            </div>
                                        </div>
                                        {userRole !== 'Student' && (
                                            <div className="flex items-center shrink-0 w-full sm:w-auto">
                                                <Button
                                                    size="sm" disabled={isResolving} onClick={() => handleResolveFlag('ignore')}
                                                    className="bg-amber-500 hover:bg-amber-600 text-white shadow-md font-bold w-full sm:w-auto h-9 border-none"
                                                >
                                                    Đã duyệt - An toàn
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            {/* 🔥 NÚT XUẤT PDF MỚI THÊM VÀO ĐÂY */}
                            <Button
                                onClick={exportPdfReport}
                                variant="outline"
                                className="bg-white hover:bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm font-bold h-12 px-5 rounded-2xl transition-all"
                            >
                                <Download className="w-4 h-4 mr-2" /> In Báo Cáo PDF
                            </Button>
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
                                                            {userRole === 'Student' && !isCorrect && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => setTutorContext({
                                                                        questionNumber: qNum,
                                                                        studentAnswer: detail.recognizedText || detail.RecognizedText,
                                                                        aiFeedback: aiFeed
                                                                    })}
                                                                    className="mt-3 rounded-full text-indigo-600 hover:bg-indigo-50 border-indigo-200 shadow-sm font-bold w-fit transition-all"
                                                                >
                                                                    <Bot className="w-4 h-4 mr-2" /> Hỏi Gia sư AI vì sao sai
                                                                </Button>
                                                            )}
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
                    <div className="shrink-0 p-4 md:p-5 bg-white/95 backdrop-blur-md border-t border-slate-200/60 flex flex-col gap-4 rounded-b-3xl">

                        {/* KHU VỰC GIÁO VIÊN NHẬN XÉT BẰNG GIỌNG NÓI */}
                        {userRole !== 'Student' && (
                            <div className="space-y-2 w-full bg-slate-50/50 p-4 rounded-2xl border border-slate-200">
                                <div className="flex justify-between items-center">
                                    <label className="font-bold text-slate-700">Lời phê của giáo viên (tự động lưu):</label>
                                    <VoiceRecorder
                                        onTranscriptionComplete={(text) => {
                                            setFeedbackText(prev => prev ? prev + " " + text : text);
                                            // Bạn có thể thêm hàm gọi API lưu lên C# ở đây
                                        }}
                                    />
                                </div>
                                <textarea
                                    value={feedbackText}
                                    onChange={(e) => setFeedbackText(e.target.value)}
                                    className="w-full h-24 p-4 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 shadow-inner resize-none text-sm font-medium"
                                    placeholder="Gõ nhận xét hoặc bấm nút Thu âm để đọc..."
                                />
                            </div>
                        )}

                        {/* CÁC NÚT ĐÓNG MODAL */}
                        <div className="flex justify-end gap-3 w-full">
                            {selectedResult && (selectedResult.paperImageUrl !== "💻 Thi Trực Tuyến (Online Exam)" && selectedResult.PaperImageUrl !== "💻 Thi Trực Tuyến (Online Exam)") ? (
                                <Button variant="outline" className="rounded-full font-bold px-6 border-slate-300 h-11 text-sm w-full sm:w-auto hover:bg-slate-100 bg-white shadow-sm" onClick={() => window.open((selectedResult.paperImageUrl || selectedResult.PaperImageUrl)!, '_blank')}>
                                    Mở file trên tab khác
                                </Button>
                            ) : null}
                            <Button className="rounded-full font-bold px-8 bg-slate-900 hover:bg-slate-800 text-white shadow-md h-11 text-sm w-full sm:w-auto" onClick={() => setSelectedResult(null)}>
                                Đóng cửa sổ
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            <AITutorModal
                isOpen={tutorContext !== null}
                onClose={() => setTutorContext(null)}
                contextData={tutorContext}
            />
        </div>
    )
}
