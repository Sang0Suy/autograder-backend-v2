import { useState, useRef, useEffect } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Upload, Download, Plus, Trash2, Loader2, Filter, History, BookOpen, Users, Search, ChevronLeft, ChevronRight, Settings } from "lucide-react"
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import axios from 'axios'
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
    AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

// --- KHUÔN MẪU BỌC LÓT TYPESCRIPT CHUẨN ---
interface GradingDetail {
    questionNumber?: number; QuestionNumber?: number;
    awardedScore?: number; AwardedScore?: number;
    aiFeedback?: string; AIFeedback?: string;
    teacherCorrection?: string; TeacherCorrection?: string;
    finalScore?: number; FinalScore?: number;
    isTeacherModified?: boolean; IsTeacherModified?: boolean;
}

interface Student {
    id?: string; Id?: string;
    studentCode: string; StudentCode?: string;
    fullName: string; FullName?: string;
    className: string; ClassName?: string;
    extraAttributes?: Record<string, unknown>;
    ExtraAttributes?: Record<string, unknown>;
}

interface GradingResult {
    id?: string; Id?: string;
    testId?: string; TestId?: string;
    studentName?: string; StudentName?: string;
    studentCode?: string; StudentCode?: string;
    totalScore?: number; TotalScore?: number;
    gradedAt?: string; GradedAt?: string;
    paperImageUrl?: string; PaperImageUrl?: string;
    gradingDetails?: GradingDetail[]; GradingDetails?: GradingDetail[];
}

interface Rubric { id?: string; Id?: string; title?: string; Title?: string; examType?: string; ExamType?: string; }

