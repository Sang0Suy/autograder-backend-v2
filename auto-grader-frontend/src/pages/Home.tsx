import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, ShieldCheck, Zap, Star, Users, Eye, PlayCircle } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Home() {
    const navigate = useNavigate();
    const [visitCount, setVisitCount] = useState(12458);
    const [feedbacks, setFeedbacks] = useState([
        // Dữ liệu dự phòng trong lúc chờ API
        { customerName: "Cô Nguyễn Thu Hà", role: "Giáo viên Ngữ Văn", content: "Hệ thống cực kỳ tuyệt vời!", rating: 5 }
    ]);

    // 🔥 GỌI API LẤY DATA THẬT TỪ C# MONGODB KHI VỪA VÀO TRANG
    useEffect(() => {
        // 1. Kích hoạt đếm lượt truy cập
        axios.get('/api/Stats/visit')
            .then(res => {
                if (res.data && res.data.totalVisits) {
                    setVisitCount(res.data.totalVisits);
                }
            })
            .catch(err => console.error("Lỗi lấy lượt truy cập:", err));

        // 2. Lấy Feedback thật
        axios.get('/api/Feedbacks/approved')
            .then(res => {
                if (res.data && res.data.length > 0) {
                    setFeedbacks(res.data);
                }
            })
            .catch(err => console.error("Lỗi lấy feedback:", err));
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 selection:bg-indigo-100 selection:text-indigo-900 font-sans overflow-hidden">
            {/* Background Blobs (Tinh tế, không quá lố) */}
            <div className="fixed top-[-10%] left-[-5%] w-[500px] h-[500px] bg-indigo-200/40 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="fixed bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-emerald-200/30 rounded-full blur-[120px] pointer-events-none"></div>

            {/* NAVBAR */}
            <nav className="fixed w-full top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                        <div className="bg-indigo-600 text-white p-2 rounded-xl"><Sparkles className="w-6 h-6" /></div>
                        <span className="text-2xl font-black text-slate-800 tracking-tight">Auto<span className="text-indigo-600">Grader</span></span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="hidden md:flex items-center text-sm font-bold text-slate-500 bg-slate-100 px-4 py-2 rounded-full">
                            <Eye className="w-4 h-4 mr-2 text-indigo-500" /> {visitCount.toLocaleString('vi-VN')} lượt truy cập
                        </span>
                        <Button onClick={() => navigate('/login')} className="bg-slate-900 hover:bg-indigo-600 text-white rounded-full font-bold px-8 h-11 transition-all shadow-md hover:shadow-xl">
                            Đăng Nhập
                        </Button>
                    </div>
                </div>
            </nav>

            {/* HERO SECTION */}
            <main className="pt-32 pb-16 px-6 relative z-10">
                <div className="max-w-5xl mx-auto text-center space-y-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-sm mb-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                        Phiên bản 2.0 đã sẵn sàng
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight leading-[1.1] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                        Giải phóng thời gian với <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-emerald-500">Trợ giảng AI Thông minh</span>
                    </h1>
                    <p className="text-xl text-slate-500 font-medium max-w-3xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                        Hệ thống tự động đọc đề, xáo trộn mã đề, chấm điểm trắc nghiệm lẫn tự luận và đưa ra lộ trình học tập cá nhân hóa cho từng học sinh chỉ trong vài giây.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                        <Button onClick={() => navigate('/login')} className="w-full sm:w-auto h-14 px-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg shadow-lg hover:shadow-indigo-500/30 transition-all hover:-translate-y-1">
                            Bắt đầu dùng thử miễn phí <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                        <Button variant="outline" className="w-full sm:w-auto h-14 px-8 rounded-full bg-white border-slate-200 text-slate-700 font-bold text-lg hover:bg-slate-50 shadow-sm transition-all">
                            <PlayCircle className="w-5 h-5 mr-2 text-indigo-600" /> Xem Video Demo
                        </Button>
                    </div>
                </div>

                {/* FEATURES GRID */}
                <div className="max-w-7xl mx-auto mt-32 grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { icon: Zap, title: "Chấm Điểm Siêu Tốc", desc: "Công nghệ OMR kết hợp AI Vision đọc hiểu cả chữ viết tay, chấm hàng trăm bài tự luận trong nháy mắt.", color: "text-amber-500", bg: "bg-amber-50" },
                        { icon: ShieldCheck, title: "Chống Đạo Văn", desc: "Thuật toán phát hiện sự bất thường và sao chép. Tự động cắm cờ đỏ các bài thi có độ tin cậy thấp.", color: "text-emerald-500", bg: "bg-emerald-50" },
                        { icon: Users, title: "Lộ Trình Cá Nhân Hóa", desc: "Không chỉ là điểm số. AI phân tích điểm mạnh, điểm yếu và khuyên học sinh nên học gì tiếp theo.", color: "text-blue-500", bg: "bg-blue-50" }
                    ].map((feature, idx) => (
                        <div key={idx} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-2 transition-transform duration-300">
                            <div className={`w-14 h-14 rounded-2xl ${feature.bg} flex items-center justify-center mb-6`}>
                                <feature.icon className={`w-7 h-7 ${feature.color}`} />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 mb-3">{feature.title}</h3>
                            <p className="text-slate-500 font-medium leading-relaxed">{feature.desc}</p>
                        </div>
                    ))}
                </div>

                {/* FEEDBACK SECTION */}
                <div className="max-w-7xl mx-auto mt-32">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-black text-slate-900 mb-4">Được tin dùng bởi các Trường học</h2>
                        <p className="text-lg text-slate-500 font-medium">Hàng ngàn giáo viên đã chuyển sang sử dụng AutoGrader để tối ưu hóa thời gian.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {feedbacks.map((fb, idx) => (
                            <div key={idx} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex gap-1 mb-6">
                                        {[...Array(5)].map((_, i) => (
                                            <Star key={i} className={`w-5 h-5 ${i < fb.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                                        ))}
                                    </div>
                                    <p className="text-slate-700 font-medium leading-relaxed italic mb-8">"{fb.content}"</p>
                                </div>
                                <div className="flex items-center gap-4 border-t border-slate-100 pt-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-emerald-100 rounded-full flex items-center justify-center font-black text-indigo-700">
                                        {fb.customerName ? fb.customerName.charAt(0) : 'A'}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900">{fb.customerName}</h4>
                                        <p className="text-sm text-slate-500 font-medium">{fb.role}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {/* FOOTER */}
            <footer className="bg-slate-900 text-slate-400 py-12 text-center mt-20">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex items-center justify-center gap-2 mb-6 opacity-50">
                        <Sparkles className="w-5 h-5 text-white" />
                        <span className="text-xl font-black text-white tracking-tight">AutoGrader</span>
                    </div>
                    <p className="font-medium mb-2">Hệ thống Đánh giá & Phân tích Học tập Ứng dụng Trí tuệ Nhân tạo.</p>
                    <p className="text-sm opacity-60">© 2026 AutoGrader System. Đã đăng ký bản quyền.</p>
                </div>
            </footer>
        </div>
    );
}