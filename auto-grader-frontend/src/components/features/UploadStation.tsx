import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { UploadCloud, FileImage, Loader2, CheckCircle2, XCircle, ChevronRight, ScanSearch, Inbox, FileText, FileType2, FileArchive, Zap, Bot, Ban, Activity, Server, Edit2, Save, PlayCircle } from "lucide-react"
import axios from "axios"
import { toast } from 'sonner'
import confetti from 'canvas-confetti'
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'

// ============================================================================
// 1. KHAI BÁO KIỂU DỮ LIỆU (INTERFACES)
// ============================================================================
interface Student { id: string; studentCode: string; fullName: string; className: string; }
interface Rubric { id: string; title: string; examType: string; totalScore: number; }
interface GradeDetail {
    questionNumber: number; awardedScore: number; recognizedText: string; aiFeedback: string;
    finalScore?: number;
    teacherCorrection?: string;
    isTeacherModified?: boolean;
}
interface GradeResult { id?: string; totalScore: number; overallFeedback: string; details: GradeDetail[]; fileName?: string; status?: 'success' | 'error' | 'canceled' }
interface GradingConfigProps {
    gradingMode: 'omr' | 'ai';
    setGradingMode: (mode: 'omr' | 'ai') => void;
    selectedTestId: string;
    setSelectedTestId: (id: string) => void;
    selectedStudentCode: string;
    setSelectedStudentCode: (code: string) => void;
    rubrics: Rubric[];
    students: Student[];
    isStudent: boolean;
}

interface DropzoneAreaProps {
    files: File[];
    isDragging: boolean;
    setIsDragging: (val: boolean) => void;
    handleFileSelect: (files: FileList | null) => void;
    removeFile: (idx: number) => void;
    handleBulkUpload: () => void;
    isGrading: boolean;
    gradingMode: 'omr' | 'ai';
    selectedTestId: string;
    uploadProgress: number; // Thêm prop tiến độ tải
}

const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) return <FileImage className="w-5 h-5 text-indigo-500 mr-3 shrink-0" />;
    if (ext === 'pdf') return <FileText className="w-5 h-5 text-red-500 mr-3 shrink-0" />;
    if (['doc', 'docx', 'txt'].includes(ext || '')) return <FileType2 className="w-5 h-5 text-blue-600 mr-3 shrink-0" />;
    return <FileArchive className="w-5 h-5 text-slate-500 mr-3 shrink-0" />;
}

// ============================================================================
// 2. CÁC COMPONENT CON (SUB-COMPONENTS)
// ============================================================================

