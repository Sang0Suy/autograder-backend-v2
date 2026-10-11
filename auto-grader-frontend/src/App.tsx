import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { LogOut, PlayCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import Login from './pages/Login'
import UploadStation from './components/features/UploadStation'
import RubricManager from './components/features/RubricManager'
import GradingHistory from './components/features/GradingHistory'
import ClassManager from './components/features/ClassManager'
import AccountManager from './components/features/AccountManager'
import OnlineExam from './components/features/OnlineExam'
import StudentDashboard from './components/features/StudentDashboard'
import { Toaster, toast } from 'sonner'

type TabType = 'upload' | 'rubric' | 'history' | 'class' | 'account';

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'))
    const [userRole, setUserRole] = useState(localStorage.getItem('role') || '')

    const [activeTab, setActiveTab] = useState<TabType>(() => {
        return (localStorage.getItem('currentTab') as TabType) || 'upload';
    })

    const switchTab = (tab: TabType) => {
        setActiveTab(tab);
        localStorage.setItem('currentTab', tab);
    }

    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const isOnline = currentPath.startsWith('/thi-truc-tuyen/');
    const routeId = isOnline ? currentPath.split('/thi-truc-tuyen/')[1] : '';

    const [isOnlineExamMode] = useState(isOnline)
    const [examTestId] = useState(routeId)

    // 🔥 STATE CHO MODAL VÀO PHÒNG THI
    const [isExamModalOpen, setIsExamModalOpen] = useState(false);
    const [examCode, setExamCode] = useState('');

    const handleJoinExam = () => {
        if (!examCode.trim()) {
            toast.error("🚪 Cửa phòng thi đang khóa! Bạn phải nhập Mã phòng vào đã chứ! 😆");
            return;
        }
        window.location.href = `/thi-truc-tuyen/${examCode.trim()}`;
    }

    const handleLogout = () => {
        localStorage.removeItem('token')
        localStorage.removeItem('role')
        localStorage.removeItem('ReferenceId')
        localStorage.removeItem('currentTab')
        setIsAuthenticated(false)
        setUserRole('')
        setActiveTab('upload')
    }

    if (!isAuthenticated) {
        return <Login onLoginSuccess={() => {
            setIsAuthenticated(true)
            setUserRole(localStorage.getItem('role') || '')
            setActiveTab('upload')
        }} />
    }

    // NẾU ĐANG Ở ĐƯỜNG DẪN THI TRỰC TUYẾN
    if (isOnlineExamMode) {
        const currentStudentCode = localStorage.getItem('ReferenceId') || "HS_TEST_001";
        return (
            <div className="min-h-screen relative overflow-hidden">
                <div className="fixed inset-0 -z-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50 via-slate-50 to-blue-50/50 pointer-events-none"></div>

                <div className="relative z-10 p-4 md:p-8">
                    <div className="max-w-7xl mx-auto mb-6 flex justify-between items-center bg-white/60 backdrop-blur-md p-4 rounded-3xl border border-white shadow-sm">
                        <div className="font-black text-indigo-900 text-lg tracking-tight px-2">AutoGrader <span className="text-indigo-500">Online Exam</span></div>
                        <Button variant="outline" className="rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-bold px-6 shadow-sm" onClick={() => window.location.href = '/'}>
                            Thoát khỏi phòng thi
                        </Button>
                    </div>
                    <OnlineExam testId={examTestId} studentCode={currentStudentCode} />
                    <Toaster richColors position="top-right" />
                </div>
            </div>
        )
    }

    // GIAO DIỆN CHÍNH (DASHBOARD GLASSMORPHISM)
    return (
        <div className="min-h-screen relative text-slate-900 p-4 md:p-8 print:p-0 print:bg-white">

            <div className="fixed inset-0 -z-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50 via-slate-50 to-blue-50/50 pointer-events-none print:hidden"></div>
            <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] bg-indigo-300/20 rounded-full blur-[120px] -z-10 pointer-events-none animate-pulse print:hidden"></div>
            <div className="fixed bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[120px] -z-10 pointer-events-none animate-pulse delay-1000 print:hidden"></div>

            <div className="max-w-[1400px] mx-auto space-y-6 print:space-y-0 relative z-10">

                {/* 🔥 HEADER ĐÃ ĐƯỢC LÀM STICKY VÀ NỔI BẬT HƠN */}
                <div className="sticky top-2 md:top-4 z-50 flex flex-col xl:flex-row items-center justify-between bg-white/80 backdrop-blur-2xl p-4 md:p-6 rounded-[2rem] shadow-[0_10px_40px_rgb(0,0,0,0.08)] border border-white print:hidden relative overflow-hidden gap-4 md:gap-6 transition-all">
                    <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-indigo-100 to-blue-50 rounded-full blur-3xl -z-10 opacity-70 -translate-x-1/3 -translate-y-1/3"></div>

                    <div className="flex items-center justify-between w-full xl:w-auto">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
                                AutoGrader System <span className="inline-block animate-bounce ml-1">🤖</span>
                            </h1>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 mt-1.5">
                                <p className="text-slate-500 font-medium text-sm whitespace-nowrap">Hệ thống tự động chấm điểm bằng AI</p>
                                <span className="px-3 py-1 bg-indigo-100/80 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200/60 shadow-sm backdrop-blur-sm w-fit">
                                    Quyền: {userRole || 'Chưa xác định'}
                                </span>
                            </div>
                        </div>
                        <Button variant="ghost" onClick={handleLogout} className="xl:hidden text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full w-12 h-12 p-0 flex items-center justify-center">
                            <LogOut className="w-5 h-5" />
                        </Button>
                    </div>

                    <div className="flex flex-wrap items-center justify-center xl:justify-end gap-2.5 w-full xl:w-auto">

                        {/* 🔥 NÚT VÀO PHÒNG THI DÀNH CHO HỌC SINH */}
                        {userRole === 'Student' && (
                            <Button
                                onClick={() => setIsExamModalOpen(true)}
                                className="rounded-full px-6 font-bold shadow-md transition-all duration-300 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-none transform hover:scale-105"
                            >
                                <PlayCircle className="w-5 h-5 mr-2" /> Vào Phòng Thi
                            </Button>
                        )}

                        <Button
                            onClick={() => switchTab('upload')}
                            className={`rounded-full px-6 font-bold shadow-sm transition-all duration-300 ${activeTab === 'upload' ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md transform scale-105 border-none' : 'bg-white/60 text-slate-600 hover:bg-white border-white'}`}
                            variant={activeTab === 'upload' ? 'default' : 'outline'}
                        >
                            Trạm Nộp Bài
                        </Button>

                        <Button
                            onClick={() => switchTab('class')}
                            className={`rounded-full px-6 font-bold shadow-sm transition-all duration-300 ${activeTab === 'class' ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md transform scale-105 border-none' : 'bg-white/60 text-slate-600 hover:bg-white border-white'}`}
                            variant={activeTab === 'class' ? 'default' : 'outline'}
                        >
                            {userRole === 'Student' ? 'Bảng Điểm Của Tôi' : 'Quản Lý Lớp Học'}
                        </Button>

                        {userRole !== 'Student' && (
                            <Button
                                onClick={() => switchTab('rubric')}
                                className={`rounded-full px-6 font-bold shadow-sm transition-all duration-300 ${activeTab === 'rubric' ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md transform scale-105 border-none' : 'bg-white/60 text-slate-600 hover:bg-white border-white'}`}
                                variant={activeTab === 'rubric' ? 'default' : 'outline'}
                            >
                                Quản Lý Barem
                            </Button>
                        )}

                        {/* 🔥 MỞ KHÓA TAB LỊCH SỬ CHO HỌC SINH */}
                        <Button
                            onClick={() => switchTab('history')}
                            className={`rounded-full px-6 font-bold shadow-sm transition-all duration-300 ${activeTab === 'history' ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md transform scale-105 border-none' : 'bg-white/60 text-slate-600 hover:bg-white border-white'}`}
                            variant={activeTab === 'history' ? 'default' : 'outline'}
                        >
                            {userRole === 'Student' ? 'Lịch Sử Của Tôi' : 'Lịch Sử Chấm Bài'}
                        </Button>

                        {(userRole === 'Admin' || userRole === 'Teacher') && (
                            <Button
                                onClick={() => switchTab('account')}
                                className={`rounded-full px-6 font-bold shadow-sm transition-all duration-300 ${activeTab === 'account' ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md transform scale-105 border-none' : 'bg-white/60 text-slate-600 hover:bg-white border-white'}`}
                                variant={activeTab === 'account' ? 'default' : 'outline'}
                            >
                                Quản Lý Tài Khoản
                            </Button>
                        )}

                        <div className="hidden xl:block pl-4 ml-2 border-l border-slate-200/60">
                            <Button variant="ghost" onClick={handleLogout} className="text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-full font-bold px-5">
                                <LogOut className="w-4 h-4 mr-2" /> Đăng xuất
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="min-h-[600px] print:p-0 print:border-none print:shadow-none print:bg-white animate-in slide-in-from-bottom-4 duration-500 fade-in">
                    {activeTab === 'upload' && <UploadStation />}
                    {activeTab === 'rubric' && userRole !== 'Student' && <RubricManager />}

                    {/* 🔥 CHO PHÉP RENDER GRADING HISTORY MÀ KHÔNG BỊ CHẶN */}
                    {activeTab === 'history' && <GradingHistory />}

                    {/* 🔥 TÁCH BIỆT GIAO DIỆN HỌC SINH VÀ GIÁO VIÊN Ở TAB CLASS */}
                    {activeTab === 'class' && userRole === 'Student' && <StudentDashboard />}
                    {activeTab === 'class' && userRole !== 'Student' && <ClassManager />}

                    {activeTab === 'account' && userRole !== 'Student' && <AccountManager />}
                </div>
            </div>

            {/* 🔥 MODAL VÀO PHÒNG THI */}
            <Dialog open={isExamModalOpen} onOpenChange={setIsExamModalOpen}>
                <DialogContent className="sm:max-w-[420px] bg-white/95 backdrop-blur-xl rounded-[2rem] p-0 border-white shadow-2xl overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-emerald-400 to-teal-500 w-full absolute top-0 left-0"></div>
                    <DialogHeader className="p-6 pb-2 bg-slate-50/50 border-b border-slate-100">
                        <DialogTitle className="text-2xl font-black text-slate-800 flex items-center">
                            <PlayCircle className="w-7 h-7 mr-3 text-emerald-500" /> Vào Phòng Thi
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 ml-1">Nhập mã phòng thi / Mã đề</label>
                            <Input
                                placeholder="VD: 6abc232..."
                                className="bg-slate-50 border-slate-200 focus-visible:ring-emerald-500 rounded-xl h-14 font-medium text-base shadow-inner"
                                value={examCode}
                                onChange={(e) => setExamCode(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleJoinExam()}
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter className="p-5 bg-slate-50/80 border-t border-slate-100 flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setIsExamModalOpen(false)} className="rounded-full font-bold hover:bg-slate-200 h-11 px-6">Hủy</Button>
                        <Button onClick={handleJoinExam} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full font-bold px-8 shadow-md border-none h-11 transition-all transform hover:scale-105">
                            Bắt đầu thi
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Toaster richColors position="top-right" />
        </div>
    )
}

export default App