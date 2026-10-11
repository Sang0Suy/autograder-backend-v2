import { useState } from 'react'
import axios from 'axios'
import { toast } from 'sonner'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Lock, Sparkles } from "lucide-react"

export default function Login({ onLoginSuccess }: { onLoginSuccess: () => void }) {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!username || !password) return toast.warning("Vui lòng nhập đầy đủ thông tin!")

        try {
            setIsLoading(true)
            // Gọi xuống API AuthController của C#
            const res = await axios.post('/api/Auth/login', {
                username,
                password
            })

            // 🔥 FIX: Bắt trường hợp C# API trả về { success: false, message: "Sai MK" } nhưng HTTP vẫn là 200 OK
            if (res.data.success === false) {
                toast.error(res.data.message || "Sai tài khoản hoặc mật khẩu!");
                return;
            }

            // 🔥 FIX: Bắt trường hợp C# Serialize JSON chữ cái đầu viết Hoa (Token, Role)
            const token = res.data.token || res.data.Token;
            const role = res.data.role || res.data.Role;
            const refId = res.data.referenceId || res.data.ReferenceId;

            if (!token) {
                toast.error("Lỗi hệ thống: Máy chủ không trả về Token hợp lệ!");
                return;
            }

            // Lưu Token và Role vào kho chứa của trình duyệt
            localStorage.setItem('token', token)
            localStorage.setItem('role', role)

            // Lưu Mã Học Sinh (Nếu có) để dùng cho việc thi trực tuyến
            if (refId) localStorage.setItem('ReferenceId', refId)

            toast.success(res.data.message || "Đăng nhập thành công!")
            onLoginSuccess() // Báo cho App.tsx

        } catch (error) {
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.message || error.response?.data || "Sai tài khoản hoặc mật khẩu!");
            } else {
                toast.error("Sai tài khoản hoặc mật khẩu!");
            }
            console.error(error);
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden p-4">

            {/* 🔥 BACKGROUND DECORATION (Hiệu ứng ánh sáng nền mờ ảo) */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full blur-[120px] opacity-40 mix-blend-multiply animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-gradient-to-br from-blue-400 to-emerald-400 rounded-full blur-[120px] opacity-40 mix-blend-multiply animate-pulse delay-1000"></div>

            {/* MAIN LOGIN CARD */}
            <div className="w-full max-w-md p-8 md:p-10 space-y-8 bg-white/90 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white relative z-10 animate-in fade-in zoom-in-95 duration-700">

                <div className="text-center space-y-3">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-600 rounded-3xl shadow-inner border border-white">
                            <Lock className="w-10 h-10" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-2">
                        AutoGrader <Sparkles className="w-6 h-6 text-amber-400" />
                    </h1>
                    <p className="text-base text-slate-500 font-medium">Hệ thống chấm điểm trắc nghiệm AI</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-3">
                        <Label htmlFor="username" className="font-bold text-slate-700 ml-1 text-sm uppercase tracking-wide">Tài khoản</Label>
                        <Input
                            id="username"
                            placeholder="Nhập tên đăng nhập (VD: admin)"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="h-14 rounded-2xl bg-slate-50/50 border-slate-200 focus-visible:ring-indigo-500 focus-visible:bg-white px-5 font-medium text-base transition-all"
                        />
                    </div>

                    <div className="space-y-3">
                        <Label htmlFor="password" className="font-bold text-slate-700 ml-1 text-sm uppercase tracking-wide">Mật khẩu</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="h-14 rounded-2xl bg-slate-50/50 border-slate-200 focus-visible:ring-indigo-500 focus-visible:bg-white px-5 font-medium text-base transition-all tracking-widest"
                        />
                    </div>

                    <Button type="submit" className="w-full h-14 rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-lg shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5" disabled={isLoading}>
                        {isLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
                        {isLoading ? "Đang xử lý..." : "Đăng nhập ngay"}
                    </Button>
                </form>
            </div>
        </div>
    )
}