const GradingConfig = ({ gradingMode, setGradingMode, selectedTestId, setSelectedTestId, selectedStudentCode, setSelectedStudentCode, rubrics, students, isStudent }: GradingConfigProps) => (
    <div className="bg-white/70 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80">
        <h3 className="text-xl font-black text-slate-800 mb-6 border-b border-slate-200/60 pb-4">Cấu Hình Phân Tích</h3>
        <div className="space-y-6">
            <div className="space-y-3">
                <Label className="text-slate-700 font-bold text-base ml-1">Chế độ xử lý <span className="text-red-500">*</span></Label>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setGradingMode('omr')} className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${gradingMode === 'omr' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold shadow-sm' : 'border-white bg-white/50 text-slate-500 hover:border-indigo-200 hover:bg-white'}`}>
                        <Zap className={`w-6 h-6 mb-1 ${gradingMode === 'omr' ? 'text-indigo-600' : 'text-slate-400'}`} />
                        <span className="text-sm">OMR (Tốc độ)</span>
                    </button>
                    <button onClick={() => setGradingMode('ai')} className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${gradingMode === 'ai' ? 'border-purple-500 bg-purple-50 text-purple-700 font-bold shadow-sm' : 'border-white bg-white/50 text-slate-500 hover:border-purple-200 hover:bg-white'}`}>
                        <Bot className={`w-6 h-6 mb-1 ${gradingMode === 'ai' ? 'text-purple-600' : 'text-slate-400'}`} />
                        <span className="text-sm">AI Đọc hiểu</span>
                    </button>
                </div>
            </div>
            <div className="space-y-3">
                <Label className="text-slate-700 font-bold text-base ml-1">Thuộc bộ đề thi nào? <span className="text-red-500">*</span></Label>
                <select className="w-full h-14 rounded-2xl border border-white/60 bg-white/50 px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-base font-medium text-slate-700 shadow-sm backdrop-blur-sm transition-colors" value={selectedTestId} onChange={e => setSelectedTestId(e.target.value)}>
                    <option value="" className="text-slate-400">-- Chọn đề thi cần chấm --</option>
                    {rubrics.map((r: Rubric) => <option key={r.id} value={r.id}>[{r.examType}] {r.title}</option>)}
                </select>
            </div>
            <div className="space-y-3">
                <Label className="text-slate-700 font-bold text-base ml-1">Định danh học sinh <span className="text-red-500">*</span></Label>
                <select className="w-full h-14 rounded-2xl border border-white/60 bg-white/50 px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-base font-medium text-slate-700 shadow-sm backdrop-blur-sm transition-colors" disabled={isStudent} value={selectedStudentCode} onChange={e => setSelectedStudentCode(e.target.value)}>
                    {!isStudent && <option value="AUTO" className="font-bold text-indigo-600">✨ AI Tự Động Tìm Mã HS</option>}
                    {students.map((s: Student) => <option key={s.id} value={s.studentCode}>{s.studentCode} - {s.fullName}</option>)}
                </select>
            </div>
        </div>
    </div>
);

const DropzoneArea = ({ files, isDragging, setIsDragging, handleFileSelect, removeFile, handleBulkUpload, isGrading, gradingMode, selectedTestId, uploadProgress }: DropzoneAreaProps) => {
    const acceptedFormats = gradingMode === 'omr' ? "image/jpeg, image/png, image/jpg" : "image/*, application/pdf, .doc, .docx, text/plain";
    const hintText = gradingMode === 'omr' ? "Chỉ hỗ trợ file Ảnh (JPG, PNG) để quét OMR" : "Hỗ trợ Ảnh, PDF, Word, TXT cho AI phân tích";

    return (
        <div className="bg-white/70 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80">
            <h3 className="text-xl font-black text-slate-800 mb-6 border-b border-slate-200/60 pb-4">Tải Lên Bài Làm</h3>
            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileSelect(e.dataTransfer.files) }}
                className={`relative border-2 border-dashed rounded-[2rem] p-10 text-center transition-all cursor-pointer shadow-sm ${isDragging ? 'border-indigo-500 bg-indigo-50/80 scale-[1.02]' : 'border-indigo-200/60 bg-white/40 hover:bg-white/80 hover:border-indigo-400'}`}
                onClick={() => document.getElementById('file-upload')?.click()}
            >
                <input id="file-upload" type="file" multiple className="hidden" accept={acceptedFormats} onChange={(e) => handleFileSelect(e.target.files)} />
                <div className="flex flex-col items-center space-y-4 pointer-events-none">
                    <div className={`p-4 rounded-full transition-colors shadow-sm ${isDragging ? 'bg-indigo-200 text-indigo-700' : 'bg-white text-indigo-500 border border-indigo-100'}`}>
                        <UploadCloud className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="font-bold text-slate-700 text-lg">Kéo thả tài liệu vào đây</p>
                        <p className={`text-sm mt-1 font-bold ${gradingMode === 'omr' ? 'text-indigo-500' : 'text-purple-500'}`}>{hintText}</p>
                    </div>
                </div>
            </div>

            {files.length > 0 && (
                <div className="mt-6 space-y-3 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                    {files.map((f: File, idx: number) => {
                        const isImage = f.type.startsWith('image/');
                        const thumbUrl = isImage ? URL.createObjectURL(f) : null;

                        return (
                            <div key={idx} className="flex items-center justify-between bg-white/60 backdrop-blur-sm p-3 rounded-xl border border-white shadow-sm hover:border-indigo-200 transition-colors">
                                <div className="flex items-center truncate mr-3">
                                    {isImage && thumbUrl ? (
                                        <img src={thumbUrl} alt="preview" className="w-10 h-10 object-cover rounded-lg mr-3 shadow-sm border border-slate-200" />
                                    ) : (
                                        getFileIcon(f.name)
                                    )}
                                    <span className="truncate font-bold text-slate-700 text-sm">{f.name}</span>
                                </div>
                                {!isGrading && (
                                    <button onClick={() => removeFile(idx)} className="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors shadow-sm">
                                        <XCircle className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {isGrading && uploadProgress < 100 && (
                <div className="mt-6 w-full flex items-center gap-4 text-sm font-bold text-blue-600">
                    <Loader2 className="w-5 h-5 animate-spin" /> Đang tải lên ({uploadProgress}%)...
                    <div className="flex-1 bg-blue-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                </div>
            )}

            <Button
                onClick={handleBulkUpload}
                disabled={files.length === 0 || !selectedTestId || isGrading}
                className={`w-full mt-8 h-14 rounded-full font-black text-lg text-white shadow-lg hover:shadow-xl transition-all border-none ${gradingMode === 'omr' ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'}`}
            >
                {isGrading ? <><Loader2 className="w-6 h-6 mr-2 animate-spin" /> Đang gửi file lên máy chủ...</> : <><PlayCircle className="w-6 h-6 mr-2" /> Bắt Đầu Chấm ({files.length} Bài)</>}
            </Button>
        </div>
    );
};

