"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

export type Locale = "en" | "vi";

export type Dictionary = {
  localeLabel: string;
  nav: { dashboard: string; chat: string; lists: string; settings: string; allProjects: string; project: string; add: string };
  home: { sharedPlanner: string; projects: string; todaySummary: string; account: string; today: string; nothingDue: string; addActivity: string; myProjects: string; sharedWithMe: string; newProject: string; createProject: string; cancel: string; next: string; noUpcoming: string };
  auth: { welcomeBack: string; signInSpace: string; email: string; emailOrDemo: string; password: string; forgotPassword: string; signIn: string; signingIn: string; noAccount: string; signUp: string; joinPlanner: string; createAccount: string; displayName: string; passwordChars: string; creating: string; signUpWithGoogle: string; haveAccount: string };
  account: { personal: string; aiProvider: string; agentOps: string; home: string };
  settings: { personal: string; personalDescription: string; openPersonal: string; project: string; projectDescription: string; name: string; description: string; tags: string; saveProject: string; sharing: string; sharedDescription: string; privateDescription: string; private: string; shared: string; members: string; accountEmail: string; createInvite: string; createViewLink: string; viewLinkDescription: string; search: string; searchItems: string; dangerZone: string; deleteDescription: string; projectName: string; deleteProject: string; signOut: string };
  chat: {
    title: string;
    empty: string;
    plannerPlaceholder: string;
    askPlanner: string;
    sending: string;
    saved: string;
    confirm: string;
    planDraft: { title: string; saved: string; saving: string; confirm: string; missing: string; foodToTry: string; category: string; tags: string; preparation: string; activities: string; travel: string; experience: string; todos: string; costs: string; notes: string };
    progress: { title: string; understand: string; context: string; places: string; draft: string; check: string; save: string };
  };
};

