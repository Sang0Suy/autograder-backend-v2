import { useState, useEffect } from 'react';
import { Database, Plus, Wand2, Search, BookOpen, Layers, CheckCircle2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from 'sonner';
//import axios from 'axios';

// Định nghĩa kiểu dữ liệu
interface Question {
    id: string;
    content: string;
    questionType: string;
    subject: string;
    topic: string;
    difficultyLevel: string;
    defaultScore: number;
}

export default function QuestionBankManager() {
    const [activeView, setActiveView] = useState<'bank' | 'generate'>('bank');
    const [questions, setQuestions] = useState<Question[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // State cho Modal Thêm câu hỏi mới
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newQuestion, setNewQuestion] = useState({
        content: '', questionType: 'MultipleChoice', subject: 'Toán', topic: '', difficultyLevel: 'Trung Bình', defaultScore: 1.0, options: '', correctAnswer: ''
    });

    // State cho Form Sinh Đề
    const [genConfig, setGenConfig] = useState({
        title: 'Đề Thi Tự Động', subject: 'Toán', easyCount: 5, mediumCount: 3, hardCount: 2, numberOfVersions: 1
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const fetchQuestions = async () => {
        //setIsLoading(true);
        try {
            // Giả lập Dữ liệu (Mock Data) để bạn test UI trước. Sau khi API C# hoàn thiện, thay bằng: axios.get('/api/QuestionBank/all')
            const mockData: Question[] = [
                { id: '1', content: 'Tính đạo hàm của hàm số y = x^2', questionType: 'MultipleChoice', subject: 'Toán', topic: 'Đạo hàm', difficultyLevel: 'Dễ', defaultScore: 1 },
                { id: '2', content: 'Giải phương trình bậc hai: x^2 - 4x + 4 = 0', questionType: 'Essay', subject: 'Toán', topic: 'Đại số', difficultyLevel: 'Trung Bình', defaultScore: 2 },
                { id: '3', content: 'Sự kiện Vịnh Bắc Bộ xảy ra năm nào?', questionType: 'MultipleChoice', subject: 'Lịch Sử', topic: 'Lịch sử thế giới', difficultyLevel: 'Dễ', defaultScore: 1 },
            ];
            setQuestions(mockData);
        } catch{
            toast.error("Lỗi khi tải ngân hàng câu hỏi.");
        } finally {
            //setIsLoading(false);
        }
    };
    // Lấy dữ liệu khi Component load
    useEffect(() => {
        // eslint-disable-next-line
        fetchQuestions();
    }, []);

    // Hàm xử lý Thêm Câu hỏi
    const handleAddQuestion = async () => {
        if (!newQuestion.content.trim() || !newQuestion.topic.trim()) {
            toast.error("Vui lòng nhập đủ nội dung và chủ đề câu hỏi!");
            return;
        }

        try {
            const payload = {
                ...newQuestion,
                options: newQuestion.questionType === 'MultipleChoice' ? newQuestion.options.split('|').map(o => o.trim()) : []
            };
            console.log(payload);
            // Gọi API C# (Khi Backend đã sẵn sàng)
            // await axios.post('/api/QuestionBank/add', payload);

            toast.success("Đã thêm câu hỏi vào ngân hàng!");
            setIsAddModalOpen(false);
            fetchQuestions(); // Cập nhật lại danh sách
        } catch {
            toast.error("Lỗi khi thêm câu hỏi!");
        }
    };

    // Hàm xử lý Sinh Đề Thi tự động
    const handleGenerateTest = async () => {
        setIsGenerating(true);
        const toastId = toast.loading("🤖 AI đang tự động trộn đề...");

        try {
            // Gọi API C# (Khi Backend đã sẵn sàng)
            // const res = await axios.post('/api/QuestionBank/generate-test', genConfig);

            // Giả lập Delay 2 giây
            await new Promise(resolve => setTimeout(resolve, 2000));

            toast.success(`Tạo thành công ${genConfig.numberOfVersions} mã đề! Hãy sang tab "Quản Lý Barem" để xem chi tiết.`, { id: toastId });
        } catch {
            toast.error("Kho dữ liệu không đủ câu hỏi để đáp ứng cấu trúc này!", { id: toastId });
        } finally {
            setIsGenerating(false);
        }
    };

    const filteredQuestions = questions.filter(q => q.content.toLowerCase().includes(searchTerm.toLowerCase()) || q.topic.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500">

            {/* 1. KHU VỰC ĐIỀU HƯỚNG TỔNG QUAN */}
            <div className="bg-white/80 backdrop-blur-2xl p-6 md:p-8 rounded-[2rem] shadow-[0_10px_40px_rgb(0,0,0,0.06)] border border-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 flex items-center tracking-tight">
                        <Database className="w-8 h-8 mr-3 text-indigo-600" /> Ngân Hàng Câu Hỏi Trí Tuệ
                    </h2>
                    <p className="text-base text-slate-500 mt-2 font-medium">Lưu trữ tập trung và tự động trộn đề thi theo cấu trúc</p>
                </div>

                <div className="flex bg-slate-100/80 p-1.5 rounded-full shadow-inner border border-slate-200">
                    <button
                        onClick={() => setActiveView('bank')}
                        className={`flex items-center px-6 py-2.5 rounded-full font-bold text-sm transition-all ${activeView === 'bank' ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Layers className="w-4 h-4 mr-2" /> Kho Dữ Liệu
                    </button>
                    <button
                        onClick={() => setActiveView('generate')}
                        className={`flex items-center px-6 py-2.5 rounded-full font-bold text-sm transition-all ${activeView === 'generate' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Wand2 className="w-4 h-4 mr-2" /> Trộn Đề Tự Động
                    </button>
                </div>
            </div>

            {/* 2. CHẾ ĐỘ HIỂN THỊ KHO DỮ LIỆU */}
            {activeView === 'bank' && (
                <div className="bg-white/90 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-4 top-3 h-5 w-5 text-slate-400" />
                            <Input
                                placeholder="Tìm kiếm nội dung hoặc chủ đề..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-12 h-12 bg-slate-50 border-slate-200 rounded-full"
                            />
                        </div>
                        <Button
                            onClick={() => setIsAddModalOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full h-12 px-6 font-bold shadow-md"
                        >
                            <Plus className="w-5 h-5 mr-2" /> Thêm Câu Hỏi Mới
                        </Button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="py-4 px-4 font-bold text-slate-600">ID</th>
                                    <th className="py-4 px-4 font-bold text-slate-600">Chủ đề</th>
                                    <th className="py-4 px-4 font-bold text-slate-600 min-w-[300px]">Nội dung</th>
                                    <th className="py-4 px-4 font-bold text-slate-600">Loại</th>
                                    <th className="py-4 px-4 font-bold text-slate-600 text-center">Mức độ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredQuestions.map((q, idx) => (
                                    <tr key={q.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                        <td className="py-4 px-4 font-medium text-slate-500">#{idx + 1}</td>
                                        <td className="py-4 px-4">
                                            <span className="font-bold text-xs px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100 uppercase">{q.subject}</span>
                                            <div className="text-sm font-medium text-slate-600 mt-1">{q.topic}</div>
                                        </td>
                                        <td className="py-4 px-4 font-medium text-slate-800">{q.content}</td>
                                        <td className="py-4 px-4 text-sm font-bold text-slate-500">{q.questionType === 'MultipleChoice' ? 'Trắc Nghiệm' : 'Tự Luận'}</td>
                                        <td className="py-4 px-4 text-center">
                                            <span className={`text-xs font-bold px-3 py-1 rounded-full ${q.difficultyLevel === 'Dễ' ? 'bg-emerald-100 text-emerald-700' : q.difficultyLevel === 'Trung Bình' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                                {q.difficultyLevel}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 3. CHẾ ĐỘ FORM TRỘN ĐỀ TỰ ĐỘNG */}
            {activeView === 'generate' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4">
                    {/* Panel Cấu hình */}
                    <div className="bg-white/95 backdrop-blur-xl p-8 rounded-[2rem] shadow-sm border border-slate-100">
                        <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center">
                            <BookOpen className="w-6 h-6 mr-3 text-emerald-600" /> Cấu hình Sinh Đề
                        </h3>

                        <div className="space-y-5">
                            <div>
                                <label className="text-sm font-bold text-slate-700 mb-1 block">Tên Đề Thi</label>
                                <Input value={genConfig.title} onChange={e => setGenConfig({ ...genConfig, title: e.target.value })} className="h-12 bg-slate-50 border-slate-200 rounded-xl font-medium" />
                            </div>

                            <div>
                                <label className="text-sm font-bold text-slate-700 mb-1 block">Môn Học (Dùng để lọc)</label>
                                <Input value={genConfig.subject} onChange={e => setGenConfig({ ...genConfig, subject: e.target.value })} className="h-12 bg-slate-50 border-slate-200 rounded-xl font-medium" />
                            </div>

                            <div className="grid grid-cols-3 gap-4 pt-2">
                                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                                    <label className="text-xs font-bold text-emerald-700 uppercase tracking-wider block text-center mb-2">Số câu Dễ</label>
                                    <Input type="number" min="0" value={genConfig.easyCount} onChange={e => setGenConfig({ ...genConfig, easyCount: parseInt(e.target.value) || 0 })} className="text-center font-black text-lg bg-white border-none h-12 rounded-xl shadow-sm" />
                                </div>
                                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                                    <label className="text-xs font-bold text-amber-700 uppercase tracking-wider block text-center mb-2">Trung Bình</label>
                                    <Input type="number" min="0" value={genConfig.mediumCount} onChange={e => setGenConfig({ ...genConfig, mediumCount: parseInt(e.target.value) || 0 })} className="text-center font-black text-lg bg-white border-none h-12 rounded-xl shadow-sm" />
                                </div>
                                <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                                    <label className="text-xs font-bold text-red-700 uppercase tracking-wider block text-center mb-2">Số câu Khó</label>
                                    <Input type="number" min="0" value={genConfig.hardCount} onChange={e => setGenConfig({ ...genConfig, hardCount: parseInt(e.target.value) || 0 })} className="text-center font-black text-lg bg-white border-none h-12 rounded-xl shadow-sm" />
                                </div>
                            </div>

                            <div className="pt-2">
                                <label className="text-sm font-bold text-slate-700 mb-1 block">Số lượng Mã Đề cần sinh (Trộn hoán vị)</label>
                                <Input type="number" min="1" max="10" value={genConfig.numberOfVersions} onChange={e => setGenConfig({ ...genConfig, numberOfVersions: parseInt(e.target.value) || 1 })} className="h-12 bg-slate-50 border-slate-200 rounded-xl font-medium w-full" />
                            </div>

                            <Button
                                disabled={isGenerating}
                                onClick={handleGenerateTest}
                                className="w-full h-14 mt-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-2xl font-black text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
                            >
                                {isGenerating ? "HỆ THỐNG ĐANG XỬ LÝ..." : "BẮT ĐẦU TRỘN ĐỀ THI TỰ ĐỘNG"}
                            </Button>
                        </div>
                    </div>

                    {/* Panel Thống kê tóm tắt */}
                    <div className="bg-slate-900 p-8 rounded-[2rem] shadow-xl text-white flex flex-col justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                        <h3 className="text-2xl font-black mb-2 relative z-10 text-emerald-400">Dự kiến sinh ra</h3>
                        <div className="text-7xl font-black relative z-10 mb-4 tracking-tighter">
                            {genConfig.easyCount + genConfig.mediumCount + genConfig.hardCount} <span className="text-2xl text-slate-400 font-medium tracking-normal">Câu hỏi / Đề</span>
                        </div>

                        <ul className="space-y-3 relative z-10 text-slate-300 font-medium">
                            <li className="flex items-center"><CheckCircle2 className="w-5 h-5 mr-3 text-emerald-500" /> Tự động trộn thứ tự câu hỏi</li>
                            <li className="flex items-center"><CheckCircle2 className="w-5 h-5 mr-3 text-emerald-500" /> Tự động trộn vị trí đáp án (A,B,C,D)</li>
                            <li className="flex items-center"><CheckCircle2 className="w-5 h-5 mr-3 text-emerald-500" /> Sinh sẵn Barem chấm điểm cho AI</li>
                        </ul>
                    </div>
                </div>
            )}

            {/* MODAL THÊM CÂU HỎI */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent className="sm:max-w-[600px] bg-white rounded-[2rem] p-0 border-white shadow-2xl overflow-hidden">
                    <DialogHeader className="p-6 bg-slate-50 border-b border-slate-100">
                        <DialogTitle className="text-2xl font-black text-slate-800 flex items-center">
                            <Plus className="w-6 h-6 mr-3 text-indigo-600" /> Thêm Câu Hỏi Vào Kho
                        </DialogTitle>
                    </DialogHeader>

                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-bold text-slate-700 mb-1 block">Môn Học</label>
                                <Input value={newQuestion.subject} onChange={e => setNewQuestion({ ...newQuestion, subject: e.target.value })} className="h-12 bg-slate-50 rounded-xl" />
                            </div>
                            <div>
                                <label className="text-sm font-bold text-slate-700 mb-1 block">Chủ Đề (VD: Tích phân)</label>
                                <Input value={newQuestion.topic} onChange={e => setNewQuestion({ ...newQuestion, topic: e.target.value })} className="h-12 bg-slate-50 rounded-xl" />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-bold text-slate-700 mb-1 block">Nội dung câu hỏi</label>
                            <textarea
                                value={newQuestion.content} onChange={e => setNewQuestion({ ...newQuestion, content: e.target.value })}
                                className="w-full min-h-[100px] p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none font-medium"
                                placeholder="Gõ câu hỏi vào đây..."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-bold text-slate-700 mb-1 block">Loại Câu Hỏi</label>
                                <select
                                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 font-medium"
                                    value={newQuestion.questionType} onChange={e => setNewQuestion({ ...newQuestion, questionType: e.target.value })}
                                >
                                    <option value="MultipleChoice">Trắc Nghiệm (A,B,C,D)</option>
                                    <option value="Essay">Tự Luận</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-bold text-slate-700 mb-1 block">Mức Độ</label>
                                <select
                                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 font-medium"
                                    value={newQuestion.difficultyLevel} onChange={e => setNewQuestion({ ...newQuestion, difficultyLevel: e.target.value })}
                                >
                                    <option value="Dễ">Dễ</option>
                                    <option value="Trung Bình">Trung Bình</option>
                                    <option value="Khó">Khó</option>
                                </select>
                            </div>
                        </div>

                        {newQuestion.questionType === 'MultipleChoice' && (
                            <div className="space-y-4 pt-2 border-t border-slate-100">
                                <div>
                                    <label className="text-sm font-bold text-slate-700 mb-1 block">Các đáp án (Ngăn cách bởi dấu |)</label>
                                    <Input value={newQuestion.options} onChange={e => setNewQuestion({ ...newQuestion, options: e.target.value })} placeholder="VD: 5 | 10 | 15 | 20" className="h-12 bg-slate-50 rounded-xl" />
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-emerald-700 mb-1 block">Đáp án Đúng</label>
                                    <Input value={newQuestion.correctAnswer} onChange={e => setNewQuestion({ ...newQuestion, correctAnswer: e.target.value })} placeholder="VD: A hoặc Nội dung câu trả lời" className="h-12 bg-emerald-50 border-emerald-200 rounded-xl font-bold text-emerald-700" />
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setIsAddModalOpen(false)} className="rounded-full font-bold px-6">Hủy</Button>
                        <Button onClick={handleAddQuestion} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold px-8 shadow-md">
                            Lưu Câu Hỏi
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}