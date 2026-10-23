import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle2, Info } from 'lucide-react';
import * as signalR from '@microsoft/signalr';
import { toast } from 'sonner';

interface Notification {
    id: string;
    message: string;
    time: Date;
    isRead: boolean;
}

export default function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // 1. Khởi tạo kết nối SignalR tới Backend (Đổi URL cổng cho khớp với Backend C# của bạn)
        const connection = new signalR.HubConnectionBuilder()
            .withUrl("https://localhost:7196/gradingHub") // TODO: Đổi thành URL chạy BE thật
            .withAutomaticReconnect()
            .build();

        connection.start()
            .then(() => console.log("🔔 SignalR Connected for Notifications"))
            .catch(err => console.error("SignalR Connection Error: ", err));

        // 2. Lắng nghe sự kiện từ C# (Ví dụ: tên sự kiện là "ReceiveNotification" hoặc "GradingCompleted")
        connection.on("ReceiveNotification", (message: string) => {
            const newNotif: Notification = {
                id: Date.now().toString(),
                message,
                time: new Date(),
                isRead: false
            };
            setNotifications(prev => [newNotif, ...prev]);
            setUnreadCount(prev => prev + 1);

            // Hiện thêm cái toast nhỏ gọn ở góc
            toast(message, { icon: '🔔' });
        });

        // Click ra ngoài để đóng menu
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            connection.stop();
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
        if (!isOpen) {
            // Khi mở chuông ra thì tự động đánh dấu đã đọc hết
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        }
    };

    const clearAll = () => setNotifications([]);

    return (
        <div className="relative z-50" ref={dropdownRef}>
            {/* NÚT QUẢ CHUÔNG */}
            <button
                onClick={toggleDropdown}
                className="relative p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-600 outline-none"
            >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-black leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-500 rounded-full animate-bounce">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* DROPDOWN THÔNG BÁO */}
            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-3xl shadow-2xl overflow-hidden origin-top-right animate-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="font-black text-slate-800 text-lg">Thông báo</h3>
                        {notifications.length > 0 && (
                            <button onClick={clearAll} className="text-xs font-bold text-indigo-600 hover:text-indigo-800">Xóa tất cả</button>
                        )}
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center flex flex-col items-center">
                                <Bell className="w-10 h-10 text-slate-200 mb-3" />
                                <span className="text-slate-500 font-medium">Bạn không có thông báo nào.</span>
                            </div>
                        ) : (
                            notifications.map((notif) => (
                                <div key={notif.id} className="p-4 border-b border-slate-100/50 hover:bg-indigo-50/50 transition-colors flex gap-3 items-start">
                                    <div className="bg-indigo-100 p-2 rounded-full shrink-0 text-indigo-600 mt-0.5">
                                        {notif.message.toLowerCase().includes('hoàn thành') || notif.message.toLowerCase().includes('thành công')
                                            ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                            : <Info className="w-5 h-5 text-indigo-600" />}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-slate-700 leading-snug">{notif.message}</p>
                                        <p className="text-xs font-bold text-slate-400 mt-1.5">{notif.time.toLocaleTimeString('vi-VN')} - {notif.time.toLocaleDateString('vi-VN')}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}