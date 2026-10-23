import { useState, useRef } from 'react';
import { Mic, Square, Loader2, Wand2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

interface VoiceRecorderProps {
    onTranscriptionComplete: (text: string) => void;
}

export default function VoiceRecorder({ onTranscriptionComplete }: VoiceRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<BlobPart[]>([]);

    const startRecording = async () => {
        try {
            // Xin quyền Mic và bật chế độ lọc tiếng ồn (noise suppression)
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { noiseSuppression: true, echoCancellation: true }
            });

            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await processAudio(audioBlob);
                // Tắt stream mic
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (error) {
            toast.error("Vui lòng cấp quyền sử dụng Microphone!");
            console.error(error);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const processAudio = async (audioBlob: Blob) => {
        setIsProcessing(true);
        const toastId = toast.loading("🤖 AI đang nghe và viết lại nhận xét...");

        try {
            const formData = new FormData();
            formData.append('audioFile', audioBlob, 'recording.webm');

            // Gọi API C# vừa viết
            const response = await axios.post('/api/Tutor/voice-to-text', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data && response.data.text) {
                toast.success("Đã hoàn thiện văn bản!", { id: toastId });
                // Đẩy text ra ngoài component cha
                onTranscriptionComplete(response.data.text);
            }
        } catch (error) {
            console.error(error);
            toast.error("Lỗi khi xử lý giọng nói. Vui lòng thử lại.", { id: toastId });
        } finally {
            setIsProcessing(false);
        }
    };

    if (isProcessing) {
        return (
            <button disabled className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-full font-bold text-sm border border-indigo-200">
                <Loader2 className="w-4 h-4 animate-spin" /> Đang bóc băng AI...
            </button>
        );
    }

    return isRecording ? (
        <button
            onClick={stopRecording}
            className="flex items-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-full font-bold text-sm border border-red-300 animate-pulse transition-all shadow-sm"
        >
            <Square className="w-4 h-4 fill-current" /> Dừng & Xử lý
        </button>
    ) : (
        <button
            onClick={startRecording}
            className="flex items-center gap-2 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 px-4 py-2 rounded-full font-bold text-sm border border-slate-200 shadow-sm transition-all"
        >
            <Mic className="w-4 h-4" /> <Wand2 className="w-3 h-3 -ml-1 text-purple-500" /> Đọc nhận xét
        </button>
    );
}