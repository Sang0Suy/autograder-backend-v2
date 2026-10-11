import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import { Clock, UserCircle, CheckCircle2, ChevronRight, AlertTriangle, Loader2, FileText, CheckCircle } from 'lucide-react';

interface Question {
    order: number;
    content: string;
    options: string;
    maxScore: number;
}

interface Rubric {
    title: string;
    examType: string;
    questions: Question[];
}

interface GradingResult {
    totalScore: number;
    overallFeedback: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    details: any[];
}

export default function OnlineExam({ testId, studentCode }: { testId: string, studentCode: string }) {
    const [rubric, setRubric] = useState<Rubric | null>(null);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<GradingResult | null>(null);

    const [studentName, setStudentName] = useState("Đang tải...");
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    const [showReviewModal, setShowReviewModal] = useState(false);

    const confirmSubmit = async () => {
        setShowReviewModal(false);
        setIsSubmitting(true);
        const toastId = toast.loading("Đang nộp bài lên hệ thống...");

        try {
            const payload = {
                TestId: testId,
                StudentCode: studentCode,
                StudentName: studentName,
                Answers: answers
            };

            const res = await axios.post('/api/Grading/online-grade', payload);
            toast.success("Nộp bài thành công!", { id: toastId });
            setResult(res.data);

        } catch (error) {
            console.error(error);
            toast.error("Lỗi khi nộp bài. Vui lòng thử lại!", { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        axios.get(`/api/Rubrics/${testId}`).then(res => {
            setRubric(res.data);

            let minutes = 15;
            if (res.data.examType.includes('45')) minutes = 45;
            if (res.data.examType.includes('Thi')) minutes = 60;
            setTimeLeft(minutes * 60);
        });

        const role = localStorage.getItem('role');
        let fallbackName = "Khách vãng lai";
        if (role === 'Admin') fallbackName = "👑 Quản trị viên (Thi thử)";
        if (role === 'Teacher') fallbackName = "👨‍🏫 Giáo viên (Thi thử)";

        axios.get('/api/Students').then(res => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const stu = res.data.find((s: any) => s.studentCode.toLowerCase() === studentCode.toLowerCase());
            setStudentName(stu ? stu.fullName : fallbackName);
        }).catch(() => setStudentName(fallbackName));

    }, [testId, studentCode]);

    useEffect(() => {
        if (timeLeft === null || isSubmitting || result) return;

        if (timeLeft <= 0) {
            toast.error("Đã hết thời gian làm bài! Hệ thống tự động nộp.");
            setTimeout(() => {
                confirmSubmit();
            }, 0);
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft(prev => (prev !== null ? prev - 1 : null));
        }, 1000);

        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeLeft, isSubmitting, result]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    const handleSelect = (questionOrder: number, option: string) => {
        setAnswers(prev => ({ ...prev, [questionOrder]: option }));
    };

    const scrollToQuestion = (order: number) => {
        const element = document.getElementById(`question-${order}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('ring-4', 'ring-indigo-300', 'bg-indigo-100/80');
            setTimeout(() => element.classList.remove('ring-4', 'ring-indigo-300', 'bg-indigo-100/80'), 1500);
        }
    };

    // 🔥 GIAO DIỆN TẢI PHÒNG THI
    if (!rubric) return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] animate-in fade-in duration-700 relative">
            <div className="fixed inset-0 -z-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50 via-slate-50 to-blue-50/50 pointer-events-none"></div>
            <div className="p-8 bg-white/70 backdrop-blur-xl rounded-[2rem] shadow-xl border border-white flex flex-col items-center">
                <Loader2 className="w-14 h-14 animate-spin text-indigo-600 mb-6" />
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Đang khởi tạo phòng thi...</h2>
                <p className="text-slate-500 mt-2 font-medium text-lg">Vui lòng chờ trong giây lát</p>
            </div>
        </div>
    );

    // 🔥 GIAO DIỆN XEM ĐIỂM SAU KHI NỘP (GLASSMORPHISM MÀU EMERALD)
    if (result) {
        return (
            <div className="min-h-screen relative p-4 md:p-6 animate-in fade-in duration-700">
                {/* Background trang xem điểm */}
                <div className="fixed inset-0 -z-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-50 via-slate-50 to-teal-50/50 pointer-events-none"></div>
                <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] bg-emerald-300/20 rounded-full blur-[120px] -z-10 pointer-events-none animate-pulse"></div>

                <div className="max-w-4xl mx-auto bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white overflow-hidden mt-6 mb-12">
                    <div className="bg-gradient-to-br from-emerald-400 to-teal-600 p-14 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl opacity-20 translate-x-1/3 -translate-y-1/3"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-900 rounded-full blur-3xl opacity-20 -translate-x-1/3 translate-y-1/3"></div>
                        <CheckCircle className="w-24 h-24 text-white mx-auto mb-6 drop-shadow-md relative z-10" />
                        <h2 className="text-7xl font-black text-white drop-shadow-lg tracking-tighter relative z-10">{result.totalScore} <span className="text-3xl">điểm</span></h2>
                        <p className="text-emerald-50 mt-5 text-xl font-medium max-w-2xl mx-auto relative z-10 leading-relaxed shadow-sm bg-black/10 p-4 rounded-2xl backdrop-blur-sm">"{result.overallFeedback}"</p>
                    </div>

                    <div className="p-8 md:p-10 space-y-4 bg-slate-50/50">
                        <h3 className="font-black text-2xl text-slate-800 mb-8 flex items-center">
                            <FileText className="w-7 h-7 mr-3 text-emerald-600" /> Bảng chi tiết đáp án
                        </h3>

                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {result.details?.map((d: any, i: number) => {
                                const isCorrect = d.awardedScore > 0;
                                return (
                                    <div key={i} className={`flex items-start p-6 rounded-3xl border-2 shadow-sm transition-all backdrop-blur-sm ${isCorrect ? 'bg-emerald-50/60 border-emerald-100 hover:border-emerald-300' : 'bg-red-50/60 border-red-100 hover:border-red-300'}`}>
                                        <ChevronRight className={`w-7 h-7 mr-4 shrink-0 mt-0.5 ${isCorrect ? 'text-emerald-500' : 'text-red-400'}`} />
                                        <div>
                                            <span className="font-black text-slate-800 text-lg">Câu {d.questionNumber} <span className="text-slate-400 text-sm font-bold">({d.awardedScore}đ)</span>:{' '}</span>
                                            <span className={`text-base block mt-1.5 leading-relaxed ${isCorrect ? "text-emerald-700 font-bold" : "text-red-600 font-medium"}`}>
                                                {isCorrect ? `Chính xác! Bạn đã chọn đáp án ${d.recognizedText}` : `Sai (Bạn chọn: ${d.recognizedText}). ${d.aiFeedback}`}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="mt-10 text-center pt-8 border-t border-slate-200/60">
                            <Button size="lg" className="rounded-full bg-slate-800 hover:bg-slate-900 text-white px-12 h-14 text-lg font-bold shadow-lg transition-all" onClick={() => window.location.href = '/'}>
                                Rời khỏi phòng thi
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const unAnsweredCount = rubric.questions.length - Object.keys(answers).length;

    // 🔥 GIAO DIỆN LÀM BÀI CHÍNH
    return (
        <div className="min-h-screen relative max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in duration-700">
            {/* Background Phòng thi */}
            <div className="fixed inset-0 -z-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50 via-slate-50 to-blue-50/50 pointer-events-none"></div>
            <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] bg-indigo-300/20 rounded-full blur-[120px] -z-10 pointer-events-none animate-pulse"></div>

            <div className="flex flex-col lg:flex-row gap-6 items-start">

                {/* ================= CỘT TRÁI: ĐỀ THI ================= */}
                <div className="flex-1 w-full space-y-6">
                    {/* Header Bài thi */}
                    <div className="bg-white/70 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-100 to-blue-50 rounded-full blur-3xl -z-10 opacity-70 translate-x-1/3 -translate-y-1/3"></div>
                        <h1 className="text-3xl md:text-4xl font-black text-indigo-900 mb-5 tracking-tight leading-tight drop-shadow-sm">{rubric.title}</h1>
                        <div className="flex flex-wrap gap-4 items-center text-slate-600 font-medium">
                            <div className="flex items-center bg-white/60 backdrop-blur-sm px-5 py-2.5 rounded-full border border-white shadow-sm">
                                <UserCircle className="w-6 h-6 mr-2 text-indigo-600" />
                                <span className="mr-2 text-slate-500">Thí sinh:</span>
                                <span className="text-indigo-800 font-bold">{studentName}</span>
                            </div>
                            <div className="flex items-center bg-white/60 backdrop-blur-sm px-5 py-2.5 rounded-full border border-white shadow-sm">
                                <span className="mr-2 text-slate-500">Tổng số:</span>
                                <span className="text-indigo-800 font-bold">{rubric.questions.length} câu</span>
                            </div>
                        </div>
                    </div>

                    {/* Danh sách Câu hỏi */}
                    <div className="space-y-6">
                        {rubric.questions.map((q: Question) => {
                            const opts = (q.options || '|||').split('|');
                            const labels = ['A', 'B', 'C', 'D'];

                            return (
                                <div
                                    key={q.order}
                                    id={`question-${q.order}`}
                                    className="p-6 md:p-8 bg-white/80 backdrop-blur-sm rounded-[2rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-lg transition-all duration-300"
                                >
                                    <h3 className="font-bold text-slate-800 mb-8 text-lg md:text-xl leading-relaxed flex items-start">
                                        <span className="bg-indigo-100/80 text-indigo-700 px-4 py-1.5 rounded-xl mr-4 text-base shrink-0 border border-indigo-200/60 shadow-sm backdrop-blur-sm">Câu {q.order}</span>
                                        <span>
                                            <span className="font-medium text-slate-700">{q.content}</span>
                                            <span className="text-slate-400 text-sm font-bold ml-2 block sm:inline">({q.maxScore} điểm)</span>
                                        </span>
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {labels.map((lbl, idx) => {
                                            const isSelected = answers[q.order] === lbl;
                                            return (
                                                <label
                                                    key={lbl}
                                                    className={`flex items-center p-5 border-2 rounded-2xl cursor-pointer transition-all duration-200 group
                                                        ${isSelected
                                                            ? 'bg-indigo-50/80 border-indigo-400 shadow-sm backdrop-blur-sm'
                                                            : 'bg-white/50 border-white hover:bg-white hover:border-indigo-200 hover:shadow-sm'}
                                                    `}
                                                >
                                                    {/* Custom Radio Button */}
                                                    <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center mr-4 shrink-0 transition-colors shadow-sm
                                                        ${isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white group-hover:border-indigo-400'}
                                                    `}>
                                                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-white"></div>}
                                                    </div>

                                                    {/* Thẻ input gốc bị ẩn đi bằng class "hidden" - GIỮ NGUYÊN LOGIC NÀY */}
                                                    <input
                                                        type="radio"
                                                        name={`question-${q.order}`}
                                                        value={lbl}
                                                        checked={isSelected}
                                                        onChange={() => handleSelect(q.order, lbl)}
                                                        className="hidden"
                                                    />

                                                    <span className={`font-black mr-3 text-xl ${isSelected ? 'text-indigo-700' : 'text-slate-400'}`}>{lbl}.</span>
                                                    <span className={`font-medium text-lg leading-relaxed ${isSelected ? 'text-indigo-900 font-bold' : 'text-slate-700'}`}>{opts[idx]}</span>
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ================= CỘT PHẢI: BẢNG ĐIỀU HƯỚNG ================= */}
                {/* 🔥 ĐÃ FIX LỖI STICKY TẠI ĐÂY: Thêm h-fit, max-h, overflow-y-auto */}
                <div className="w-full lg:w-[360px] shrink-0 bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 lg:sticky lg:top-6 z-10 h-fit max-h-[calc(100vh-3rem)] overflow-y-auto custom-scrollbar">

                    {/* Đồng hồ */}
                    <div className={`flex flex-col items-center justify-center p-6 rounded-[1.5rem] border-2 mb-8 shadow-inner transition-colors backdrop-blur-sm
                        ${timeLeft !== null && timeLeft <= 60
                            ? 'bg-red-500/10 text-red-600 border-red-500/50 animate-pulse'
                            : 'bg-slate-900/80 text-white border-slate-700'}`}>
                        <div className="flex items-center font-black text-5xl tracking-tighter drop-shadow-md">
                            <Clock className={`w-8 h-8 mr-3 ${timeLeft !== null && timeLeft <= 60 ? 'text-red-500 animate-bounce' : 'text-indigo-300'}`} />
                            {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
                        </div>
                        <span className={`text-sm mt-3 font-bold uppercase tracking-widest ${timeLeft !== null && timeLeft <= 60 ? 'text-red-600 font-black' : 'text-slate-300 opacity-90'}`}>
                            Thời gian còn lại
                        </span>
                    </div>

                    <div className="flex items-center justify-between mb-5 border-b border-slate-200/60 pb-4">
                        <span className="font-bold text-slate-700 text-lg">Bảng câu hỏi:</span>
                        <span className="bg-indigo-100/80 text-indigo-700 px-3 py-1 rounded-full font-bold text-sm border border-indigo-200/60 shadow-sm backdrop-blur-sm">
                            Đã làm {Object.keys(answers).length}/{rubric.questions.length}
                        </span>
                    </div>

                    {/* Lưới các nút câu hỏi */}
                    <div className="grid grid-cols-5 gap-3 mb-8">
                        {rubric.questions.map(q => {
                            const isAnswered = !!answers[q.order];
                            return (
                                <button
                                    key={q.order}
                                    onClick={() => scrollToQuestion(q.order)}
                                    className={`w-full aspect-square rounded-xl font-bold border-2 flex items-center justify-center transition-all duration-200 text-sm md:text-base backdrop-blur-sm
                                        ${isAnswered
                                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-md transform scale-[1.05]'
                                            : 'bg-white/50 text-slate-500 border-white hover:border-indigo-400 hover:text-indigo-600 hover:bg-white shadow-sm'}
                                    `}
                                >
                                    {q.order}
                                </button>
                            )
                        })}
                    </div>

                    <Button
                        onClick={() => setShowReviewModal(true)}
                        disabled={isSubmitting}
                        className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white py-7 font-black text-xl rounded-2xl shadow-lg hover:shadow-xl transition-all border-none transform hover:-translate-y-1"
                    >
                        {isSubmitting ? <><Loader2 className="w-6 h-6 mr-2 animate-spin" /> Đang xử lý...</> : "NỘP BÀI NGAY"}
                    </Button>
                </div>
            </div>

            {/* ================= MODAL XÁC NHẬN REVIEW TRƯỚC KHI NỘP ================= */}
            {showReviewModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 border border-white p-0">

                        {/* Header Modal */}
                        <div className="p-6 md:p-8 border-b border-slate-200/60 bg-white/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Kiểm tra trước khi nộp</h2>
                                <p className="text-slate-500 text-sm mt-1 font-medium">Bấm vào câu hỏi bị thiếu để quay lại làm tiếp</p>
                            </div>
                            {unAnsweredCount > 0 ? (
                                <span className="flex items-center text-red-700 font-bold bg-red-50 border border-red-200 px-4 py-2 rounded-xl text-sm shadow-sm backdrop-blur-sm">
                                    <AlertTriangle className="w-5 h-5 mr-2" /> Còn {unAnsweredCount} câu chưa làm!
                                </span>
                            ) : (
                                <span className="flex items-center text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl text-sm shadow-sm backdrop-blur-sm">
                                    <CheckCircle2 className="w-5 h-5 mr-2" /> Đã hoàn thành 100%
                                </span>
                            )}
                        </div>

                        {/* Body Modal (Cuộn được) */}
                        <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-slate-50/50 custom-scrollbar">
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                                {rubric.questions.map(q => {
                                    const ans = answers[q.order];
                                    return (
                                        <button
                                            key={q.order}
                                            onClick={() => {
                                                setShowReviewModal(false);
                                                scrollToQuestion(q.order);
                                            }}
                                            className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 transition-all hover:scale-105 shadow-sm backdrop-blur-sm
                                                ${!ans
                                                    ? 'border-red-300 bg-red-50 hover:border-red-400'
                                                    : 'border-white bg-white/80 hover:border-indigo-300 hover:bg-white'}
                                            `}
                                        >
                                            <span className="font-bold text-slate-500 text-sm mb-1">Câu {q.order}</span>
                                            <span className={`font-black text-2xl ${ans ? 'text-indigo-600' : 'text-red-500'}`}>
                                                {ans || '--'}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Footer Modal */}
                        <div className="p-6 border-t border-slate-200/60 bg-white/50 flex flex-col sm:flex-row justify-end gap-4 rounded-b-[2rem]">
                            <Button variant="outline" size="lg" className="rounded-full border-slate-300 font-bold hover:bg-slate-100 bg-white/80 px-8 h-12 shadow-sm text-base" onClick={() => setShowReviewModal(false)}>
                                Quay lại làm tiếp
                            </Button>
                            <Button size="lg" className="rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold px-10 shadow-md h-12 text-base border-none" onClick={() => confirmSubmit()}>
                                Chắc chắn nộp bài
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}