export default function ClassManager() {
    const [students, setStudents] = useState<Student[]>([])
    const [gradingHistory, setGradingHistory] = useState<GradingResult[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [activeTestDetail, setActiveTestDetail] = useState<GradingResult | null>(null)
    const [selectedClass, setSelectedClass] = useState<string>("Tất cả")
    const [viewHistoryStudent, setViewHistoryStudent] = useState<Student | null>(null)
    const [rubrics, setRubrics] = useState<Rubric[]>([])

    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isImporting, setIsImporting] = useState(false)
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [newStudent, setNewStudent] = useState({ studentCode: '', fullName: '', className: '' })
    const [searchTerm, setSearchTerm] = useState("")

    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
    const [isDeletingBulk, setIsDeletingBulk] = useState(false)

    const [editingQuestion, setEditingQuestion] = useState<number | null>(null);
    const [editScore, setEditScore] = useState<number>(0);
    const [editFeedback, setEditFeedback] = useState<string>('');
    const [isSavingScore, setIsSavingScore] = useState(false);

    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [weights, setWeights] = useState(() => {
        const savedWeights = localStorage.getItem('gradeWeights');
        if (savedWeights) {
            try { return JSON.parse(savedWeights); }
            catch (error) { console.error("Lỗi khi đọc hệ số điểm:", error); }
        }
        return { tx: 1, p15: 1, p45: 2, thi: 3 };
    });

    const handleSaveWeights = () => {
        localStorage.setItem('gradeWeights', JSON.stringify(weights));
        setIsConfigModalOpen(false);
        toast.success("Đã cập nhật hệ số tính điểm cho toàn trường!");
    };

    const removeAccents = (str: string) => {
        if (!str) return ""
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    }

    const fetchData = async () => {
        try {
            setIsLoading(true)
            const [stuRes, histRes, rubRes] = await Promise.all([
                axios.get('/api/Students'),
                axios.get('/api/StudentResults?pageSize=1000'),
                axios.get('/api/Rubrics')
            ])
            setStudents(Array.isArray(stuRes.data) ? stuRes.data : [])

            const rawHistory = histRes.data;
            let parsedHistory = [];
            if (Array.isArray(rawHistory)) parsedHistory = rawHistory;
            else if (rawHistory?.data && Array.isArray(rawHistory.data)) parsedHistory = rawHistory.data;
            else if (rawHistory?.Data && Array.isArray(rawHistory.Data)) parsedHistory = rawHistory.Data;

            setGradingHistory(parsedHistory)
            setRubrics(Array.isArray(rubRes.data) ? rubRes.data : [])
            setSelectedStudentIds([])
        } catch (error) {
            console.error("Lỗi khi tải dữ liệu:", error)
            toast.error("Không thể tải danh sách dữ liệu từ Server!")
        } finally {
            setIsLoading(false)
        }
    }

    const getRubricTitle = (testId: string | undefined) => {
        if (!testId) return "Không rõ mã đề"
        const found = rubrics.find(r => (r.id || r.Id) === testId)
        return found ? (found.title || found.Title || "Không rõ") : "Đề thi đã bị xóa"
    }

    useEffect(() => {
        const initData = setTimeout(() => { fetchData(); }, 0);
        return () => clearTimeout(initData);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const classList = ["Tất cả", ...Array.from(new Set(students.map(s => s.className || s.ClassName))).filter(c => c)] as string[];
    let displayStudents = students;

    if (selectedClass !== "Tất cả") {
        displayStudents = students.filter(s => (s.className || s.ClassName) === selectedClass);
    }

    if (searchTerm.trim()) {
        const searchLower = removeAccents(searchTerm);
        displayStudents = displayStudents.filter(s =>
            removeAccents(s.fullName || s.FullName || "").includes(searchLower) ||
            removeAccents(s.studentCode || s.StudentCode || "").includes(searchLower)
        );
    }

    // --- HÀM TÌM ĐIỂM THÔNG MINH ---
    const getExtraScore = (student: Student, targetKey: string) => {
        const extra = student.extraAttributes || student.ExtraAttributes;
        if (!extra) return null;

        const foundKey = Object.keys(extra).find(k => k.toLowerCase().trim() === targetKey.toLowerCase().trim());
        return foundKey ? Number(extra[foundKey]) : null;
    }

    const getStudentStats = (studentCode: string, studentData: Student) => {
        const tests = gradingHistory.filter(h => {
            const code = h.studentCode || h.StudentCode || "";
            return code.toLowerCase().trim() === studentCode.toLowerCase().trim();
        });

        const totalTests = tests.length

        const scoresTX: number[] = [];
        const scores15p: number[] = [];
        const scores45p: number[] = [];
        const scoresThi: number[] = [];

        tests.forEach(t => {
            const tId = t.testId || t.TestId;
            const r = rubrics.find(rub => (rub.id || rub.Id) === tId);

            const targetText = ((r?.title || r?.Title || "") + " " + (r?.examType || r?.ExamType || "")).toLowerCase();
            const score = t.totalScore ?? t.TotalScore ?? 0;

            // 🔥 ĐÃ SỬA LỖI ĐIỂM THI BỊ LẶP
            const is15p = ["15 phút", "15p"].some(k => targetText.includes(k));
            const is45p = ["45 phút", "45p", "1 tiết", "1t", "định kỳ", "giữa kỳ"].some(k => targetText.includes(k));
            const isThi = !is15p && !is45p && ["thi học kỳ", "thi hk", "điểm thi", "cuối kỳ"].some(k => targetText.includes(k));

            if (is15p) scores15p.push(score);
            else if (is45p) scores45p.push(score);
            else if (isThi) scoresThi.push(score);
            else scoresTX.push(score);
        });

        // Lấy điểm từ extraAttributes
        const extTX = getExtraScore(studentData, "Điểm TX") || getExtraScore(studentData, "Điểm Thường Xuyên");
        const ext15 = getExtraScore(studentData, "Điểm 15p") || getExtraScore(studentData, "Điểm 15 Phút");
        const ext45 = getExtraScore(studentData, "Điểm 45p") || getExtraScore(studentData, "Điểm 1 Tiết");
        const extThi = getExtraScore(studentData, "Điểm Thi");

        // Gộp điểm từ cả 2 nguồn (Tests và extraAttributes) để tính trung bình
        const finalScoresTX = extTX !== null ? [...scoresTX, extTX] : scoresTX;
        const finalScores15p = ext15 !== null ? [...scores15p, ext15] : scores15p;
        const finalScores45p = ext45 !== null ? [...scores45p, ext45] : scores45p;
        const finalScoresThi = extThi !== null ? [...scoresThi, extThi] : scoresThi;

        const avgCat = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

        const avgTX = avgCat(finalScoresTX);
        const avg15p = avgCat(finalScores15p);
        const avg45p = avgCat(finalScores45p);
        const avgThi = avgCat(finalScoresThi);

        let totalWeight = 0;
        let weightedScore = 0;

        if (avgTX !== null) { weightedScore += avgTX * weights.tx; totalWeight += weights.tx; }
        if (avg15p !== null) { weightedScore += avg15p * weights.p15; totalWeight += weights.p15; }
        if (avg45p !== null) { weightedScore += avg45p * weights.p45; totalWeight += weights.p45; }
        if (avgThi !== null) { weightedScore += avgThi * weights.thi; totalWeight += weights.thi; }

        const finalAvgScore = totalWeight > 0 ? (weightedScore / totalWeight).toFixed(1) : "0.0";

        return {
            totalTests,
            avgScore: finalAvgScore,
            tests,
            extTX, ext15, ext45, extThi
        }
    }

    const totalPages = Math.ceil(displayStudents.length / itemsPerPage);
    const currentStudentsData = displayStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handleAddManual = async () => {
        const cleanedCode = newStudent.studentCode.trim(); const cleanedName = newStudent.fullName.trim()
        if (!cleanedName) {
            return toast.warning("Vui lòng nhập Họ và Tên học sinh!")
        }
        try {
            setIsSaving(true)
            const payload = [{
                studentCode: cleanedCode,
                fullName: cleanedName,
                className: newStudent.className.trim() || "Chưa xếp lớp"
            }]
            await axios.post('/api/Students/import', payload)
            toast.success("Thêm học sinh thành công!");
            setIsAddModalOpen(false);
            setNewStudent({ studentCode: '', fullName: '', className: '' });
            fetchData()
        } catch (error) {
            toast.error("Lỗi khi lưu học sinh!")
            console.error(error)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteStudent = async (studentId: string) => {
        try { await axios.delete(`/api/Students/${studentId}`); toast.success("Đã xóa học sinh!"); fetchData() }
        catch (error) {
            toast.error("Không thể xóa học sinh này!")
            console.error(error)
        }
    }

    const handleBulkDelete = async () => {
        if (selectedStudentIds.length === 0) return;
        const confirm = window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedStudentIds.length} học sinh đã chọn?`);
        if (!confirm) return;

        setIsDeletingBulk(true);
        try {
            await Promise.all(selectedStudentIds.map(id => axios.delete(`/api/Students/${id}`)));
            toast.success(`Đã xóa ${selectedStudentIds.length} học sinh thành công!`);
            fetchData();
        } catch (error) {
            toast.error("Có lỗi xảy ra khi xóa hàng loạt!");
            console.error(error);
        } finally {
            setIsDeletingBulk(false);
        }
    };

    const handleDeleteTestResult = async (resultId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const confirm = window.confirm("⚠️ CẢNH BÁO: Bạn có chắc chắn muốn hủy bài làm này?\nKết quả và cột điểm của học sinh sẽ bị xóa vĩnh viễn!");
        if (!confirm) return;

        try {
            await axios.delete(`/api/Grading/${resultId}`);
            toast.success("Đã xóa bài kiểm tra thành công!");

            setGradingHistory(prev => prev.filter(h => (h.id || h.Id) !== resultId));
            if ((activeTestDetail?.id || activeTestDetail?.Id) === resultId) setActiveTestDetail(null);
        } catch (error) {
            toast.error("Lỗi khi xóa bài kiểm tra!");
            console.error(error);
        }
    };

    const handleEditScoreClick = (detail: GradingDetail) => {
        setEditingQuestion(detail.questionNumber ?? detail.QuestionNumber ?? null);
        setEditScore(detail.finalScore ?? detail.FinalScore ?? detail.awardedScore ?? detail.AwardedScore ?? 0);
        setEditFeedback(detail.teacherCorrection ?? detail.TeacherCorrection ?? detail.aiFeedback ?? detail.AIFeedback ?? '');
    };

    const handleSaveScoreCorrection = async (questionNumber: number | undefined) => {
        const resultId = activeTestDetail?.id || activeTestDetail?.Id;
        if (!resultId || questionNumber === undefined) return;
        setIsSavingScore(true);
        try {
            const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
            const response = await axios.put(`/api/Grading/${resultId}/correction`, {
                QuestionNumber: questionNumber,
                NewScore: editScore,
                TeacherCorrection: editFeedback
            }, config);

            toast.success("✅ Đã cập nhật điểm số thành công!");

            const updatedData = response.data.data || response.data.Data || response.data;
            if (updatedData) {
                setActiveTestDetail(updatedData);
            }
            fetchData();
            setEditingQuestion(null);
        } catch (error) {
            toast.error("Lỗi khi lưu điểm!");
            console.error(error);
        } finally {
            setIsSavingScore(false);
        }
    };

    const handleExportExcel = () => {
        if (students.length === 0) return toast.warning("Chưa có dữ liệu để xuất!")
        try {
            const workbook = XLSX.utils.book_new()
            const distinctClasses = Array.from(new Set(students.map(s => s.className || s.ClassName || "Chưa xếp lớp")))

            distinctClasses.forEach(clsName => {
                const classStudents = students.filter(s => (s.className || s.ClassName || "Chưa xếp lớp") === clsName)
                const dataToExport = classStudents.map((s, i) => ({
                    "STT": i + 1,
                    "Mã Học Sinh": s.studentCode || s.StudentCode,
                    "Họ và Tên": s.fullName || s.FullName,
                    "Lớp": s.className || s.ClassName
                }))
                const worksheet = XLSX.utils.json_to_sheet(dataToExport)
                worksheet['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 10 }]
                XLSX.utils.book_append_sheet(workbook, worksheet, clsName.substring(0, 30))
            })

            XLSX.writeFile(workbook, "Danh_Sach_Hoc_Sinh.xlsx")
            toast.success("Xuất file Excel thành công! 📊")
        } catch (error) {
            toast.error("Lỗi khi xuất Excel!")
            console.error(error)
        }
    }

    const handleExportGradebook = () => {
        if (students.length === 0) return toast.warning("Chưa có dữ liệu để xuất!")
        try {
            const workbook = XLSX.utils.book_new()
            const distinctClasses = Array.from(new Set(students.map(s => s.className || s.ClassName || "Chưa xếp lớp")))

            distinctClasses.forEach(clsName => {
                const classStudents = students.filter(s => (s.className || s.ClassName || "Chưa xếp lớp") === clsName)

                const dataToExport = classStudents.map((s, i) => {
                    const stats = getStudentStats(s.studentCode || s.StudentCode || "", s)
                    const getScoreByExamType = (keywords: string[]) => {
                        const foundTests = stats.tests.filter(t => {
                            const r = rubrics.find(rub => (rub.id || rub.Id) === (t.testId || t.TestId))
                            return keywords.some(k => (r?.examType || r?.ExamType || "").toLowerCase().includes(k.toLowerCase()))
                        })
                        return foundTests.length > 0 ? foundTests.map(t => t.totalScore ?? t.TotalScore).join(", ") : ""
                    };

                    return {
                        "STT": i + 1,
                        "Mã Học Sinh": s.studentCode || s.StudentCode,
                        "Họ và Tên": s.fullName || s.FullName,
                        "Lớp": s.className || s.ClassName,
                        "KT Thường Xuyên": getScoreByExamType(["Thường xuyên", "KTTX"]) || stats.extTX,
                        "KT 15 Phút": getScoreByExamType(["15 phút", "15p"]) || stats.ext15,
                        "KT 1 Tiết": getScoreByExamType(["45 phút", "45p", "1 tiết", "1t", "Định kỳ"]) || stats.ext45,
                        "Điểm Thi": getScoreByExamType(["Thi học kỳ", "Thi HK", "Điểm thi", "Thi"]) || stats.extThi,
                        "Điểm TB Môn": stats.avgScore,
                        "Ghi Chú": stats.totalTests > 0 ? `Đã làm ${stats.totalTests} bài` : "Dữ liệu cũ"
                    }
                })

                const worksheet = XLSX.utils.json_to_sheet(dataToExport)
                worksheet['!cols'] = [
                    { wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 10 },
                    { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 20 }
                ]
                XLSX.utils.book_append_sheet(workbook, worksheet, `Điểm - ${clsName}`.substring(0, 30))
            })

            XLSX.writeFile(workbook, "Bang_Diem_Chi_Tiet.xlsx")
            toast.success("Xuất Bảng Điểm thành công! 📊")
        } catch (error) {
            toast.error("Lỗi khi xuất Bảng Điểm!")
            console.error(error)
        }
    }

    const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return
        setIsImporting(true); const reader = new FileReader()
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result; const workbook = XLSX.read(bstr, { type: 'binary' })
                const worksheet = workbook.Sheets[workbook.SheetNames[0]]
                const rawData: Record<string, string | number>[] = XLSX.utils.sheet_to_json(worksheet)
                const newStudents: Student[] = rawData.map((row) => ({
                    studentCode: String(row["Mã Học Sinh"] || row["studentCode"] || row["StudentCode"] || "").trim(),
                    fullName: String(row["Họ và Tên"] || row["fullName"] || row["FullName"] || "").trim(),
                    className: String(row["Lớp"] || row["className"] || row["ClassName"] || "Chưa xếp lớp").trim()
                })).filter(s => s.fullName !== "" && s.studentCode !== "")

                if (newStudents.length === 0) return toast.warning("Không tìm thấy dữ liệu hợp lệ!")
                toast.promise(axios.post('/api/Students/import', newStudents), {
                    loading: '📁 Đang truyền dữ liệu...',
                    success: () => { fetchData(); return `Nhập thành công!` },
                    error: () => '❌ Lỗi server khi import!'
                })
            } catch { toast.error("File Excel không đúng định dạng!") }
            finally { setIsImporting(false); if (fileInputRef.current) fileInputRef.current.value = '' }
        }
        reader.readAsBinaryString(file)
    }

    const renderScorePills = (tests: GradingResult[], category: "tx" | "15p" | "45p" | "thi") => {
        const matchingTests = tests.filter(t => {
            const tId = t.testId || t.TestId;
            const r = rubrics.find(rub => (rub.id || rub.Id) === tId);
            const targetText = ((r?.title || r?.Title || "") + " " + (r?.examType || r?.ExamType || "")).toLowerCase();

            // 🔥 ĐÃ SỬA LỖI ĐIỂM THI BỊ LẶP Ở ĐÂY
            const is15p = ["15 phút", "15p"].some(k => targetText.includes(k));
            const is45p = ["45 phút", "45p", "1 tiết", "1t", "định kỳ", "giữa kỳ"].some(k => targetText.includes(k));
            const isThi = !is15p && !is45p && ["thi học kỳ", "thi hk", "điểm thi", "cuối kỳ"].some(k => targetText.includes(k));

            if (category === "15p") return is15p;
            if (category === "45p") return is45p;
            if (category === "thi") return isThi;

            if (category === "tx") {
                return !is15p && !is45p && !isThi;
            }
            return false;
        });

        if (matchingTests.length === 0) return null;

        return (
            <div className="flex flex-wrap gap-1.5 justify-center items-center max-w-[120px] mx-auto">
                {matchingTests.map((t, idx) => {
                    const tId = t.testId || t.TestId;
                    const date = t.gradedAt || t.GradedAt;
                    const score = t.totalScore ?? t.TotalScore;
                    return (
                        <span
                            key={idx}
                            className="bg-white/90 text-indigo-700 border border-indigo-100/60 font-bold px-2.5 py-1 rounded-md text-xs shadow-sm cursor-default"
                            title={`Đề thi: ${getRubricTitle(tId)} - Ngày chấm: ${date ? new Date(date).toLocaleDateString('vi-VN') : 'N/A'}`}
                        >
                            {score}
                        </span>
                    )
                })}
            </div>
        );
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
            link.href = url; link.setAttribute('download', fileName);
            document.body.appendChild(link); link.click();
            document.body.removeChild(link); window.URL.revokeObjectURL(url);
            toast.success("Tải file hoàn tất!");
        } catch {
            window.open(fileUrl, '_blank');
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-700 p-2 md:p-4 relative min-h-screen">
            <div className="fixed inset-0 -z-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-slate-50 to-indigo-50/50 pointer-events-none"></div>

            {/* HEADER */}
            <div className="bg-white/70 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 flex items-center tracking-tight">
                        <Users className="w-8 h-8 mr-3 text-blue-600" /> Hồ Sơ Học Sinh
                    </h2>
                    <p className="text-base text-slate-500 mt-2">Quản lý danh sách học sinh, sổ điểm chi tiết và lịch sử làm bài</p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={handleImportExcel} />
                    <Button variant="outline" className="rounded-full bg-white/50 text-blue-700 hover:bg-blue-50 border-white/60 font-bold px-5 h-11 shadow-sm backdrop-blur-sm" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                        {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />} Nhập từ File
                    </Button>
                    <Button variant="outline" className="rounded-full bg-white/50 text-emerald-700 hover:bg-emerald-50 border-white/60 font-bold px-5 h-11 shadow-sm" onClick={handleExportExcel}>
                        <Download className="w-4 h-4 mr-2" /> Danh Sách
                    </Button>
                    <Button variant="outline" className="rounded-full bg-white/50 text-amber-700 hover:bg-amber-50 border-white/60 font-bold px-5 h-11 shadow-sm" onClick={handleExportGradebook}>
                        <Download className="w-4 h-4 mr-2" /> Bảng Điểm
                    </Button>
                    <Button variant="outline" className="rounded-full bg-slate-800 text-white hover:bg-slate-700 hover:text-white border-none font-bold px-5 h-11 shadow-md transition-all" onClick={() => setIsConfigModalOpen(true)}>
                        <Settings className="w-4 h-4 mr-2" /> Cấu Hình Điểm
                    </Button>
                    <Button className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md font-bold px-6 h-11 border-none" onClick={() => setIsAddModalOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" /> Thêm thủ công
                    </Button>
                </div>
            </div>

            {/* FILTER & MULTI-SELECT BAR */}
            <div className="bg-white/70 backdrop-blur-xl p-4 rounded-[2rem] border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col lg:flex-row items-start lg:items-center gap-4">
                <div className="relative w-full lg:w-[450px]">
                    <Search className="absolute left-5 top-3.5 h-5 w-5 text-slate-400" />
                    <Input
                        placeholder="Tìm theo tên hoặc mã..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="pl-14 h-12 bg-white/50 border-white/60 focus-visible:ring-blue-500 rounded-full transition-all text-base shadow-sm"
                    />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 scrollbar-hide flex-1">
                    <Filter className="w-5 h-5 text-slate-400 ml-2 mr-1 hidden xl:block" />
                    <span className="text-sm font-bold text-slate-400 mr-2 whitespace-nowrap uppercase tracking-wider hidden xl:block">Lọc Lớp:</span>
                    {classList.map(cls => (
                        <button
                            key={cls}
                            onClick={() => { setSelectedClass(cls); setCurrentPage(1); }}
                            className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 whitespace-nowrap shadow-sm backdrop-blur-sm ${selectedClass === cls ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/50 text-slate-600 border border-white/60 hover:bg-white hover:text-blue-600'}`}
                        >
                            {cls}
                        </button>
                    ))}
                </div>

                {selectedStudentIds.length > 0 && (
                    <Button onClick={handleBulkDelete} disabled={isDeletingBulk} className="bg-red-500 hover:bg-red-600 text-white rounded-full font-bold px-6 h-12 shadow-sm transition-all ml-auto w-full lg:w-auto">
                        {isDeletingBulk ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                        Xóa {selectedStudentIds.length} mục
                    </Button>
                )}
            </div>

            {/* MAIN TABLE */}
            <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-100/50 backdrop-blur-md">
                            <TableRow className="border-b border-slate-200/60 whitespace-nowrap">
                                <TableHead className="w-[50px] pl-6 py-5">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        checked={currentStudentsData.length > 0 && selectedStudentIds.length === currentStudentsData.length}
                                        onChange={(e) => {
                                            if (e.target.checked) setSelectedStudentIds(currentStudentsData.map(s => s.id || s.Id!));
                                            else setSelectedStudentIds([]);
                                        }}
                                    />
                                </TableHead>
                                <TableHead className="w-[60px] font-bold text-slate-700 pl-4 py-5">STT</TableHead>
                                <TableHead className="font-bold text-slate-700 py-5">Mã Học Sinh</TableHead>
                                <TableHead className="font-bold text-slate-700 py-5 min-w-[180px]">Họ và Tên</TableHead>
                                <TableHead className="text-center font-bold text-slate-700 py-5">Lớp</TableHead>
                                <TableHead className="text-center font-bold text-indigo-800 bg-indigo-50/40 border-l border-r border-indigo-100/50 py-5 min-w-[100px]">Điểm TX</TableHead>
                                <TableHead className="text-center font-bold text-indigo-800 bg-indigo-50/40 border-r border-indigo-100/50 py-5 min-w-[100px]">Điểm 15p</TableHead>
                                <TableHead className="text-center font-bold text-indigo-800 bg-indigo-50/40 border-r border-indigo-100/50 py-5 min-w-[100px]">Điểm 45p</TableHead>
                                <TableHead className="text-center font-bold text-rose-800 bg-rose-50/40 border-r border-rose-100/50 py-5 min-w-[100px]">Điểm Thi</TableHead>
                                <TableHead className="text-center font-black text-slate-800 py-5 bg-slate-200/30">Điểm TB</TableHead>
                                <TableHead className="text-right font-bold text-slate-700 pr-8 py-5 min-w-[120px]">Hành Động</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={11} className="h-48 text-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" /></TableCell></TableRow>
                            ) : currentStudentsData.length === 0 ? (
                                <TableRow><TableCell colSpan={11} className="h-48 text-center text-slate-500 font-medium text-base">Không tìm thấy học sinh nào.</TableCell></TableRow>
                            ) : currentStudentsData.map((student, index) => {
                                const stId = student.id || student.Id;
                                const stCode = student.studentCode || student.StudentCode || "";
                                const stName = student.fullName || student.FullName || "";
                                const stClass = student.className || student.ClassName || "";
                                const stats = getStudentStats(stCode, student);
                                const stt = (currentPage - 1) * itemsPerPage + index + 1;

                                // Lấy điểm từ 2 nguồn và hợp nhất hiển thị
                                const testsTX = renderScorePills(stats.tests, "tx");
                                const tests15p = renderScorePills(stats.tests, "15p");
                                const tests45p = renderScorePills(stats.tests, "45p");
                                const testsThi = renderScorePills(stats.tests, "thi");

                                return (
                                    <TableRow key={stId || index} className="hover:bg-white/80 transition-all duration-200 border-b border-slate-100/60 last:border-0">
                                        <TableCell className="pl-6">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                checked={stId ? selectedStudentIds.includes(stId) : false}
                                                onChange={(e) => {
                                                    if (!stId) return;
                                                    if (e.target.checked) setSelectedStudentIds(prev => [...prev, stId]);
                                                    else setSelectedStudentIds(prev => prev.filter(id => id !== stId));
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium text-slate-600 pl-4">{stt}</TableCell>
                                        <TableCell className="font-mono text-sm text-slate-500">{stCode}</TableCell>
                                        <TableCell className="font-bold text-base whitespace-nowrap text-slate-800">{stName}</TableCell>
                                        <TableCell className="text-center">
                                            <span className="bg-slate-100/80 px-3 py-1.5 rounded-lg text-sm font-bold border border-slate-200/60 shadow-sm text-slate-600">{stClass}</span>
                                        </TableCell>

                                        {/* Cột Điểm TX */}
                                        <TableCell className="text-center border-l border-r border-slate-100/50 bg-indigo-50/10">
                                            <div className="flex flex-wrap gap-1.5 justify-center items-center">
                                                {stats.extTX !== null && (
                                                    <span className="bg-white/90 text-indigo-700 border border-indigo-100/60 font-bold px-2.5 py-1 rounded-md text-xs shadow-sm">{stats.extTX}</span>
                                                )}
                                                {testsTX}
                                                {stats.extTX === null && !testsTX && <span className="text-slate-300">-</span>}
                                            </div>
                                        </TableCell>

                                        {/* Cột Điểm 15p */}
                                        <TableCell className="text-center border-r border-slate-100/50 bg-indigo-50/10">
                                            <div className="flex flex-wrap gap-1.5 justify-center items-center">
                                                {stats.ext15 !== null && (
                                                    <span className="bg-white/90 text-indigo-700 border border-indigo-100/60 font-bold px-2.5 py-1 rounded-md text-xs shadow-sm">{stats.ext15}</span>
                                                )}
                                                {tests15p}
                                                {stats.ext15 === null && !tests15p && <span className="text-slate-300">-</span>}
                                            </div>
                                        </TableCell>

                                        {/* Cột Điểm 45p */}
                                        <TableCell className="text-center border-r border-slate-100/50 bg-indigo-50/10">
                                            <div className="flex flex-wrap gap-1.5 justify-center items-center">
                                                {stats.ext45 !== null && (
                                                    <span className="bg-white/90 text-indigo-700 border border-indigo-100/60 font-bold px-2.5 py-1 rounded-md text-xs shadow-sm">{stats.ext45}</span>
                                                )}
                                                {tests45p}
                                                {stats.ext45 === null && !tests45p && <span className="text-slate-300">-</span>}
                                            </div>
                                        </TableCell>

                                        {/* Cột Điểm Thi */}
                                        <TableCell className="text-center border-r border-slate-100/50 bg-rose-50/10">
                                            <div className="flex flex-wrap gap-1.5 justify-center items-center">
                                                {stats.extThi !== null && (
                                                    <span className="bg-white/90 text-rose-700 border border-rose-100/60 font-bold px-2.5 py-1 rounded-md text-xs shadow-sm">{stats.extThi}</span>
                                                )}
                                                {testsThi}
                                                {stats.extThi === null && !testsThi && <span className="text-slate-300">-</span>}
                                            </div>
                                        </TableCell>

                                        {/* Cột Điểm TB */}
                                        <TableCell className="text-center font-black text-emerald-600 text-xl bg-slate-100/30 backdrop-blur-sm">
                                            {stats.avgScore}
                                        </TableCell>

                                        <TableCell className="text-right space-x-1 pr-6 whitespace-nowrap">
                                            <Button variant="ghost" size="icon" className="rounded-full text-blue-600 hover:bg-blue-100 font-bold transition-colors w-10 h-10" title="Chi tiết bài làm" onClick={() => setViewHistoryStudent(student)}>
                                                <History className="w-5 h-5" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="rounded-full text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors w-10 h-10 ml-1" title="Xóa học sinh">
                                                        <Trash2 className="w-5 h-5" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent className="bg-white border-none rounded-3xl shadow-2xl">
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle className="text-red-600 text-xl font-bold">Xóa học sinh khỏi lớp?</AlertDialogTitle>
                                                        <AlertDialogDescription className="text-base text-slate-600 mt-2">Xóa vĩnh viễn học sinh <span className="font-bold text-slate-800">{stName}</span> khỏi hệ thống.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter className="mt-4">
                                                        <AlertDialogCancel className="rounded-full font-bold px-6 border-slate-300">Hủy</AlertDialogCancel>
                                                        <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white rounded-full font-bold px-8 shadow-md" onClick={() => handleDeleteStudent(stId!)}>Xác nhận xóa</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>

                {displayStudents.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between px-8 py-5 bg-slate-50/30 border-t border-slate-200/60 gap-4 backdrop-blur-md">
                        <div className="text-sm text-slate-500 font-medium text-center sm:text-left">
                            Hiển thị <span className="font-bold text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</span> đến <span className="font-bold text-slate-800">{Math.min(currentPage * itemsPerPage, displayStudents.length)}</span> trong tổng số <span className="font-bold text-blue-600">{displayStudents.length}</span> học sinh
                        </div>
                        <div className="flex items-center space-x-2 bg-white/60 border border-white p-1.5 rounded-full shadow-sm backdrop-blur-sm">
                            <Button variant="ghost" size="sm" className="rounded-full hover:bg-white" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="w-5 h-5" /></Button>
                            <div className="text-sm font-bold text-slate-700 px-4">Trang {currentPage} / {totalPages || 1}</div>
                            <Button variant="ghost" size="sm" className="rounded-full hover:bg-white" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}><ChevronRight className="w-5 h-5" /></Button>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL LỊCH SỬ LÀM BÀI */}
            <Dialog open={!!viewHistoryStudent} onOpenChange={(open) => { if (!open) { setViewHistoryStudent(null); setActiveTestDetail(null); } }}>
                <DialogContent className="!max-w-5xl w-[95vw] md:w-[90vw] bg-slate-50/95 backdrop-blur-xl z-50 rounded-[2rem] shadow-2xl p-0 overflow-hidden border border-white/60">
                    <div className="h-3 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 w-full sticky top-0 z-50"></div>

                    <DialogHeader className="p-6 md:p-8 pb-5 bg-white/80 border-b border-slate-200/60 sticky top-3 z-40 backdrop-blur-md">
                        <DialogTitle className="text-3xl font-black flex items-center text-slate-800 tracking-tight">
                            <BookOpen className="w-8 h-8 mr-4 text-indigo-600 bg-indigo-50 p-1.5 rounded-full" />
                            Lịch sử làm bài: <span className="text-indigo-600 ml-2">{viewHistoryStudent?.fullName || viewHistoryStudent?.FullName}</span>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="p-6 md:p-8 overflow-y-auto max-h-[75vh]">
                        {!activeTestDetail ? (
                            viewHistoryStudent && getStudentStats(viewHistoryStudent.studentCode || viewHistoryStudent.StudentCode || "", viewHistoryStudent).totalTests === 0 ? (
                                <div className="text-center bg-white/60 border border-dashed border-slate-300 rounded-3xl py-20 shadow-sm backdrop-blur-sm">
                                    <p className="text-slate-500 font-medium text-lg">Học sinh này chưa thực hiện bài kiểm tra nào.</p>
                                </div>
                            ) : (
                                <div className="border border-white/60 rounded-3xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/80 backdrop-blur-sm w-full">
                                    <Table>
                                        <TableHeader className="bg-slate-100/50">
                                            <TableRow className="border-b border-slate-200/60">
                                                <TableHead className="font-bold text-slate-700 py-5 pl-8">Tên Đề Thi</TableHead>
                                                <TableHead className="font-bold text-center text-slate-700 whitespace-nowrap px-6 py-5">Ngày Nộp Bài</TableHead>
                                                <TableHead className="text-right font-bold text-slate-700 whitespace-nowrap pr-10 py-5">Điểm Đạt Được</TableHead>
                                                <TableHead className="w-[80px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {viewHistoryStudent && getStudentStats(viewHistoryStudent.studentCode || viewHistoryStudent.StudentCode || "", viewHistoryStudent).tests.map((test: GradingResult, i: number) => {
                                                const tId = test.testId || test.TestId;
                                                const date = test.gradedAt || test.GradedAt;
                                                const score = test.totalScore ?? test.TotalScore;
                                                return (
                                                    <TableRow key={i} className="hover:bg-white transition-colors border-b border-slate-100/60 last:border-0 group cursor-pointer" onClick={() => setActiveTestDetail(test)} title="Nhấn vào để xem chi tiết">
                                                        <TableCell className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors py-5 pl-8 max-w-[400px] truncate text-base">
                                                            {getRubricTitle(tId)}
                                                        </TableCell>
                                                        <TableCell className="text-center text-slate-500 font-medium px-6 whitespace-nowrap">
                                                            <span className="bg-white px-3 py-1.5 rounded-lg border border-slate-200/60 text-xs shadow-sm">{date ? new Date(date).toLocaleString('vi-VN') : "-"}</span>
                                                        </TableCell>
                                                        <TableCell className="text-right pr-10 whitespace-nowrap">
                                                            <span className="font-black text-indigo-600 text-2xl bg-indigo-50/50 px-4 py-1.5 rounded-xl border border-indigo-100/60 shadow-sm">{score} đ</span>
                                                        </TableCell>
                                                        <TableCell className="text-right pr-4">
                                                            <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors rounded-full" title="Hủy bài kiểm tra này" onClick={(e) => handleDeleteTestResult(test.id || test.Id || "", e)}>
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )
                        ) : (
                            <div className="space-y-6 animate-in zoom-in-95 duration-300">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/80 backdrop-blur-md border border-white p-6 rounded-3xl shadow-sm gap-4">
                                    <div>
                                        <button className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors mb-2 flex items-center bg-white px-3 py-1 rounded-full border border-slate-100 hover:bg-indigo-50 hover:border-indigo-100 shadow-sm" onClick={() => setActiveTestDetail(null)}>
                                            <ChevronLeft className="w-4 h-4 mr-1" /> Quay lại danh sách
                                        </button>
                                        <h4 className="font-black text-slate-800 text-2xl tracking-tight">{getRubricTitle(activeTestDetail.testId || activeTestDetail.TestId)}</h4>
                                        {((activeTestDetail?.paperImageUrl && activeTestDetail.paperImageUrl.match(/\.(doc|docx|txt|pdf|rar|zip)\$/i)) ||
                                            (activeTestDetail?.PaperImageUrl && activeTestDetail.PaperImageUrl.match(/\.(doc|docx|txt|pdf|rar|zip)\$/i))) && (
                                                <div className="mt-4 mb-2">
                                                    <p className="text-sm text-slate-500 font-medium mb-2">
                                                        Bài làm được nộp dưới dạng Tệp tin đính kèm.
                                                    </p>
                                                    <button
                                                        onClick={() => downloadFileWithCustomName(activeTestDetail.paperImageUrl || activeTestDetail.PaperImageUrl || "", viewHistoryStudent?.fullName || viewHistoryStudent?.FullName || "Học_Sinh")}
                                                        className="inline-flex items-center px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-sm font-bold transition-colors border border-indigo-200 shadow-sm"
                                                    >
                                                        <Download className="w-4 h-4 mr-2" />
                                                        Tải Xuống File Gốc
                                                    </button>
                                                </div>
                                            )}
                                    </div>
                                    <div className="bg-gradient-to-br from-indigo-600 to-blue-600 text-white px-8 py-4 rounded-2xl shadow-lg flex flex-col items-center justify-center min-w-[140px]">
                                        <span className="font-black text-4xl leading-none">{activeTestDetail.totalScore ?? activeTestDetail.TotalScore}</span>
                                        <span className="text-sm font-bold opacity-80 mt-1 uppercase tracking-wider">Điểm số</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    {(activeTestDetail.gradingDetails || activeTestDetail.GradingDetails) && (activeTestDetail.gradingDetails || activeTestDetail.GradingDetails)!.length > 0 ? (
                                        (activeTestDetail.gradingDetails || activeTestDetail.GradingDetails)!.map((detail: GradingDetail, idx: number) => {
                                            const qNum = detail.questionNumber ?? detail.QuestionNumber ?? (idx + 1);
                                            const aScore = detail.awardedScore ?? detail.AwardedScore ?? 0;
                                            const fScore = detail.finalScore ?? detail.FinalScore;
                                            const aiFeed = detail.aiFeedback ?? detail.AIFeedback;
                                            const tCorrect = detail.teacherCorrection ?? detail.TeacherCorrection;
                                            const isMod = detail.isTeacherModified ?? detail.IsTeacherModified;

                                            const isCorrect = aScore > 0;
                                            const isEditing = editingQuestion === qNum;
                                            const displayScore = fScore !== undefined ? fScore : aScore;

                                            return (
                                                <div key={idx} className={`bg-white/80 backdrop-blur-sm p-5 rounded-2xl border flex flex-col shadow-sm transition-all hover:shadow-md ${isCorrect ? 'border-emerald-200' : 'border-red-200'} ${isMod ? 'ring-2 ring-indigo-300' : ''}`}>

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
                                                            {!isEditing && (
                                                                <Button variant="outline" size="icon" onClick={() => handleEditScoreClick(detail)} className="h-12 w-12 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-colors">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {isEditing && (
                                                        <div className="mt-5 pt-5 border-t border-slate-200/80 animate-in fade-in slide-in-from-top-2">
                                                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
                                                                <div className="sm:col-span-1">
                                                                    <Label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Điểm mới</Label>
                                                                    <Input type="number" step="0.25" value={editScore} onChange={e => setEditScore(parseFloat(e.target.value) || 0)} className="w-full bg-white h-11" />
                                                                </div>
                                                                <div className="sm:col-span-3">
                                                                    <Label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Lời phê của giáo viên</Label>
                                                                    <Input type="text" value={editFeedback} onChange={e => setEditFeedback(e.target.value)} className="w-full bg-white h-11" placeholder="Nhập lời giải thích hoặc nhận xét mới..." />
                                                                </div>
                                                            </div>
                                                            <div className="flex justify-end gap-2">
                                                                <Button variant="ghost" onClick={() => setEditingQuestion(null)} className="rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-600">Hủy</Button>
                                                                <Button onClick={() => handleSaveScoreCorrection(qNum)} disabled={isSavingScore} className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md">
                                                                    {isSavingScore ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Lưu & Cập nhật
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })
                                    ) : (
                                        <p className="text-center text-base text-slate-500 py-10 bg-white/60 backdrop-blur-sm border border-dashed border-slate-300 rounded-3xl">Không có bảng bóc tách dữ liệu chi tiết cho đề thi này.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* MODAL CẤU HÌNH HỆ SỐ ĐIỂM */}
            <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
                <DialogContent className="sm:max-w-[400px] bg-white/95 backdrop-blur-xl z-50 rounded-[2rem] overflow-hidden p-0 border border-white shadow-2xl">
                    <div className="h-2 bg-gradient-to-r from-slate-700 to-slate-900 w-full absolute top-0 left-0"></div>
                    <DialogHeader className="pt-6 px-6 pb-2 border-b border-slate-100 bg-slate-50/50">
                        <DialogTitle className="text-xl font-black text-slate-800 flex items-center">
                            <Settings className="w-5 h-5 mr-2 text-slate-600" /> Cấu Hình Tính Điểm
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-slate-500 font-medium mb-4 leading-relaxed">
                            Nhập hệ số nhân cho từng cột điểm. Hệ thống sẽ tự động tính lại Điểm Trung Bình của toàn bộ học sinh.
                        </p>
                        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <Label className="font-bold text-slate-700">Điểm Thường Xuyên</Label>
                            <Input type="number" min="0" step="0.5" className="w-20 text-center font-bold bg-white" value={weights.tx} onChange={(e) => setWeights({ ...weights, tx: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <Label className="font-bold text-slate-700">Điểm 15 Phút</Label>
                            <Input type="number" min="0" step="0.5" className="w-20 text-center font-bold bg-white" value={weights.p15} onChange={(e) => setWeights({ ...weights, p15: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <Label className="font-bold text-slate-700">Điểm 1 Tiết / Giữa Kỳ</Label>
                            <Input type="number" min="0" step="0.5" className="w-20 text-center font-bold bg-white" value={weights.p45} onChange={(e) => setWeights({ ...weights, p45: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <Label className="font-bold text-slate-700 text-rose-600">Điểm Thi Học Kỳ</Label>
                            <Input type="number" min="0" step="0.5" className="w-20 text-center font-bold bg-white border-rose-200 focus-visible:ring-rose-500" value={weights.thi} onChange={(e) => setWeights({ ...weights, thi: parseFloat(e.target.value) || 0 })} />
                        </div>
                    </div>
                    <DialogFooter className="p-5 pt-3 bg-slate-50/50 border-t border-slate-100 rounded-b-[2rem]">
                        <Button variant="outline" className="rounded-full font-bold px-6 bg-white shadow-sm" onClick={() => setIsConfigModalOpen(false)}>Hủy</Button>
                        <Button onClick={handleSaveWeights} className="bg-slate-800 hover:bg-slate-900 text-white rounded-full font-bold px-8 shadow-md">
                            Lưu cấu hình
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL THÊM HỌC SINH MỚI */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent className="sm:max-w-[450px] bg-white/90 backdrop-blur-xl z-50 rounded-[2rem] overflow-hidden p-0 border border-white shadow-2xl">
                    <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-500 w-full absolute top-0 left-0"></div>
                    <DialogHeader className="pt-6 px-6 pb-2 border-b border-slate-100 bg-slate-50/50">
                        <DialogTitle className="text-2xl font-black text-slate-800">Thêm Học Sinh Mới</DialogTitle>
                    </DialogHeader>
                    <div className="p-6 space-y-5">
                        <div className="space-y-2">
                            <Label className="font-bold text-slate-700 ml-1">Mã học sinh</Label>
                            <Input placeholder="VD: HS001 (Để trống HT sẽ tự tạo)" className="bg-white/50 backdrop-blur-sm border-slate-200 h-12 rounded-xl focus-visible:ring-blue-500" value={newStudent.studentCode} onChange={(e) => setNewStudent({ ...newStudent, studentCode: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label className="font-bold text-slate-700 ml-1">Họ và Tên <span className="text-red-500">*</span></Label>
                            <Input placeholder="VD: Nguyễn Văn A" className="bg-white/50 backdrop-blur-sm border-slate-200 h-12 rounded-xl focus-visible:ring-blue-500 font-bold" value={newStudent.fullName} onChange={(e) => setNewStudent({ ...newStudent, fullName: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label className="font-bold text-slate-700 ml-1">Lớp</Label>
                            <Input placeholder="VD: 12A1" className="bg-white/50 backdrop-blur-sm border-slate-200 h-12 rounded-xl focus-visible:ring-blue-500" value={newStudent.className} onChange={(e) => setNewStudent({ ...newStudent, className: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter className="p-6 pt-4 bg-slate-50/50 border-t border-slate-100 rounded-b-[2rem]">
                        <Button variant="outline" className="rounded-full font-bold px-6 hover:bg-white border-slate-300 h-11 bg-white/50 shadow-sm backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)}>Hủy</Button>
                        <Button onClick={handleAddManual} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold px-8 shadow-md h-11 transition-all border-none">
                            {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Users className="w-5 h-5 mr-2" />} Lưu Học Sinh
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}