const dictionaries: Record<Locale, Dictionary> = {
  en: {
    localeLabel: "English",
    nav: { dashboard: "Dashboard", chat: "Chat", lists: "Lists", settings: "Settings", allProjects: "← All projects", project: "Project", add: "Add" },
    home: { sharedPlanner: "Shared Planner", projects: "Projects", todaySummary: "Today, projects, and cross-project chat in one place.", account: "Account", today: "Today", nothingDue: "Nothing due today", addActivity: "Add Activity", myProjects: "My wishlist", sharedWithMe: "Shared with me", newProject: "New project", createProject: "Create project", cancel: "Cancel", next: "Next", noUpcoming: "No upcoming" },
    auth: { welcomeBack: "Welcome back", signInSpace: "Sign in to your shared space", email: "Email", emailOrDemo: "Email or demo", password: "Password", forgotPassword: "Forgot password?", signIn: "Sign in", signingIn: "Signing in...", noAccount: "No account?", signUp: "Sign up", joinPlanner: "Join Planner", createAccount: "Create an account for shared planning.", displayName: "Display name", passwordChars: "Password", creating: "Creating...", signUpWithGoogle: "Sign up with Google", haveAccount: "Have an account?" },
    account: { personal: "Personal", aiProvider: "AI Provider", agentOps: "Agent Ops", home: "← Home" },
    settings: { personal: "Personal", personalDescription: "Profile, LLM keys, and Agent Ops live on your personal page.", openPersonal: "Open Personal →", project: "This project", projectDescription: "Edit name, description, and appearance. Save to rename.", name: "Name", description: "Description", tags: "Tags (comma-separated)", saveProject: "Save changes", sharing: "Sharing", sharedDescription: "This project is shared. Invite accounts with permissions or create a public view-only link.", privateDescription: "This project is private. Enable sharing to invite accounts or create a public view-only link.", private: "Private", shared: "Shared", members: "Members", accountEmail: "Account email", createInvite: "Create invite link", createViewLink: "Create view-only link", viewLinkDescription: "Anyone with this link can view activities without an account. They cannot change the project.", search: "Search", searchItems: "Search items…", dangerZone: "Danger zone", deleteDescription: "Permanently delete this project and all of its data. Owner only. Type the project name to confirm.", projectName: "Project name", deleteProject: "Delete project", signOut: "Sign out" },
    chat: { title: "Chat", empty: "Say hi, or ask Planner:", plannerPlaceholder: "Ask Planner… (Shift+Enter for newline)", askPlanner: "Ask Planner", sending: "Sending…", saved: "Saved", confirm: "Confirm", planDraft: { title: "Plan draft", saved: "Saved plan", saving: "Saving plan…", confirm: "Confirm plan", missing: "Missing information:", foodToTry: "Food to try:", category: "Category", tags: "Tags", preparation: "Preparation", activities: "Activities", travel: "Travel", experience: "Experience", todos: "To-dos", costs: "Costs", notes: "Notes" }, progress: { title: "Planner is plotting...", understand: "Reading your mind", context: "Checking project gossip", places: "Summoning useful places", draft: "Making it look intentional", check: "Preventing future-you complaints", save: "Awaiting royal approval" } },
  },
  vi: {
    localeLabel: "Tiếng Việt",
    nav: { dashboard: "Tổng quan", chat: "Trò chuyện", lists: "Danh sách", settings: "Cài đặt", allProjects: "← Tất cả dự án", project: "Dự án", add: "Thêm" },
    home: { sharedPlanner: "Planner chung", projects: "Dự án", todaySummary: "Theo dõi hôm nay, các dự án và cuộc trò chuyện ở cùng một nơi.", account: "Tài khoản", today: "Hôm nay", nothingDue: "Hôm nay không có việc nào đến hạn", addActivity: "Thêm hoạt động", myProjects: "My wishlist", sharedWithMe: "Được chia sẻ cùng tôi", newProject: "Dự án mới", createProject: "Tạo dự án", cancel: "Hủy", next: "Tiếp theo", noUpcoming: "Chưa có lịch sắp tới" },
    auth: { welcomeBack: "Chào mừng trở lại", signInSpace: "Đăng nhập vào không gian dùng chung", email: "Email", emailOrDemo: "Email hoặc demo", password: "Mật khẩu", forgotPassword: "Quên mật khẩu?", signIn: "Đăng nhập", signingIn: "Đang đăng nhập...", noAccount: "Chưa có tài khoản?", signUp: "Đăng ký", joinPlanner: "Tham gia Planner", createAccount: "Tạo tài khoản để lập kế hoạch chung.", displayName: "Tên hiển thị", passwordChars: "Mật khẩu", creating: "Đang tạo...", signUpWithGoogle: "Đăng ký bằng Google", haveAccount: "Đã có tài khoản?" },
    account: { personal: "Cá nhân", aiProvider: "Nhà cung cấp AI", agentOps: "Agent Ops", home: "← Trang chủ" },
    settings: { personal: "Cá nhân", personalDescription: "Hồ sơ, khóa LLM và Agent Ops có trong trang cá nhân của bạn.", openPersonal: "Mở trang cá nhân →", project: "Dự án này", projectDescription: "Chỉnh sửa tên, mô tả và giao diện. Bấm lưu để cập nhật.", name: "Tên", description: "Mô tả", tags: "Thẻ (ngăn cách bằng dấu phẩy)", saveProject: "Lưu thay đổi", sharing: "Chia sẻ", sharedDescription: "Dự án đang được chia sẻ. Mời tài khoản kèm quyền hoặc tạo link công khai chỉ xem.", privateDescription: "Dự án đang ở chế độ riêng tư. Bật chia sẻ để mời tài khoản hoặc tạo link công khai chỉ xem.", private: "Riêng tư", shared: "Đã chia sẻ", members: "Thành viên", accountEmail: "Email tài khoản", createInvite: "Tạo liên kết mời", createViewLink: "Tạo link chỉ xem", viewLinkDescription: "Ai có link đều xem được các hoạt động mà không cần tài khoản. Họ không thể thay đổi dự án.", search: "Tìm kiếm", searchItems: "Tìm hoạt động…", dangerZone: "Khu vực nguy hiểm", deleteDescription: "Xóa vĩnh viễn dự án và toàn bộ dữ liệu. Chỉ chủ sở hữu mới có thể thực hiện. Nhập đúng tên dự án để xác nhận.", projectName: "Tên dự án", deleteProject: "Xóa dự án", signOut: "Đăng xuất" },
    chat: { title: "Trò chuyện", empty: "Gửi lời chào hoặc hỏi Planner:", plannerPlaceholder: "Hỏi Planner… (Shift+Enter để xuống dòng)", askPlanner: "Hỏi Planner", sending: "Đang gửi…", saved: "Đã lưu", confirm: "Xác nhận", planDraft: { title: "Bản nháp kế hoạch", saved: "Đã lưu kế hoạch", saving: "Đang lưu kế hoạch…", confirm: "Xác nhận kế hoạch", missing: "Thông tin còn thiếu:", foodToTry: "Món ngon nên thử:", category: "Danh mục", tags: "Thẻ", preparation: "Chuẩn bị", activities: "Hoạt động", travel: "Di chuyển", experience: "Trải nghiệm", todos: "Việc cần làm", costs: "Chi phí", notes: "Ghi chú" }, progress: { title: "Planner đang bày mưu...", understand: "Đọc vị ý tưởng", context: "Hỏi thăm hội dự án", places: "Triệu hồi địa điểm hữu ích", draft: "Làm cho có vẻ rất có kế hoạch", check: "Để tương lai khỏi phàn nàn", save: "Chờ ngài phê duyệt" } },
  },
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

function readLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem("togo-locale");
  if (saved === "vi" || saved === "en") return saved;
  return navigator.language.toLowerCase().startsWith("vi") ? "vi" : "en";
}

function subscribeLocale(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("togo-locale", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("togo-locale", onChange);
  };
}

type LocaleContextValue = { locale: Locale; setLocale: (locale: Locale) => void; dictionary: Dictionary };
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore<Locale>(subscribeLocale, readLocale, () => "en");
  const dictionary = useMemo(() => getDictionary(locale), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  function setLocale(next: Locale) {
    window.localStorage.setItem("togo-locale", next);
    window.dispatchEvent(new Event("togo-locale"));
  }

  return <LocaleContext.Provider value={{ locale, setLocale, dictionary }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  return value ?? { locale: "en" as const, setLocale: () => undefined, dictionary: getDictionary("en") };
}

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-surface p-0.5 text-xs" aria-label="Language">
      {(["en", "vi"] as const).map((value) => (
        <button key={value} type="button" className={`rounded-md px-2 py-1 font-semibold ${locale === value ? "bg-primary-soft text-foreground" : "text-muted"}`} onClick={() => setLocale(value)}>
          {value.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
