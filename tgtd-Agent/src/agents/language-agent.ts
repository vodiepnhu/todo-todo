export type Language = "en" | "vi";

const VI_WORDS = /\b(thêm|tạo|xóa|sửa|đổi|hoạt động|dự án|hôm nay|ngày mai|lịch sử|gợi ý|giúp|lưu|xem|đi|vào|với|cho|của|tôi|them|tao|xoa|sua|du an|hoat dong|hom nay|ngay mai|lich su|goi y|giup|luu|toi)\b/i;
const VI_DIACRITICS = /[ăâđêôơưĂÂĐÊÔƠƯáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/u;

export function detectLanguage(message: string): Language {
  if (VI_DIACRITICS.test(message) || VI_WORDS.test(message)) return "vi";
  return "en";
}

export async function runLanguageAgent(input: { message: string }): Promise<{ language: Language }> {
  return { language: detectLanguage(input.message) };
}
