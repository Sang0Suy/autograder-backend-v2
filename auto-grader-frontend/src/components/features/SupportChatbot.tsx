import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// import axios from 'axios';

interface ChatMessage {
    id: string;
    role: 'user' | 'bot';
    content: string;
}

export default function SupportChatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: '1', role: 'bot', content: 'Chào bạn! Mình là Trợ lý AI của AutoGrader. Mình có thể giúp gì cho bạn trong việc tạo đề, chấm thi hay quản lý lớp học?' }
    ]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Tự động cuộn xuống tin nhắn mới nhất
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const handleSendMessage = async () => {
        if (!inputText.trim()) return;

        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: inputText };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setIsTyping(true);

        try {
            // TODO: Gọi API Backend C# (Semantic Kernel + Gemini API)
            // const response = await axios.post('/api/Chatbot/ask', { message: userMsg.content });
            // const botReply = response.data.reply;

            // Giả lập delay phản hồi của AI
            await new Promise(resolve => setTimeout(resolve, 1500));
            const botReply = "Đây là phản hồi mẫu từ hệ thống. Khi Backend C# hoàn thiện, dữ liệu từ Gemini sẽ được trả về tại đây!";

            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', content: botReply }]);
        } catch {
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', content: 'Xin lỗi, hệ thống AI đang bận. Vui lòng thử lại sau.' }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
            {/* CỬA SỔ CHAT */}
            {isOpen && (
                <div className="mb-4 w-[350px] sm:w-[400px] h-[500px] bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-slate-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">

                    {/* Header Chat */}
                    <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-4 flex justify-between items-center text-white shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/30">
                                <Bot className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="font-black text-lg leading-tight">AutoGrader AI</h3>
                                <p className="text-indigo-100 text-xs font-medium flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Đang trực tuyến
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-indigo-100 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Khu vực nội dung Chat */}
                    <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'bot' && (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-blue-50 flex items-center justify-center shrink-0 border border-indigo-100">
                                        <Bot className="w-4 h-4 text-indigo-600" />
                                    </div>
                                )}
                                <div className={`px-4 py-2.5 rounded-2xl max-w-[80%] text-sm font-medium leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white text-slate-700 border border-slate-200 shadow-sm rounded-tl-sm'}`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}

                        {isTyping && (
                            <div className="flex gap-2 justify-start">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                    <Bot className="w-4 h-4 text-slate-400" />
                                </div>
                                <div className="px-4 py-3 rounded-2xl bg-white border border-slate-200 shadow-sm rounded-tl-sm flex items-center gap-1.5">
                                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75"></span>
                                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150"></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Ô nhập liệu (Input) */}
                    <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                        <div className="relative flex items-center">
                            <Input
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="Hỏi AI về cách sử dụng hệ thống..."
                                className="pr-12 h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 font-medium"
                                disabled={isTyping}
                            />
                            <Button
                                onClick={handleSendMessage}
                                disabled={isTyping || !inputText.trim()}
                                size="icon"
                                className="absolute right-1 w-10 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* NÚT BONG BÓNG MỞ CHAT */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="w-14 h-14 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-full shadow-[0_8px_30px_rgba(79,70,229,0.4)] flex items-center justify-center text-white hover:scale-110 transition-transform duration-300"
                >
                    <MessageCircle className="w-7 h-7" />
                </button>
            )}
        </div>
    );
}