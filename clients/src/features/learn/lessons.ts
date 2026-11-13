import type { Lesson } from './types'
import { IRREGULAR_REGION_MAP } from '../../lib/offlineSudoku'

// Nghiệm chuẩn 1: Classic Sudoku 9x9 đã kiểm tra hợp lệ 100%
// 534678912
// 672195348
// 198342567
// 859761423
// 426853791
// 713924856
// 961537284
// 287419635
// 345286179
const STD_SOL =
  '534678912672195348198342567859761423426853791713924856961537284287419635345286179'

// Nghiệm chuẩn 2: Irregular / Shuffle Sudoku đã kiểm tra hợp lệ 100% với IRREGULAR_REGION_MAP
// 741952386
// 326849751
// 685237149
// 417365298
// 562418937
// 893726514
// 179584623
// 958173462
// 234691875
const IRREG_SOL =
  '741952386326849751685237149417365298562418937893726514179584623958173462234691875'

// Helper tạo bàn với các ô giữ lại từ nghiệm
function makeBoard(sol: string, keepIndices: number[]): string {
  const chars = Array(81).fill('.')
  for (const idx of keepIndices) {
    chars[idx] = sol[idx]
  }
  return chars.join('')
}

export const LESSONS: Lesson[] = [
  // ── Bài 1: Luật chơi ──────────────────────────────────────────
  {
    code: 'rules',
    order: 1,
    title: 'Luật chơi',
    summary: 'Hiểu bàn 9×9, hàng, cột, khối 3×3; mỗi vùng có đủ 1–9, không lặp',
    minutes: 3,
    steps: [
      {
        kind: 'explain',
        title: 'Chào mừng bạn đến với Sudoku',
        body:
          'Sudoku là trò chơi giải đố số học hấp dẫn nhất thế giới.\n\n' +
          'Bàn cờ gồm 9 hàng và 9 cột, tổng cộng 81 ô vuông. Mục tiêu của bạn là điền các chữ số từ 1 đến 9 vào các ô trống sao cho tuân thủ đúng 3 quy tắc cơ bản bên dưới.\n\n' +
          'Đặc biệt: bạn không cần tính toán cộng trừ nhân chia, chỉ cần tư duy logic và quan sát!',
        board: {
          cells: makeBoard(STD_SOL, [
            0, 1, 4, 8, 10, 14, 20, 24, 28, 32, 40, 48, 52, 60, 66, 70, 76, 80,
          ]),
        },
      },
      {
        kind: 'explain',
        title: 'Quy tắc 1: Hàng ngang (Row)',
        body:
          'Bàn cờ có 9 hàng ngang (từ trên xuống dưới).\n\n' +
          '- Mỗi hàng ngang phải chứa đầy đủ các chữ số từ 1 đến 9.\n' +
          '- Tuyệt đối KHÔNG có số nào được lặp lại 2 lần trong cùng một hàng.\n\n' +
          'Hãy nhìn hàng trên cùng đang được tô sáng: mỗi ô là một con số duy nhất!',
        board: {
          cells: makeBoard(STD_SOL, [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 20, 30, 40]),
        },
        highlights: [{ type: 'row', targets: [0], tone: 'focus' }],
      },
      {
        kind: 'explain',
        title: 'Quy tắc 2: Cột dọc (Column)',
        body:
          'Tương tự hàng ngang, bàn cờ có 9 cột dọc (từ trái qua phải).\n\n' +
          '- Mỗi cột dọc cũng phải chứa đầy đủ 9 chữ số từ 1 đến 9.\n' +
          '- Không được phép có số trùng lặp trong cùng một cột dọc.',
        board: {
          cells: makeBoard(STD_SOL, [4, 13, 22, 31, 40, 49, 58, 67, 76, 0, 8, 72, 80]),
        },
        highlights: [{ type: 'col', targets: [4], tone: 'focus' }],
      },
      {
        kind: 'explain',
        title: 'Quy tắc 3: Khối 3×3 (Box)',
        body:
          'Bàn 9×9 được chia thành 9 khối vuông nhỏ kích thước 3×3, ngăn cách bởi đường viền đậm.\n\n' +
          '- Mỗi khối 3×3 cũng phải chứa trọn vẹn 9 chữ số từ 1 đến 9 không trùng lặp.\n\n' +
          'Nhớ kỹ: Hàng, Cột và Khối 3×3 đều có chung một quy tắc: Đủ 1–9 và không trùng!',
        board: {
          cells: makeBoard(STD_SOL, [
            30, 31, 32, 39, 40, 41, 48, 49, 50, 0, 8, 72, 80,
          ]),
        },
        highlights: [{ type: 'region', targets: [4], tone: 'focus' }],
      },
      {
        kind: 'exercise',
        title: 'Thực hành: Phát hiện số vi phạm luật',
        prompt:
          'Trong hàng thứ 3 (được tô sáng), có một con số đang bị đặt lặp lại 2 lần, vi phạm quy tắc hàng ngang! Hãy bấm vào con số bị lặp đó.',
        board: {
          // Hàng 2 chuẩn: 1 9 8 3 4 2 5 6 7 (indices 18..26). Ta cố tình thay ô 23 thành 7 (trùng với ô 26)
          cells: (() => {
            const arr = Array(81).fill('.')
            arr[18] = '1'
            arr[19] = '9'
            arr[20] = '8'
            arr[21] = '3'
            arr[22] = '4'
            arr[23] = '7' // Cố tình trùng số 7 với ô 26
            arr[24] = '5'
            arr[25] = '6'
            arr[26] = '7'
            return arr.join('')
          })(),
        },
        task: {
          type: 'pick-cell',
          correctCell: 23,
        },
        hints: [
          'Quan sát hàng thứ 3 (đang được tô sáng màu vàng).',
          'Đếm xem con số nào xuất hiện 2 lần trong hàng này.',
          'Con số 7 xuất hiện ở cuối hàng và ở cột thứ 6. Bấm vào ô số 7 ở cột thứ 6 (ô đang chọn).',
        ],
        successMessage:
          'Chính xác! Trong một hàng không thể có hai số 7. Bạn đã nắm rất vững quy tắc cơ bản!',
        answerExplanation:
          'Ở hàng thứ 3, số 7 xuất hiện ở cả ô thứ 6 và ô thứ 9. Theo luật Sudoku, mỗi hàng chỉ được có đúng 1 số 7.',
      },
    ],
  },

  // ── Bài 2: Ô cuối cùng còn thiếu ──────────────────────────────
  {
    code: 'last-missing',
    order: 2,
    title: 'Ô cuối cùng còn thiếu',
    summary: 'Một vùng thiếu đúng 1 số thì điền ngay',
    minutes: 3,
    steps: [
      {
        kind: 'explain',
        title: 'Kỹ thuật cơ bản nhất: Đếm số còn thiếu',
        body:
          'Khi một hàng, cột hoặc khối đã có sẵn 8 con số, thì ô trống duy nhất còn lại BẮT BUỘC phải là con số còn thiếu từ 1 đến 9.\n\n' +
          'Bạn không cần phải đoán mò hay suy nghĩ phức tạp: chỉ cần đếm từ 1 đến 9 xem số nào chưa xuất hiện!',
        board: {
          cells: makeBoard(STD_SOL, [0, 1, 3, 4, 5, 6, 7, 8]),
        },
        highlights: [
          { type: 'row', targets: [0], tone: 'focus' },
          { type: 'cell', targets: [2], tone: 'target' },
        ],
      },
      {
        kind: 'exercise',
        title: 'Điền ô còn thiếu trong hàng',
        prompt:
          'Hàng trên cùng đã có 8 số: 5, 3, (trống), 6, 7, 8, 9, 1, 2. Hãy tìm con số còn thiếu và điền vào ô trống!',
        board: {
          // Hàng 0 chuẩn: 5, 3, 4, 6, 7, 8, 9, 1, 2. Thiếu ô 2 (giá trị 4)
          cells: makeBoard(STD_SOL, [0, 1, 3, 4, 5, 6, 7, 8]),
        },
        task: {
          type: 'fill-cell',
          answers: { 2: 4 },
        },
        hints: [
          'Liệt kê các số từ 1 đến 9: đã có 1, 2, 3, ?, 5, 6, 7, 8, 9.',
          'Số còn thiếu nằm giữa 3 và 5.',
          'Chọn ô trống và bấm số 4 trên bàn phím số.',
        ],
        successMessage: 'Xuất sắc! 8 số đã có mặt thì ô thứ 9 bắt buộc là số 4.',
        answerExplanation:
          'Hàng 1 đã có đầy đủ 1, 2, 3, 5, 6, 7, 8, 9. Con số duy nhất chưa có trong tập hợp 1–9 là số 4.',
      },
      {
        kind: 'explain',
        title: 'Áp dụng tương tự cho Khối 3×3',
        body:
          'Nguyên tắc này cũng áp dụng hoàn hảo cho một Khối 3×3.\n\n' +
          'Bất cứ khi nào bạn nhìn thấy một khối vuông có 8 ô đã điền và chỉ còn 1 ô trống, hãy đếm ngay để tìm ra con số còn thiếu và hoàn thành khối đó.',
        board: {
          // Khối 0: rows 0,1,2 and cols 0,1,2. Bỏ ô 20 (row 2 col 2, giá trị 8)
          cells: makeBoard(STD_SOL, [0, 1, 2, 9, 10, 11, 18, 19]),
        },
        highlights: [
          { type: 'region', targets: [0], tone: 'focus' },
          { type: 'cell', targets: [20], tone: 'target' },
        ],
      },
      {
        kind: 'exercise',
        title: 'Điền ô còn thiếu trong khối 3×3',
        prompt:
          'Khối vuông 3×3 ở góc trên bên trái đang có 8 số: 5, 3, 4, 6, 7, 2, 1, 9. Hãy tìm và điền con số còn thiếu vào ô trống duy nhất!',
        board: {
          // Khối 0 chuẩn có 8 số, thiếu ô 20 (giá trị 8)
          cells: makeBoard(STD_SOL, [0, 1, 2, 9, 10, 11, 18, 19]),
        },
        task: {
          type: 'fill-cell',
          answers: { 20: 8 },
        },
        hints: [
          'Kiểm tra 9 ô trong khối 3×3 góc trên bên trái.',
          'Đã có các số 1, 2, 3, 4, 5, 6, 7, 9.',
          'Số còn thiếu là số 8. Hãy bấm chọn ô trống và điền số 8.',
        ],
        successMessage:
          'Tuyệt vời! Bạn đã hoàn thành khối 3×3 bằng kỹ thuật Ô cuối cùng còn thiếu.',
        answerExplanation:
          'Trong khối 3×3 trên cùng bên trái, 8 số [1, 2, 3, 4, 5, 6, 7, 9] đã xuất hiện. Số duy nhất còn lại là 8.',
      },
    ],
  },

  // ── Bài 3: Ô duy nhất ẩn (Hidden Single) ───────────────────────
  {
    code: 'hidden-single',
    order: 3,
    title: 'Ô duy nhất ẩn (Hidden Single)',
    summary: 'Chọn một số, loại các ô bị chặn, còn đúng 1 ô thì điền',
    minutes: 4,
    steps: [
      {
        kind: 'explain',
        title: 'Chiếu tia loại trừ (Cross-Hatching)',
        body:
          'Đây là kỹ thuật quan trọng và được sử dụng nhiều nhất trong Sudoku!\n\n' +
          'Khi bạn muốn tìm vị trí của một con số (ví dụ số 5) trong một khối 3×3:\n' +
          '1. Nhìn các hàng và cột xung quanh xem có số 5 nào chưa.\n' +
          '2. Số 5 từ hàng/cột khác sẽ "chiếu tia" chặn toàn bộ hàng hoặc cột đó trong khối của bạn.\n' +
          '3. Nếu trong khối chỉ còn duy nhất 1 ô trống không bị chặn, số 5 chắc chắn phải nằm ở đó!',
        board: {
          cells: makeBoard(STD_SOL, [3, 35, 45, 68]),
        },
        highlights: [
          { type: 'number', targets: [5], tone: 'focus' },
          { type: 'region', targets: [4], tone: 'focus' },
        ],
      },
      {
        kind: 'explain',
        title: 'Quan sát các tia chặn vào Khối giữa',
        body:
          'Hãy nhìn vào Khối giữa (Khối 4):\n\n' +
          '- Hàng 3 có số 5 ở bên phải (ô 35) → chặn 3 ô hàng 3 của khối giữa.\n' +
          '- Hàng 5 có số 5 ở bên trái (ô 45) → chặn 3 ô hàng 5 của khối giữa.\n' +
          '- Cột 3 có số 5 ở trên (ô 3) → chặn ô bên trái hàng 4.\n' +
          '- Cột 5 có số 5 ở dưới (ô 68) → chặn ô bên phải hàng 4.\n\n' +
          'Kết quả: Khối giữa chỉ còn đúng 1 ô ở chính tâm (ô 40) chưa bị chặn!',
        board: {
          cells: makeBoard(STD_SOL, [3, 35, 45, 68]),
        },
        highlights: [
          { type: 'cell', targets: [30, 31, 32, 48, 49, 50, 39, 41], tone: 'block' },
          { type: 'cell', targets: [40], tone: 'target' },
        ],
      },
      {
        kind: 'exercise',
        title: 'Loại trừ các ô bị chặn bởi số 5',
        prompt:
          'Trong khối giữa, số 5 ở hàng 3 và hàng 5 chiếu qua làm chặn 6 ô. Hãy bấm vào các ô bị số 5 chặn (hàng 3 và hàng 5 của khối giữa) để loại trừ!',
        board: {
          cells: makeBoard(STD_SOL, [35, 45]),
        },
        task: {
          type: 'eliminate',
          number: 5,
          blockedCells: [30, 31, 32, 48, 49, 50],
        },
        hints: [
          'Hàng 3 có số 5 (bên phải), nên cả 3 ô ở hàng 3 trong khối giữa không thể đặt số 5.',
          'Hàng 5 có số 5 (bên trái), nên cả 3 ô ở hàng 5 trong khối giữa cũng bị chặn.',
          'Bấm vào các ô ở hàng 3 và hàng 5 thuộc khối trung tâm.',
        ],
        successMessage: 'Chính xác! 6 ô đó đã bị loại trừ hoàn toàn đối với số 5.',
        answerExplanation:
          'Quy tắc hàng ngang không cho phép có 2 số 5, nên các ô cùng hàng 3 và 5 với số 5 đều bị loại.',
      },
      {
        kind: 'exercise',
        title: 'Điền số duy nhất ẩn (Hidden Single)',
        prompt:
          'Bây giờ, với các ô bị chặn đã rõ, ô chính giữa (hàng 4, cột 4) là vị trí duy nhất trong khối có thể đặt số 5. Hãy điền số 5 vào ô này!',
        board: {
          cells: makeBoard(STD_SOL, [3, 35, 45, 68, 39, 41]),
        },
        task: {
          type: 'fill-cell',
          answers: { 40: 5 },
        },
        hints: [
          'Chỉ còn lại đúng 1 ô trống ở chính tâm khối giữa chưa bị chặn.',
          'Chọn ô ở hàng 4 cột 4 và điền số 5.',
        ],
        successMessage:
          'Quá đỉnh! Đó chính là Hidden Single: dù ô đó còn có thể chứa số khác, nhưng số 5 chỉ có thể đặt ở đây.',
        answerExplanation:
          'Trong khối trung tâm, mọi ô khác đều bị số 5 ở các hàng và cột chiếu chặn. Ô tâm là nơi duy nhất số 5 có thể đứng.',
      },
      {
        kind: 'explain',
        title: 'Bí quyết ghi nhớ Hidden Single',
        body:
          'Công thức nằm lòng:\n\n' +
          '1. Chọn một con số xuất hiện nhiều lần trên bàn (ví dụ số 5).\n' +
          '2. Chiếu các đường ngang và dọc đi qua con số đó.\n' +
          '3. Tìm khối 3×3 còn thiếu số đó và quan sát xem chỉ còn 1 ô nào không bị chặn.\n\n' +
          'Luyện tập kỹ thuật này sẽ giúp bạn điền được 80% các ô trong ván chơi cơ bản!',
        board: {
          cells: makeBoard(STD_SOL, [3, 35, 40, 45, 68]),
        },
        highlights: [{ type: 'number', targets: [5], tone: 'focus' }],
      },
    ],
  },

  // ── Bài 4: Ô duy nhất trần (Naked Single) ──────────────────────
  {
    code: 'naked-single',
    order: 4,
    title: 'Ô duy nhất trần (Naked Single)',
    summary: 'Nhìn 1 ô, loại số đã có ở hàng/cột/khối, còn đúng 1 ứng viên thì điền',
    minutes: 4,
    steps: [
      {
        kind: 'explain',
        title: 'Khác biệt giữa Naked Single và Hidden Single',
        body:
          '- Hidden Single: Bạn chọn 1 con số, rồi tìm xem trong một khối số đó phải vào ô nào.\n' +
          '- Naked Single: Bạn chọn 1 ô trống cụ thể, rồi nhìn xem xung quanh ô đó (hàng, cột, khối) đã có những số nào.\n\n' +
          'Nếu xung quanh ô đó đã có đủ 8 số khác nhau từ 1 đến 9, thì ô đó "trần trụi" chỉ còn đúng 1 ứng viên duy nhất còn lại!',
        board: {
          // Ô 10 (row 1, col 1): hàng 1, cột 1, khối 0
          cells: makeBoard(STD_SOL, [0, 1, 2, 9, 11, 18, 19, 20, 28, 46, 64, 73]),
        },
        highlights: [{ type: 'cell', targets: [10], tone: 'target' }],
      },
      {
        kind: 'explain',
        title: 'Quan sát hàng, cột và khối của ô đích',
        body:
          'Hãy nhìn vào ô đích (hàng 1, cột 1 - đang được tô viền xanh lá):\n\n' +
          '- Hàng 1 đã có: 6, 2, 1, 9, 5, 3, 4, 8 (đủ các số trừ 7).\n' +
          '- Các ô xung quanh đã "tiêu diệt" hết các khả năng từ 1 đến 9 trừ số 7.\n' +
          '- Do đó, ô này chỉ có một khả năng duy nhất là số 7!',
        board: {
          // Đặt các số xung quanh ô 10: giá trị của ô 10 trong STD_SOL là 7
          cells: makeBoard(STD_SOL, [0, 1, 2, 9, 11, 12, 13, 14, 15, 16, 17]),
        },
        highlights: [
          { type: 'row', targets: [1], tone: 'focus' },
          { type: 'cell', targets: [10], tone: 'target' },
        ],
      },
      {
        kind: 'exercise',
        title: 'Tìm ứng viên duy nhất',
        prompt:
          'Quan sát ô đích (hàng 1, cột 1). Xung quanh ô này đã có các số 1, 2, 3, 4, 5, 6, 8, 9. Ứng viên duy nhất còn sót lại của ô này là số mấy?',
        board: {
          cells: makeBoard(STD_SOL, [0, 1, 2, 9, 11, 12, 13, 14, 15, 16, 17]),
        },
        task: {
          type: 'pick-candidates',
          cell: 10,
          correct: [7],
        },
        hints: [
          'Kiểm tra hàng 1: đã có 6, 2, 1, 9, 5, 3, 4, 8.',
          'Số nào từ 1 đến 9 chưa xuất hiện trong hàng này?',
          'Bật chế độ ghi chú và chọn số 7 cho ô đích.',
        ],
        successMessage: 'Chính xác! Ô này chỉ có duy nhất 1 ứng viên hợp lệ là số 7.',
        answerExplanation:
          'Vì hàng 1 đã chứa tất cả các số 1, 2, 3, 4, 5, 6, 8, 9, ô này không thể nhận bất kỳ số nào khác ngoài 7.',
      },
      {
        kind: 'exercise',
        title: 'Điền số Naked Single',
        prompt: 'Bây giờ hãy điền con số 7 vào ô đích để hoàn thành bài tập!',
        board: {
          cells: makeBoard(STD_SOL, [0, 1, 2, 9, 11, 12, 13, 14, 15, 16, 17]),
        },
        task: {
          type: 'fill-cell',
          answers: { 10: 7 },
        },
        hints: ['Chọn ô hàng 1, cột 1 và bấm số 7 trên bàn phím.'],
        successMessage: 'Tuyệt hảo! Bạn đã nắm chắc kỹ thuật Naked Single.',
        answerExplanation: 'Điền 7 vào ô 10 hoàn thiện hàng 1 với đủ 9 chữ số từ 1 đến 9.',
      },
    ],
  },

  // ── Bài 5: Ghi chú ứng viên ───────────────────────────────────
  {
    code: 'pencil-marks',
    order: 5,
    title: 'Ghi chú ứng viên',
    summary: 'Dùng ghi chú để theo dõi ứng viên, xóa dần khi điền số',
    minutes: 3,
    steps: [
      {
        kind: 'explain',
        title: 'Tại sao cần ghi chú (Pencil Marks)?',
        body:
          'Khi giải các ván Sudoku từ mức độ trung bình trở lên, sẽ có những ô chưa thể xác định ngay là số nào (ví dụ ô này chỉ có thể là 3 hoặc 8).\n\n' +
          'Thay vì cố nhớ trong đầu dễ bị nhầm lẫn, người chơi chuyên nghiệp sử dụng Ghi chú (bút chì) để viết các số ứng viên nhỏ vào ô.\n\n' +
          'Mỗi ô có thể chứa nhiều ghi chú nhỏ hiển thị theo lưới 3×3.',
        board: {
          cells: makeBoard(STD_SOL, [0, 2, 9, 10, 11, 18, 19, 20]),
          candidates: {
            1: [3, 8],
          },
        },
        highlights: [{ type: 'cell', targets: [1], tone: 'target' }],
      },
      {
        kind: 'explain',
        title: 'Ghi chú tự động loại trừ',
        body:
          'Khi bạn đã ghi chú các ứng viên cho một ô:\n\n' +
          'Bất cứ khi nào có một con số mới được điền vào cùng hàng, cột hoặc khối, ứng viên đó sẽ bị loại bỏ khỏi danh sách ghi chú!\n\n' +
          'Khi một ô ghi chú chỉ còn lại đúng 1 con số, bạn có thể tự tin điền số đó ngay lập tức.',
        board: {
          cells: makeBoard(STD_SOL, [0, 2, 9, 10, 11, 18, 19, 20]),
          candidates: {
            1: [3, 8],
            3: [1, 6],
          },
        },
      },
      {
        kind: 'exercise',
        title: 'Tập ghi chú ứng viên',
        prompt:
          'Hãy bật chế độ Ghi chú (bấm nút ✏️ Ghi chú bên dưới hoặc phím N). Sau đó chọn ô trống (hàng 0, cột 1) và ghi 2 ứng viên là số 3 và số 8!',
        board: {
          cells: makeBoard(STD_SOL, [0, 2, 9, 10, 11, 18, 19, 20]),
        },
        task: {
          type: 'pick-candidates',
          cell: 1,
          correct: [3, 8],
        },
        hints: [
          'Bấm nút ✏️ Ghi chú (hoặc phím N) để chuyển sang chế độ bút chì.',
          'Chọn ô ở hàng 0 cột 1 (ô đang được tô viền).',
          'Bấm số 3, sau đó bấm số 8.',
        ],
        successMessage: 'Rất tốt! Ô đã hiển thị 2 ứng viên nhỏ 3 và 8.',
        answerExplanation:
          'Chế độ ghi chú cho phép bạn lưu vết các con số khả dĩ mà không làm ảnh hưởng tới bàn cờ.',
      },
      {
        kind: 'exercise',
        title: 'Điền số khi ứng viên bị loại bỏ',
        prompt:
          'Cột 1 đã có số 8 xuất hiện ở bên dưới! Ứng viên 8 bị loại bỏ, chỉ còn lại số 3. Hãy tắt chế độ ghi chú và điền số 3 vào ô này!',
        board: {
          // Thêm số 8 ở ô 73 (hàng 8 col 1) để loại trừ 8
          cells: makeBoard(STD_SOL, [0, 2, 9, 10, 11, 18, 19, 20, 73]),
          candidates: {
            1: [3],
          },
        },
        task: {
          type: 'fill-cell',
          answers: { 1: 3 },
        },
        hints: [
          'Tắt nút ghi chú hoặc dùng phím số thông thường.',
          'Bấm chọn ô hàng 0 cột 1 và điền số 3.',
        ],
        successMessage:
          'Hoàn hảo! Ghi chú giúp tư duy của bạn luôn rõ ràng và không bao giờ bị sót nước đi.',
        answerExplanation:
          'Do cột 1 đã có số 8 ở hàng dưới cùng, ô 1 chỉ còn lại khả năng duy nhất là số 3.',
      },
    ],
  },

  // ── Bài 6: Quét và quy trình giải ─────────────────────────────
  {
    code: 'scan-workflow',
    order: 6,
    title: 'Quét và quy trình giải',
    summary: 'Thói quen: quét khối → quét hàng/cột → ghi chú → quay lại quét',
    minutes: 4,
    steps: [
      {
        kind: 'explain',
        title: 'Quy trình giải bài bản của cao thủ Sudoku',
        body:
          'Để không bị lạc lối giữa 81 ô cờ, hãy rèn luyện thói quen theo 4 bước tuần hoàn sau:\n\n' +
          '1. Quét theo số (Hidden Single): Đi lần lượt từ 1 đến 9, số nào có nhiều trên bàn thì dùng chiếu tia tìm ô trong các khối.\n' +
          '2. Quét vùng gần đầy (Last Missing): Xem hàng, cột hay khối nào đã có 7–8 số thì giải ngay.\n' +
          '3. Ghi chú ứng viên: Điền ghi chú cho các ô chỉ còn 2 ứng viên.\n' +
          '4. Lặp lại chu trình: Mỗi khi có một số mới được điền, hãy quay lại bước 1 với con số đó!',
        board: {
          cells: makeBoard(STD_SOL, [
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 18, 27, 36, 45, 54, 63, 72,
          ]),
        },
      },
      {
        kind: 'explain',
        title: 'Nhận diện mục tiêu dễ ăn nhất',
        body:
          'Khi nhìn vào một bàn cờ, đừng vội điền vào các khối còn quá trống.\n\n' +
          'Hãy tìm các hàng hoặc cột chỉ còn đúng 1 hoặc 2 ô trống. Đó là những mục tiêu dễ nhất để tạo đà giải quyết toàn bộ bàn cờ!',
        board: {
          // Hàng 8 (indices 72..80) có 8 số, chỉ thiếu ô 80 (giá trị 9)
          cells: makeBoard(STD_SOL, [72, 73, 74, 75, 76, 77, 78, 79]),
        },
        highlights: [
          { type: 'row', targets: [8], tone: 'focus' },
          { type: 'cell', targets: [80], tone: 'target' },
        ],
      },
      {
        kind: 'exercise',
        title: 'Thực hành quét: Tìm ô dễ nhất',
        prompt:
          'Quan sát toàn bộ bàn cờ. Bấm vào ô mà theo quy trình quét bạn có thể giải được ngay lập tức mà không cần suy đoán!',
        board: {
          // Bàn cờ rải rác nhưng hàng 8 có đủ 8 số (72..79), thiếu ô 80 (giá trị 9)
          cells: makeBoard(STD_SOL, [
            0, 4, 8, 10, 20, 30, 40, 50, 60, 70, 72, 73, 74, 75, 76, 77, 78, 79,
          ]),
        },
        task: {
          type: 'pick-cell',
          correctCell: 80,
        },
        hints: [
          'Quét nhanh 9 hàng ngang xem hàng nào gần đầy nhất.',
          'Hàng dưới cùng (hàng 8) đã có tới 8 con số!',
          'Hãy bấm vào ô trống duy nhất ở góc dưới cùng bên phải.',
        ],
        successMessage: 'Rất tinh mắt! Đó là ô Last Missing có thể giải ngay lập tức.',
        answerExplanation:
          'Hàng 8 đã có 8 số, chỉ còn thiếu 1 ô ở cột 8. Đây là ô dễ nhất để bắt đầu giải.',
      },
      {
        kind: 'exercise',
        title: 'Điền số giải quyết ô đó',
        prompt:
          'Hàng dưới cùng có: 3, 4, 5, 2, 8, 6, 1, 7. Hãy xác định số còn thiếu và điền vào ô góc dưới cùng bên phải!',
        board: {
          cells: makeBoard(STD_SOL, [
            0, 4, 8, 10, 20, 30, 40, 50, 60, 70, 72, 73, 74, 75, 76, 77, 78, 79,
          ]),
        },
        task: {
          type: 'fill-cell',
          answers: { 80: 9 },
        },
        hints: [
          'Đếm từ 1 đến 9 trong hàng dưới cùng.',
          'Đã có 1, 2, 3, 4, 5, 6, 7, 8.',
          'Số còn thiếu là 9. Điền số 9 vào ô 80.',
        ],
        successMessage: 'Chính xác! Một con số được điền sẽ mở đường cho các số tiếp theo.',
        answerExplanation:
          'Điền 9 vào ô 80 giúp hoàn thiện hàng 8, đồng thời bổ sung thêm số 9 cho cột 8 và khối 8.',
      },
      {
        kind: 'explain',
        title: 'Tự tin bước vào ván đấu',
        body:
          'Bạn đã có trong tay chiếc chìa khóa vạn năng:\n\n' +
          '- Luôn bình tĩnh quét số từ 1 đến 9.\n' +
          '- Không đoán mò — mỗi ô số đều có lý do logic đằng sau nó.\n' +
          '- Tận dụng ghi chú khi gặp thế cờ khó.\n\n' +
          'Chúc bạn luôn có những giây phút giải đố thật sảng khoái!',
        board: {
          cells: makeBoard(STD_SOL, [
            0, 1, 2, 10, 11, 20, 30, 40, 50, 60, 70, 72, 73, 74, 75, 76, 77, 78, 79, 80,
          ]),
        },
      },
    ],
  },

  // ── Bài 7: Chơi biến thể Shuffle (Jigsaw) ──────────────────────
  {
    code: 'shuffle',
    order: 7,
    title: 'Chơi biến thể Shuffle',
    summary:
      'Vùng có hình dạng bất kỳ (không phải khối 3×3), kỹ thuật vẫn như cũ nhưng đổi "khối" thành "vùng"',
    minutes: 4,
    steps: [
      {
        kind: 'explain',
        title: 'Biến thể Shuffle (Jigsaw Sudoku) là gì?',
        body:
          'Trong biến thể Shuffle, bàn cờ 9×9 không còn chia thành các khối vuông 3×3 quen thuộc nữa!\n\n' +
          'Thay vào đó, bàn cờ được chia thành 9 vùng có hình dạng bất kỳ (uốn lượn như mảnh ghép xếp hình Jigsaw).\n\n' +
          'Mỗi vùng được phân biệt bằng màu sắc riêng biệt và ranh giới viền đậm.',
        board: {
          cells: makeBoard(IRREG_SOL, [0, 4, 8, 12, 24, 36, 48, 60, 72, 80]),
          regions: IRREGULAR_REGION_MAP,
        },
      },
      {
        kind: 'explain',
        title: 'Quy tắc vàng: Không hề thay đổi!',
        body:
          'Dù hình dạng vùng có biến đổi thế nào, luật chơi vẫn hoàn toàn giữ nguyên:\n\n' +
          '- Mỗi hàng ngang: Đủ 1 đến 9 không lặp.\n' +
          '- Mỗi cột dọc: Đủ 1 đến 9 không lặp.\n' +
          '- MỖI VÙNG HÌNH DẠNG BẤT KỲ: Cũng có đúng 9 ô, và phải chứa đủ các số từ 1 đến 9 không trùng lặp!\n\n' +
          'Tất cả các kỹ thuật bạn đã học (Last Missing, Hidden Single, Naked Single) vẫn áp dụng 100%, chỉ cần đổi khái niệm "khối 3×3" thành "vùng màu"!',
        board: {
          cells: makeBoard(IRREG_SOL, [0, 1, 2, 4, 5, 6, 7, 8]),
          regions: IRREGULAR_REGION_MAP,
        },
        highlights: [{ type: 'region', targets: [0], tone: 'focus' }],
      },
      {
        kind: 'explain',
        title: 'Nhận diện vùng uốn lượn',
        body:
          'Hãy nhìn vào Vùng 0 (đang được tô sáng ở góc trên bên trái):\n\n' +
          'Vùng này uốn cong qua 2 hàng: gồm 5 ô ở hàng trên và 4 ô ở hàng dưới, tổng cộng đúng 9 ô vuông.\n\n' +
          'Nếu vùng này đã có sẵn 8 số, ô trống duy nhất còn lại chắc chắn là số còn thiếu!',
        board: {
          // Vùng 0 trong IRREGULAR_REGION_MAP là: ô 0,1,2,3,4 (hàng 0) và 9,10,11,12 (hàng 1)
          // Giá trị chuẩn trong IRREG_SOL: ô 0:7, 1:4, 2:1, 3:9, 4:5, 9:3, 10:2, 11:6, 12:8
          // Bỏ ô 3 (giá trị 9)
          cells: makeBoard(IRREG_SOL, [0, 1, 2, 4, 9, 10, 11, 12]),
          regions: IRREGULAR_REGION_MAP,
        },
        highlights: [
          { type: 'region', targets: [0], tone: 'focus' },
          { type: 'cell', targets: [3], tone: 'target' },
        ],
      },
      {
        kind: 'exercise',
        title: 'Điền ô còn thiếu trong vùng Shuffle',
        prompt:
          'Vùng uốn lượn màu xanh lam (vùng 0) đã có 8 số: 7, 4, 1, 5, 3, 2, 6, 8. Hãy tìm con số còn thiếu và điền vào ô trống (hàng 0, cột 3)!',
        board: {
          cells: makeBoard(IRREG_SOL, [0, 1, 2, 4, 9, 10, 11, 12]),
          regions: IRREGULAR_REGION_MAP,
        },
        task: {
          type: 'fill-cell',
          answers: { 3: 9 },
        },
        hints: [
          'Đếm các số thuộc vùng màu xanh lam (vùng 0).',
          'Đã có: 1, 2, 3, 4, 5, 6, 7, 8.',
          'Số còn thiếu duy nhất là 9. Điền số 9 vào ô trống.',
        ],
        successMessage:
          'Chính xác! Bạn đã chinh phục thành công biến thể Shuffle (Jigsaw Sudoku)!',
        answerExplanation:
          'Trong vùng màu xanh lam gồm 9 ô, 8 số từ 1 đến 8 đã có mặt. Ô trống bắt buộc là số 9.',
      },
      {
        kind: 'explain',
        title: 'Chúc mừng bạn đã hoàn thành khóa học!',
        body:
          '🎉 Bạn đã hoàn thành xuất sắc tất cả 7 bài học kỹ thuật Sudoku!\n\n' +
          'Từ luật chơi cơ bản, các kỹ thuật tìm kiếm ô duy nhất (Last Missing, Hidden Single, Naked Single), kỹ năng ghi chú ứng viên, quy trình quét chuyên nghiệp cho đến biến thể Shuffle phức tạp.\n\n' +
          'Bây giờ, bạn đã hoàn toàn sẵn sàng bước vào ván đấu đầu tiên. Chúc bạn có những chiến thắng rực rỡ!',
        board: {
          cells: makeBoard(IRREG_SOL, [
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
          ]),
          regions: IRREGULAR_REGION_MAP,
        },
      },
    ],
  },
]

