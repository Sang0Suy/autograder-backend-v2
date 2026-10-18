import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MessageSquareQuote, Star, Loader2, Send } from "lucide-react";
import { toast } from 'sonner';
import axios from 'axios';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    userData: {
        username: string;
        fullName?: string;
        role: string;
    };
}

export default function FeedbackModal({ isOpen, onClose, userData }: FeedbackModalProps) {
    const [rating, setRating] = useState(5);
    const [hoveredRating, setHoveredRating] = useState(0);
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (content.trim().length < 10) {
            return toast.warning("Vui lòng nhập cảm nhận ít nhất 10 ký tự nhé!");
        }

        setIsSubmitting(true);
        try {
            await axios.post('/api/Feedbacks', {
                CustomerName: userData.fullName || userData.username,
                Role: userData.role === 'Student' ? 'Học sinh' : 'Giáo viên',
                Content: content.trim(),
                Rating: rating
            });

            toast.success("Cảm ơn bạn đã đánh giá hệ thống! Đánh giá sẽ được hiển thị sau khi duyệt.");
            setContent('');
            setRating(5);
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Có lỗi xảy ra khi gửi đánh giá.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] bg-white/95 backdrop-blur-xl rounded-[2rem] p-0 border-white shadow-2xl overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-amber-400 to-orange-500 w-full absolute top-0 left-0"></div>
                <DialogHeader className="p-6 pb-4 bg-slate-50/50 border-b border-slate-100">
                    <DialogTitle className="text-2xl font-black text-slate-800 flex items-center">
                        <MessageSquareQuote className="w-7 h-7 mr-3 text-amber-500" /> Đánh giá hệ thống
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6 space-y-6">
                    <div className="flex flex-col items-center justify-center space-y-2">
                        <Label className="font-bold text-slate-600 mb-2">Trải nghiệm của bạn thế nào?</Label>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                    key={star}
                                    className={`w-10 h-10 cursor-pointer transition-all hover:scale-110 ${star <= (hoveredRating || rating)
                                            ? 'fill-amber-400 text-amber-400'
                                            : 'text-slate-200'
                                        }`}
                                    onMouseEnter={() => setHoveredRating(star)}
                                    onMouseLeave={() => setHoveredRating(0)}
                                    onClick={() => setRating(star)}
                                />
                            ))}
                        </div>
                        <span className="text-sm font-bold text-amber-600 mt-2">
                            {rating === 5 ? 'Tuyệt vời!' : rating >= 4 ? 'Rất tốt' : rating === 3 ? 'Bình thường' : 'Cần cải thiện'}
                        </span>
                    </div>

                    <div className="space-y-2">
                        <Label className="font-bold text-slate-700 ml-1">Nhận xét của bạn</Label>
                        <textarea
                            rows={4}
                            placeholder="Chia sẻ cảm nhận của bạn về AutoGrader để chúng tôi cải thiện tốt hơn..."
                            className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-amber-500 rounded-xl p-4 font-medium text-slate-700 shadow-inner resize-none outline-none transition-colors"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter className="p-5 bg-slate-50/80 border-t border-slate-100 flex justify-end gap-2">
                    <Button variant="ghost" onClick={onClose} className="rounded-full font-bold hover:bg-slate-200 h-11 px-6 text-slate-500">
                        Để sau
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="bg-amber-500 hover:bg-amber-600 text-white rounded-full font-bold px-8 shadow-md border-none h-11 transition-all transform hover:scale-105"
                    >
                        {isSubmitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Send className="w-5 h-5 mr-2" />}
                        Gửi Đánh Giá
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}