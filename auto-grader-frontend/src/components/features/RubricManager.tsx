import { useState, useEffect, useMemo } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { toast } from 'sonner'
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';
import BubbleSheet from './BubbleSheet';
import axios from 'axios'
import { Plus, Printer, Trash2, ClipboardCheck, Loader2, Edit, LayoutList, Search, ScanText, Camera, CheckCircle2, ChevronRight, Globe, Settings2, Shuffle, ChevronLeft, Download, Upload } from "lucide-react"

interface Question {
    order: number;
    questionType: 'Essay' | 'MultipleChoice';
    content: string;
    options: string;
    correctAnswer: string;
    explanation?: string;
    maxScore: number;
}

interface Rubric {
    id?: string;
    title: string;
    examType: string;
    questions: Question[];
    totalScore?: number;
    startDate?: string | null;
    endDate?: string | null;
    maxAttempts?: number | null;
}

const MathFormatter = ({ text }: { text: string }) => {
    if (!text) return null;
    const parts = text.split(/(\$.*?\$)/g);
    return (
        <span className="text-slate-800">
            {parts.map((part, index) => {
                if (part.startsWith('$') && part.endsWith('$')) {
                    return <InlineMath key={index} math={part.slice(1, -1)} />;
                }
                return <span key={index}>{part}</span>;
            })}
        </span>
    );
};

