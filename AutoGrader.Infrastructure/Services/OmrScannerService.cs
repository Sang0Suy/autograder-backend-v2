using AutoGrader.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using OpenCvSharp;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace AutoGrader.Infrastructure.Services
{
    public class OmrScannerService : IOmrScannerService
    {
        public async Task<List<string>> ScanBubbleSheetAsync(IFormFile imageFile)
        {
            if (imageFile == null || imageFile.Length == 0)
                throw new ArgumentException("Không tìm thấy file ảnh.");

            // 1. CHUYỂN ẢNH VÀO OPENCV
            using var memoryStream = new MemoryStream();
            await imageFile.CopyToAsync(memoryStream);
            byte[] fileBytes = memoryStream.ToArray();

            using Mat srcImage = Cv2.ImDecode(fileBytes, ImreadModes.Color);
            if (srcImage.Empty()) throw new Exception("OpenCV không đọc được ảnh.");

            // 2. TIỀN XỬ LÝ (Đen trắng & Khử nhiễu)
            using Mat gray = new Mat();
            Cv2.CvtColor(srcImage, gray, ColorConversionCodes.BGR2GRAY);

            using Mat blurred = new Mat();
            Cv2.GaussianBlur(gray, blurred, new Size(5, 5), 0);

            // 3. TÌM VIỀN TỜ GIẤY & NẮN THẲNG
            using Mat edges = new Mat();
            Cv2.Canny(blurred, edges, 75, 200);

            Cv2.FindContours(edges, out Point[][] contours, out _, RetrievalModes.External, ContourApproximationModes.ApproxSimple);

            // Tìm khung lớn nhất có 4 cạnh (Giả định đó là viền tờ giấy A4)
            var paperContour = contours.OrderByDescending(c => Cv2.ContourArea(c))
                                       .FirstOrDefault(c => Cv2.ApproxPolyDP(c, Cv2.ArcLength(c, true) * 0.02, true).Length == 4);

            Mat warpedImage;
            if (paperContour != null)
            {
                var approx = Cv2.ApproxPolyDP(paperContour, Cv2.ArcLength(paperContour, true) * 0.02, true);
                warpedImage = WarpPerspective(gray, approx);
            }
            else
            {
                // Nếu chụp quá sát không thấy viền giấy, dùng luôn ảnh gốc
                warpedImage = gray.Clone();
            }

            // 4. NHỊ PHÂN HÓA (Đảo ngược đen trắng: Mực chì đen sẽ biến thành điểm sáng Trắng 255)
            using Mat thresh = new Mat();
            Cv2.Threshold(warpedImage, thresh, 0, 255, ThresholdTypes.BinaryInv | ThresholdTypes.Otsu);

            // 5. TRUY TÌM CÁC BONG BÓNG ĐÁP ÁN
            Cv2.FindContours(thresh, out Point[][] bubbleContours, out _, RetrievalModes.External, ContourApproximationModes.ApproxSimple);

            List<Rect> bubbles = new List<Rect>();
            foreach (var c in bubbleContours)
            {
                Rect rect = Cv2.BoundingRect(c);
                float aspectRatio = (float)rect.Width / rect.Height;

                // Điều kiện để được nhận diện là 1 bong bóng: 
                // Tỷ lệ gần hình vuông (0.8 - 1.2), kích thước không quá bé và không quá to
                if (rect.Width >= 15 && rect.Height >= 15 && rect.Width <= 60 && rect.Height <= 60 && aspectRatio >= 0.8f && aspectRatio <= 1.2f)
                {
                    bubbles.Add(rect);
                }
            }

            // 6. THUẬT TOÁN NHÓM VÀ CHẤM ĐIỂM
            List<string> results = new List<string>();
            string[] options = { "A", "B", "C", "D" };

            if (bubbles.Count > 0)
            {
                // Bước 6.1: Sắp xếp tất cả bong bóng từ TRÊN xuống DƯỚI (Theo tọa độ Y)
                bubbles = bubbles.OrderBy(b => b.Y).ToList();

                // Bước 6.2: Gom nhóm các bong bóng nằm trên cùng 1 hàng ngang
                List<List<Rect>> rows = new List<List<Rect>>();
                List<Rect> currentRow = new List<Rect>();

                foreach (var b in bubbles)
                {
                    if (currentRow.Count == 0)
                    {
                        currentRow.Add(b);
                    }
                    else
                    {
                        // Nếu bong bóng này có tọa độ Y chênh lệch không quá 15 pixel so với bong bóng trước -> Cùng 1 hàng
                        if (Math.Abs(b.Y - currentRow.Last().Y) < 15)
                        {
                            currentRow.Add(b);
                        }
                        else
                        {
                            rows.Add(currentRow);
                            currentRow = new List<Rect> { b };
                        }
                    }
                }
                if (currentRow.Count > 0) rows.Add(currentRow);

                // Bước 6.3: Quét từng hàng để chấm điểm (Phù hợp tuyệt đối với Grid 3 cột của ReactJS)
                foreach (var row in rows)
                {
                    // Sắp xếp các bong bóng trong hàng từ TRÁI qua PHẢI (Theo tọa độ X)
                    var sortedRow = row.OrderBy(b => b.X).ToList();

                    // Cứ 4 bong bóng liên tiếp sẽ ghép thành 1 câu hỏi (A, B, C, D)
                    for (int i = 0; i < sortedRow.Count; i += 4)
                    {
                        var questionBubbles = sortedRow.Skip(i).Take(4).ToList();
                        if (questionBubbles.Count < 4) continue; // Hụt bong bóng -> Bỏ qua

                        int maxPixels = 0;
                        int selectedIndex = -1;

                        // Quét 4 đáp án
                        for (int j = 0; j < 4; j++)
                        {
                            // Cắt vùng ảnh chứa riêng cái bong bóng đó ra
                            using Mat bubbleRoi = new Mat(thresh, questionBubbles[j]);
                            // Đếm số lượng pixel trắng (chính là vết bút chì đen tô vào)
                            int nonZero = Cv2.CountNonZero(bubbleRoi);

                            if (nonZero > maxPixels)
                            {
                                maxPixels = nonZero;
                                selectedIndex = j;
                            }
                        }

                        // Kiểm tra: Nếu lượng vết chì > 40% diện tích bong bóng thì mới công nhận
                        int bubbleArea = questionBubbles[0].Width * questionBubbles[0].Height;
                        if (selectedIndex != -1 && maxPixels > bubbleArea * 0.4)
                        {
                            results.Add(options[selectedIndex]);
                        }
                        else
                        {
                            results.Add("N/A"); // Học sinh bỏ trống hoặc tô quá mờ
                        }
                    }
                }
            }

            warpedImage.Dispose();
            return results;
        }

        // ==========================================
        // CÁC HÀM HỖ TRỢ TOÁN HỌC OPENCV
        // ==========================================
        private Mat WarpPerspective(Mat image, Point[] corners)
        {
            var orderedCorners = OrderPoints(corners);

            Point2f tl = orderedCorners[0]; Point2f tr = orderedCorners[1];
            Point2f br = orderedCorners[2]; Point2f bl = orderedCorners[3];

            // Tính toán kích thước của tờ giấy sau khi nắn
            var widthA = Math.Sqrt(Math.Pow(br.X - bl.X, 2) + Math.Pow(br.Y - bl.Y, 2));
            var widthB = Math.Sqrt(Math.Pow(tr.X - tl.X, 2) + Math.Pow(tr.Y - tl.Y, 2));
            int maxWidth = Math.Max((int)widthA, (int)widthB);

            var heightA = Math.Sqrt(Math.Pow(tr.X - br.X, 2) + Math.Pow(tr.Y - br.Y, 2));
            var heightB = Math.Sqrt(Math.Pow(tl.X - bl.X, 2) + Math.Pow(tl.Y - bl.Y, 2));
            int maxHeight = Math.Max((int)heightA, (int)heightB);

            Point2f[] dst = new Point2f[]
            {
                new Point2f(0, 0),
                new Point2f(maxWidth - 1, 0),
                new Point2f(maxWidth - 1, maxHeight - 1),
                new Point2f(0, maxHeight - 1)
            };

            using Mat matrix = Cv2.GetPerspectiveTransform(orderedCorners, dst);
            Mat warped = new Mat();
            Cv2.WarpPerspective(image, warped, matrix, new Size(maxWidth, maxHeight));

            return warped;
        }

        private Point2f[] OrderPoints(Point[] pts)
        {
            var ordered = new Point2f[4];
            var sum = pts.Select(p => p.X + p.Y).ToList();
            var diff = pts.Select(p => p.Y - p.X).ToList();

            ordered[0] = pts[sum.IndexOf(sum.Min())]; // Top-Left
            ordered[2] = pts[sum.IndexOf(sum.Max())]; // Bottom-Right
            ordered[1] = pts[diff.IndexOf(diff.Min())]; // Top-Right
            ordered[3] = pts[diff.IndexOf(diff.Max())]; // Bottom-Left

            return ordered;
        }
    }
}