const ResultCard = ({ res, currentRubric, gradingMode }: { res: GradeResult, currentRubric?: Rubric, gradingMode: string }) => {
    const isError = res.status === 'error';
    const isCanceled = res.status === 'canceled';

    const [localRes, setLocalRes] = useState<GradeResult>(res);
    const [editingQuestion, setEditingQuestion] = useState<number | null>(null);
    const [editScore, setEditScore] = useState<number>(0);
    const [editFeedback, setEditFeedback] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const timerId = setTimeout(() => {
            setLocalRes(res);
        }, 0);
        return () => clearTimeout(timerId);
    }, [res]);

    const handleEditClick = (detail: GradeDetail) => {
        setEditingQuestion(detail.questionNumber);
        setEditScore(detail.finalScore ?? detail.awardedScore);
        setEditFeedback(detail.teacherCorrection || detail.aiFeedback);
    };

    const handleSaveCorrection = async (questionNumber: number) => {
        if (!localRes.id) return toast.error("Không tìm thấy ID bài làm!");
        setIsSaving(true);
        try {
            const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
            const response = await axios.put(`/api/Grading/${localRes.id}/correction`, {
                QuestionNumber: questionNumber,
                NewScore: editScore,
                TeacherCorrection: editFeedback
            }, config);

            toast.success("✅ Đã ghi nhận sửa điểm. AI sẽ học từ dữ liệu này!");

            if (response.data && response.data.data) {
                setLocalRes(response.data.data);
            }
            setEditingQuestion(null);
        } catch (error) {
            toast.error("Lỗi khi lưu chỉnh sửa điểm!");
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className={`bg-white/80 backdrop-blur-md border-2 rounded-[2rem] p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-lg 
            ${isError ? 'border-red-200' : isCanceled ? 'border-orange-300 opacity-80' : 'border-emerald-100/60'}`}>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200/60 pb-5 mb-5">
                <div className="flex items-center">
                    {isError ? <XCircle className="w-8 h-8 text-red-500 mr-3 shrink-0 drop-shadow-sm" />
                        : isCanceled ? <Ban className="w-8 h-8 text-orange-500 mr-3 shrink-0 drop-shadow-sm" />
                            : <CheckCircle2 className="w-8 h-8 text-emerald-500 mr-3 shrink-0 drop-shadow-sm" />}
                    <h4 className="font-black text-slate-800 text-lg md:text-xl truncate max-w-[200px] sm:max-w-xs md:max-w-md">{localRes.fileName}</h4>
                </div>
                {(!isError && !isCanceled) && (
                    <div className={`font-black text-3xl bg-white px-6 py-2.5 rounded-2xl border shadow-sm text-center flex items-baseline justify-center gap-1.5 ${gradingMode === 'omr' ? 'text-indigo-700 border-indigo-100' : 'text-purple-700 border-purple-100'}`}>
                        <span>{localRes.totalScore}</span>
                        <span className="text-xl text-slate-400 font-bold">/ {currentRubric?.totalScore || 10}</span>
                        <span className={`text-base font-bold ${gradingMode === 'omr' ? 'text-indigo-400' : 'text-purple-400'}`}>đ</span>
                    </div>
                )}
            </div>

            <div className={`p-5 rounded-2xl border mb-6 text-base font-medium leading-relaxed shadow-sm 
                ${isError ? 'bg-red-50 border-red-100 text-red-700'
                    : isCanceled ? 'bg-orange-50 border-orange-200 text-orange-700'
                        : 'bg-slate-50/80 border-slate-200/60 text-slate-700 italic'}`}>
                "{localRes.overallFeedback}"
            </div>

            {localRes.details && localRes.details.length > 0 && (
                <div className="grid grid-cols-1 gap-4">
                    {localRes.details.map((d, i) => {
                        const displayScore = d.finalScore !== undefined && d.finalScore !== null ? d.finalScore : d.awardedScore;
                        const isCorrect = displayScore > 0;
                        const isEditing = editingQuestion === d.questionNumber;

                        return (
                            <div key={i} className={`flex flex-col text-sm p-4 rounded-xl border shadow-sm transition-colors ${isCorrect ? 'bg-emerald-50/40 border-emerald-100' : 'bg-red-50/40 border-red-100'} ${d.isTeacherModified ? 'ring-2 ring-indigo-300' : ''}`}>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start">
                                        <ChevronRight className={`w-5 h-5 mr-3 shrink-0 mt-0.5 ${isCorrect ? 'text-emerald-500' : 'text-red-400'}`} />
                                        <div>
                                            <span className="font-black text-slate-800 text-base flex items-center gap-2">
                                                Câu {d.questionNumber}
                                                <span className="text-slate-400 font-medium">({displayScore}đ)</span>
                                                {d.isTeacherModified && <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full border border-indigo-200">Giáo viên đã sửa</span>}
                                            </span>

                                            <span className={`block mt-1.5 text-base ${isCorrect ? "text-emerald-700 font-bold" : "text-red-600 font-medium"}`}>
                                                Học sinh trả lời: {d.recognizedText || 'Trống'}
                                            </span>

                                            <p className="mt-2 text-slate-600 italic border-l-2 border-slate-300 pl-3">
                                                {d.isTeacherModified ? d.teacherCorrection : d.aiFeedback}
                                            </p>
                                        </div>
                                    </div>

                                    {!isEditing && (
                                        <button onClick={() => handleEditClick(d)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Sửa điểm và lời phê">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {isEditing && (
                                    <div className="mt-4 pt-4 border-t border-slate-200/60 animate-in fade-in slide-in-from-top-2">
                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-3">
                                            <div className="sm:col-span-1">
                                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Điểm mới</label>
                                                <input type="number" step="0.25" value={editScore} onChange={e => setEditScore(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                                            </div>
                                            <div className="sm:col-span-3">
                                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Lời phê của giáo viên</label>
                                                <textarea value={editFeedback} onChange={e => setEditFeedback(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 custom-scrollbar" placeholder="Nhập lời phê thực tế của bạn..." />
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setEditingQuestion(null)} className="px-4 py-1.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                                                Hủy
                                            </button>
                                            <button onClick={() => handleSaveCorrection(d.questionNumber)} disabled={isSaving} className="flex items-center px-4 py-1.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50">
                                                {isSaving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                                                Lưu & Dạy AI
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ============================================================================
// 3. COMPONENT CHÍNH (THE ORCHESTRATOR)
// ============================================================================
export default function UploadStation() {
    // States
    const [files, setFiles] = useState<File[]>([])
    const [students, setStudents] = useState<Student[]>([])
    const [rubrics, setRubrics] = useState<Rubric[]>([])
    const [selectedTestId, setSelectedTestId] = useState('')
    const [gradingMode, setGradingMode] = useState<'omr' | 'ai'>('omr')
    const [isDragging, setIsDragging] = useState(false)

    // Upload & Grading States
    const [isGrading, setIsGrading] = useState(false) // Trạng thái đang push file lên server
    const [isAIGrading, setIsAIGrading] = useState(false) // Trạng thái chờ AI chấm
    const [uploadProgress, setUploadProgress] = useState(0) // % Push file lên server
    const [totalToGrade, setTotalToGrade] = useState(0) // Tổng số file đã push thành công
    const [completedGrading, setCompletedGrading] = useState(0) // Số bài AI đã chấm xong
    const [results, setResults] = useState<GradeResult[]>([])

    const [serverLoadCount, setServerLoadCount] = useState<number>(0);

    const abortControllerRef = useRef<AbortController | null>(null);

    const userRole = localStorage.getItem('role') || ''
    const isStudent = userRole === 'Student'
    const myStudentCode = (() => {
        const token = localStorage.getItem('token')
        if (!token) return ''
        try { return JSON.parse(atob(token.split('.')[1]))?.ReferenceId || '' } catch { return '' }
    })()
    const [selectedStudentCode, setSelectedStudentCode] = useState<string>(isStudent ? myStudentCode : "AUTO")

    // Fetch data & Bật SignalR
    useEffect(() => {
        let isMounted = true;

        const fetchInitialData = async () => {
            try {
                const [stuRes, rubRes, queueRes] = await Promise.all([
                    axios.get('/api/Students'),
                    axios.get('/api/Rubrics'),
                    axios.get('/api/Grading/queue-status')
                ])
                if (isMounted) {
                    setStudents(Array.isArray(stuRes.data) ? stuRes.data : [])
                    setRubrics(Array.isArray(rubRes.data) ? rubRes.data : [])
                    if (queueRes.data && typeof queueRes.data.pendingCount === 'number') {
                        setServerLoadCount(queueRes.data.pendingCount);
                    }
                }
            } catch { toast.error("Lỗi khi kết nối đến máy chủ!") }
        }
        fetchInitialData();

        // CẤU HÌNH BỘ ĐÀM SIGNALR
        const connection = new HubConnectionBuilder()
            .withUrl(`${import.meta.env.VITE_API_URL || 'https://autograder-backend-sang.onrender.com'}/gradingHub`, {
                accessTokenFactory: () => localStorage.getItem('token') || ""
            })
            .withAutomaticReconnect()
            .configureLogging(LogLevel.Information)
            .build();

        connection.start()
            .then(() => {
                // Lắng nghe tiếng "bíp còi" cập nhật hàng đợi
                connection.on("ReceiveQueueUpdate", (count: number) => {
                    if (isMounted) setServerLoadCount(count);
                });

                // Lắng nghe AI chấm xong
                connection.on("ReceiveGradingUpdate", async (resultId: string) => {
                    try {
                        const response = await axios.get(`/api/Grading/result/${resultId}`);
                        const finalResult = response.data;
                        const isError = finalResult.paperImageUrl && finalResult.paperImageUrl.includes('(Lỗi');

                        // Cập nhật lại list kết quả
                        setResults(prev => prev.map(item => {
                            if (item.id === resultId || item.id?.includes('temp-')) {
                                return {
                                    ...item,
                                    id: finalResult.id,
                                    totalScore: finalResult.totalScore,
                                    overallFeedback: isError ? "🛑 Hệ thống AI xử lý thất bại!" : (finalResult.overallFeedback || `Đã chấm xong! Điểm: ${finalResult.totalScore}`),
                                    details: finalResult.gradingDetails?.map((d: GradeDetail) => ({
                                        questionNumber: d.questionNumber,
                                        awardedScore: d.awardedScore,
                                        recognizedText: d.recognizedText,
                                        aiFeedback: d.aiFeedback,
                                        finalScore: d.finalScore,
                                        teacherCorrection: d.teacherCorrection,
                                        isTeacherModified: d.isTeacherModified
                                    })) || [],
                                    status: isError ? 'error' : 'success'
                                };
                            }
                            return item;
                        }));

                        // Tăng tiến trình chấm
                        setCompletedGrading(prev => {
                            const next = prev + 1;
                            if (totalToGrade > 0 && next >= totalToGrade) {
                                setIsAIGrading(false);
                            }
                            return next;
                        });

                        if (isMounted && !isError) {
                            if (finalResult.totalScore >= 9) {
                                confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
                            }
                        }
                    } catch (error) {
                        console.error("Lỗi khi tải kết quả mới:", error);
                    }
                });
            })
            .catch(err => console.error("Lỗi kết nối bộ đàm SignalR: ", err));

        // Dọn dẹp bộ đàm khi rời khỏi trang
        return () => {
            isMounted = false;
            connection.stop();
        }
    }, [totalToGrade]) // Thêm dependencies

    // TRẠM RADAR HỎI THĂM ĐỊNH KỲ (DỰ PHÒNG SIGNALR RỚT MẠNG)
    useEffect(() => {
        const pendingItems = results.filter(r => r.overallFeedback?.includes("hàng đợi"));
        if (pendingItems.length === 0) return;

        const intervalId = setInterval(() => {
            pendingItems.forEach(async (item) => {
                if (!item.id) return;
                try {
                    const response = await axios.get(`/api/Grading/result/${item.id}`);
                    const finalResult = response.data;
                    const isFinished = finalResult.overallFeedback || (finalResult.paperImageUrl && !finalResult.paperImageUrl.includes('(Đang chờ'));
                    const isError = finalResult.paperImageUrl && finalResult.paperImageUrl.includes('(Lỗi');

                    if (isFinished || isError) {
                        setResults(prev => prev.map(r => {
                            if (r.id === item.id) {
                                return {
                                    ...r,
                                    totalScore: finalResult.totalScore || 0,
                                    overallFeedback: isError ? "🛑 Lỗi: Hệ thống AI xử lý thất bại!" : (finalResult.overallFeedback || `Đã chấm xong!`),
                                    details: finalResult.gradingDetails?.map((d: GradeDetail) => ({
                                        questionNumber: d.questionNumber,
                                        awardedScore: d.awardedScore,
                                        recognizedText: d.recognizedText,
                                        aiFeedback: d.aiFeedback,
                                    })) || [],
                                    status: isError ? 'error' : 'success'
                                };
                            }
                            return r;
                        }));

                        setCompletedGrading(prev => {
                            const next = prev + 1;
                            if (totalToGrade > 0 && next >= totalToGrade) setIsAIGrading(false);
                            return next;
                        });
                    }
                } catch { /* Ignore */ }
            });
        }, 5000);

        return () => clearInterval(intervalId);
    }, [results, totalToGrade]);

    // Logic Functions
    const handleFileSelect = (selectedFiles: FileList | null) => {
        if (!selectedFiles?.length) return;
        setFiles(prev => [...prev, ...Array.from(selectedFiles)]);
    }
    const removeFile = (indexToRemove: number) => setFiles(files.filter((_, idx) => idx !== indexToRemove));

    const handleBulkUpload = async () => {
        if (files.length === 0 || !selectedStudentCode || !selectedTestId) return toast.warning("Vui lòng chọn Đề thi và tải tài liệu lên!")

        setIsGrading(true);
        setUploadProgress(0);
        setResults([]);

        let successfulUploads = 0;

        for (let i = 0; i < files.length; i++) {
            const currentFile = files[i];
            const formData = new FormData();
            formData.append('ImageFile', currentFile);
            formData.append('StudentCode', selectedStudentCode);
            formData.append('TestId', selectedTestId);
            formData.append('GradingMode', gradingMode);

            abortControllerRef.current = new AbortController();

            try {
                let apiEndpoint = '/api/Grading/omr-grade';
                const fileName = currentFile.name.toLowerCase();

                if (gradingMode === 'ai' || fileName.endsWith('.docx') || fileName.endsWith('.doc') || fileName.endsWith('.txt')) {
                    apiEndpoint = '/api/Grading/ai-grade';
                }

                const response = await axios.post(apiEndpoint, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    signal: abortControllerRef.current.signal,
                    onUploadProgress: (progressEvent) => {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
                        setUploadProgress(Math.round(((i + (percentCompleted / 100)) / files.length) * 100));
                    }
                });

                const data = response.data;

                // Thêm một thẻ "Đang chờ" vào danh sách
                setResults(prev => [...prev, {
                    ...data,
                    id: data.id || data.Id || data.resultId || `temp-${i}`, // Lưu tạm ID nếu có
                    fileName: currentFile.name,
                    overallFeedback: "Đã ném vào hàng đợi AI...",
                    status: 'success'
                }]);

                successfulUploads++;

            } catch (err: unknown) {
                // Xử lý lỗi an toàn không dùng 'any' để làm vừa lòng ESLint
                const isCanceled = axios.isCancel(err);
                let errorMessage = 'Lỗi xử lý';

                if (axios.isAxiosError(err)) {
                    errorMessage = err.response?.data?.error || err.message;
                } else if (err instanceof Error) {
                    errorMessage = err.message;
                }

                setResults(prev => [...prev, {
                    totalScore: 0,
                    overallFeedback: errorMessage,
                    details: [],
                    fileName: currentFile.name,
                    status: isCanceled ? 'canceled' : 'error'
                }]);
            }
        }

        setIsGrading(false);
        setFiles([]); // Xóa file sau khi đẩy lên xong

        if (successfulUploads > 0) {
            setIsAIGrading(true);
            setTotalToGrade(successfulUploads);
            setCompletedGrading(0);
            toast.success(`Đã đẩy ${successfulUploads} bài vào hàng đợi AI!`);

            // THÊM 3 DÒNG NÀY ĐỂ TỰ ĐỘNG RESET Ô ĐỊNH DANH VỀ AI CHO LẦN SAU
            if (!isStudent) {
                setSelectedStudentCode("AUTO");
            }
        }
    }

    const currentRubric = rubrics.find(r => r.id === selectedTestId);
    const aiProgressPercent = totalToGrade > 0 ? Math.round((completedGrading / totalToGrade) * 100) : 0;

    // Render Layout
    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-700 p-2 md:p-4 relative min-h-[85vh]">
            <div className="fixed inset-0 -z-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50 via-slate-50 to-blue-50/50 pointer-events-none"></div>

            <div className="bg-white/70 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-100 to-purple-50 rounded-full blur-3xl -z-10 opacity-70 translate-x-1/3 -translate-y-1/3"></div>
                <div>
                    <h2 className="text-3xl font-black text-slate-800 flex items-center tracking-tight">
                        <ScanSearch className="w-8 h-8 mr-3 text-indigo-600" /> Trạm Chấm Điểm Thông Minh
                    </h2>
                    <p className="text-base text-slate-500 mt-2 font-medium">Tải lên hình ảnh, PDF, hoặc Word để hệ thống tự động nhận diện và phân tích điểm số.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
                {/* CỘT TRÁI */}
                <div className="xl:col-span-1 space-y-6">
                    <GradingConfig gradingMode={gradingMode} setGradingMode={setGradingMode} selectedTestId={selectedTestId} setSelectedTestId={setSelectedTestId} selectedStudentCode={selectedStudentCode} setSelectedStudentCode={setSelectedStudentCode} rubrics={rubrics} students={students} isStudent={isStudent} />
                    <DropzoneArea files={files} isDragging={isDragging} setIsDragging={setIsDragging} handleFileSelect={handleFileSelect} removeFile={removeFile} handleBulkUpload={handleBulkUpload} isGrading={isGrading} gradingMode={gradingMode} selectedTestId={selectedTestId} uploadProgress={uploadProgress} />
                </div>

                {/* CỘT PHẢI */}
                <div className="xl:col-span-2 space-y-6">
                    {/* BẢNG ĐIỀU KHIỂN HÀNG ĐỢI MÁY CHỦ */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2rem] p-6 shadow-xl relative overflow-hidden border border-slate-700">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none"></div>
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 relative z-10">
                            <div>
                                <h3 className="text-indigo-400 font-bold text-sm tracking-wider uppercase mb-1.5 flex items-center">
                                    <Server className="w-4 h-4 mr-1.5" /> Tải Trọng Máy Chủ AI
                                </h3>
                                <div className="flex items-center">
                                    <Activity className={`w-6 h-6 mr-3 ${serverLoadCount > 0 ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`} />
                                    <span className="text-white font-black text-2xl md:text-3xl tracking-tight">
                                        {serverLoadCount > 0 ? `${serverLoadCount} Tác vụ đang xếp hàng` : 'Hệ thống đang rảnh rỗi'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* MÀN HÌNH CHỜ AI CHẤM */}
                    {isAIGrading && (
                        <div className="bg-indigo-50/80 border border-indigo-100 rounded-[2rem] p-8 text-center shadow-inner animate-in zoom-in-95">
                            <Loader2 className="w-16 h-16 animate-spin text-indigo-500 mx-auto mb-4" />
                            <h3 className="text-2xl font-black text-indigo-800 mb-2">AI Đang Chấm Bài...</h3>
                            <p className="text-indigo-600/80 font-medium mb-6">Bạn có thể rời đi làm việc khác. Kết quả sẽ tự động hiện ra khi xong.</p>

                            <div className="w-full bg-indigo-200/50 rounded-full h-6 mb-2 overflow-hidden relative shadow-inner">
                                <div
                                    className="bg-gradient-to-r from-indigo-500 to-blue-500 h-6 rounded-full transition-all duration-500 ease-out flex items-center justify-end px-2"
                                    style={{ width: `${aiProgressPercent}%` }}
                                >
                                    <span className="text-[10px] font-black text-white">{aiProgressPercent}%</span>
                                </div>
                            </div>
                            <div className="flex justify-between text-sm font-bold text-indigo-700">
                                <span>Đã chấm: {completedGrading} bài</span>
                                <span>Tổng cộng: {totalToGrade} bài</span>
                            </div>
                        </div>
                    )}

                    {!isGrading && !isAIGrading && results.length === 0 && (
                        <div className="bg-white/50 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-2 border-dashed border-indigo-200/50 h-full min-h-[300px] flex flex-col items-center justify-center p-8 text-center">
                            <div className="bg-white p-6 rounded-full mb-5 shadow-sm border border-slate-100"><Inbox className="w-12 h-12 text-indigo-200" /></div>
                            <h3 className="text-xl font-black text-slate-700">Trạm xử lý đang trống</h3>
                            <p className="text-slate-500 mt-2 font-medium max-w-md leading-relaxed">Vui lòng cấu hình và tải tài liệu lên để AI bắt đầu chấm.</p>
                        </div>
                    )}

                    {results.length > 0 && (
                        <div className="bg-white/70 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80">
                            <h3 className="font-black text-slate-800 text-xl mb-5">Danh sách Bài làm</h3>
                            <div className="space-y-6 max-h-[800px] overflow-y-auto pr-2 pb-4 custom-scrollbar">
                                {results.map((res, idx) => <ResultCard key={idx} res={res} currentRubric={currentRubric} gradingMode={gradingMode} />)}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}