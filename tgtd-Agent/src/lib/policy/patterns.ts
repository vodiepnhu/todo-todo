/** Curated v1 lists — EN + light VI. Keep short; expand via tests. */

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
  /\b(save|execute|run)\b.*\b(without|bypass|skip)\b.*\b(confirm|approval|safety)\b/i,
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

export function matchesUnsafe(text: string): boolean {
  return UNSAFE.some((re) => re.test(text));
}

export function matchesOffDomain(text: string): boolean {
  return OFF_DOMAIN.some((re) => re.test(text));
}

export function matchesAppHelp(text: string): boolean {
  return APP_HELP.some((re) => re.test(text));
}
