import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, Wifi, WifiOff, UploadCloud, Loader2 } from 'lucide-react';
import { get, set } from 'idb-keyval'; // Thư viện lưu trữ Offline Database
import axios from 'axios';
import { toast } from 'sonner';

interface QueuedImage {
    id: string;
    base64: string;
    timestamp: number;
}

export default function OfflineScanner() {
    const webcamRef = useRef<Webcam>(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [offlineQueue, setOfflineQueue] = useState<QueuedImage[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);

    // 2. Lắng nghe trạng thái Mạng (Rớt mạng / Có mạng)
    useEffect(() => {
        // Bọc logic lấy dữ liệu vào một hàm async nội bộ
        const initData = async () => {
            const queue = await get('offline-exams') || [];
            setOfflineQueue(queue);
        };
        initData(); // Gọi hàm vừa tạo

        const handleOnline = () => {
            setIsOnline(true);
            toast.success("Đã kết nối Internet trở lại! Đang chuẩn bị đồng bộ...");
        };
        const handleOffline = () => {
            setIsOnline(false);
            toast.warning("Mất kết nối Internet! Ứng dụng đã chuyển sang chế độ Offline.", { duration: 5000 });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);
    const sendToServer = async (base64Image: string) => {
        try {
            // Chuyển base64 thành File để gửi form
            const res = await fetch(base64Image);
            const blob = await res.blob();
            const file = new File([blob], "scan.jpg", { type: "image/jpeg" });

            const formData = new FormData();
            formData.append("ImageFile", file);
            formData.append("StudentCode", "AUTO"); // Tự nhận diện
            formData.append("TestId", "TEST_01"); // Tạm hardcode hoặc cho chọn

            toast.promise(
                axios.post('/api/Grading/auto-grade', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
                {
                    loading: 'Đang đẩy ảnh lên AI phân tích...',
                    success: 'Chấm thành công 1 bài!',
                    error: 'Lỗi chấm bài!'
                }
            );
        } catch (error) {
            console.error("Lỗi upload:", error);
        }
    };
    // 3. Xử lý khi bấm nút Chụp
    const capture = useCallback(async () => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (!imageSrc) return;

        if (isOnline) {
            // CÓ MẠNG: Gửi thẳng lên Server
            sendToServer(imageSrc);
        } else {
            // MẤT MẠNG: Lưu vào Database nội bộ của điện thoại
            const newImage: QueuedImage = { id: Date.now().toString(), base64: imageSrc, timestamp: Date.now() };
            const currentQueue = await get('offline-exams') || [];
            const newQueue = [...currentQueue, newImage];

            await set('offline-exams', newQueue);
            setOfflineQueue(newQueue);
            toast("Đã lưu nháp vào máy (Chế độ Offline)", { icon: '💾' });
        }
    }, [webcamRef, isOnline]);

    // 4. Gửi ảnh lên Server (Hàm tái sử dụng)
  

    // 5. Đồng bộ hàng loạt ảnh Offline lên Server khi có mạng
    const syncOfflineData = async () => {
        if (offlineQueue.length === 0) return;
        setIsSyncing(true);

        try {
            for (const img of offlineQueue) {
                await sendToServer(img.base64);
            }
            // Đồng bộ xong thì xóa sạch hàng đợi
            await set('offline-exams', []);
            setOfflineQueue([]);
            toast.success(`Đã đồng bộ thành công ${offlineQueue.length} bài thi lên hệ thống!`);
        } catch {
            toast.error("Lỗi trong quá trình đồng bộ. Vui lòng thử lại sau.");
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="max-w-md mx-auto bg-slate-900 min-h-screen sm:min-h-[800px] sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col relative">
            {/* HEADER TRẠNG THÁI */}
            <div className="p-5 bg-slate-900 flex justify-between items-center z-10 border-b border-slate-800">
                <div className="flex flex-col">
                    <span className="text-white font-black text-lg">Máy Quét Bài</span>
                    <div className={`flex items-center text-xs font-bold ${isOnline ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`}>
                        {isOnline ? <><Wifi className="w-3 h-3 mr-1" /> Đang trực tuyến</> : <><WifiOff className="w-3 h-3 mr-1" /> Chế độ Offline</>}
                    </div>
                </div>

                {offlineQueue.length > 0 && (
                    <button
                        onClick={syncOfflineData}
                        disabled={!isOnline || isSyncing}
                        className={`flex items-center px-4 py-2 rounded-full font-bold text-sm transition-all ${isOnline ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.5)]' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                    >
                        {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
                        Đồng bộ ({offlineQueue.length})
                    </button>
                )}
            </div>

            {/* KHU VỰC CAMERA */}
            <div className="flex-1 relative bg-black flex items-center justify-center">
                <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: "environment" }} // Luôn ưu tiên Camera sau của điện thoại
                    className="w-full h-full object-cover opacity-90"
                />

                {/* Lưới căn chỉnh (Grid lines) */}
                <div className="absolute inset-0 pointer-events-none flex flex-col">
                    <div className="flex-1 border-b border-white/20 flex">
                        <div className="flex-1 border-r border-white/20"></div>
                        <div className="flex-1 border-r border-white/20"></div>
                        <div className="flex-1"></div>
                    </div>
                    <div className="flex-1 border-b border-white/20 flex">
                        <div className="flex-1 border-r border-white/20"></div>
                        <div className="flex-1 border-r border-white/20"></div>
                        <div className="flex-1"></div>
                    </div>
                    <div className="flex-1 flex">
                        <div className="flex-1 border-r border-white/20"></div>
                        <div className="flex-1 border-r border-white/20"></div>
                        <div className="flex-1"></div>
                    </div>
                </div>

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-1/2 border-2 border-emerald-400/50 rounded-2xl"></div>
            </div>

            {/* KHU VỰC NÚT CHỤP BÊN DƯỚI */}
            <div className="h-32 bg-slate-900 pb-8 flex items-center justify-center relative">
                <button
                    onClick={capture}
                    className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-all active:scale-95"
                >
                    <div className="w-16 h-16 bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.4)] flex items-center justify-center text-slate-800">
                        <Camera className="w-8 h-8" />
                    </div>
                </button>
            </div>
        </div>
    );
}