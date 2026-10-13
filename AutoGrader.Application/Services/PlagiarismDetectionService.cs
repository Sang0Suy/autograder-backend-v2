using System;
using System.Collections.Generic;
using System.Linq;

namespace AutoGrader.Application.Services
{
    public class PlagiarismDetectionService
    {
        // Thuật toán Jaccard đo độ giống nhau giữa 2 đoạn văn bản (trả về 0.0 đến 1.0)
        public double CalculateSimilarity(string text1, string text2)
        {
            if (string.IsNullOrWhiteSpace(text1) || string.IsNullOrWhiteSpace(text2))
                return 0.0;

            // Tách từ, chuyển thành chữ thường, loại bỏ khoảng trắng dư thừa
            var tokens1 = text1.ToLower().Split(new[] { ' ', '.', ',', '\n' }, StringSplitOptions.RemoveEmptyEntries).ToHashSet();
            var tokens2 = text2.ToLower().Split(new[] { ' ', '.', ',', '\n' }, StringSplitOptions.RemoveEmptyEntries).ToHashSet();

            var intersectionCount = tokens1.Intersect(tokens2).Count();
            var unionCount = tokens1.Union(tokens2).Count();

            return unionCount == 0 ? 0 : (double)intersectionCount / unionCount;
        }
    }
}