export default function RubricManager() {
    // === STATES CƠ BẢN ===
    const [rubrics, setRubrics] = useState<Rubric[]>([])
    const [filterType, setSelectedType] = useState("Tất cả")
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)

    const [searchTerm, setSearchTerm] = useState("")
    const [isScanning, setIsScanning] = useState(false)

    const [printingRubric, setPrintingRubric] = useState<Rubric | null>(null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [omrResult, setOmrResult] = useState<any>(null)
    const [isResultModalOpen, setIsResultModalOpen] = useState(false)

    // 🔥 STATE CHO TÍNH NĂNG TẠO MÃ ĐỀ (TRỘN CÂU HỎI)
    const [shuffleModalOpen, setShuffleModalOpen] = useState(false)
    const [shuffleCount, setShuffleCount] = useState(1)
    const [selectedRubricToShuffle, setSelectedRubricToShuffle] = useState<Rubric | null>(null)

    // 🔥 STATE PHÂN TRANG (PAGINATION)
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10
    const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
    const defaultRubric: Rubric = {
        title: '', examType: '15p',
        questions: [{ order: 1, questionType: 'Essay', content: '', options: '|||', correctAnswer: '', explanation: '', maxScore: 2.0 }],
        startDate: '',
        endDate: '',
        maxAttempts: null
    }
    const [newRubric, setNewRubric] = useState<Rubric>(defaultRubric)

    // === FETCH DỮ LIỆU ===
    const fetchRubrics = async () => {
        try {
            setIsLoading(true)
            const res = await axios.get('/api/Rubrics')
            setRubrics(Array.isArray(res.data) ? res.data : [])
        } catch {
            toast.error("Lỗi tải danh sách!")
        } finally {
            setIsLoading(false)
        }
    }

    // eslint-disable-next-line
    useEffect(() => {
        fetchRubrics()
    }, [])

    // === XỬ LÝ MODAL ===
    const openEditModal = (rubric: Rubric) => {
        const safeQuestions = rubric.questions.map(q => ({
            ...q,
            questionType: q.questionType || 'Essay',
            options: q.options || '|||',
            explanation: q.explanation || ''
        }))
        setNewRubric({
            ...rubric,
            questions: safeQuestions,
            startDate: rubric.startDate ? rubric.startDate.substring(0, 16) : '',
            endDate: rubric.endDate ? rubric.endDate.substring(0, 16) : '',
            maxAttempts: rubric.maxAttempts || null
        })
        setEditingId(rubric.id!)
        setIsModalOpen(true)
    }

    const openAddModal = () => {
        setNewRubric(defaultRubric)
        setEditingId(null)
        setIsModalOpen(true)
    }

    // 🔥 HÀM TẠO MÃ ĐỀ (XÁO TRỘN CÂU HỎI)
    const handleGenerateCodes = async () => {
        if (!selectedRubricToShuffle) return;
        setIsSaving(true);
        const toastId = toast.loading(`Đang nhân bản và xáo trộn tạo ${shuffleCount} mã đề...`);

        try {
            for (let i = 0; i < shuffleCount; i++) {
                // Tạo mã đề ngẫu nhiên 3 số (vd: 104, 209)
                const code = Math.floor(100 + Math.random() * 900);

                // Trộn mảng câu hỏi bằng thuật toán Fisher-Yates
                const shuffledQuestions = [...selectedRubricToShuffle.questions];
                for (let j = shuffledQuestions.length - 1; j > 0; j--) {
                    const k = Math.floor(Math.random() * (j + 1));
                    [shuffledQuestions[j], shuffledQuestions[k]] = [shuffledQuestions[k], shuffledQuestions[j]];
                }

                // Cập nhật lại số thứ tự (order) từ 1 đến N cho mảng đã trộn
                const finalQuestions = shuffledQuestions.map((q, idx) => ({
                    ...q,
                    order: idx + 1
                }));

                const newRubricData = {
                    title: `${selectedRubricToShuffle.title} - Mã đề ${code}`,
                    examType: selectedRubricToShuffle.examType,
                    startDate: selectedRubricToShuffle.startDate,
                    endDate: selectedRubricToShuffle.endDate,
                    maxAttempts: selectedRubricToShuffle.maxAttempts,
                    questions: finalQuestions
                };

                await axios.post('/api/Rubrics', newRubricData);
            }

            toast.success(`Đã tạo thành công ${shuffleCount} mã đề thi!`, { id: toastId });
            setShuffleModalOpen(false);
            fetchRubrics(); // Load lại bảng
        } catch (error) {
            console.error(error);
            toast.error("Lỗi khi tạo mã đề!", { id: toastId });
        } finally {
            setIsSaving(false);
        }
    }

    // === XỬ LÝ TRÍCH XUẤT ĐỀ THI TỪ MỌI LOẠI FILE (WORD, PDF, TXT, ẢNH) ===
    const handleScanExam = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        try {
            setIsScanning(true);
            const toastId = toast.loading("🤖 AI đang đọc và bóc tách dữ liệu từ file...");

            const formData = new FormData();
            // Đổi tên key thành 'Files' (hoặc giữ nguyên tùy Backend của bạn)
            formData.append('file', files[0]);
            formData.append('ImageFiles', files[0]);

            // Gọi API quét Đề (Lúc này API C# đã được nâng cấp để nhận mọi file)
            const response = await axios.post('/api/Ocr/extract-exam', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data && Array.isArray(response.data.questions)) {
                const newQuestions = response.data.questions.map((q: any, idx: number) => ({
                    order: idx + 1,
                    questionType: q.questionType === 'MultipleChoice' ? 'MultipleChoice' : 'Essay',
                    content: q.content || '',
                    options: q.options || '|||',
                    correctAnswer: '',
                    explanation: '',
                    maxScore: q.maxScore || 1.0
                }));

                setNewRubric({ ...newRubric, title: response.data.title || newRubric.title, questions: newQuestions });
                toast.success(`Phân tích thành công ${newQuestions.length} câu hỏi!`, { id: toastId });
            }
        } catch (error) {
            toast.error("File quá phức tạp hoặc AI không thể đọc được định dạng này!");
        } finally {
            setIsScanning(false);
            e.target.value = '';
        }
    }

    // === XỬ LÝ TRÍCH XUẤT ĐÁP ÁN TỪ MỌI LOẠI FILE ===
    const handleScanAnswerKey = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        if (newRubric.questions.length <= 1 && !newRubric.questions[0].content) {
            return toast.warning("Vui lòng nạp câu hỏi trước khi nạp đáp án!");
        }

        try {
            setIsScanning(true);
            const toastId = toast.loading("🤖 AI đang phân tích và khớp nối đáp án...");

            const formData = new FormData();
            Array.from(files).forEach(file => formData.append('ImageFiles', file));

            const response = await axios.post('/api/Ocr/extract-answer-key', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

            if (response.data && Array.isArray(response.data.answers)) {
                const currentQuestions = [...newRubric.questions];

                response.data.answers.forEach((ans: any) => {
                    const qIndex = currentQuestions.findIndex(q => q.order === ans.order);
                    if (qIndex !== -1) {
                        currentQuestions[qIndex].correctAnswer = ans.correctAnswer || currentQuestions[qIndex].correctAnswer;
                        currentQuestions[qIndex].explanation = ans.explanation || currentQuestions[qIndex].explanation;
                    }
                });

                setNewRubric({ ...newRubric, questions: currentQuestions });
                toast.success(`Đã đắp xong đáp án vào khung đề thi!`, { id: toastId });
            }
        } catch (error) {
            toast.error("Lỗi khi đọc file đáp án!");
        } finally {
            setIsScanning(false);
            e.target.value = '';
        }
    }

    const handleExportRubric = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(newRubric.questions, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `barem_${newRubric.title || 'de_thi'}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        toast.success("Đã xuất file Barem!");
    };

    const handleImportRubric = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const fileExt = file.name.split('.').pop()?.toLowerCase();

        // Trường hợp 1: Nếu là file JSON -> Xử lý mượt mà ngay trên trình duyệt
        if (fileExt === 'json') {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const parsedQuestions = JSON.parse(event.target?.result as string);
                    if (Array.isArray(parsedQuestions)) {
                        setNewRubric({ ...newRubric, questions: parsedQuestions });
                        toast.success("Đã nạp Barem từ file JSON thành công!");
                    } else {
                        toast.error("Cấu trúc file JSON không hợp lệ!");
                    }
                } catch (err) {
                    toast.error("Lỗi khi đọc file JSON!");
                }
            };
            reader.readAsText(file);
            e.target.value = '';
            return;
        }

        // Trường hợp 2: File Excel, Word, PDF, Hình ảnh -> Nhờ AI Backend xử lý
        try {
            setIsScanning(true);
            const toastId = toast.loading("🤖 AI đang đọc và phân tích cấu trúc Barem...");

            const formData = new FormData();
            formData.append('file', file);
            formData.append('ImageFiles', file); // Gửi kèm đề phòng AI cần xử lý hình ảnh

            // Chuyển hướng file sang API AI để bóc tách
            const response = await axios.post('/api/Ocr/extract-exam', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data && Array.isArray(response.data.questions)) {
                const newQuestions = response.data.questions.map((q: any, idx: number) => ({
                    order: idx + 1,
                    questionType: q.questionType === 'MultipleChoice' ? 'MultipleChoice' : 'Essay',
                    content: q.content || '',
                    options: q.options || '|||',
                    correctAnswer: q.correctAnswer || (q.questionType === 'MultipleChoice' ? 'A' : ''),
                    explanation: q.explanation || '',
                    maxScore: q.maxScore || 1.0
                }));

                setNewRubric({ ...newRubric, title: response.data.title || newRubric.title, questions: newQuestions });
                toast.success(`Nhập Barem thành công với ${newQuestions.length} câu!`, { id: toastId });
            }
        } catch (error) {
            toast.error("File quá phức tạp hoặc AI không nhận diện được định dạng này!");
        } finally {
            setIsScanning(false);
            e.target.value = '';
        }
    };

    // === XỬ LÝ SỬA ĐỔI FORM CÂU HỎI ===
    const addQuestionField = () => {
        const newIndex = newRubric.questions.length;
        setNewRubric({
            ...newRubric,
            questions: [...newRubric.questions, { order: newIndex + 1, questionType: 'MultipleChoice', content: '', options: '|||', correctAnswer: 'A', explanation: '', maxScore: 1.0 }] // Set điểm mặc định 1.0 cho gọn
        });
        setActiveQuestionIndex(newIndex); // Tự động focus vào câu mới tạo
    }

    const removeQuestionField = (index: number) => {
        if (newRubric.questions.length <= 1) return toast.warning("Đề thi phải có ít nhất 1 câu hỏi!");

        const updated = newRubric.questions.filter((_, i) => i !== index);
        setNewRubric({ ...newRubric, questions: updated.map((q, i) => ({ ...q, order: i + 1 })) });

        // Điều chỉnh lại vị trí index để không bị văng lỗi màn hình trắng
        if (activeQuestionIndex >= updated.length) {
            setActiveQuestionIndex(Math.max(0, updated.length - 1));
        } else if (activeQuestionIndex === index) {
            setActiveQuestionIndex(Math.max(0, activeQuestionIndex - 1));
        }
    }
    const updateQuestion = (index: number, field: keyof Question, value: string | number) => {
        const updated = [...newRubric.questions]
        updated[index] = { ...updated[index], [field]: value }

        if (field === 'questionType' && value === 'MultipleChoice') {
            updated[index].correctAnswer = 'A'
        }
        setNewRubric({ ...newRubric, questions: updated })
    }

    const updateMcqOption = (qIndex: number, optIndex: number, value: string) => {
        const updated = [...newRubric.questions]
        const opts = updated[qIndex].options.split('|')
        opts[optIndex] = value
        updated[qIndex].options = opts.join('|')
        setNewRubric({ ...newRubric, questions: updated })
    }

    // === XỬ LÝ LƯU, XÓA & IN ẤN ===
    const handleSaveRubric = async () => {
        if (!newRubric.title.trim()) return toast.warning("Vui lòng nhập Tên bộ đề thi!")
        const isAnyQuestionEmpty = newRubric.questions.some(q => !q.correctAnswer.trim())
        if (isAnyQuestionEmpty) return toast.warning("Vui lòng nhập Đáp án chuẩn cho tất cả câu hỏi!")

        try {
            setIsSaving(true)

            const payloadToSave = { ...newRubric };
            if (!payloadToSave.startDate) payloadToSave.startDate = null;
            if (!payloadToSave.endDate) payloadToSave.endDate = null;

            if (editingId) {
                await axios.put(`/api/Rubrics/${editingId}`, payloadToSave)
                toast.success("Cập nhật bộ đề thi thành công!")
            } else {
                await axios.post('/api/Rubrics', payloadToSave)
                toast.success("Đã tạo bộ đề thi mới!")
            }
            setIsModalOpen(false)
            fetchRubrics()
        } catch {
            toast.error("Lỗi khi lưu dữ liệu!")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteRubric = async (id: string) => {
        try {
            await axios.delete(`/api/Rubrics/${id}`)
            toast.success("Đã xóa bộ đề thi!")
            fetchRubrics()
        } catch {
            toast.error("Không thể xóa đề thi này!")
        }
    }

    const handlePrintExam = (rubric: Rubric) => {
        const printWindow = window.open('', '_blank')
        if (!printWindow) return

        const html = `
            <html>
                <head>
                    <title>In đề thi - ${rubric.title}</title>
                    <style>
                        body { font-family: "Times New Roman", serif; padding: 40px; line-height: 1.6; font-size: 16px; }
                        .header { text-align: center; font-weight: bold; margin-bottom: 30px; }
                        .info-row { display: flex; justify-content: space-between; margin-bottom: 20px; font-weight: bold; }
                        .question { margin-bottom: 25px; }
                        .question-title { font-weight: bold; margin-bottom: 5px;}
                        .mcq-options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
                        .writing-line { width: 100%; height: 35px; border-bottom: 1px dotted #999; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div style="font-size: 22px;">ĐỀ KIỂM TRA ${rubric.examType.toUpperCase()}</div>
                        <div style="font-size: 16px; margin-top: 5px;">Mã đề: ${rubric.id?.substring(18) || '000'} - ${rubric.title}</div>
                    </div>
                    <div class="info-row">
                        <span>Họ và tên: ...........................................................</span>
                        <span>Lớp: .....................</span>
                    </div>
                    <hr style="margin-bottom: 20px;" />
                    <div class="content">
                        ${rubric.questions.map(q => {
            let contentHtml = `<div class="question"><div class="question-title">Câu ${q.order} (${q.maxScore} điểm):</div><div>${q.content}</div>`

            if (q.questionType === 'MultipleChoice') {
                const opts = (q.options || '|||').split('|')
                contentHtml += `
                                    <div class="mcq-options">
                                        <div>A. ${opts[0]}</div> <div>B. ${opts[1]}</div>
                                        <div>C. ${opts[2]}</div> <div>D. ${opts[3]}</div>
                                    </div>
                                </div>`
            } else {
                contentHtml += `<div class="writing-line"></div><div class="writing-line"></div></div>`
            }
            return contentHtml
        }).join('')}
                    </div>
                    <div style="margin-top: 50px; text-align: right; font-style: italic;">--- Hết ---</div>
                </body>
            </html>
        `
        printWindow.document.write(html)
        printWindow.document.close()
        setTimeout(() => printWindow.print(), 200)
    }

    const handlePrintBubbleSheet = (rubric: Rubric) => {
        const hasMCQ = rubric.questions.some(q => q.questionType === 'MultipleChoice');
        if (!hasMCQ) {
            toast.warning("Đề thi này không có câu hỏi trắc nghiệm nào!");
            return;
        }
        setPrintingRubric(rubric);
        setTimeout(() => {
            window.print();
        }, 200);
    }

    const handleOmrTest = async (e: React.ChangeEvent<HTMLInputElement>, rubricId: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const studentCode = prompt("Nhập mã học sinh giả định để test (VD: HS001):", "HS001");
        if (!studentCode) {
            e.target.value = '';
            return;
        }

        const formData = new FormData();
        formData.append('ImageFile', file);
        formData.append('TestId', rubricId);
        formData.append('StudentCode', studentCode);

        const toastId = toast.loading("📸 Mắt thần OpenCV đang quét ảnh...");
        try {
            const res = await axios.post('/api/Grading/omr-grade', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.dismiss(toastId);
            setOmrResult(res.data);
            setIsResultModalOpen(true);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error("Lỗi OMR:", error);
            toast.error(error.response?.data?.error || "OpenCV báo lỗi khi quét ảnh hoặc Server bị lỗi", { id: toastId });
        } finally {
            e.target.value = '';
        }
    }


    const removeAccents = (str: string) => {
        if (!str) return ""
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    }

    const filteredRubrics = useMemo(() => {
        let result = filterType === "Tất cả" ? rubrics : rubrics.filter(r => r.examType === filterType);
        if (searchTerm.trim()) {
            const searchLower = removeAccents(searchTerm);
            result = result.filter(r => removeAccents(r.title).includes(searchLower));
        }
        return result.reverse(); // Sắp xếp mới nhất lên đầu
    }, [rubrics, filterType, searchTerm]);

    // Đẩy trang về 1 nếu thay đổi bộ lọc hoặc từ khóa tìm kiếm
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterType]);

    // Các biến cần cho giao diện phân trang
    const totalPages = Math.ceil(filteredRubrics.length / itemsPerPage);
    const currentRubricsData = filteredRubrics.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-700 print:hidden p-2 md:p-4 relative min-h-screen">

                {/* 🔥 GLOBAL BACKGROUND DECORATION (Hiệu ứng kính mờ & ánh sáng nền) */}
                <div className="fixed inset-0 -z-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50 via-slate-50 to-purple-50/50 pointer-events-none"></div>
                <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] bg-indigo-300/20 rounded-full blur-[120px] -z-10 pointer-events-none animate-pulse"></div>
                <div className="fixed bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-400/20 rounded-full blur-[120px] -z-10 pointer-events-none animate-pulse delay-1000"></div>

                {/* 🔥 HEADER CARD - GLASSMORPHISM */}
                <div className="bg-white/70 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-100 to-blue-50 rounded-full blur-3xl -z-10 opacity-70 translate-x-1/3 -translate-y-1/3"></div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 flex items-center tracking-tight">
                            <ClipboardCheck className="w-8 h-8 mr-3 text-indigo-600" /> Quản Lý Barem & Đề Thi
                        </h2>
                        <p className="text-base text-slate-500 mt-2 font-medium">Soạn thảo đề thi, tạo barem điểm và thiết lập phòng thi trực tuyến</p>
                    </div>
                    <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-300 rounded-full px-8 py-6 h-auto text-base font-bold border-none" onClick={openAddModal}>
                        <Plus className="w-5 h-5 mr-2" /> Tạo Đề Thi Mới
                    </Button>
                </div>

                {/* 🔥 BỘ LỌC VÀ TÌM KIẾM - GLASSMORPHISM */}
                <div className="bg-white/70 backdrop-blur-xl p-4 rounded-[2rem] border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col lg:flex-row items-start lg:items-center gap-4">
                    <div className="relative w-full lg:w-[450px]">
                        <Search className="absolute left-5 top-3.5 h-5 w-5 text-slate-400" />
                        <Input
                            placeholder="Tìm kiếm theo tên đề thi..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="pl-14 h-12 bg-white/50 border-white/60 focus-visible:ring-indigo-500 focus-visible:bg-white rounded-full transition-all text-base shadow-sm backdrop-blur-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 scrollbar-hide">
                        <span className="text-sm font-bold text-slate-400 mr-2 whitespace-nowrap uppercase tracking-wider ml-2 hidden sm:block">Phân loại:</span>
                        {["Tất cả", "Thường xuyên", "15p", "45p", "Thi"].map(t => (
                            <button
                                key={t}
                                onClick={() => {
                                    setSelectedType(t);
                                    setCurrentPage(1);
                                }}
                                className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 whitespace-nowrap shadow-sm backdrop-blur-sm ${filterType === t ? 'bg-indigo-600 text-white border border-indigo-700 shadow-md transform scale-105' : 'bg-white/50 text-slate-600 border border-white/60 hover:bg-white hover:text-indigo-600'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                {/* BẢNG DỮ LIỆU - GLASSMORPHISM */}
                <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 overflow-hidden flex flex-col">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-100/50 backdrop-blur-md">
                                <TableRow className="border-b border-slate-200/60 whitespace-nowrap">
                                    <TableHead className="font-bold text-slate-700 pl-8 py-5">Tên Đề / Barem</TableHead>
                                    <TableHead className="font-bold text-slate-700 py-5">Loại Đề</TableHead>
                                    <TableHead className="text-center font-bold text-slate-700 py-5">Số Câu</TableHead>
                                    <TableHead className="text-center font-black text-slate-800 py-5 bg-slate-200/30">Tổng Điểm</TableHead>
                                    <TableHead className="text-right font-bold text-slate-700 pr-8 py-5 min-w-[350px]">Hành Động</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={5} className="h-48 text-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" /></TableCell></TableRow>
                                ) : currentRubricsData.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="h-48 text-center text-slate-500 font-medium text-base">Không tìm thấy đề thi nào.</TableCell></TableRow>
                                ) : currentRubricsData.map(r => (
                                    <TableRow key={r.id} className="hover:bg-white/80 transition-all duration-200 border-b border-slate-100/60 last:border-0">
                                        <TableCell className="font-bold text-slate-800 text-base pl-8 max-w-[250px] truncate" title={r.title}>{r.title}</TableCell>
                                        <TableCell>
                                            <span className="px-3 py-1.5 bg-slate-100/80 text-slate-700 font-bold rounded-lg text-xs border border-slate-200/60 shadow-sm">{r.examType}</span>
                                        </TableCell>
                                        <TableCell className="text-center font-bold text-slate-600 text-base">{r.questions.length}</TableCell>
                                        <TableCell className="text-center font-black text-indigo-600 text-xl bg-slate-100/30 backdrop-blur-sm">{r.totalScore} đ</TableCell>
                                        <TableCell className="text-right pr-6">
                                            <div className="flex items-center justify-end flex-wrap gap-2">
                                                <Button variant="ghost" size="icon" className="text-blue-600 hover:bg-blue-100 rounded-full w-10 h-10 transition-colors shadow-sm bg-white/50 border border-white" title="Chỉnh sửa" onClick={() => openEditModal(r)}>
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button variant="outline" size="sm" className="rounded-full text-orange-600 border-orange-200 bg-orange-50/80 hover:bg-orange-100 hover:text-orange-700 font-bold shadow-sm backdrop-blur-sm" onClick={() => { setSelectedRubricToShuffle(r); setShuffleCount(1); setShuffleModalOpen(true); }}>
                                                    <Shuffle className="w-4 h-4 mr-1.5" /> Tạo Mã Đề
                                                </Button>
                                                <Button variant="outline" size="sm" className="rounded-full text-indigo-600 border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 hover:text-indigo-700 font-bold shadow-sm backdrop-blur-sm" onClick={() => handlePrintExam(r)}>
                                                    <Printer className="w-4 h-4 mr-1.5" /> In Đề
                                                </Button>
                                                <Button variant="outline" size="sm" className="rounded-full text-emerald-600 border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100 hover:text-emerald-700 font-bold shadow-sm backdrop-blur-sm" onClick={() => handlePrintBubbleSheet(r)}>
                                                    <ScanText className="w-4 h-4 mr-1.5" /> In Phiếu Tô
                                                </Button>
                                                <input type="file" accept="image/*" id={`omr-test-${r.id}`} className="hidden" onChange={(e) => handleOmrTest(e, r.id!)} />
                                                <Button variant="outline" size="sm" className="rounded-full text-fuchsia-600 border-fuchsia-200 bg-fuchsia-50/80 hover:bg-fuchsia-100 hover:text-fuchsia-700 font-bold shadow-sm backdrop-blur-sm" onClick={() => document.getElementById(`omr-test-${r.id}`)?.click()}>
                                                    <Camera className="w-4 h-4 mr-1.5" /> Chấm Thử
                                                </Button>
                                                <Button variant="outline" size="sm" className="rounded-full text-sky-600 border-sky-200 bg-sky-50/80 hover:bg-sky-100 hover:text-sky-700 font-bold shadow-sm backdrop-blur-sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/thi-truc-tuyen/${r.id}`); toast.success("Đã copy link phòng thi!"); }}>
                                                    <Globe className="w-4 h-4 mr-1.5" /> Copy Link
                                                </Button>
                                                <Button variant="outline" size="sm" className="rounded-full text-teal-600 border-teal-200 bg-teal-50/80 hover:bg-teal-100 hover:text-teal-700 font-bold shadow-sm backdrop-blur-sm" onClick={() => window.open(`/thi-truc-tuyen/${r.id}`, '_blank')}>
                                                    <LayoutList className="w-4 h-4 mr-1.5" /> Thi Thử
                                                </Button>

                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-100 rounded-full w-10 h-10 transition-colors ml-1 shadow-sm bg-white/50 border border-white" title="Xóa">
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="bg-white/95 backdrop-blur-xl border-white rounded-[2rem] shadow-2xl">
                                                        <AlertDialogHeader><AlertDialogTitle className="text-red-600 text-xl font-bold">Xóa đề thi này?</AlertDialogTitle></AlertDialogHeader>
                                                        <AlertDialogFooter className="mt-4">
                                                            <AlertDialogCancel className="rounded-full font-bold px-6 border-slate-300">Hủy</AlertDialogCancel>
                                                            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700 rounded-full font-bold px-8 shadow-md border-none" onClick={() => handleDeleteRubric(r.id!)}>Xác nhận xóa</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {filteredRubrics.length > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between px-8 py-5 bg-slate-50/30 border-t border-slate-200/60 gap-4 backdrop-blur-md">
                            <div className="text-sm text-slate-500 font-medium text-center sm:text-left">
                                Hiển thị <span className="font-bold text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</span> đến <span className="font-bold text-slate-800">{Math.min(currentPage * itemsPerPage, filteredRubrics.length)}</span> trong tổng số <span className="font-bold text-indigo-600">{filteredRubrics.length}</span> kết quả
                            </div>
                            <div className="flex items-center space-x-2 bg-white/60 border border-white p-1.5 rounded-full shadow-sm backdrop-blur-sm">
                                <Button variant="ghost" size="sm" className="rounded-full hover:bg-white" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="w-5 h-5" /></Button>
                                <div className="text-sm font-bold text-slate-700 px-4">Trang {currentPage} / {totalPages || 1}</div>
                                <Button variant="ghost" size="sm" className="rounded-full hover:bg-white" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}><ChevronRight className="w-5 h-5" /></Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* MODAL TẠO MÃ ĐỀ NGẪU NHIÊN */}
                <Dialog open={shuffleModalOpen} onOpenChange={setShuffleModalOpen}>
                    <DialogContent className="bg-white/95 backdrop-blur-xl max-w-md rounded-[2rem] border border-white/60 shadow-2xl overflow-hidden p-0">
                        <div className="bg-orange-50/80 p-6 border-b border-orange-100">
                            {/* HEADER SIÊU GỌN */}
                            <DialogHeader className="p-4 bg-white/95 border-b border-slate-200 sticky top-0 z-50 backdrop-blur-md">
                                <DialogTitle className="text-xl font-bold text-slate-800 flex items-center">
                                    {editingId ? <Edit className="w-5 h-5 mr-2 text-blue-600" /> : <Plus className="w-5 h-5 mr-2 text-indigo-600" />}
                                    {editingId ? 'Chỉnh Sửa Đề Thi' : 'Tạo Đề Thi Mới'}
                                </DialogTitle>
                            </DialogHeader>
                        </div>
                        <div className="p-6">
                            <div className="bg-slate-50/80 text-slate-700 p-5 rounded-2xl border border-slate-100 text-sm mb-6 font-medium leading-relaxed shadow-inner">
                                Hệ thống sẽ lấy đề thi gốc <span className="font-bold bg-white px-2 py-0.5 rounded border border-slate-200 mx-1 shadow-sm text-indigo-700">{selectedRubricToShuffle?.title}</span>, tự động xáo trộn vị trí các câu hỏi và sinh ra các mã đề ngẫu nhiên (ví dụ: Mã đề 104, 205).
                            </div>
                            <Label className="font-bold text-slate-700 text-base ml-1">Số lượng mã đề cần tạo:</Label>
                            <Input type="number" min="1" max="10" className="mt-3 font-black text-3xl text-indigo-700 h-16 text-center rounded-2xl bg-white/50 backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-indigo-500 border-2 border-slate-200 shadow-sm" value={shuffleCount} onChange={(e) => setShuffleCount(parseInt(e.target.value) || 1)} />
                        </div>
                        <DialogFooter className="p-6 pt-0 flex gap-3">
                            <Button variant="outline" className="rounded-full font-bold px-8 border-slate-300 bg-white/50" onClick={() => setShuffleModalOpen(false)}>Hủy</Button>
                            <Button className="bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white rounded-full font-bold px-8 shadow-md border-none" onClick={handleGenerateCodes} disabled={isSaving}>
                                {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Shuffle className="w-5 h-5 mr-2" />} Bắt Đầu Xáo Trộn
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* 🔥 GIAO DIỆN MỚI: MODAL TẠO/SỬA ĐỀ THI SIÊU XỊN - GLASSMORPHISM */}
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent className="!max-w-[95vw] lg:!max-w-6xl max-h-[90vh] overflow-y-auto bg-slate-50/95 backdrop-blur-xl p-0 border border-white/60 shadow-2xl rounded-[2rem]">
                        <div className="h-3 bg-gradient-to-r from-indigo-500 via-blue-500 to-sky-500 w-full sticky top-0 z-50"></div>

                        <DialogHeader className="p-6 md:p-8 pb-4 bg-white/80 border-b border-slate-200/60 sticky top-3 z-40 backdrop-blur-md">
                            <DialogTitle className="text-3xl font-black text-slate-800 tracking-tight flex items-center">
                                {editingId ? <Edit className="w-7 h-7 mr-3 text-blue-600" /> : <Plus className="w-8 h-8 mr-3 text-indigo-600 bg-indigo-50 rounded-full p-1 border border-indigo-100" />}
                                {editingId ? 'Chỉnh Sửa Đề Thi' : 'Tạo Bộ Barem & Đề Thi Mới'}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="p-4 md:p-8 space-y-6">
                            {/* THÔNG TIN CHUNG */}
                            <div className="bg-white/80 backdrop-blur-sm p-6 md:p-8 rounded-[2rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="space-y-3 md:col-span-3">
                                    <Label className="font-bold text-slate-700 text-base ml-1">Tên Đề Kiểm Tra <span className="text-red-500">*</span></Label>
                                    <Input placeholder="VD: Kiểm tra Toán Giải Tích Chương 1" value={newRubric.title} onChange={e => setNewRubric({ ...newRubric, title: e.target.value })} className="bg-white/50 border-white h-14 rounded-2xl focus-visible:ring-indigo-500 font-bold text-lg px-5 shadow-inner" />
                                </div>
                                <div className="space-y-3">
                                    <Label className="font-bold text-slate-700 text-base ml-1">Loại Đề <span className="text-red-500">*</span></Label>
                                    <select className="w-full h-14 border border-white rounded-2xl px-4 bg-white/50 font-bold text-indigo-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all shadow-inner" value={newRubric.examType} onChange={e => setNewRubric({ ...newRubric, examType: e.target.value })}>
                                        <option value="Thường xuyên">Thường xuyên</option><option value="15p">15 Phút</option><option value="45p">45 Phút</option><option value="Thi">Thi Học Kỳ</option>
                                    </select>
                                </div>
                            </div>

                            {/* KHU VỰC CẤU HÌNH LUẬT CHƠI */}
                            <div className="bg-indigo-50/60 backdrop-blur-md p-6 md:p-8 rounded-[2rem] border border-indigo-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-200 rounded-full blur-3xl -z-10 opacity-40 translate-x-1/2 -translate-y-1/2"></div>
                                <div className="col-span-1 md:col-span-3 pb-3 border-b border-indigo-200/60 flex items-center text-indigo-900 font-black text-xl">
                                    <Settings2 className="w-6 h-6 mr-3 text-indigo-600" /> Cấu hình thi trực tuyến (Tùy chọn)
                                </div>
                                <div className="space-y-3">
                                    <Label className="font-bold text-indigo-900 ml-1">Mở Đề (Từ giờ/ngày)</Label>
                                    <Input type="datetime-local" value={newRubric.startDate || ''} onChange={e => setNewRubric({ ...newRubric, startDate: e.target.value })} className="bg-white/80 border-white shadow-sm h-12 rounded-xl text-slate-700 font-medium px-4 backdrop-blur-sm" />
                                </div>
                                <div className="space-y-3">
                                    <Label className="font-bold text-indigo-900 ml-1">Đóng Đề (Đến giờ/ngày)</Label>
                                    <Input type="datetime-local" value={newRubric.endDate || ''} onChange={e => setNewRubric({ ...newRubric, endDate: e.target.value })} className="bg-white/80 border-white shadow-sm h-12 rounded-xl text-slate-700 font-medium px-4 backdrop-blur-sm" />
                                </div>
                                <div className="space-y-3">
                                    <Label className="font-bold text-indigo-900 ml-1">Giới hạn số lượt nộp bài</Label>
                                    <Input type="number" min="1" placeholder="Để trống = Không giới hạn" value={newRubric.maxAttempts || ''} onChange={e => setNewRubric({ ...newRubric, maxAttempts: e.target.value ? parseInt(e.target.value) : null })} className="bg-white/80 border-white shadow-sm h-12 rounded-xl text-slate-700 font-medium px-4 backdrop-blur-sm" />
                                </div>
                            </div>

                            {/* DANH SÁCH CÂU HỎI */}
                            <div className="space-y-6 mt-8">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white/80 backdrop-blur-md p-5 rounded-[2rem] border border-white shadow-sm sticky top-[88px] z-30">
                                    <h3 className="font-black flex items-center text-slate-800 text-xl ml-2">
                                        <LayoutList className="w-6 h-6 mr-3 text-indigo-500" /> Danh sách câu hỏi ({newRubric.questions.length})
                                    </h3>
                                    {/* THANH CÔNG CỤ SIÊU GỌN - Ép lên sát Header */}
                                    <div className="flex flex-wrap justify-between items-center gap-2 bg-slate-50/90 backdrop-blur-md p-2 px-4 rounded-lg border border-slate-200 shadow-sm sticky top-[60px] z-40 mx-4 md:mx-8">
                                        <h3 className="font-bold flex items-center text-slate-800 text-sm whitespace-nowrap">
                                            <LayoutList className="w-4 h-4 mr-2 text-indigo-500" /> Cấu Trúc Đề ({newRubric.questions.length})
                                        </h3>

                                        <div className="flex flex-wrap items-center justify-end gap-2">
                                            <div className="flex bg-purple-50 p-1 rounded-md border border-purple-100">
                                                {/* Đã thêm .xls, .xlsx và image/* vào accept */}
                                                <input type="file" id="scan-exam" accept=".json, .txt, .pdf, .doc, .docx, .xls, .xlsx, image/*" className="hidden" onChange={handleScanExam} disabled={isScanning} />
                                                <Button variant="ghost" size="sm" className="h-7 text-xs rounded text-purple-700 hover:bg-white font-bold" onClick={() => document.getElementById('scan-exam')?.click()} disabled={isScanning}>
                                                    {isScanning ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <ScanText className="w-3 h-3 mr-1" />} Đọc Đề AI
                                                </Button>

                                                {/* Đã thêm .xls, .xlsx và image/* vào accept */}
                                                <input type="file" id="scan-answer" accept=".json, .txt, .pdf, .doc, .docx, .xls, .xlsx, image/*" className="hidden" onChange={handleScanAnswerKey} disabled={isScanning} />
                                                <Button variant="ghost" size="sm" className="h-7 text-xs rounded text-fuchsia-700 hover:bg-white font-bold" onClick={() => document.getElementById('scan-answer')?.click()} disabled={isScanning}>
                                                    {isScanning ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />} Đọc Đáp Án
                                                </Button>
                                            </div>

                                            <div className="flex bg-teal-50 p-1 rounded-md border border-teal-100">
                                                {/* Nút Nhập Barem giờ đã nhận mọi thể loại file */}
                                                <input type="file" id="import-rubric" accept=".json, .txt, .pdf, .doc, .docx, .xls, .xlsx, image/*" className="hidden" onChange={handleImportRubric} />
                                                <Button variant="ghost" size="sm" className="h-7 text-xs rounded text-teal-700 hover:bg-white font-bold" onClick={() => document.getElementById('import-rubric')?.click()}>
                                                    <Upload className="w-3 h-3 mr-1" /> Nhập Barem
                                                </Button>

                                                <Button variant="ghost" size="sm" className="h-7 text-xs rounded text-teal-700 hover:bg-white font-bold" onClick={handleExportRubric}>
                                                    <Download className="w-3 h-3 mr-1" /> Xuất File
                                                </Button>
                                            </div>

                                            <Button size="sm" className="h-8 text-xs rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm border-none" onClick={addQuestionField}>
                                                <Plus className="w-3 h-3 mr-1" /> Thêm Dòng
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* GIAO DIỆN SOẠN THẢO THẾ HỆ MỚI: SIDEBAR & MAIN CONTENT */}
                                <div className="flex flex-col lg:flex-row gap-5 mt-6 min-h-[500px]">

                                    {/* CỘT TRÁI: Bảng điều hướng câu hỏi (Sidebar) */}
                                    <div className="w-full lg:w-1/4 bg-slate-50/80 backdrop-blur-sm border border-slate-200 rounded-[1.5rem] p-4 flex flex-col shadow-inner">
                                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
                                            <span className="font-black text-slate-700 text-sm">CHỌN CÂU HỎI</span>
                                            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-bold">{newRubric.questions.length}</span>
                                        </div>

                                        {/* Lưới Nút Bấm Câu Hỏi */}
                                        <div className="flex-1 overflow-y-auto pr-1 max-h-[350px] lg:max-h-[500px] scrollbar-thin scrollbar-thumb-slate-300">
                                            <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-4 gap-2">
                                                {newRubric.questions.map((q, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => setActiveQuestionIndex(idx)}
                                                        className={`h-11 rounded-xl text-sm font-black transition-all flex items-center justify-center border-2 ${activeQuestionIndex === idx
                                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105'
                                                                : 'bg-white text-slate-500 border-slate-100 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 shadow-sm'
                                                            }`}
                                                        title={`Câu ${q.order} - ${q.maxScore}đ`}
                                                    >
                                                        {q.order}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* CỘT PHẢI: Khu vực làm việc siêu rộng (Chỉ hiển thị câu đang chọn) */}
                                    <div className="w-full lg:w-3/4 flex flex-col">
                                        {newRubric.questions[activeQuestionIndex] && (() => {
                                            const idx = activeQuestionIndex;
                                            const q = newRubric.questions[idx];
                                            const opts = (q.options || '|||').split('|');

                                            return (
                                                <div className="bg-white p-6 rounded-[1.5rem] border border-slate-200 shadow-sm flex-1 flex flex-col animate-in fade-in zoom-in-95 duration-200">

                                                    {/* THANH CÔNG CỤ CỦA CÂU HỎI */}
                                                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-5">
                                                        <div className="flex flex-wrap items-center gap-3">
                                                            <div className="bg-indigo-600 text-white font-black px-4 py-1.5 rounded-lg text-lg shadow-sm">
                                                                Câu {q.order}
                                                            </div>

                                                            <select className="h-10 border border-slate-200 rounded-lg px-3 bg-slate-50 font-bold text-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer" value={q.questionType} onChange={e => updateQuestion(idx, 'questionType', e.target.value)}>
                                                                <option value="Essay">📝 Tự luận (Điền khuyết)</option>
                                                                <option value="MultipleChoice">✅ Trắc nghiệm</option>
                                                            </select>

                                                            <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
                                                                <Label className="font-bold text-amber-900 text-sm">Điểm:</Label>
                                                                <Input type="number" step="0.25" min="0" className="w-16 h-7 text-center font-black text-base text-indigo-700 bg-white border-none shadow-sm rounded px-1" value={q.maxScore} onChange={e => updateQuestion(idx, 'maxScore', parseFloat(e.target.value) || 0)} />
                                                            </div>

                                                            {q.questionType === 'MultipleChoice' && (
                                                                <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                                                                    <Label className="font-black text-emerald-700 text-sm uppercase">Đáp án:</Label>
                                                                    <select className="h-7 w-14 border-none bg-white text-emerald-700 font-black text-base rounded text-center outline-none cursor-pointer shadow-sm focus:ring-2 focus:ring-emerald-400" value={q.correctAnswer} onChange={e => updateQuestion(idx, 'correctAnswer', e.target.value)}>
                                                                        <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                                                                    </select>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg w-10 h-10 transition-colors" onClick={() => removeQuestionField(idx)} title="Xóa câu hỏi này">
                                                            <Trash2 className="w-5 h-5" />
                                                        </Button>
                                                    </div>

                                                    {/* KHUNG SOẠN THẢO RỘNG LỚN */}
                                                    <div className="flex-1 flex flex-col space-y-5">
                                                        <div className="space-y-2 flex-1 flex flex-col">
                                                            <Label className="font-bold text-slate-700 text-sm">Nội dung đề bài</Label>
                                                            <textarea className="flex-1 w-full border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white rounded-xl p-4 focus:ring-2 focus:ring-indigo-500 outline-none resize-y font-medium text-slate-800 text-base shadow-inner min-h-[120px] transition-colors" placeholder="Nhập nội dung đoạn văn, câu hỏi..." value={q.content} onChange={e => updateQuestion(idx, 'content', e.target.value)} />
                                                            {q.content.includes('$') && (
                                                                <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg text-sm"><MathFormatter text={q.content} /></div>
                                                            )}
                                                        </div>

                                                        {q.questionType === 'MultipleChoice' ? (
                                                            <div>
                                                                <Label className="font-bold text-slate-700 text-sm mb-2 block">Các phương án</Label>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    {[0, 1, 2, 3].map((optIdx) => (
                                                                        <div key={optIdx} className="flex gap-3 items-start bg-slate-50 p-2 rounded-xl border border-slate-200 focus-within:border-indigo-400 focus-within:bg-white focus-within:shadow-md transition-all">
                                                                            <span className="font-black text-lg text-indigo-300 mt-1.5 w-6 text-center">{['A', 'B', 'C', 'D'][optIdx]}.</span>
                                                                            <div className="w-full flex-1">
                                                                                <textarea rows={2} className="w-full bg-transparent border-none focus:ring-0 font-medium text-base p-1 resize-none outline-none" value={opts[optIdx] || ''} onChange={e => updateMcqOption(idx, optIdx, e.target.value)} placeholder={`Nội dung đáp án ${['A', 'B', 'C', 'D'][optIdx]}`} />
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <Label className="font-bold text-slate-700 text-sm mb-2 block">Đáp án chuẩn (Keywords)</Label>
                                                                <textarea rows={2} className="w-full border border-indigo-100 bg-indigo-50/40 rounded-xl p-4 focus:ring-2 focus:ring-indigo-500 outline-none resize-y font-medium text-indigo-900 text-base min-h-[80px]" placeholder="Nhập từ khóa AI cần tìm..." value={q.correctAnswer} onChange={e => updateQuestion(idx, 'correctAnswer', e.target.value)} />
                                                            </div>
                                                        )}

                                                        <div>
                                                            <Input className="h-10 w-full border-dashed border-slate-300 bg-slate-50 hover:bg-white rounded-lg px-4 focus:ring-2 focus:ring-slate-300 text-sm font-medium text-slate-600 transition-colors" placeholder="Ghi chú thêm luật chấm cho AI (Tùy chọn)..." value={q.explanation || ''} onChange={e => updateQuestion(idx, 'explanation', e.target.value)} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* FOOTER SIÊU GỌN - Đẩy sát mép dưới */}
                        <DialogFooter className="p-3 px-6 bg-white/95 backdrop-blur-md border-t border-slate-200 sticky bottom-0 z-50">
                            <div className="flex w-full justify-between items-center gap-4">
                                <div className="font-bold text-slate-600 text-sm flex items-center">
                                    Tổng điểm: <span className="text-2xl font-black text-indigo-600 ml-2">{newRubric.questions.reduce((sum, q) => sum + q.maxScore, 0)}</span> <span className="ml-1 text-xs">đ</span>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="h-9 px-4 text-sm font-bold rounded-md" onClick={() => setIsModalOpen(false)}>Hủy</Button>
                                    <Button size="sm" className="h-9 px-6 text-sm font-bold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSaveRubric} disabled={isSaving}>
                                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ClipboardCheck className="w-4 h-4 mr-2" />} Lưu
                                    </Button>
                                </div>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* MODAL KẾT QUẢ OMR - GLASSMORPHISM */}
            <Dialog open={isResultModalOpen} onOpenChange={setIsResultModalOpen}>
                <DialogContent className="max-w-3xl bg-slate-50/95 backdrop-blur-xl p-6 max-h-[85vh] overflow-y-auto rounded-[2rem] border border-white/60 shadow-2xl">
                    <DialogHeader className="hidden"><DialogTitle>Kết quả</DialogTitle></DialogHeader>
                    {omrResult && (
                        <div className="bg-white/80 backdrop-blur-sm border border-white rounded-[2rem] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                            <div className="flex justify-between items-center p-6 border-b border-slate-200/60 bg-emerald-50/40">
                                <div className="font-bold text-emerald-600 flex items-center text-xl"><CheckCircle2 className="w-7 h-7 mr-2" /> Kết Quả Quét Phiếu</div>
                                <div className="text-4xl font-black text-indigo-700">{omrResult.totalScore} <span className="text-xl text-indigo-400 font-bold">đ</span></div>
                            </div>
                            <div className="p-6 md:p-8">
                                <p className="text-slate-600 italic font-medium mb-6 bg-white/60 p-4 rounded-xl border border-slate-200/60 text-base leading-relaxed shadow-sm">"{omrResult.overallFeedback}"</p>
                                <div className="space-y-3">
                                    {omrResult.details?.map((detail: any, idx: number) => (
                                        <div key={idx} className={`flex items-start text-sm p-4 rounded-xl border shadow-sm ${detail.awardedScore > 0 ? 'bg-emerald-50/40 border-emerald-100' : 'bg-red-50/40 border-red-100'}`}>
                                            <ChevronRight className={`w-5 h-5 mr-3 shrink-0 ${detail.awardedScore > 0 ? 'text-emerald-500' : 'text-red-400'}`} />
                                            <div>
                                                <span className="font-bold text-slate-800 text-base">Câu {detail.questionNumber} ({detail.awardedScore}đ): </span>
                                                <span className={`text-base ${detail.awardedScore > 0 ? "text-emerald-700 font-bold" : "text-red-600 font-medium"}`}>
                                                    {detail.awardedScore > 0 ? "Chính xác." : `Sai. ${detail.aiFeedback}`}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {printingRubric && <div className="hidden print:block print:w-full"><BubbleSheet questions={printingRubric.questions} /></div>}
        </>
    )
}