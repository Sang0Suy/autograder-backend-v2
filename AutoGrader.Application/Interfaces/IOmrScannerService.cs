using Microsoft.AspNetCore.Http;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace AutoGrader.Application.Interfaces
{
    public interface IOmrScannerService
    {
        // Hàm nhận file ảnh, dùng OpenCV quét và trả về mảng đáp án (VD: ["A", "C", "B", "D"])
        Task<List<string>> ScanBubbleSheetAsync(IFormFile imageFile);
    }
}