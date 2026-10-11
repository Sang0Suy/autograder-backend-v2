import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import axios from 'axios'

// 🔥 Lấy tự động URL từ file .env, nếu quên tạo file .env thì tự dùng link dự phòng
axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'https://autograder-backend-sang.onrender.com';

// ================= CẤU HÌNH AXIOS TOÀN CỤC =================
// 1. Tự động gắn Token vào tất cả các gói tin gửi xuống C#
axios.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// 2. Tự động bắt lỗi 401 (Hết hạn Token hoặc bị đuổi) -> Bắt đăng nhập lại
axios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token')
            localStorage.removeItem('role')
            localStorage.removeItem('currentTab') // Dọn rác
            window.location.href = '/' // Tải lại trang để về màn hình Login
        }
        return Promise.reject(error)
    }
)
// ===========================================================

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)