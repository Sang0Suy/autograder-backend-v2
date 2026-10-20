import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Lock, Save, Loader2, Phone, Mail } from "lucide-react";
import { toast } from 'sonner';
import axios from 'axios';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    userData: {
        username: string;
        fullName?: string;
        email?: string;
        phone?: string;
        role: string;
    };
}

// Hàm hỗ trợ giải mã JWT Token để lấy chính xác Username & Họ tên đang đăng nhập
function getUserFromToken() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return null;
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        const payload = JSON.parse(jsonPayload);
        return {
            username: payload.sub || payload.unique_name || payload.name || '',
            fullName: payload.FullName || ''
        };
    } catch {
        return null;
    }
}

export default function ProfileModal({ isOpen, onClose, userData }: ProfileModalProps) {
    const [activeTab, setActiveTab] = useState<'info' | 'password'>('info');
    const [isSaving, setIsSaving] = useState(false);

    // Xác định username chính xác nhất từ Token hoặc localStorage
    const tokenUser = getUserFromToken();
    const actualUsername =
        tokenUser?.username ||
        localStorage.getItem('username') ||
        (userData.username !== 'User' ? userData.username : 'admin');

    // Khởi tạo State form Hồ sơ
    const [profile, setProfile] = useState(() => ({
        fullName: localStorage.getItem('FullName') || tokenUser?.fullName || userData?.fullName || '',
        email: localStorage.getItem('Email') || userData?.email || '',
        phone: localStorage.getItem('Phone') || userData?.phone || ''
    }));

    // Khởi tạo State form Mật khẩu
    const [passwords, setPasswords] = useState({
        oldPass: '',
        newPass: '',
        confirmPass: ''
    });

    // Đồng bộ dữ liệu thông qua Event Handler khi đóng/mở Modal (thay cho useEffect)
    const handleOpenChange = (open: boolean) => {
        const currentTokenUser = getUserFromToken();
        setProfile({
            fullName: localStorage.getItem('FullName') || currentTokenUser?.fullName || userData?.fullName || '',
            email: localStorage.getItem('Email') || userData?.email || '',
            phone: localStorage.getItem('Phone') || userData?.phone || ''
        });
        setPasswords({ oldPass: '', newPass: '', confirmPass: '' });

        if (!open) {
            onClose();
        }
    };

    const handleSaveProfile = async () => {
        if (!profile.fullName.trim()) {
            return toast.warning("Họ và tên không được để trống!");
        }

        setIsSaving(true);
        try {
            await axios.put('/api/Auth/profile', {
                Username: actualUsername,
                FullName: profile.fullName.trim(),
                Email: profile.email.trim(),
                Phone: profile.phone.trim()
            });

            // Lưu lại vào localStorage để hiển thị đồng bộ
            localStorage.setItem('FullName', profile.fullName.trim());
            localStorage.setItem('Email', profile.email.trim());
            localStorage.setItem('Phone', profile.phone.trim());

            toast.success("Đã cập nhật thông tin cá nhân thành công!");
            onClose();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error(error);
                toast.error(error.response?.data?.message || "Lỗi khi lưu thông tin cá nhân!");
            } else {
                console.error(error);
                toast.error("Đã xảy ra lỗi không xác định!");
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (!passwords.oldPass) {
            return toast.warning("Vui lòng nhập mật khẩu hiện tại!");
        }

        if (passwords.newPass !== passwords.confirmPass) {
            return toast.error("Mật khẩu xác nhận không khớp!");
        }

        if (passwords.newPass.length < 6) {
            return toast.warning("Mật khẩu mới phải có ít nhất 6 ký tự!");
        }

        setIsSaving(true);
        try {
            await axios.post('/api/Auth/change-password', {
                Username: actualUsername,
                OldPassword: passwords.oldPass,
                NewPassword: passwords.newPass
            });

            toast.success("Đổi mật khẩu thành công! Tuyệt vời 🎉");
            setPasswords({ oldPass: '', newPass: '', confirmPass: '' });
            onClose();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error(error);
                toast.error(error.response?.data?.message || "Lỗi server! Không thể đổi mật khẩu.");
            } else {
                console.error(error);
                toast.error("Đã xảy ra lỗi không xác định!");
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-[500px] bg-white/95 backdrop-blur-xl p-0 overflow-hidden rounded-[2rem] border-white/60 shadow-2xl">
                <DialogTitle className="sr-only">Hồ sơ cá nhân và Đổi mật khẩu</DialogTitle>
                <div className="flex border-b border-slate-100 bg-slate-50/50">
                    <button
                        type="button"
                        onClick={() => setActiveTab('info')}
                        className={`flex-1 py-4 text-sm font-bold flex items-center justify-center transition-colors ${activeTab === 'info'
                                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white'
                                : 'text-slate-500 hover:bg-slate-100'
                            }`}
                    >
                        <User className="w-4 h-4 mr-2" /> Hồ Sơ Cá Nhân
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('password')}
                        className={`flex-1 py-4 text-sm font-bold flex items-center justify-center transition-colors ${activeTab === 'password'
                                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white'
                                : 'text-slate-500 hover:bg-slate-100'
                            }`}
                    >
                        <Lock className="w-4 h-4 mr-2" /> Đổi Mật Khẩu
                    </button>
                </div>

                <div className="p-8">
                    {activeTab === 'info' ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-black text-2xl flex items-center justify-center shadow-lg">
                                    {(profile.fullName || actualUsername).charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 text-xl">
                                        {profile.fullName || actualUsername}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs font-semibold text-slate-400">@{actualUsername}</span>
                                        <span className="bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-md text-xs font-bold uppercase">
                                            {userData.role || 'User'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="font-bold text-slate-700 flex items-center gap-1.5">
                                    <User className="w-4 h-4 text-slate-400" /> Họ và Tên
                                </Label>
                                <Input
                                    value={profile.fullName}
                                    onChange={e => setProfile({ ...profile, fullName: e.target.value })}
                                    placeholder="Nguyễn Văn A"
                                    className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 font-medium"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="font-bold text-slate-700 flex items-center gap-1.5">
                                    <Mail className="w-4 h-4 text-slate-400" /> Email liên hệ
                                </Label>
                                <Input
                                    type="email"
                                    value={profile.email}
                                    onChange={e => setProfile({ ...profile, email: e.target.value })}
                                    placeholder="email@truonghoc.edu.vn"
                                    className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 font-medium"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="font-bold text-slate-700 flex items-center gap-1.5">
                                    <Phone className="w-4 h-4 text-slate-400" /> Số điện thoại
                                </Label>
                                <Input
                                    type="tel"
                                    value={profile.phone}
                                    onChange={e => setProfile({ ...profile, phone: e.target.value })}
                                    placeholder="0901 234 567"
                                    className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 font-medium"
                                />
                            </div>

                            <Button
                                onClick={handleSaveProfile}
                                disabled={isSaving}
                                className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold mt-4 shadow-md transition-all"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                ) : (
                                    <Save className="w-5 h-5 mr-2" />
                                )}
                                Lưu Thay Đổi
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                            <div className="space-y-2">
                                <Label className="font-bold text-slate-700">Mật khẩu hiện tại</Label>
                                <Input
                                    type="password"
                                    placeholder="Nhập mật khẩu đang dùng..."
                                    value={passwords.oldPass}
                                    onChange={e => setPasswords({ ...passwords, oldPass: e.target.value })}
                                    className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold text-slate-700">Mật khẩu mới</Label>
                                <Input
                                    type="password"
                                    placeholder="Ít nhất 6 ký tự..."
                                    value={passwords.newPass}
                                    onChange={e => setPasswords({ ...passwords, newPass: e.target.value })}
                                    className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold text-slate-700">Xác nhận mật khẩu mới</Label>
                                <Input
                                    type="password"
                                    placeholder="Nhập lại mật khẩu mới..."
                                    value={passwords.confirmPass}
                                    onChange={e => setPasswords({ ...passwords, confirmPass: e.target.value })}
                                    className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-indigo-500"
                                />
                            </div>
                            <Button
                                onClick={handleChangePassword}
                                disabled={isSaving || !passwords.newPass}
                                className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold mt-4 shadow-md transition-all"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                ) : (
                                    <Lock className="w-5 h-5 mr-2" />
                                )}
                                Cập Nhật Mật Khẩu
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}