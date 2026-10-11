import { useState, useEffect, useMemo } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { toast } from 'sonner'
import axios from 'axios'
import { UserPlus, ShieldCheck, Loader2, Trash2, AlertTriangle, Search, ChevronLeft, ChevronRight, Settings } from "lucide-react"

// Đã bổ sung trường allowedClasses vào Interface để TypeScript không báo lỗi
interface AppUser {
    id: string;
    username: string;
    fullName: string;
    role: string;
    referenceId?: string;
    allowedClasses?: string[];
}

export default function AccountManager() {
    const userRole = localStorage.getItem('role') || ''
    const isReadOnly = userRole !== 'Admin'

    const [users, setUsers] = useState<AppUser[]>([])
    const [isLoadingData, setIsLoadingData] = useState(true)
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    const [searchTerm, setSearchTerm] = useState("")
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    // State cho tính năng Phân quyền lớp học
    const [isClassAssignModalOpen, setIsClassAssignModalOpen] = useState(false);
    const [selectedTeacher, setSelectedTeacher] = useState<AppUser | null>(null);
    const [teacherAllowedClasses, setTeacherAllowedClasses] = useState<string[]>([]);
    const [allAvailableClasses, setAllAvailableClasses] = useState<string[]>([]);

    const [formData, setFormData] = useState({
        username: '', password: '', fullName: '', role: 'Student', referenceId: ''
    })

    const fetchUsers = async () => {
        try {
            setIsLoadingData(true)
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/Auth/users`);
            setUsers(Array.isArray(response.data) ? response.data : [])
        } catch (error) {
            toast.error("Không thể tải danh sách tài khoản!")
            console.error(error)
        } finally {
            setIsLoadingData(false)
        }
    }

    // eslint-disable-next-line
    useEffect(() => { fetchUsers() }, [])

    // ==========================================
    // LOGIC PHÂN QUYỀN LỚP HỌC CHO GIÁO VIÊN
    // ==========================================
    const handleOpenAssignModal = async (teacher: AppUser) => {
        setSelectedTeacher(teacher);
        setTeacherAllowedClasses(teacher.allowedClasses || []);

        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/Students`);
            const students = res.data;
            const distinctClasses = Array.from(new Set(students.map((s: { className?: string }) => s.className))).filter(Boolean) as string[];            setAllAvailableClasses(distinctClasses);

            setIsClassAssignModalOpen(true);
        } catch (error) {
            console.error(error);
            toast.error("Không thể lấy danh sách lớp học từ Server!");
        }
    };

    const toggleClassSelection = (className: string) => {
        setTeacherAllowedClasses(prev =>
            prev.includes(className)
                ? prev.filter(c => c !== className)
                : [...prev, className]
        );
    };

    const handleSaveTeacherClasses = async () => {
        if (!selectedTeacher) return;
        try {
            await axios.put(`${import.meta.env.VITE_API_URL}/api/Auth/${selectedTeacher.id}/assign-classes`, teacherAllowedClasses);
            toast.success(`Đã phân công ${teacherAllowedClasses.length} lớp cho giáo viên ${selectedTeacher.fullName}`);
            setIsClassAssignModalOpen(false);
            fetchUsers();
        } catch (error) {
            console.error(error);
            toast.error("Lỗi khi phân công lớp!");
        }
    };

    // ==========================================
    // LOGIC QUẢN LÝ TÀI KHOẢN CƠ BẢN
    // ==========================================
    const handleRegister = async () => {
        if (!formData.username || !formData.password || !formData.fullName) {
            return toast.warning("Vui lòng điền đầy đủ Tên đăng nhập, Mật khẩu và Họ tên!")
        }
        if (formData.role === 'Student' && !formData.referenceId) {
            return toast.warning("Vui lòng nhập Mã học sinh để đồng bộ điểm số!")
        }

        try {
            setIsSaving(true)
            const payload = {
                username: formData.username.trim(), password: formData.password, fullName: formData.fullName.trim(),
                role: formData.role, referenceId: formData.role === 'Student' ? formData.referenceId.trim() : null
            }
            await axios.post(`${import.meta.env.VITE_API_URL}/api/Auth/register`, payload)
            toast.success("Tạo tài khoản thành công!")

            setIsAddModalOpen(false)
            setFormData({ username: '', password: '', fullName: '', role: 'Student', referenceId: '' })
            fetchUsers()
        } catch (error) {
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data || "Lỗi khi tạo tài khoản!");
            } else {
                toast.error("Lỗi khi tạo tài khoản!");
            }
            console.error(error);
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteUser = async (userId: string) => {
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/Auth/users/${userId}`)
            toast.success("Đã xóa tài khoản khỏi hệ thống!")
            fetchUsers()
        } catch (error) {
            toast.error("Lỗi khi xóa tài khoản!")
            console.error(error)
        }
    }

    const getRoleLabel = (role: string) => {
        if (role === 'Admin') return <span className="bg-rose-100/80 text-rose-700 px-4 py-1.5 rounded-full text-xs font-bold border border-rose-200 shadow-sm backdrop-blur-sm">Admin</span>
        if (role === 'Teacher') return <span className="bg-amber-100/80 text-amber-700 px-4 py-1.5 rounded-full text-xs font-bold border border-amber-200 shadow-sm backdrop-blur-sm">Giáo Viên</span>
        return <span className="bg-sky-100/80 text-sky-700 px-4 py-1.5 rounded-full text-xs font-bold border border-sky-200 shadow-sm backdrop-blur-sm">Học Sinh</span>
    }

    const removeAccents = (str: string) => {
        if (!str) return ""
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    }

    const filteredUsers = useMemo(() => {
        if (!searchTerm.trim()) return users;
        const searchLower = removeAccents(searchTerm);
        return users.filter(user => {
            const name = removeAccents(user.fullName || "");
            const username = removeAccents(user.username || "");
            const refId = removeAccents(user.referenceId || "");
            return name.includes(searchLower) || username.includes(searchLower) || refId.includes(searchLower);
        })
    }, [users, searchTerm]);

    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const currentUsersData = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-700 p-2 md:p-4 relative min-h-screen">

            <div className="fixed inset-0 -z-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-50 via-slate-50 to-blue-50/50 pointer-events-none"></div>
            <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] bg-sky-300/20 rounded-full blur-[120px] -z-10 pointer-events-none animate-pulse"></div>
            <div className="fixed bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[120px] -z-10 pointer-events-none animate-pulse delay-1000"></div>

            <div className="bg-white/70 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-100 to-sky-50 rounded-full blur-3xl -z-10 opacity-70 translate-x-1/2 -translate-y-1/2"></div>

                <div>
                    <h2 className="text-3xl font-black text-slate-800 flex items-center tracking-tight">
                        <ShieldCheck className="w-8 h-8 mr-3 text-blue-600" /> Quản Lý Tài Khoản
                    </h2>
                    <p className="text-base text-slate-500 mt-2 font-medium">Danh sách tài khoản và phân quyền truy cập hệ thống giáo dục</p>
                </div>

                {!isReadOnly && (
                    <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-300 rounded-full px-8 py-6 h-auto text-base font-bold border-none" onClick={() => setIsAddModalOpen(true)}>
                        <UserPlus className="w-5 h-5 mr-2" /> Thêm tài khoản mới
                    </Button>
                )}
            </div>

            {isReadOnly && (
                <div className="bg-amber-50/80 backdrop-blur-sm text-amber-800 p-5 rounded-[1.5rem] flex items-center border border-amber-200/60 shadow-sm font-medium">
                    <AlertTriangle className="w-6 h-6 mr-4 flex-shrink-0 text-amber-600" />
                    Giáo viên chỉ có quyền xem danh sách. Việc cấp mới hoặc xóa tài khoản thuộc thẩm quyền của Admin nhà trường.
                </div>
            )}

            <div className="bg-white/70 backdrop-blur-xl p-4 rounded-[2rem] border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col sm:flex-row items-center gap-4">
                <div className="relative w-full sm:w-[450px]">
                    <Search className="absolute left-5 top-3.5 h-5 w-5 text-slate-400" />
                    <Input
                        placeholder="Tìm theo họ tên, tên đăng nhập hoặc mã ĐB..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="pl-14 h-12 bg-white/50 border-white/60 focus-visible:ring-blue-500 focus-visible:bg-white rounded-full transition-all text-base shadow-sm backdrop-blur-sm"
                    />
                </div>
            </div>

            <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-100/50 backdrop-blur-md">
                            <TableRow className="border-b border-slate-200/60 whitespace-nowrap">
                                <TableHead className="w-[80px] font-bold text-slate-700 pl-8 py-5">STT</TableHead>
                                <TableHead className="font-bold text-slate-700 py-5">Họ và Tên</TableHead>
                                <TableHead className="font-bold text-slate-700 py-5">Tên Đăng Nhập</TableHead>
                                <TableHead className="text-center font-bold text-slate-700 py-5">Vai Trò</TableHead>
                                <TableHead className="text-center font-bold text-slate-700 py-5">Mã Đồng Bộ</TableHead>
                                <TableHead className="text-center font-bold text-slate-700 py-5">Phân Lớp</TableHead>
                                {!isReadOnly && <TableHead className="text-right font-bold text-slate-700 pr-8 py-5">Hành Động</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingData ? (
                                <TableRow><TableCell colSpan={7} className="h-48 text-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" /></TableCell></TableRow>
                            ) : currentUsersData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-48 text-center text-slate-500 font-medium text-base">
                                        {searchTerm ? "Không tìm thấy tài khoản nào khớp với từ khóa." : "Chưa có tài khoản nào trong hệ thống."}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                currentUsersData.map((user, index) => {
                                    const stt = (currentPage - 1) * itemsPerPage + index + 1;

                                    return (
                                        <TableRow key={user.id} className="hover:bg-white/80 transition-colors border-b border-slate-100/60 last:border-0">
                                            <TableCell className="font-medium text-slate-600 pl-8">{stt}</TableCell>
                                            <TableCell className="font-bold text-slate-800 text-base">{user.fullName}</TableCell>
                                            <TableCell className="font-mono text-sm text-slate-500">
                                                <span className="bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200/60 shadow-sm">{user.username}</span>
                                            </TableCell>
                                            <TableCell className="text-center">{getRoleLabel(user.role)}</TableCell>
                                            <TableCell className="text-center">
                                                {user.referenceId ? <span className="font-mono text-sm text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg font-bold shadow-sm">{user.referenceId}</span> : <span className="text-slate-300">-</span>}
                                            </TableCell>

                                            {/* 🔥 CỘT HIỂN THỊ TRẠNG THÁI PHÂN LỚP */}
                                            <TableCell className="text-center">
                                                {user.role === 'Teacher' ? (
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                                            {user.allowedClasses?.length || 0} lớp
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </TableCell>

                                            {!isReadOnly && (
                                                <TableCell className="text-right pr-6">
                                                    {user.username !== 'admin' && (
                                                        <div className="flex items-center justify-end gap-1">

                                                            {/* 🔥 NÚT CẤU HÌNH LỚP CHO GIÁO VIÊN */}
                                                            {user.role === 'Teacher' && (
                                                                <Button variant="ghost" size="icon" className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-full w-10 h-10 transition-colors shadow-sm bg-white/50 border border-white" title="Phân công lớp học" onClick={() => handleOpenAssignModal(user)}>
                                                                    <Settings className="w-5 h-5" />
                                                                </Button>
                                                            )}

                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full w-10 h-10 transition-colors shadow-sm bg-white/50 border border-white" title="Xóa tài khoản">
                                                                        <Trash2 className="w-5 h-5" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent className="bg-white/95 backdrop-blur-xl border-white rounded-[2rem] shadow-2xl">
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle className="text-red-600 text-xl font-bold">Xóa tài khoản này?</AlertDialogTitle>
                                                                        <AlertDialogDescription className="text-base text-slate-600 mt-2">
                                                                            Xóa vĩnh viễn quyền truy cập hệ thống của <span className="font-bold text-slate-800">{user.fullName}</span> ({user.username}). Không thể khôi phục.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter className="mt-4">
                                                                        <AlertDialogCancel className="rounded-full font-bold px-6 border-slate-300 bg-white/50">Hủy</AlertDialogCancel>
                                                                        <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white rounded-full font-bold px-8 shadow-md border-none" onClick={() => handleDeleteUser(user.id!)}>Xác nhận xóa</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {filteredUsers.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between px-8 py-5 bg-slate-50/30 border-t border-slate-200/60 gap-4 backdrop-blur-md">
                        <div className="text-sm text-slate-500 font-medium text-center sm:text-left">
                            Hiển thị <span className="font-bold text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</span> đến <span className="font-bold text-slate-800">{Math.min(currentPage * itemsPerPage, filteredUsers.length)}</span> trong tổng số <span className="font-bold text-blue-600">{filteredUsers.length}</span> tài khoản
                        </div>
                        <div className="flex items-center space-x-2 bg-white/60 border border-white p-1.5 rounded-full shadow-sm backdrop-blur-sm">
                            <Button variant="ghost" size="sm" className="rounded-full hover:bg-white" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                                <ChevronLeft className="w-5 h-5" />
                            </Button>
                            <div className="text-sm font-bold text-slate-700 px-4">
                                Trang {currentPage} / {totalPages || 1}
                            </div>
                            <Button variant="ghost" size="sm" className="rounded-full hover:bg-white" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}>
                                <ChevronRight className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* 🔥 MODAL PHÂN QUYỀN LỚP HỌC CHO GIÁO VIÊN */}
            <Dialog open={isClassAssignModalOpen} onOpenChange={setIsClassAssignModalOpen}>
                <DialogContent className="sm:max-w-[500px] bg-white rounded-3xl p-0 overflow-hidden shadow-2xl">
                    <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500 w-full"></div>
                    <DialogHeader className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <DialogTitle className="text-xl font-black text-slate-800 flex items-center">
                            <Settings className="w-5 h-5 mr-2 text-indigo-600" />
                            Phân Công Quản Lý Lớp
                        </DialogTitle>
                        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                            Chọn các lớp mà giáo viên <span className="font-bold text-indigo-600">{selectedTeacher?.fullName}</span> được phép quản lý và xem điểm.
                        </p>
                    </DialogHeader>

                    <div className="p-6 bg-slate-50/30 max-h-[50vh] overflow-y-auto">
                        {allAvailableClasses.length === 0 ? (
                            <div className="text-center py-8">
                                <span className="text-4xl mb-3 block">📭</span>
                                <p className="text-slate-500 font-medium">Chưa có lớp học nào trong hệ thống.</p>
                                <p className="text-sm text-slate-400 mt-1">Hãy thêm học sinh vào các lớp trước.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {allAvailableClasses.map(clsName => {
                                    const isSelected = teacherAllowedClasses.includes(clsName);
                                    return (
                                        <div
                                            key={clsName}
                                            onClick={() => toggleClassSelection(clsName)}
                                            className={`cursor-pointer rounded-xl p-3 flex flex-col items-center justify-center transition-all duration-200 border-2 ${isSelected
                                                    ? 'bg-indigo-50 border-indigo-500 shadow-sm scale-[1.02]'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-slate-50'
                                                }`}
                                        >
                                            <span className={`font-bold ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>{clsName}</span>
                                            {isSelected && <span className="text-[10px] font-black text-indigo-500 uppercase mt-1">Đã chọn</span>}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-5 border-t border-slate-100 bg-white">
                        <Button variant="outline" className="rounded-full font-bold px-6" onClick={() => setIsClassAssignModalOpen(false)}>Hủy</Button>
                        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold px-8 shadow-md" onClick={handleSaveTeacherClasses}>
                            Lưu Phân Công
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 🔥 MODAL THÊM TÀI KHOẢN MỚI */}
            {!isReadOnly && (
                <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                    <DialogContent className="!max-w-[500px] !w-[95vw] bg-white/95 backdrop-blur-xl z-50 rounded-[2rem] overflow-hidden p-0 border border-white shadow-2xl">
                        <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-500 w-full absolute top-0 left-0"></div>

                        <DialogHeader className="pt-8 px-8 pb-4 border-b border-slate-100/60 bg-white/50 backdrop-blur-md">
                            <DialogTitle className="text-2xl font-black text-slate-800 tracking-tight">Tạo Tài Khoản Mới</DialogTitle>
                            <p className="text-sm text-slate-500 mt-1 font-medium">Cấp quyền truy cập hệ thống cho thành viên mới.</p>
                        </DialogHeader>

                        <div className="px-8 py-6">
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-2 col-span-2">
                                    <Label className="font-bold text-slate-700 ml-1">Họ và Tên <span className="text-red-500">*</span></Label>
                                    <Input placeholder="VD: Nguyễn Văn A" className="bg-white/50 backdrop-blur-sm border-white/60 focus-visible:ring-blue-500 rounded-2xl h-12 shadow-inner font-medium text-base" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} />
                                </div>
                                <div className="space-y-2 col-span-2 sm:col-span-1">
                                    <Label className="font-bold text-slate-700 ml-1">Tên đăng nhập <span className="text-red-500">*</span></Label>
                                    <Input placeholder="VD: hs_vana" className="bg-white/50 backdrop-blur-sm border-white/60 focus-visible:ring-blue-500 rounded-2xl h-12 shadow-inner font-medium text-base" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
                                </div>
                                <div className="space-y-2 col-span-2 sm:col-span-1">
                                    <Label className="font-bold text-slate-700 ml-1">Mật khẩu <span className="text-red-500">*</span></Label>
                                    <Input type="text" placeholder="Khởi tạo mật khẩu" className="bg-white/50 backdrop-blur-sm border-white/60 focus-visible:ring-blue-500 rounded-2xl h-12 shadow-inner font-medium text-base" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                                </div>
                                <div className="space-y-2 col-span-2">
                                    <Label className="font-bold text-slate-700 ml-1">Phân quyền hệ thống <span className="text-red-500">*</span></Label>
                                    <select className="flex h-12 w-full rounded-2xl border border-white/60 bg-white/50 px-4 py-2 text-base font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors shadow-inner backdrop-blur-sm" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                                        <option value="Student">👨‍🎓 Học sinh (Student)</option>
                                        <option value="Teacher">👨‍🏫 Giáo viên (Teacher)</option>
                                        <option value="Admin">🛡️ Quản trị viên (Admin)</option>
                                    </select>
                                </div>

                                {formData.role === 'Student' && (
                                    <div className="space-y-3 col-span-2 p-5 bg-blue-50/50 backdrop-blur-sm border border-blue-100/60 rounded-2xl animate-in zoom-in-95 duration-200 mt-2">
                                        <Label className="text-blue-900 font-bold ml-1">Mã Học Sinh đồng bộ <span className="text-red-500">*</span></Label>
                                        <Input placeholder="VD: HS001" className="bg-white border-blue-200/60 focus-visible:ring-blue-500 rounded-xl h-12 font-bold text-blue-700 shadow-sm" value={formData.referenceId} onChange={(e) => setFormData({ ...formData, referenceId: e.target.value })} />
                                        <p className="text-sm text-blue-700/80 mt-2 font-medium">Mã này dùng để liên kết tài khoản này với bảng điểm của học sinh trên hệ thống.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <DialogFooter className="border-t border-slate-100/60 p-6 md:px-8 bg-slate-50/50 backdrop-blur-md flex gap-3 sm:justify-end rounded-b-[2rem]">
                            <Button variant="outline" className="rounded-full font-bold px-8 border-slate-300 hover:bg-white bg-white/50 h-12 text-base shadow-sm" onClick={() => setIsAddModalOpen(false)}>Hủy bỏ</Button>
                            <Button onClick={handleRegister} disabled={isSaving} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md rounded-full px-10 font-bold transition-all h-12 text-base border-none">
                                {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <UserPlus className="w-5 h-5 mr-2" />} Khởi Tạo
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    )
}