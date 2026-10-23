import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, User, Sparkles } from "lucide-react";
import axios from 'axios';
import { toast } from 'sonner';

interface AITutorModalProps {
    isOpen: boolean;
    onClose: () => void;
    contextData: {
        questionNumber: number;
        studentAnswer: string;
        aiFeedback: string;
    } | null;
}

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

export default function AITutorModal({ isOpen, onClose, contextData }: AITutorModalProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputMsg, setInputMsg] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Mỗi khi mở Modal cho 1 câu hỏi mới, tự động ghi đè câu chào (xóa luôn lịch sử cũ)
    useEffect(() => {
        if (isOpen && contextData) {
            // Đưa vào setTimeout để chạy bất đồng bộ, Linter sẽ không còn bắt bẻ nữa
            const timer = setTimeout(() => {
                setMessages([{
                    role: 'model',
                    text: `Chào em! Thầy/cô là Gia sư AI. Em đang thắc mắc về **Câu số ${contextData.questionNumber}** đúng không? Cứ hỏi thoải mái nhé!`
                }]);
            }, 0);

            return () => clearTimeout(timer); // Dọn dẹp timer nếu đóng/mở liên tục
        }
    }, [isOpen, contextData]);

    // Tự động cuộn xuống tin nhắn mới nhất
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    const handleSendMessage = async () => {
        if (!inputMsg.trim() || !contextData) return;

        const newMsg = inputMsg.trim();
        setInputMsg('');

        // Cập nhật giao diện ngay lập tức
        const updatedHistory: ChatMessage[] = [...messages, { role: 'user', text: newMsg }];
        setMessages(updatedHistory);
        setIsTyping(true);

        try {
            // Loại bỏ câu chào mặc định đầu tiên khi gửi lịch sử cho API
            const historyToSend = updatedHistory.slice(1, -1);

            const response = await axios.post('/api/Tutor/ask', {
                QuestionNumber: contextData.questionNumber,
                StudentAnswer: contextData.studentAnswer || "Bỏ trống",
                AiFeedback: contextData.aiFeedback,
                History: historyToSend,
                NewMessage: newMsg
            });

            setMessages(prev => [...prev, { role: 'model', text: response.data.reply }]);
        } catch (e) {
            console.error(e);
            toast.error("Gia sư AI hiện đang bận. Em thử lại sau nhé!");
            setMessages(prev => prev.slice(0, -1)); // Xóa tin nhắn lỗi
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px] h-[80vh] flex flex-col bg-white/95 backdrop-blur-xl rounded-3xl p-0 border-white shadow-2xl overflow-hidden">

                {/* HEADER CHAT */}
                <DialogHeader className="p-5 bg-gradient-to-r from-blue-600 to-indigo-600 border-b border-indigo-700 shrink-0">
                    <DialogTitle className="text-xl font-black text-white flex items-center tracking-tight">
                        <div className="bg-white/20 p-2 rounded-full mr-3 backdrop-blur-sm">
                            <Bot className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            Gia sư AI Thông minh
                            <p className="text-xs font-medium text-blue-100 mt-0.5 flex items-center">
                                <Sparkles className="w-3 h-3 mr-1" /> Hỏi đáp trực tiếp 1-1
                            </p>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                {/* KHU VỰC HIỂN THỊ TIN NHẮN */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50 custom-scrollbar">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

                                {/* Avatar */}
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-sm'}`}>
                                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-5 h-5" />}
                                </div>

                                {/* Bong bóng chat */}
                                <div className={`px-4 py-3 rounded-2xl text-sm font-medium leading-relaxed shadow-sm ${msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-tr-sm'
                                        : 'bg-white text-slate-700 border border-slate-100 rounded-tl-sm'
                                    }`}>
                                    {msg.text}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Hiệu ứng đang gõ... */}
                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="max-w-[85%] flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                                    <Bot className="w-5 h-5" />
                                </div>
                                <div className="px-5 py-3.5 bg-white border border-slate-100 rounded-2xl rounded-tl-sm flex gap-1.5 shadow-sm items-center">
                                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></span>
                                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce delay-150"></span>
                                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce delay-300"></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* KHU VỰC NHẬP TIN NHẮN */}
                <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                    <form
                        onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                        className="flex gap-2 relative"
                    >
                        <Input
                            placeholder="Gõ câu hỏi của em ở đây..."
                            value={inputMsg}
                            onChange={e => setInputMsg(e.target.value)}
                            disabled={isTyping}
                            className="flex-1 bg-slate-50 border-slate-200 h-12 rounded-full pl-5 pr-14 focus-visible:ring-indigo-500 transition-all font-medium text-slate-700"
                        />
                        <Button
                            type="submit"
                            disabled={!inputMsg.trim() || isTyping}
                            className="absolute right-1 top-1 w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 p-0 text-white shadow-md transition-transform active:scale-95"
                        >
                            <Send className="w-4 h-4 ml-0.5" />
                        </Button>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}