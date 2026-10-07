/** Curated v1 lists — EN + light VI. Keep short; expand via tests. */
// ponytail: regex-only ceiling; upgrade to a dedicated safety classifier when cases outgrow curated patterns.

const UNSAFE: RegExp[] = [
  /\b(kill\s+myself|suicide|self[-\s]?harm)\b/i,
  /\b(how\s+to\s+)?(build|make)\s+(a\s+)?bomb\b/i,
  /\b(weapon|firearm|gun)\s+(for|to)\s+(kill|attack)\b/i,
  /\b(hack|exploit)\s+(into|someone|password|account)\b/i,
  /\b(child\s+porn|csam|underage\s+sex)\b/i,
  /\b(bio[-\s]?weapon|weaponize\s+(a\s+)?(virus|pathogen))\b/i,
  /\b(tu\s+tu[aâ]t|tự\s+tử)\b/i,
  /\b(ignore\s+(all\s+)?previous\s+instructions|system\s+override|ignore\s+policy[-\s]?agent)\b/i,
  /\b(reveal|show|print)\s+(your\s+)?system\s+prompt\b/i,
  /\b(act\s+as\s+admin|access\s+another\s+(user|workspace|project))\b/i,
  /\b(bỏ\s+qua\s+(?:mọi\s+)?hướng\s+dẫn\s+(?:trước|trước\s+đó)|bỏ\s+qua\s+hướng\s+dẫn\s+hệ\s+thống)\b/i,
  /\b(?:tiết\s+lộ|cho\s+(?:tôi|mình)\s+xem)\s+(?:your\s+)?(?:system\s+prompt|prompt\s+hệ\s+thống)\b/i,
  /\b(?:đóng\s+vai\s+admin|truy\s+cập\s+(?:project|dự\s+án|workspace)\s+(?:của\s+)?(?:người\s+dùng\s+)?khác)\b/i,
  /\b(?:lưu|thực\s+thi|chạy)\b[^.!?\n]*\b(?:không\s+cần|bỏ\s+qua|không\s+qua)\b[^.!?\n]*\b(?:xác\s+nhận|phê\s+duyệt|an\s+toàn)\b/i,
];

const CONFIRMATION_BYPASS =
  /\b(save|execute|run)\b[^.!?\n]*\b(without|bypass|skip)\b[^.!?\n]*\b(confirm(?:ation)?|approval|safety)\b/i;
const SAFETY_PRESERVING_CONFIRMATION =
  /\b(?:do\s+not|don't|never|not)\s+(?:save|execute|run)\b[^.!?;\n]*\b(?:without|bypass|skip)\b[^.!?;\n]*\b(?:confirm(?:ation)?|approval|safety)\b/i;
const NEGATED_JAILBREAK: RegExp[] = [
  /\b(?:do\s+not|don't|never|not)\s+(?:ignore\s+(?:all\s+)?previous\s+instructions|system\s+override|ignore\s+policy[-\s]?agent)\b/gi,
  /\b(?:do\s+not|don't|never|not)\s+(?:reveal|show|print)\s+(?:your\s+)?system\s+prompt\b/gi,
  /\b(?:do\s+not|don't|never|not)\s+(?:act\s+as\s+admin|access\s+another\s+(?:user|workspace|project))\b/gi,
];

const OFF_DOMAIN: RegExp[] = [
  /\b(write|generate)\s+(me\s+)?(an?\s+)?(python|javascript|code|essay|poem)\b/i,
  /\b(math\s+homework|solve\s+for\s+x)\b/i,
  /\b(news\s+today|latest\s+news)\b/i,
  /\btell\s+me\s+a\s+joke\b/i,
  /\b(chitchat|who\s+will\s+win\s+the\s+election)\b/i,
  /\b(viết\s+code|làm\s+bài\s+toán)\b/i,
];

const APP_HELP: RegExp[] = [
  /^\s*help\s*$/i,
  /\bwhat\s+can\s+you\s+do\b/i,
  /\bhow\s+(do\s+i|to)\s+(add|create|update|delete|use)\b/i,
  /\bhelp\s+with\s+(todo|togo|planner|@?planner)\b/i,
  /\b@planner\b/i,
  /\b(làm\s+sao|hướng\s+dẫn).*(todo|togo|planner)\b/i,
];
const GREETING = /^\s*(?:hi|hello|hey|yo|good\s+(?:morning|afternoon|evening)|chào(?:\s+bạn)?|xin\s+chào)\s*[!.?]*$/i;
const APP_ACTION =
  /\b(?:add|save|create|plan|schedule|remind|put|delete|remove|update|change|log|thêm|lưu|tạo|lập\s+kế\s+hoạch|nhắc|xóa|sửa|đổi)\b/i;

function normalizeGreeting(text: string): string {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase()
    .trim()
    .replace(/[!.?,。！？]+$/gu, "")
    .replace(/(.)\1+$/u, "$1");
}

export function matchesUnsafe(text: string): boolean {
  const candidate = NEGATED_JAILBREAK.reduce(
    (value, re) => value.replace(re, " "),
    text,
  );
  if (UNSAFE.some((re) => re.test(candidate))) return true;
  const actionable = candidate.replace(SAFETY_PRESERVING_CONFIRMATION, " ");
  return CONFIRMATION_BYPASS.test(actionable);
}

export function matchesOffDomain(text: string): boolean {
  return OFF_DOMAIN.some((re) => re.test(text));
}

export function matchesAppHelp(text: string): boolean {
  return matchesGreeting(text) || APP_HELP.some((re) => re.test(text));
}

export function matchesGreeting(text: string): boolean {
  return GREETING.test(normalizeGreeting(text));
}

export function matchesAppAction(text: string): boolean {
  return APP_ACTION.test(text);
}
