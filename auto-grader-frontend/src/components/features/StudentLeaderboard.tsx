import { useState } from 'react';
import { Trophy, Medal, Crown, Star, Flame, ChevronUp, Swords } from 'lucide-react';

// Định nghĩa kiểu dữ liệu khớp với C# Backend
interface StudentProfile {
    id: string;
    studentCode: string;
    fullName: string;
    totalXP: number;
    level: number;
    currentRank: string;
    highestScoreCount: number;
}

export default function StudentLeaderboard() {
    // Dữ liệu mẫu (Mock data) - Trong thực tế bạn sẽ fetch từ API axios.get('/api/Profiles')
    const [profiles] = useState<StudentProfile[]>([
        { id: '1', studentCode: 'HS001', fullName: 'Nguyễn Văn Anh', totalXP: 3250, level: 7, currentRank: 'Thách Đấu 💎', highestScoreCount: 15 },
        { id: '2', studentCode: 'HS002', fullName: 'Trần Thị Bé', totalXP: 1800, level: 4, currentRank: 'Kim Cương 💠', highestScoreCount: 8 },
        { id: '3', studentCode: 'HS003', fullName: 'Lê Hoàng Cường', totalXP: 1200, level: 3, currentRank: 'Bạch Kim 👑', highestScoreCount: 5 },
        { id: '4', studentCode: 'HS004', fullName: 'Phạm Văn Dũng', totalXP: 850, level: 2, currentRank: 'Vàng ⭐', highestScoreCount: 2 },
        { id: '5', studentCode: 'HS005', fullName: 'Vũ Thị Em', totalXP: 450, level: 1, currentRank: 'Bạc 🥈', highestScoreCount: 0 },
    ]);

    // Giả sử học sinh đang đăng nhập là HS003
    const currentUserCode = 'HS003';
    const currentUser = profiles.find(p => p.studentCode === currentUserCode);

    // Hàm lấy màu sắc và Icon tùy theo Rank
    const getRankStyle = (rank: string) => {
        if (rank.includes('Thách Đấu')) return { color: 'text-rose-500', bg: 'bg-rose-100', border: 'border-rose-300', icon: <Crown className="w-5 h-5 text-rose-500" /> };
        if (rank.includes('Kim Cương')) return { color: 'text-cyan-500', bg: 'bg-cyan-100', border: 'border-cyan-300', icon: <Star className="w-5 h-5 text-cyan-500" /> };
        if (rank.includes('Bạch Kim')) return { color: 'text-emerald-500', bg: 'bg-emerald-100', border: 'border-emerald-300', icon: <ShieldCheck className="w-5 h-5 text-emerald-500" /> };
        if (rank.includes('Vàng')) return { color: 'text-amber-500', bg: 'bg-amber-100', border: 'border-amber-300', icon: <Medal className="w-5 h-5 text-amber-500" /> };
        return { color: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-300', icon: <Swords className="w-5 h-5 text-slate-500" /> };
    };

    // Tính toán tiến độ XP hiện tại của học sinh
    const xpInCurrentLevel = currentUser ? currentUser.totalXP % 500 : 0;
    const progressPercentage = (xpInCurrentLevel / 500) * 100;

    return (
        <div className="max-w-4xl mx-auto space-y-8 p-4 animate-in fade-in zoom-in-95 duration-500">

            {/* 1. THANH TIẾN ĐỘ & HỒ SƠ CÁ NHÂN (XP BAR) */}
            {currentUser && (
                <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-indigo-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -z-10 opacity-70 translate-x-1/2 -translate-y-1/2"></div>

                    <div className="flex items-center gap-6">
                        {/* Avatar & Cấp độ */}
                        <div className="relative">
                            <div className="w-20 h-20 rounded-full border-4 border-indigo-500 p-1 flex items-center justify-center bg-white shadow-md">
                                <span className="text-3xl">🥷</span>
                            </div>
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-black px-3 py-1 rounded-full border-2 border-white shadow-sm">
                                LV.{currentUser.level}
                            </div>
                        </div>

                        {/* Thanh Tiến Độ */}
                        <div className="flex-1">
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800">{currentUser.fullName}</h2>
                                    <p className={`font-bold mt-1 flex items-center gap-1 ${getRankStyle(currentUser.currentRank).color}`}>
                                        {getRankStyle(currentUser.currentRank).icon} {currentUser.currentRank}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-black text-indigo-600">{currentUser.totalXP}</span>
                                    <span className="text-sm font-bold text-slate-400 ml-1">XP</span>
                                </div>
                            </div>

                            {/* Progress Bar Container */}
                            <div className="w-full bg-slate-100 rounded-full h-4 mb-1 overflow-hidden shadow-inner">
                                <div
                                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-4 rounded-full transition-all duration-1000 ease-out relative"
                                    style={{ width: `${progressPercentage}%` }}
                                >
                                    <div className="absolute top-0 right-0 bottom-0 left-0 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')] opacity-20"></div>
                                </div>
                            </div>
                            <p className="text-xs font-bold text-slate-500 text-right mt-1">Cần thêm {500 - xpInCurrentLevel} XP để lên Cấp {currentUser.level + 1}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. BẢNG XẾP HẠNG (LEADERBOARD) */}
            <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-800 p-6 text-center relative overflow-hidden">
                    <Trophy className="w-24 h-24 absolute -right-4 -top-4 text-slate-700 opacity-30" />
                    <h3 className="text-2xl font-black text-white tracking-wider flex items-center justify-center gap-3">
                        <Flame className="text-orange-500 w-8 h-8 animate-pulse" /> BẢNG PHONG THẦN
                    </h3>
                    <p className="text-slate-400 text-sm font-medium mt-1">Top học sinh có điểm kinh nghiệm cao nhất</p>
                </div>

                <div className="p-4 space-y-3">
                    {profiles.map((student, index) => {
                        const rankStyle = getRankStyle(student.currentRank);
                        const isTop3 = index < 3;

                        return (
                            <div
                                key={student.id}
                                className={`flex items-center gap-4 p-4 rounded-2xl transition-all hover:scale-[1.01] ${isTop3 ? 'bg-gradient-to-r shadow-md border' : 'bg-slate-50 hover:bg-slate-100 border border-slate-100'} 
                                ${index === 0 ? 'from-amber-50 to-amber-100 border-amber-300' :
                                        index === 1 ? 'from-slate-100 to-slate-200 border-slate-300' :
                                            index === 2 ? 'from-orange-50 to-orange-100 border-orange-300' : ''}`}
                            >
                                {/* Cột Thứ hạng */}
                                <div className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center font-black text-xl shadow-sm border-2 bg-white
                                    ${index === 0 ? 'text-amber-500 border-amber-400' :
                                        index === 1 ? 'text-slate-500 border-slate-400' :
                                            index === 2 ? 'text-orange-500 border-orange-400' : 'text-slate-400 border-slate-200'}`}>
                                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                                </div>

                                {/* Cột Thông tin */}
                                <div className="flex-1">
                                    <h4 className="font-black text-slate-800 text-lg flex items-center gap-2">
                                        {student.fullName}
                                        {student.studentCode === currentUserCode && <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Bạn</span>}
                                    </h4>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${rankStyle.bg} ${rankStyle.color} ${rankStyle.border}`}>
                                            LV.{student.level} • {student.currentRank}
                                        </span>
                                        {student.highestScoreCount > 0 && (
                                            <span className="text-xs font-medium text-slate-500 flex items-center">
                                                <ChevronUp className="w-3 h-3 text-emerald-500 mr-0.5" /> {student.highestScoreCount} lần điểm tuyệt đối
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Cột XP */}
                                <div className="text-right">
                                    <div className="font-black text-xl text-slate-800">{student.totalXP}</div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">XP</div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

        </div>
    );
}

// Dummy Icon vì lúc nãy chưa import đủ
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ShieldCheck(props: any) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>;
}