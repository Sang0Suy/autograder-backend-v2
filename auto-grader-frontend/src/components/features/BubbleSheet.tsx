import React from 'react';

interface QuestionItem {
    order: number;
    questionType: string;
    maxScore: number;
}

interface BubbleSheetProps {
    questions: QuestionItem[];
}

const BubbleSheet: React.FC<BubbleSheetProps> = ({ questions }) => {
    const multipleChoiceQuestions = questions.filter(q => q.questionType === 'MultipleChoice');
    // OpenCV thường đọc tốt nhất với khoảng 30-40 câu/trang để bong bóng không bị quá bé
    const QUESTIONS_PER_PAGE = 30;

    const chunks = [];
    for (let i = 0; i < multipleChoiceQuestions.length; i += QUESTIONS_PER_PAGE) {
        chunks.push(multipleChoiceQuestions.slice(i, i + QUESTIONS_PER_PAGE));
    }

    return (
        // Giao diện khi xem trên màn hình (Có nền xám và đổ bóng). Khi in (print:*) sẽ thành giấy trắng.
        <div className="flex flex-col items-center py-10 bg-slate-200 min-h-screen space-y-12 print:block print:space-y-0 print:p-0 print:bg-white">
            {chunks.map((chunk, pageIndex) => (
                <div
                    key={pageIndex}
                    className="bg-white relative shadow-2xl rounded-sm print:shadow-none print:rounded-none mx-auto border border-slate-300 print:border-none"
                    style={{
                        width: '210mm',
                        height: '296mm',
                        padding: '20mm',
                        pageBreakAfter: 'always',
                        boxSizing: 'border-box'
                    }}
                >
                    {/* 🔥 4 ĐIỂM NEO (ANCHORS) DÀNH RIÊNG CHO OPENCV ĐỌC - TUYỆT ĐỐI KHÔNG ĐỔI MÀU HAY BO GÓC CHỖ NÀY */}
                    <div className="absolute top-6 left-6 w-6 h-6 bg-black" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}></div>
                    <div className="absolute top-6 right-6 w-6 h-6 bg-black" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}></div>
                    <div className="absolute bottom-6 left-6 w-6 h-6 bg-black" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}></div>
                    <div className="absolute bottom-6 right-6 w-6 h-6 bg-black" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}></div>

                    {pageIndex === 0 ? (
                        <>
                            {/* 🔥 ĐÃ ĐỘ GIAO DIỆN IN ẤN: Typography đẹp, cứng cáp, chuyên nghiệp hơn */}
                            <div className="text-center mb-8 mt-2">
                                <h1 className="text-3xl font-black uppercase tracking-widest text-black">Phiếu Trả Lời Trắc Nghiệm</h1>
                                <p className="text-gray-800 mt-2 font-semibold tracking-widest uppercase text-sm border-b-2 border-black inline-block pb-1 px-8">Hệ Thống Chấm Điểm AutoGrader</p>
                            </div>

                            <div className="flex justify-between mb-10 border-2 border-black rounded-lg p-5">
                                <div className="space-y-4 w-1/2">
                                    <p className="font-bold text-lg flex items-end">
                                        <span className="w-24 whitespace-nowrap">Họ và tên:</span>
                                        <span className="flex-1 border-b border-dotted border-gray-500 h-6 mx-2 inline-block"></span>
                                    </p>
                                    <p className="font-bold text-lg flex items-end">
                                        <span className="w-24 whitespace-nowrap">Lớp:</span>
                                        <span className="flex-1 border-b border-dotted border-gray-500 h-6 mx-2 inline-block"></span>
                                    </p>
                                </div>
                                <div className="space-y-4 w-1/3">
                                    <p className="font-bold text-lg flex items-end">
                                        <span className="w-20 whitespace-nowrap">Số BD:</span>
                                        <span className="flex-1 border-b border-dotted border-gray-500 h-6 mx-2 inline-block"></span>
                                    </p>
                                    <p className="font-bold text-lg flex items-end">
                                        <span className="w-20 whitespace-nowrap">Mã Đề:</span>
                                        <span className="flex-1 border-b border-dotted border-gray-500 h-6 mx-2 inline-block"></span>
                                    </p>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex justify-between items-center mb-10 mt-6 border-b-2 border-black pb-4">
                            <p className="font-bold text-gray-500 italic">Phiếu trả lời (Trang {pageIndex + 1})</p>
                            <div className="flex space-x-8">
                                <p className="font-bold text-lg">Mã Đề: <span className="border-b-2 border-dotted border-black w-24 inline-block"></span></p>
                                <p className="font-bold text-lg">SBD: <span className="border-b-2 border-dotted border-black w-32 inline-block"></span></p>
                            </div>
                        </div>
                    )}

                    {/* 🔥 Vùng Câu Hỏi (Bong bóng tròn trịa đều tăm tắp) */}
                    <div className="grid grid-cols-3 gap-x-12 gap-y-7 ml-4">
                        {chunk.map((q) => (
                            <div key={q.order} className="flex items-center justify-between">
                                <span className="font-bold text-lg w-16 text-black">Câu {q.order.toString().padStart(2, '0')}:</span>
                                <div className="flex space-x-3">
                                    {['A', 'B', 'C', 'D'].map((option) => (
                                        <div
                                            key={option}
                                            className="w-8 h-8 rounded-full border-2 border-gray-500 flex items-center justify-center font-bold text-gray-500 text-sm tracking-tighter print:border-black print:text-black"
                                        >
                                            {option}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default BubbleSheet;