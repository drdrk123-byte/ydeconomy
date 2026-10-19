"use client";
import { useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  type User,
} from "firebase/auth";
import {
  LayoutDashboard,
  Users,
  Landmark,
  BriefcaseBusiness,
  ShoppingBag,
  ChartNoAxesCombined,
  Building2,
  BookOpen,
  Settings,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Search,
  Bell,
  LogOut,
  Menu,
  X,
  Wallet,
  Coins,
  Sprout,
  Download,
  RefreshCw,
  Check,
  ShieldCheck,
  GraduationCap,
  Send,
  NotebookPen,
  Pause,
  Play,
  TrendingUp,
  Target,
  HeartHandshake,
  Newspaper,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { initialState, demoQuotes, symbols } from "@/lib/seed";
import { applyAction, projectState, weekKey, type Action } from "@/lib/engine";
import type { State, Actor, Quote } from "@/lib/types";
import { clientAuth, firebaseReady } from "@/lib/firebase-client";
import EconomyChart from "./economy-chart";
const nav = [
  ["home", "대시보드", LayoutDashboard],
  ["students", "우리 반 학생", Users],
  ["bank", "학급은행", Landmark],
  ["jobs", "직업과 월급", BriefcaseBusiness],
  ["government", "세금과 예산", Building2],
  ["shop", "학급 상점", ShoppingBag],
  ["stocks", "주식시장", ChartNoAxesCombined],
  ["news", "경제 뉴스", Newspaper],
  ["lessons", "경제 수업", BookOpen],
  ["journal", "경제 일기", NotebookPen],
  ["analytics", "통계 및 평가", TrendingUp],
  ["settings", "설정", Settings],
] as const;
const descriptions: Record<string, string> = {
  home: "작은 선택들이 모여, 우리 반의 내일을 만들어요.",
  students: "각자의 일과 배움을 살펴보세요.",
  bank: "오늘의 저축으로 내일의 가능성을 키워요.",
  jobs: "우리 반에 필요한 일을 찾고 함께 성장해요.",
  government: "함께 모은 돈, 함께 만드는 더 좋은 교실.",
  shop: "필요와 즐거움 사이에서 나만의 선택을 해요.",
  stocks: "기업을 알아보고, 선택의 이유를 생각해요.",
  news: "세상의 경제를 우리 반 이야기로 연결해요.",
  lessons: "숫자 너머, 함께 살아가는 경제를 배워요.",
  journal: "내가 선택한 이유와 다음 선택을 기록해요.",
  analytics: "수익보다 중요한 것은 생각의 성장이에요.",
  settings: "우리 반에 맞는 경제 규칙을 만들어요.",
};
const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");
const stamp = (t: string) =>
  new Date(t).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
type Dialog = {
  title: string;
  description?: string;
  fields?: {
    name: string;
    label: string;
    type?: string;
    value?: string;
    options?: { value: string; label: string }[];
    required?: boolean;
  }[];
  summary?: string[];
  submit: string;
  action: (values: Record<string, string>) => Promise<void>;
};
export default function EconomyApp() {
  const [state, setState] = useState<State | null>(null),
    [actor, setActor] = useState<Actor>({
      uid: "teacher",
      role: "teacher",
      classId: "demo",
    }),
    [directory, setDirectory] = useState<{ id: string; name: string }[]>([]),
    [mode, setMode] = useState<"demo" | "firebase">("demo"),
    [page, setPage] = useState("home"),
    [user, setUser] = useState<User | null>(null),
    [quotes, setQuotes] = useState<Quote[]>(demoQuotes),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [dialog, setDialog] = useState<Dialog | null>(null),
    [mobile, setMobile] = useState(false),
    [search, setSearch] = useState(""),
    [login, setLogin] = useState(false),
    [loginType, setLoginType] = useState<"teacher" | "student">("teacher"),
    [passwordChange, setPasswordChange] = useState(false),
    [credentials, setCredentials] = useState<
      { name: string; id: string; email: string; password: string }[] | null
    >(null);
  const fullDemo = useRef<State>(initialState()),
    dialogRef = useRef<HTMLDialogElement>(null),
    requestLock = useRef(false),
    stateRef = useRef<State | null>(null),
    pendingRequest = useRef<{ fingerprint: string; key: string } | null>(null);
  stateRef.current = state;
  useEffect(() => {
    try {
      const raw = localStorage.getItem("class-economy-demo-v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed.version === 1 &&
          Array.isArray(parsed.accounts) &&
          parsed.settings
        )
          fullDemo.current = parsed;
      }
    } catch {}
    setState(fullDemo.current);
    setDirectory(
      fullDemo.current.accounts.map((a) => ({ id: a.id, name: a.name })),
    );
    if (!firebaseReady) return;
    return onAuthStateChanged(clientAuth(), (u) => {
      setUser(u);
      if (u) void connect(u);
    });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (dialog) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [dialog]);
  useEffect(() => {
    if (mode !== "firebase" || !user) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !requestLock.current)
        void refresh(user).catch((e) => setError(e.message));
    }, 15000);
    return () => clearInterval(timer);
  }, [mode, user]);
  async function api(path: string, init: RequestInit = {}, u = user) {
    if (!u) throw Error("로그인해 주세요.");
    const token = await u.getIdToken();
    const res = await fetch(path, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();
    if (!res.ok) throw Error(data.error ?? "요청에 실패했어요.");
    return data;
  }
  async function refresh(u = user) {
    const data = await api("/api/state", {}, u);
    setState(data.state);
    setActor(data.actor);
    setDirectory(data.directory);
    setError("");
  }
  async function connect(u: User) {
    setBusy(true);
    try {
      const token = await u.getIdTokenResult(true);
      if (token.claims.mustChangePassword) {
        setPasswordChange(true);
        setLogin(false);
        return;
      }
      await refresh(u);
      setMode("firebase");
      setLogin(false);
      setToast("우리 반에 오신 것을 환영해요.");
      try {
        const market = await api("/api/market", {}, u);
        setQuotes(market.quotes);
      } catch (e) {
        setError((e as Error).message);
        setQuotes([]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function act(action: Action) {
    if (requestLock.current) throw Error("이전 작업을 처리 중이에요.");
    requestLock.current = true;
    setBusy(true);
    try {
      if (mode === "demo") {
        const next = applyAction(
          fullDemo.current,
          actor,
          action,
          crypto.randomUUID(),
          demoQuotes(),
        );
        fullDemo.current = next;
        localStorage.setItem("class-economy-demo-v1", JSON.stringify(next));
        setState(projectState(next, actor));
        setDirectory(next.accounts.map((a) => ({ id: a.id, name: a.name })));
      } else {
        const fingerprint = JSON.stringify(action);
        if (pendingRequest.current?.fingerprint !== fingerprint)
          pendingRequest.current = { fingerprint, key: crypto.randomUUID() };
        const data = await api("/api/action", {
          method: "POST",
          headers: { "Idempotency-Key": pendingRequest.current.key },
          body: fingerprint,
        });
        pendingRequest.current = null;
        setState(data.state);
      }
      setToast("완료했어요. 기록에 안전하게 남겼어요.");
      setError("");
    } finally {
      setBusy(false);
      requestLock.current = false;
    }
  }
  function switchDemo(role: "teacher" | "student", uid = "s1") {
    if (mode !== "demo") return;
    const next = {
      uid: role === "teacher" ? "teacher" : uid,
      role,
      classId: "demo",
    } as Actor;
    setActor(next);
    setState(projectState(fullDemo.current, next));
    setPage("home");
    setSearch("");
  }
  function ask(d: Dialog) {
    setError("");
    setDialog(d);
  }
  const confirm = (title: string, summary: string[], action: Action) =>
    ask({
      title,
      summary,
      submit: "확인하고 실행",
      action: async () => act(action),
    });
  async function submitDialog(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = dialog;
    if (!d) return;
    const values = Object.fromEntries(
      new FormData(e.currentTarget).entries(),
    ) as Record<string, string>;
    try {
      await d.action(values);
      setDialog(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const teacher = actor.role === "teacher",
    me = state?.accounts.find((a) => a.id === actor.uid),
    currency = state?.settings.currency ?? "이코";
  const money = (n: number) => `${fmt(n)} ${currency}`;
  const total =
    state?.accounts.reduce((a, s) => a + s.balance + s.savings, 0) ?? 0;
  const investValue = (a: State["accounts"][number]) =>
    Object.entries(a.holdings).reduce(
      (sum, [symbol, h]) =>
        sum +
        (h.quantity *
          (quotes.find((q) => q.symbol === symbol && q.currency === "KRW")
            ?.price ?? 0)) /
          (state?.settings.coinKrw ?? 1000),
      0,
    );
  const payroll =
    state?.accounts.reduce(
      (sum, a) =>
        sum + (state.jobs.find((j) => j.id === a.jobId)?.salary ?? 200),
      0,
    ) ?? 0;
  function exportCsv() {
    if (!state) return;
    const rows = [
      ["거래번호", "학생", "종류", "금액", "저축변동", "내용", "시각"],
      ...state.ledger.map((l) => [
        l.id,
        directory.find((a) => a.id === l.studentId)?.name ?? "학급 정부",
        l.kind,
        l.amount,
        l.savingsDelta,
        l.note,
        l.time,
      ]),
    ];
    download(
      "경제활동_거래내역.csv",
      "\uFEFF" +
        rows
          .map((r) =>
            r.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(","),
          )
          .join("\n"),
      "text/csv;charset=utf-8",
    );
  }
  function bonus() {
    ask({
      title: "마음을 담아 보너스 지급",
      description: "어떤 기여에 대한 보너스인지 기록해 주세요.",
      fields: [
        {
          name: "studentId",
          label: "학생",
          options: state!.accounts.map((a) => ({ value: a.id, label: a.name })),
        },
        {
          name: "amount",
          label: `금액 (${currency})`,
          type: "number",
          value: "50",
        },
        { name: "note", label: "지급 이유", value: "공동체를 위한 기여" },
      ],
      submit: "보너스 지급",
      action: async (v) =>
        act({
          type: "bonus",
          studentId: v.studentId,
          amount: Number(v.amount),
          note: v.note,
        }),
    });
  }
  function propose() {
    ask({
      title: "우리 반에 새로운 제안",
      fields: [
        { name: "title", label: "제안 이름" },
        { name: "description", label: "모두에게 어떤 도움이 될까요?" },
        {
          name: "cost",
          label: `필요한 예산 (${currency})`,
          type: "number",
          value: "500",
        },
      ],
      submit: "제안 등록",
      action: async (v) =>
        act({
          type: "propose",
          title: v.title,
          description: v.description,
          cost: Number(v.cost),
        }),
    });
  }
  function save(direction: "deposit" | "withdraw") {
    ask({
      title:
        direction === "deposit" ? "차곡차곡 저축하기" : "저축에서 꺼내 쓰기",
      description: `현재 통장 ${money(me?.balance ?? 0)} · 저축 ${money(me?.savings ?? 0)}`,
      fields: [
        {
          name: "amount",
          label: `금액 (${currency})`,
          type: "number",
          value: "100",
        },
      ],
      submit: direction === "deposit" ? "저축하기" : "인출하기",
      action: async (v) =>
        act({ type: "save", direction, amount: Number(v.amount) }),
    });
  }
  const title =
    page === "home"
      ? teacher
        ? "우리 반 경제 한눈에"
        : "오늘도, 나답게 경제생활"
      : (nav.find((n) => n[0] === page)?.[1] ?? "");
  if (!state)
    return (
      <main className="loading">
        <div className="logo-icon">e</div>
        <p>우리 반 경제를 준비하고 있어요…</p>
        <div className="skeleton" />
      </main>
    );
  const visibleNav = nav.filter(
    (n) => teacher || !["students", "analytics", "settings"].includes(n[0]),
  );
  return (
    <div className="app">
      <a className="skip" href="#main">
        본문으로 건너뛰기
      </a>
      <aside className={`sidebar ${mobile ? "shown" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("home");
          }}
        >
          <span className="logo-icon">
            e<span>↗</span>
          </span>
          <span>
            우리반 이코노미<small>CLASS ECONOMY OS</small>
          </span>
        </a>
        <button
          className="class-picker"
          onClick={() => setToast(`학급 코드: ${actor.classId}`)}
        >
          <span className="class-icon">
            <GraduationCap size={21} />
          </span>
          <span>
            {state.settings.className}
            <small>{teacher ? "교사 관리 공간" : "학생 경제 공간"}</small>
          </span>
          <ChevronDown size={16} />
        </button>
        <div className="nav-label">우리 반 경제</div>
        <nav>
          {visibleNav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "active" : ""}`}
              onClick={() => {
                setPage(id);
                setSearch("");
                setMobile(false);
              }}
            >
              <Icon size={19} />
              {id === "home" && !teacher ? "나의 홈" : label}
              {id === "stocks" && <span className="nav-new">NEW</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="learn-card">
            <span>🌿</span>
            <strong>함께 배우는 경제</strong>
            <p>
              자산보다 소중한 건<br />
              선택하고 성장하는 과정이에요.
            </p>
            <button onClick={() => setPage("lessons")}>
              경제 수업 살펴보기 <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="profile">
            <span className="avatar">
              {teacher ? "김" : me?.name.slice(0, 1)}
            </span>
            <span>
              <strong>{teacher ? "선생님" : me?.name}</strong>
              <small>
                {mode === "demo" ? "데모 체험 중" : "Firebase 연결됨"}
              </small>
            </span>
            <button
              aria-label="실제 로그인 또는 로그아웃"
              onClick={() => {
                if (mode === "firebase") {
                  void signOut(clientAuth());
                  setMode("demo");
                  switchDemo("teacher");
                  setState(fullDemo.current);
                  setActor({
                    uid: "teacher",
                    role: "teacher",
                    classId: "demo",
                  });
                } else setLogin(true);
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-backdrop"
          aria-label="메뉴 닫기"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-btn"
              aria-label="메뉴 열기"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>우리 반 경제</span>
            <ChevronRight size={14} />
            <strong>{nav.find((n) => n[0] === page)?.[1]}</strong>
          </div>
          <div className="top-actions">
            {mode === "demo" ? (
              <>
                <span className="demo-pill">
                  <span />
                  데모 모드
                </span>
                <select
                  aria-label="데모 체험 역할"
                  value={teacher ? "teacher" : actor.uid}
                  onChange={(e) =>
                    switchDemo(
                      e.target.value === "teacher" ? "teacher" : "student",
                      e.target.value,
                    )
                  }
                >
                  <option value="teacher">교사 체험</option>
                  {fullDemo.current.accounts.map((a) => (
                    <option value={a.id} key={a.id}>
                      학생 · {a.name}
                    </option>
                  ))}
                </select>
                <button className="btn small" onClick={() => setLogin(true)}>
                  실제 로그인
                </button>
              </>
            ) : (
              <span className="live-pill">
                <ShieldCheck size={14} /> 실제 학급
              </span>
            )}
            <button
              className="icon-btn"
              aria-label="서비스 안내"
              onClick={() =>
                setToast(
                  "가상화폐 전용 학습 공간입니다. 실제 돈으로 바꿀 수 없어요.",
                )
              }
            >
              <Bell size={19} />
              <i />
            </button>
          </div>
        </header>
        <main id="main" className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {teacher ? "TEACHER WORKSPACE" : "MY ECONOMY"} <span>2026</span>
              </div>
              <h1>
                {title}
                <span className="heading-dot">.</span>
              </h1>
              <p>{descriptions[page]}</p>
            </div>
            <div className="heading-actions">
              <span className="date">
                {new Date().toLocaleDateString("ko-KR", {
                  timeZone: "Asia/Seoul",
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                })}
              </span>
              {teacher && (
                <button className="btn" onClick={exportCsv}>
                  <Download size={16} />
                  내역 내려받기
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button aria-label="오류 닫기" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {mode === "demo" && (
            <div className="demo-notice">
              <span>
                <ShieldCheck size={16} />
                가상 학생과 예시 시세로 체험하고 있어요. 이 브라우저에만
                저장됩니다.
              </span>
              <button onClick={() => setLogin(true)}>
                실제 학급 연결 <ArrowRight size={14} />
              </button>
            </div>
          )}
          {page === "home" && (
            <>
              <div className="welcome-banner">
                <div>
                  <span className="tag">함께 만드는 우리 반 경제</span>
                  <h2>
                    {teacher
                      ? "오늘도 건강한 경제가 자라고 있어요."
                      : "작은 선택에서, 큰 배움이 시작돼요."}
                  </h2>
                  <p>
                    {teacher
                      ? `${state.accounts.length}명의 작은 경제 시민과 함께하는 오늘`
                      : "벌고, 저축하고, 나누는 나만의 경제 이야기"}
                  </p>
                  <button
                    className="banner-button"
                    onClick={() => setPage(teacher ? "jobs" : "bank")}
                  >
                    {teacher ? "이번 주 월급 관리" : "내 통장 살펴보기"}
                    <ArrowRight size={16} />
                  </button>
                </div>
                <div className="coin-illustration" aria-hidden="true">
                  <div className="orbit o1" />
                  <div className="orbit o2" />
                  <div className="coin c1">e</div>
                  <div className="coin c2">e</div>
                  <div className="growth">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <Sprout className="sprout" size={58} />
                  <div className="spark sp1">✦</div>
                  <div className="spark sp2">✧</div>
                </div>
              </div>
              <div className="metrics">
                {(teacher
                  ? [
                      {
                        label: "우리 반 전체 현금·저축",
                        value: total,
                        icon: Coins,
                        note: `학생 ${state.accounts.length}명 · 주식 평가금액 제외`,
                        tone: "blue",
                      },
                      {
                        label: "이번 주 지급 예정 월급",
                        value: payroll,
                        icon: BriefcaseBusiness,
                        note:
                          state.lastPayroll === weekKey()
                            ? "이번 주 지급 완료"
                            : "세금 공제 전 총급여",
                        tone: "purple",
                      },
                      {
                        label: "함께 모은 공공예산",
                        value: state.budget,
                        icon: Building2,
                        note: "모두를 위한 소중한 자산",
                        tone: "green",
                      },
                      {
                        label: "학생 평균 저축액",
                        value: state.accounts.length
                          ? state.accounts.reduce(
                              (sum, a) => sum + a.savings,
                              0,
                            ) / state.accounts.length
                          : 0,
                        icon: Landmark,
                        note: `저축 참여 ${state.accounts.filter((a) => a.savings > 0).length}명`,
                        tone: "orange",
                      },
                    ]
                  : [
                      {
                        label: "나의 총자산",
                        value:
                          (me?.balance ?? 0) +
                          (me?.savings ?? 0) +
                          (me ? investValue(me) : 0),
                        icon: Wallet,
                        note: "통장 + 저축 + 주식 평가금액",
                        tone: "blue",
                      },
                      {
                        label: "내 통장",
                        value: me?.balance ?? 0,
                        icon: Coins,
                        note: "지금 사용할 수 있는 돈",
                        tone: "purple",
                      },
                      {
                        label: "차곡차곡 저축",
                        value: me?.savings ?? 0,
                        icon: Landmark,
                        note: `주간 이자 ${state.settings.interestRate}%`,
                        tone: "green",
                      },
                      {
                        label: "주식 평가금액",
                        value: me ? investValue(me) : 0,
                        icon: TrendingUp,
                        note: "원화 종목 · 가상 평가액",
                        tone: "orange",
                      },
                    ]
                ).map(({ label, value, icon: Icon, note, tone }) => (
                  <section className="metric card" key={label}>
                    <div className="metric-top">
                      <span>{label}</span>
                      <span className={`metric-icon ${tone}`}>
                        <Icon size={18} />
                      </span>
                    </div>
                    <div className="metric-value">
                      {fmt(value)}
                      <small>{currency}</small>
                    </div>
                    <p>{note}</p>
                  </section>
                ))}
              </div>
              <div className="dashboard-middle">
                <section className="card chart-card">
                  <div className="section-heading">
                    <div>
                      <h3>
                        {teacher ? "우리 반 자산 분포" : "나의 자산 구성"}
                      </h3>
                      <p>
                        {teacher
                          ? "개인 이름을 공개하지 않는 자산 구간별 인원"
                          : "오늘 내가 가진 돈은 어떻게 나뉘어 있을까요?"}
                      </p>
                    </div>
                    <span className="subtle-pill">현재 기준</span>
                  </div>
                  <EconomyChart
                    kind={teacher ? "distribution" : "assets"}
                    accounts={state.accounts}
                    currency={currency}
                  />
                  <div className="chart-foot">
                    <span className="legend-dot" />{" "}
                    {teacher
                      ? "현금과 저축 합계 기준 · 수익률 순위는 표시하지 않아요"
                      : "주식은 별도 투자 화면에서 확인해요"}
                  </div>
                </section>
                <section className="card quick-card">
                  <div className="section-heading">
                    <div>
                      <h3>{teacher ? "자주 하는 일" : "지금 해볼까요?"}</h3>
                      <p>필요한 일에 빠르게 닿을 수 있도록</p>
                    </div>
                    <span className="subtle-pill">QUICK</span>
                  </div>
                  <div className="quick-grid">
                    {(teacher
                      ? [
                          [
                            "월급 일괄 지급",
                            "이번 주의 노력에 보답해요",
                            BriefcaseBusiness,
                            () =>
                              confirm(
                                "이번 주 월급 지급",
                                [
                                  `대상 ${state.accounts.length}명`,
                                  `총급여 ${money(payroll)}`,
                                  `소득세율 ${state.settings.taxRate}%`,
                                  `지급 기간 ${weekKey()}`,
                                ],
                                { type: "payroll", period: weekKey() },
                              ),
                          ],
                          [
                            "보너스 지급",
                            "함께한 기여를 응원해요",
                            Coins,
                            bonus,
                          ],
                          [
                            "학급 상점",
                            "상품과 재고를 관리해요",
                            ShoppingBag,
                            () => setPage("shop"),
                          ],
                          [
                            "공공예산 제안",
                            "우리 반을 더 좋게 만들어요",
                            HeartHandshake,
                            propose,
                          ],
                        ]
                      : [
                          [
                            "저축하기",
                            "내일의 나를 응원해요",
                            Landmark,
                            () => save("deposit"),
                          ],
                          [
                            "상점 구경",
                            "합리적인 소비를 해요",
                            ShoppingBag,
                            () => setPage("shop"),
                          ],
                          [
                            "주식 알아보기",
                            "기업과 위험을 배워요",
                            TrendingUp,
                            () => setPage("stocks"),
                          ],
                          [
                            "경제 일기",
                            "나의 선택을 돌아봐요",
                            NotebookPen,
                            () => setPage("journal"),
                          ],
                        ]
                    ).map(([label, desc, Icon, fn]) => {
                      const I = Icon as typeof Coins;
                      return (
                        <button key={String(label)} onClick={fn as () => void}>
                          <span className="quick-icon">
                            <I size={22} />
                          </span>
                          <strong>{String(label)}</strong>
                          <small>{String(desc)}</small>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>
              <div className="dashboard-bottom">
                <section className="card activity-card">
                  <div className="section-heading">
                    <div>
                      <h3>최근 경제활동</h3>
                      <p>우리 반의 작은 선택들이 쌓이는 중</p>
                    </div>
                    <button
                      className="text-btn"
                      onClick={() => setPage("bank")}
                    >
                      전체 보기
                      <ChevronRight size={15} />
                    </button>
                  </div>
                  <LedgerList
                    state={state}
                    directory={directory}
                    money={money}
                    max={4}
                  />
                </section>
                <section className="card lesson-feature">
                  <div className="section-heading">
                    <span className="tag green-tag">이번 주 함께 생각하기</span>
                    <BookOpen size={22} />
                  </div>
                  <h3>
                    세금은 왜<br />
                    필요할까요?
                  </h3>
                  <p>
                    혼자서는 하기 어려운 일,
                    <br />
                    함께라면 할 수 있지 않을까요?
                  </p>
                  <div className="lesson-feature-footer">
                    <span>경제 시민성 · 공공재</span>
                    <button
                      className="circle-btn"
                      aria-label="경제 수업 보기"
                      onClick={() => setPage("lessons")}
                    >
                      <ArrowUpRight size={20} />
                    </button>
                  </div>
                </section>
              </div>
            </>
          )}
          {page === "students" && (
            <section className="card padded">
              <div className="section-heading">
                <h3>
                  함께하는 경제 시민{" "}
                  <span className="count">{state.accounts.length}</span>
                </h3>
                <button
                  className="btn primary"
                  onClick={() =>
                    ask({
                      title: "학생 계정 만들기",
                      description:
                        mode === "demo"
                          ? "실제 계정 생성은 Firebase 연결 후 사용할 수 있어요."
                          : "학생 별명을 한 줄에 하나씩 입력하세요. 초기 비밀번호는 이번 화면에서만 제공됩니다.",
                      fields: [
                        {
                          name: "names",
                          label: "학생 별명 (한 줄에 하나)",
                          type: "textarea",
                        },
                      ],
                      submit: "계정 생성",
                      action: async (v) => {
                        if (mode === "demo")
                          throw Error(
                            "실제 학급으로 로그인한 후 생성해 주세요.",
                          );
                        const data = await api("/api/members", {
                          method: "POST",
                          body: JSON.stringify({
                            names: v.names
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }),
                        });
                        setCredentials(data.credentials);
                        await refresh();
                      },
                    })
                  }
                >
                  <Plus size={16} />
                  학생 추가
                </button>
              </div>
              <SearchBox
                value={search}
                onChange={setSearch}
                label="학생 별명 검색"
              />
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>학생</th>
                      <th>직업</th>
                      <th>통장 잔액</th>
                      <th>저축</th>
                      <th>직업 변경</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.accounts
                      .filter((a) => a.name.includes(search))
                      .map((a, i) => (
                        <tr key={a.id}>
                          <td>
                            <span className={`avatar color${i % 4}`}>
                              {a.name.slice(0, 1)}
                            </span>
                            <strong>{a.name}</strong>
                          </td>
                          <td>
                            {state.jobs.find((j) => j.id === a.jobId)?.name ??
                              "기본 생활소득"}
                          </td>
                          <td>{money(a.balance)}</td>
                          <td>{money(a.savings)}</td>
                          <td>
                            <select
                              aria-label={`${a.name} 직업 변경`}
                              value={a.jobId}
                              onChange={(e) =>
                                confirm(
                                  "직업 배정",
                                  [
                                    a.name,
                                    state.jobs.find(
                                      (j) => j.id === e.target.value,
                                    )?.name ?? "",
                                  ],
                                  {
                                    type: "assign",
                                    studentId: a.id,
                                    jobId: e.target.value,
                                  },
                                )
                              }
                            >
                              <option value="" disabled>
                                직업 선택
                              </option>
                              {state.jobs.map((j) => (
                                <option key={j.id} value={j.id}>
                                  {j.name}
                                </option>
                              ))}
                            </select>
                            {state.applications[a.id] && (
                              <small className="blue-text">
                                {" "}
                                지원:{" "}
                                {
                                  state.jobs.find(
                                    (j) => j.id === state.applications[a.id],
                                  )?.name
                                }
                              </small>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {page === "bank" && (
            <>
              <div className="two-col">
                <section className="card padded">
                  <div className="section-heading">
                    <h3>{teacher ? "우리 반 학급은행" : "나의 든든한 통장"}</h3>
                    <Landmark className="blue-text" />
                  </div>
                  <span className="muted">
                    {teacher ? "전체 현금·저축 합계" : "지금 사용할 수 있는 돈"}
                  </span>
                  <div className="big-amount">
                    {money(teacher ? total : (me?.balance ?? 0))}
                  </div>
                  <p className="muted">
                    가상화폐는 실제 돈으로 바꾸거나 환전할 수 없어요.
                  </p>
                  <div className="button-row">
                    {teacher ? (
                      <>
                        <button className="btn primary" onClick={bonus}>
                          보너스 지급
                        </button>
                        <button
                          className="btn"
                          onClick={() =>
                            confirm(
                              "이번 주 저축 이자 지급",
                              [
                                `주간 이율 ${state.settings.interestRate}%`,
                                "저축 계좌에 이자를 지급합니다.",
                              ],
                              { type: "interest", period: weekKey() },
                            )
                          }
                        >
                          이자 지급
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn primary"
                          onClick={() => save("deposit")}
                        >
                          저축하기
                        </button>
                        <button
                          className="btn"
                          onClick={() => save("withdraw")}
                        >
                          저축 꺼내기
                        </button>
                        <button
                          className="btn"
                          disabled={!state.settings.transfersEnabled}
                          onClick={() =>
                            ask({
                              title: "친구에게 송금",
                              description: `1회 ${money(state.settings.transferLimit)} · 하루 3회까지`,
                              fields: [
                                {
                                  name: "to",
                                  label: "받는 친구",
                                  options: directory
                                    .filter((a) => a.id !== actor.uid)
                                    .map((a) => ({
                                      value: a.id,
                                      label: a.name,
                                    })),
                                },
                                {
                                  name: "amount",
                                  label: "금액",
                                  type: "number",
                                  value: "50",
                                },
                                { name: "note", label: "보내는 이유" },
                              ],
                              submit: "확인하고 보내기",
                              action: async (v) =>
                                act({
                                  type: "transfer",
                                  to: v.to,
                                  amount: Number(v.amount),
                                  note: v.note,
                                }),
                            })
                          }
                        >
                          <Send size={15} />
                          송금
                        </button>
                      </>
                    )}
                  </div>
                </section>
                <section className="card padded savings-card">
                  <div className="section-heading">
                    <h3>
                      <Target size={18} />
                      {teacher ? "저축을 배우는 시간" : me?.goalName}
                    </h3>
                    {!teacher && (
                      <button
                        className="text-btn"
                        onClick={() =>
                          ask({
                            title: "나의 저축 목표",
                            fields: [
                              {
                                name: "name",
                                label: "무엇을 위해 모을까요?",
                                value: me?.goalName,
                              },
                              {
                                name: "amount",
                                label: "목표 금액",
                                type: "number",
                                value: String(me?.goal),
                              },
                            ],
                            submit: "목표 저장",
                            action: async (v) =>
                              act({
                                type: "goal",
                                name: v.name,
                                amount: Number(v.amount),
                              }),
                          })
                        }
                      >
                        목표 바꾸기
                      </button>
                    )}
                  </div>
                  <div className="big-amount">
                    {money(
                      teacher
                        ? state.accounts.reduce((s, a) => s + a.savings, 0)
                        : (me?.savings ?? 0),
                    )}
                  </div>
                  <p>
                    {teacher
                      ? "우리 반 친구들이 차곡차곡 모은 돈"
                      : `목표 ${money(me?.goal ?? 0)} · ${Math.min(100, Math.round(((me?.savings ?? 0) / (me?.goal || 1)) * 100))}% 달성`}
                  </p>
                  <progress
                    aria-label="저축 목표 달성률"
                    max={100}
                    value={
                      teacher
                        ? state.accounts.length
                          ? (state.accounts.filter((a) => a.savings > 0)
                              .length /
                              state.accounts.length) *
                            100
                          : 0
                        : Math.min(
                            100,
                            ((me?.savings ?? 0) / (me?.goal || 1)) * 100,
                          )
                    }
                  />
                  <span className="muted">
                    주간 이율 {state.settings.interestRate}% · 교사 확인 후 지급
                  </span>
                </section>
              </div>
              <section className="card padded">
                <div className="section-heading">
                  <h3>
                    거래 원장 <span className="subtle-pill">최근 200건</span>
                  </h3>
                  <button className="btn small" onClick={exportCsv}>
                    <Download size={15} />
                    CSV
                  </button>
                </div>
                <LedgerList
                  state={state}
                  directory={directory}
                  money={money}
                  max={200}
                  onReverse={
                    teacher
                      ? (l) =>
                          confirm(
                            "거래를 보정할까요?",
                            ["원본 기록은 보존되고 반대 거래가 추가됩니다."],
                            { type: "reverse", transactionId: l },
                          )
                      : undefined
                  }
                />
              </section>
            </>
          )}
          {page === "jobs" && (
            <>
              <div className="info-strip">
                <BriefcaseBusiness />
                <div>
                  <strong>모두의 일이 우리 반을 움직여요.</strong>
                  <p>
                    직업이 없는 친구도 주 200 {currency}의 기본 생활소득을
                    받아요.
                  </p>
                </div>
                {teacher && (
                  <button
                    className="btn primary"
                    onClick={() =>
                      confirm(
                        "이번 주 월급 지급",
                        [
                          `대상 ${state.accounts.length}명 · 총급여 ${money(payroll)}`,
                          `소득세 ${state.settings.taxRate}% · ${weekKey()}`,
                        ],
                        { type: "payroll", period: weekKey() },
                      )
                    }
                  >
                    월급 일괄 지급
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
              <div className="three-col">
                {state.jobs.map((j, i) => (
                  <section className="card padded job-card" key={j.id}>
                    <span className={`job-icon color${i % 4}`}>
                      <BriefcaseBusiness size={25} />
                    </span>
                    <h3>{j.name}</h3>
                    <p>{j.description}</p>
                    <div className="job-pay">
                      {money(j.salary)}
                      <small>/ 주</small>
                    </div>
                    <div className="divider" />
                    <div className="section-heading">
                      <span className="muted">
                        모집 인원 {j.seats}명
                        {teacher
                          ? ` · 배정 ${state.accounts.filter((a) => a.jobId === j.id).length}명`
                          : ""}
                      </span>
                      {!teacher && (
                        <button
                          className="btn small"
                          disabled={me?.jobId === j.id}
                          onClick={() =>
                            confirm(
                              "이 직업에 지원할까요?",
                              [j.name, "교사가 확인한 후 배정해요."],
                              { type: "apply", jobId: j.id },
                            )
                          }
                        >
                          {me?.jobId === j.id
                            ? "현재 나의 일"
                            : state.applications[actor.uid] === j.id
                              ? "지원 완료"
                              : "지원하기"}
                        </button>
                      )}
                    </div>
                  </section>
                ))}
              </div>
              <div className="info-strip subtle">
                <BookOpen size={21} />
                <p>
                  월급은 총급여 − 소득세로 계산해요. 자산이나 수익률은 성적
                  기준으로 사용하지 않아요.
                </p>
              </div>
            </>
          )}
          {page === "shop" && (
            <>
              <div className="section-heading toolbar">
                <div className="filter-chips">
                  <span className="chip selected">전체 상품</span>
                  <span className="chip">
                    {state.settings.shopOpen
                      ? "상점 운영 중"
                      : "지금은 쉬는 중"}
                  </span>
                </div>
                {teacher && (
                  <button
                    className="btn primary"
                    onClick={() =>
                      ask({
                        title: "학급 상점 상품 등록",
                        fields: [
                          { name: "name", label: "상품 이름" },
                          { name: "description", label: "설명" },
                          {
                            name: "price",
                            label: "가격",
                            type: "number",
                            value: "100",
                          },
                          {
                            name: "stock",
                            label: "재고",
                            type: "number",
                            value: "10",
                          },
                          {
                            name: "limit",
                            label: "한 사람 구매 한도",
                            type: "number",
                            value: "1",
                          },
                        ],
                        submit: "상품 등록",
                        action: async (v) =>
                          act({
                            type: "item",
                            name: v.name,
                            description: v.description,
                            price: Number(v.price),
                            stock: Number(v.stock),
                            limit: Number(v.limit),
                          }),
                      })
                    }
                  >
                    <Plus size={16} />
                    상품 등록
                  </button>
                )}
              </div>
              <div className="shop-grid">
                {state.items.map((item, i) => (
                  <section className="card product" key={item.id}>
                    <div className={`product-art art${i % 4}`}>
                      <span>{item.emoji}</span>
                      <span className="stock-pill">남은 수량 {item.stock}</span>
                    </div>
                    <div className="product-body">
                      <small>학급 상점 · 1인 {item.limit}개까지</small>
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                      <div className="section-heading">
                        <strong>{money(item.price)}</strong>
                        <button
                          className="btn small primary"
                          disabled={
                            teacher ||
                            item.stock === 0 ||
                            !state.settings.shopOpen
                          }
                          onClick={() =>
                            confirm(
                              "구매 전 한 번 더 생각해요",
                              [
                                item.name,
                                `가격 ${money(item.price)}`,
                                `구매 후 잔액 ${money((me?.balance ?? 0) - item.price)}`,
                                "꼭 필요한 소비인가요?",
                              ],
                              { type: "buy", itemId: item.id },
                            )
                          }
                        >
                          {teacher
                            ? "학생용 구매"
                            : item.stock === 0
                              ? "품절"
                              : "구매하기"}
                        </button>
                      </div>
                    </div>
                  </section>
                ))}
              </div>
              <p className="muted footnote">
                상점 판매액은 학급 공공예산으로 이동해요. 기본 학습권·평가
                혜택은 상품으로 판매하지 않아요.
              </p>
            </>
          )}
          {page === "government" && (
            <>
              <div className="two-col">
                <section className="card padded budget-card">
                  <span className="tag">우리 모두의 돈</span>
                  <h3>함께 모은 공공예산</h3>
                  <div className="big-amount">{money(state.budget)}</div>
                  <p>가상의 학급 예산입니다. 실제 학교 예산과는 달라요.</p>
                </section>
                <section className="card padded">
                  <div className="section-heading">
                    <h3>우리 반의 세금 규칙</h3>
                    <Building2 size={22} />
                  </div>
                  <div className="tax-row">
                    <span>소득세</span>
                    <strong>{state.settings.taxRate}%</strong>
                  </div>
                  <p className="muted">
                    월급을 받을 때 함께 모아요. 현재는 단일세율 소득세를
                    지원해요.
                  </p>
                  <p>
                    같은 비율을 내면 모두에게 공정할까요? 함께 생각해 보세요.
                  </p>
                </section>
              </div>
              <div className="section-heading toolbar">
                <h3>우리 반을 바꾸는 제안</h3>
                <button className="btn primary" onClick={propose}>
                  <Plus size={16} />새 제안
                </button>
              </div>
              <div className="two-col">
                {state.proposals.map((p) => (
                  <section className="card padded proposal" key={p.id}>
                    <span
                      className={`tag ${p.status === "executed" ? "green-tag" : ""}`}
                    >
                      {p.status === "executed" ? "집행 완료" : "의견 모으는 중"}
                    </span>
                    <h3>{p.title}</h3>
                    <p>{p.description}</p>
                    <strong>{money(p.cost)}</strong>
                    <div className="divider" />
                    <div className="section-heading">
                      <span className="muted">
                        <HeartHandshake size={16} />
                        찬성 {p.votes.length}명
                      </span>
                      {p.status === "open" &&
                        (teacher ? (
                          <button
                            className="btn small"
                            onClick={() =>
                              confirm(
                                "공공예산 집행",
                                [
                                  p.title,
                                  `사용 예산 ${money(p.cost)}`,
                                  "학생 과반수 찬성이 필요합니다.",
                                ],
                                { type: "execute", proposalId: p.id },
                              )
                            }
                          >
                            예산 집행
                          </button>
                        ) : (
                          <button
                            className={`btn small ${p.votes.includes(actor.uid) ? "primary" : ""}`}
                            onClick={() =>
                              void act({
                                type: "vote",
                                proposalId: p.id,
                              }).catch((e) => setError(e.message))
                            }
                          >
                            {p.votes.includes(actor.uid)
                              ? "찬성 취소"
                              : "찬성해요"}
                          </button>
                        ))}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}
          {page === "stocks" && (
            <>
              <div className="info-strip">
                <ShieldCheck />
                <div>
                  <strong>
                    {quotes[0]?.source === "toss"
                      ? "토스증권 실제 시세"
                      : "학습용 데모 시세"}{" "}
                    · 가상화폐로만 모의투자해요
                  </strong>
                  <p>
                    예시 시세는 실제 시장가격이 아닙니다. 미국 종목은 조회만
                    지원하며 원화 종목만 모의거래할 수 있어요.
                  </p>
                </div>
                <button
                  className="btn"
                  onClick={async () => {
                    try {
                      if (mode === "demo") setQuotes(demoQuotes());
                      else setQuotes((await api("/api/market")).quotes);
                      setToast("시세를 새로 조회했어요.");
                    } catch (e) {
                      setQuotes([]);
                      setError((e as Error).message);
                    }
                  }}
                >
                  <RefreshCw size={16} />
                  시세 새로고침
                </button>
                {teacher && (
                  <button
                    className="btn"
                    onClick={() =>
                      confirm(
                        state.settings.marketOpen
                          ? "모의투자 일시 중지"
                          : "모의투자 다시 시작",
                        [],
                        {
                          type: "settings",
                          ...state.settings,
                          marketOpen: !state.settings.marketOpen,
                        },
                      )
                    }
                  >
                    {state.settings.marketOpen ? (
                      <Pause size={16} />
                    ) : (
                      <Play size={16} />
                    )}
                  </button>
                )}
              </div>
              <SearchBox
                value={search}
                onChange={setSearch}
                label="기업 이름 또는 종목 코드 검색"
              />
              <div className="card padded">
                <div className="section-heading">
                  <h3>생활 속 기업을 만나요</h3>
                  <span className="subtle-pill">
                    {state.settings.marketOpen
                      ? "모의시장 운영 중"
                      : "거래 일시 중지"}
                  </span>
                </div>
                {quotes.length === 0 && (
                  <Empty text="시세를 불러오지 못했어요. 다시 조회해 주세요." />
                )}
                {quotes
                  .filter(
                    (q) =>
                      q.name.includes(search) ||
                      q.symbol.includes(search.toUpperCase()),
                  )
                  .map((q, i) => {
                    const h = me?.holdings[q.symbol];
                    return (
                      <div className="stock-row" key={q.symbol}>
                        <span className={`stock-logo color${i % 4}`}>
                          {q.symbol === "AAPL" ? "A" : q.name.slice(0, 1)}
                        </span>
                        <div className="stock-name">
                          <strong>{q.name}</strong>
                          <small>
                            {q.symbol} ·{" "}
                            {q.currency === "KRW" ? "국내" : "미국"} ·{" "}
                            {q.source === "demo" ? "데모" : "실제 시세"}
                          </small>
                        </div>
                        <div className="stock-price">
                          <strong>
                            {q.currency === "KRW"
                              ? fmt(q.price) + "원"
                              : "$" + q.price.toFixed(2)}
                          </strong>
                          {q.change !== undefined && (
                            <small
                              className={
                                q.change >= 0 ? "positive" : "negative"
                              }
                            >
                              {q.change >= 0 ? "+" : ""}
                              {q.change}% <span className="muted">(예시)</span>
                            </small>
                          )}
                          <small className="muted">{stamp(q.time)}</small>
                        </div>
                        <div className="stock-holding">
                          {h?.quantity ? `${h.quantity}주 보유` : "보유 없음"}
                        </div>
                        {!teacher && (
                          <div className="button-row">
                            <button
                              className="btn small primary"
                              disabled={
                                q.currency !== "KRW" ||
                                !state.settings.marketOpen
                              }
                              onClick={() => tradeDialog(q, "buy")}
                            >
                              매수
                            </button>
                            <button
                              className="btn small"
                              disabled={
                                !h?.quantity || !state.settings.marketOpen
                              }
                              onClick={() => tradeDialog(q, "sell")}
                            >
                              매도
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
              {!teacher && (
                <section className="card padded">
                  <h3>나의 포트폴리오</h3>
                  {Object.entries(me?.holdings ?? {}).filter(
                    ([, h]) => h.quantity > 0,
                  ).length === 0 ? (
                    <Empty text="아직 보유한 주식이 없어요. 먼저 기업을 알아볼까요?" />
                  ) : (
                    Object.entries(me!.holdings)
                      .filter(([, h]) => h.quantity > 0)
                      .map(([symbol, h]) => {
                        const q = quotes.find((q) => q.symbol === symbol);
                        const value =
                          (h.quantity * (q?.price ?? 0)) /
                          state.settings.coinKrw;
                        const profit = value - h.cost;
                        return (
                          <div className="stock-row" key={symbol}>
                            <strong>{q?.name ?? symbol}</strong>
                            <span>{h.quantity}주</span>
                            <span>매입 {money(h.cost)}</span>
                            <span>평가 {money(value)}</span>
                            <strong
                              className={profit >= 0 ? "positive" : "negative"}
                            >
                              {profit >= 0 ? "+" : ""}
                              {money(profit)} (
                              {h.cost
                                ? ((profit / h.cost) * 100).toFixed(1)
                                : 0}
                              %)
                            </strong>
                          </div>
                        );
                      })
                  )}
                  <p className="muted">
                    투자 손익은 보유 주식의 원가와 평가금액 차이입니다.
                    월급·저축은 포함하지 않아요.
                  </p>
                </section>
              )}
              <div className="three-col">
                {[
                  "이 기업은 어떤 상품을 만들까요?",
                  "한 회사에 모든 돈을 넣으면 어떤 위험이 있을까요?",
                  "가격이 떨어져도 이 선택을 설명할 수 있나요?",
                ].map((q, i) => (
                  <section className="card padded thought" key={q}>
                    <span>생각해 보기 0{i + 1}</span>
                    <h3>{q}</h3>
                    <button
                      className="text-btn"
                      onClick={() => setPage("journal")}
                    >
                      내 생각 기록하기
                      <ArrowRight size={14} />
                    </button>
                  </section>
                ))}
              </div>
              <p className="muted footnote">
                교육용 환산율: 1 {currency} = {fmt(state.settings.coinKrw)}원 ·
                소수 코인은 올림 · 실시간 주문은 발생하지 않습니다. 실제 주가
                차트는 아직 제공하지 않습니다.
              </p>
            </>
          )}
          {page === "news" && (
            <>
              <div className="section-heading toolbar">
                <h3>세상과 연결되는 경제 소식</h3>
                {teacher && (
                  <button
                    className="btn primary"
                    onClick={() =>
                      ask({
                        title: "경제 뉴스 등록",
                        fields: [
                          { name: "title", label: "기사 제목" },
                          { name: "source", label: "출처" },
                          {
                            name: "url",
                            label: "원문 주소 (https://)",
                            type: "url",
                          },
                          { name: "question", label: "함께 생각할 질문" },
                        ],
                        submit: "뉴스 등록",
                        action: async (v) =>
                          act({
                            type: "news",
                            title: v.title,
                            source: v.source,
                            url: v.url,
                            question: v.question,
                          }),
                      })
                    }
                  >
                    <Plus size={16} />
                    뉴스 등록
                  </button>
                )}
              </div>
              {state.news.length === 0 ? (
                <section className="card padded">
                  <Empty text="아직 등록한 뉴스가 없어요. 교사가 기사 링크와 탐구 질문을 등록할 수 있어요." />
                </section>
              ) : (
                <div className="two-col">
                  {state.news.map((n) => (
                    <section className="card padded" key={n.id}>
                      <span className="tag">{n.source}</span>
                      <h3>{n.title}</h3>
                      <p>{n.question}</p>
                      <a
                        className="text-btn"
                        href={n.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        원문 읽기
                        <ArrowUpRight size={16} />
                      </a>
                    </section>
                  ))}
                </div>
              )}
            </>
          )}
          {page === "lessons" && (
            <>
              <div className="info-strip">
                <BookOpen />
                <div>
                  <strong>돈의 크기보다, 생각의 깊이를 배워요.</strong>
                  <p>
                    선택의 근거 · 위험에 대한 이해 · 공동체 참여 · 공정성에 대한
                    성찰
                  </p>
                </div>
              </div>
              <div className="two-col">
                {state.lessons.map((l, i) => (
                  <section className="card padded lesson-card" key={l.id}>
                    <div className="section-heading">
                      <span className="lesson-num">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="tag">{l.concept}</span>
                    </div>
                    <h3>{l.title}</h3>
                    <p>{l.question}</p>
                    <div className="lesson-goal">학습목표 · {l.goal}</div>
                    <button
                      className="text-btn"
                      onClick={() => {
                        setPage("journal");
                        setToast(`오늘의 질문: ${l.question}`);
                      }}
                    >
                      성찰 기록하기
                      <ArrowRight size={15} />
                    </button>
                  </section>
                ))}
              </div>
            </>
          )}
          {page === "journal" && (
            <>
              <div className="section-heading toolbar">
                <h3>
                  {teacher
                    ? "생각이 자라는 경제 일기"
                    : "오늘의 선택을 돌아볼까요?"}
                </h3>
                {!teacher && (
                  <button
                    className="btn primary"
                    onClick={() =>
                      ask({
                        title: "나의 경제 일기",
                        description:
                          "정답은 없어요. 나의 생각을 솔직하게 기록해 보세요.",
                        fields: [
                          {
                            name: "activity",
                            label: "오늘 내가 한 경제활동",
                            type: "textarea",
                          },
                          {
                            name: "reason",
                            label: "내가 이렇게 선택한 이유",
                            type: "textarea",
                          },
                          {
                            name: "opportunity",
                            label: "얻은 것과 포기한 것",
                            type: "textarea",
                          },
                          {
                            name: "next",
                            label: "다음에 다르게 선택하고 싶은 것",
                            type: "textarea",
                          },
                        ],
                        submit: "일기 저장",
                        action: async (v) =>
                          act({
                            type: "journal",
                            activity: v.activity,
                            reason: v.reason,
                            opportunity: v.opportunity,
                            next: v.next,
                          }),
                      })
                    }
                  >
                    <Plus size={16} />
                    일기 쓰기
                  </button>
                )}
              </div>
              {state.journals.length === 0 ? (
                <section className="card padded">
                  <Empty
                    text={
                      teacher
                        ? "학생의 성찰 기록이 이곳에 모입니다. 일기는 작성한 학생과 교사만 볼 수 있어요."
                        : "첫 경제 일기를 써보세요. 내 일기는 나와 선생님만 볼 수 있어요."
                    }
                  />
                </section>
              ) : (
                <div className="two-col">
                  {[...state.journals].reverse().map((j) => (
                    <section className="card padded journal-card" key={j.id}>
                      <div className="section-heading">
                        <strong>
                          {directory.find((a) => a.id === j.studentId)?.name}의
                          생각
                        </strong>
                        <small className="muted">{stamp(j.time)}</small>
                      </div>
                      {[
                        ["오늘의 활동", j.activity],
                        ["선택한 이유", j.reason],
                        ["얻은 것과 포기한 것", j.opportunity],
                        ["다음의 선택", j.next],
                      ].map(([label, value]) => (
                        <div className="journal-answer" key={label}>
                          <small>{label}</small>
                          <p>{value}</p>
                        </div>
                      ))}
                      {j.feedback && (
                        <div className="feedback">
                          <strong>선생님의 한마디</strong>
                          <p>{j.feedback}</p>
                        </div>
                      )}
                      {teacher && (
                        <button
                          className="text-btn"
                          onClick={() =>
                            ask({
                              title: "생각을 이어주는 피드백",
                              fields: [
                                {
                                  name: "feedback",
                                  label: "학생에게 전하는 말",
                                  type: "textarea",
                                  value: j.feedback,
                                },
                              ],
                              submit: "피드백 저장",
                              action: async (v) =>
                                act({
                                  type: "feedback",
                                  journalId: j.id,
                                  feedback: v.feedback,
                                }),
                            })
                          }
                        >
                          피드백 남기기
                          <NotebookPen size={15} />
                        </button>
                      )}
                    </section>
                  ))}
                </div>
              )}
            </>
          )}
          {page === "analytics" && (
            <>
              <div className="two-col">
                <section className="card padded">
                  <h3>우리 반 자산 분포</h3>
                  <EconomyChart
                    kind="distribution"
                    accounts={state.accounts}
                    currency={currency}
                  />
                </section>
                <section className="card padded">
                  <h3>소비와 저축 참여</h3>
                  <div className="stat-line">
                    <span>저축 참여</span>
                    <strong>
                      {state.accounts.filter((a) => a.savings > 0).length}명
                    </strong>
                  </div>
                  <div className="stat-line">
                    <span>투자 참여</span>
                    <strong>
                      {
                        state.accounts.filter((a) =>
                          Object.values(a.holdings).some((h) => h.quantity > 0),
                        ).length
                      }
                      명
                    </strong>
                  </div>
                  <div className="stat-line">
                    <span>경제 일기</span>
                    <strong>{state.journals.length}건</strong>
                  </div>
                  <div className="stat-line">
                    <span>평균 현금·저축</span>
                    <strong>
                      {money(
                        state.accounts.length
                          ? total / state.accounts.length
                          : 0,
                      )}
                    </strong>
                  </div>
                  <div className="stat-line">
                    <span>중앙값</span>
                    <strong>
                      {money(
                        median(
                          state.accounts.map((a) => a.balance + a.savings),
                        ),
                      )}
                    </strong>
                  </div>
                </section>
              </div>
              <section className="card padded">
                <h3>과정을 살피는 평가 관점</h3>
                <div className="rubrics">
                  {[
                    "경제 개념을 자신의 말로 설명하는가?",
                    "선택의 근거와 기회비용을 설명하는가?",
                    "투자의 위험과 불확실성을 인식하는가?",
                    "공동체 경제활동에 책임 있게 참여하는가?",
                    "경제적 공정성에 관해 다양한 입장을 고려하는가?",
                  ].map((t) => (
                    <p key={t}>
                      <CheckCircle2 size={18} />
                      {t}
                    </p>
                  ))}
                </div>
                <button className="btn" onClick={() => setPage("journal")}>
                  학생 성찰 살펴보기
                  <ArrowRight size={16} />
                </button>
              </section>
            </>
          )}
          {page === "settings" && (
            <section className="card padded settings-card">
              <h3>우리 반 경제 규칙</h3>
              <p className="muted">변경한 규칙은 이후 거래부터 적용됩니다.</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const settings = {
                    ...state.settings,
                    className: String(f.get("className")),
                    currency: String(f.get("currency")),
                    taxRate: Number(f.get("taxRate")),
                    interestRate: Number(f.get("interestRate")),
                    coinKrw: Number(f.get("coinKrw")),
                    transferLimit: Number(f.get("transferLimit")),
                    holdingLimit: Number(f.get("holdingLimit")),
                    marketOpen: f.get("marketOpen") === "on",
                    shopOpen: f.get("shopOpen") === "on",
                    transfersEnabled: f.get("transfersEnabled") === "on",
                  };
                  confirm(
                    "경제 규칙 저장",
                    [
                      `소득세 ${settings.taxRate}%`,
                      `저축 주간 이자 ${settings.interestRate}%`,
                    ],
                    { type: "settings", ...settings },
                  );
                }}
              >
                <div className="form-grid">
                  {[
                    ["className", "학급 이름", "text"],
                    ["currency", "화폐 이름", "text"],
                    ["taxRate", "소득세율 (%) · 최대 30", "number"],
                    ["interestRate", "주간 저축 이율 (%) · 최대 10", "number"],
                    ["coinKrw", "1코인당 원화 환산값", "number"],
                    ["transferLimit", "송금 1회 한도", "number"],
                    ["holdingLimit", "종목별 최대 보유 주식 수", "number"],
                  ].map(([key, label, type]) => (
                    <label key={key}>
                      {label}
                      <input
                        required
                        name={key}
                        type={type}
                        defaultValue={String(
                          state.settings[key as keyof typeof state.settings],
                        )}
                      />
                    </label>
                  ))}
                </div>
                <div className="toggle-list">
                  {[
                    ["marketOpen", "모의투자 허용"],
                    ["shopOpen", "학급 상점 열기"],
                    ["transfersEnabled", "학생 간 송금 허용"],
                  ].map(([key, label]) => (
                    <label key={key}>
                      <span>{label}</span>
                      <input
                        name={key}
                        type="checkbox"
                        defaultChecked={Boolean(
                          state.settings[key as keyof typeof state.settings],
                        )}
                      />
                    </label>
                  ))}
                </div>
                <button className="btn primary" disabled={busy}>
                  규칙 저장
                </button>
              </form>
              <div className="divider" />
              <h3>연결 상태</h3>
              <p>
                데이터:{" "}
                {mode === "demo"
                  ? "이 브라우저의 데모 데이터"
                  : "Firebase Firestore"}
              </p>
              <p>
                시장 데이터:{" "}
                {quotes[0]?.source === "toss"
                  ? "토스 실제 시세"
                  : "명시적으로 표시된 예시 시세"}
              </p>
              <p className="muted">
                학급 기록은 원장으로 보존합니다. 이 버전은
                직업·은행·상점·공공예산·모의투자·수업·일기의 핵심 운영 기능을
                제공합니다.
              </p>
              {mode === "demo" && (
                <button
                  className="btn danger"
                  onClick={() =>
                    ask({
                      title: "데모 데이터 초기화",
                      description:
                        "현재 브라우저의 데모 활동 기록이 사라집니다. 실제 학급 데이터에는 영향이 없습니다.",
                      submit: "데모 초기화",
                      action: async () => {
                        fullDemo.current = initialState();
                        localStorage.removeItem("class-economy-demo-v1");
                        setState(fullDemo.current);
                        setDirectory(
                          fullDemo.current.accounts.map((a) => ({
                            id: a.id,
                            name: a.name,
                          })),
                        );
                      },
                    })
                  }
                >
                  데모 초기화
                </button>
              )}
            </section>
          )}
          <footer>
            CLASS ECONOMY OS{" "}
            <span>작은 교실에서 시작하는, 함께 살아가는 경제</span>
            <span>
              <ShieldCheck size={13} />
              가상화폐 전용 교육 서비스
            </span>
          </footer>
        </main>
      </div>
      <nav className="mobile-tabs">
        {visibleNav
          .filter((n) =>
            ["home", "bank", "shop", "stocks", "journal"].includes(n[0]),
          )
          .map(([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => setPage(id)}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
      </nav>
      <dialog
        ref={dialogRef}
        onCancel={() => setDialog(null)}
        className="modal"
      >
        {dialog && (
          <form onSubmit={submitDialog}>
            <div className="section-heading">
              <h2>{dialog.title}</h2>
              <button
                type="button"
                className="icon-btn"
                aria-label="닫기"
                onClick={() => setDialog(null)}
              >
                <X size={21} />
              </button>
            </div>
            {dialog.description && (
              <p className="muted">{dialog.description}</p>
            )}
            {dialog.summary && (
              <div className="confirmation-summary">
                {dialog.summary.map((s, i) => (
                  <p key={i}>{s}</p>
                ))}
              </div>
            )}
            {dialog.fields?.map((f) => (
              <label className="field" key={f.name}>
                {f.label}
                {f.options ? (
                  <select required name={f.name} defaultValue={f.value}>
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    name={f.name}
                    defaultValue={f.value}
                    required={f.required !== false}
                    maxLength={1000}
                  />
                ) : (
                  <input
                    name={f.name}
                    type={f.type ?? "text"}
                    defaultValue={f.value}
                    required={f.required !== false}
                    min={f.type === "number" ? 1 : undefined}
                    maxLength={1000}
                  />
                )}
              </label>
            ))}
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setDialog(null)}
              >
                취소
              </button>
              <button disabled={busy} className="btn primary">
                {busy ? "처리 중…" : dialog.submit}
              </button>
            </div>
          </form>
        )}
      </dialog>
      {login && (
        <div className="overlay">
          <section className="modal-panel">
            <div className="section-heading">
              <h2>우리 반으로 로그인</h2>
              <button
                className="icon-btn"
                aria-label="로그인 닫기"
                onClick={() => setLogin(false)}
              >
                <X />
              </button>
            </div>
            <p className="muted">
              실제 학급은 Firebase 계정으로 안전하게 연결해요.
            </p>
            <div className="login-tabs">
              <button
                className={loginType === "teacher" ? "selected" : ""}
                onClick={() => setLoginType("teacher")}
              >
                교사
              </button>
              <button
                className={loginType === "student" ? "selected" : ""}
                onClick={() => setLoginType("student")}
              >
                학생
              </button>
            </div>
            {!firebaseReady && (
              <p className="error-text">
                아직 Firebase 환경변수가 연결되지 않았어요. README의 연결 절차를
                확인해 주세요.
              </p>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  const f = new FormData(e.currentTarget);
                  const email =
                    loginType === "student"
                      ? `${f.get("classId")}.${f.get("email")}@students.invalid`
                      : String(f.get("email"));
                  await signInWithEmailAndPassword(
                    clientAuth(),
                    email,
                    String(f.get("password")),
                  );
                } catch {
                  setError(
                    "로그인 정보를 확인해 주세요. 학급 계정이 없으면 교사에게 문의하세요.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {loginType === "student" && (
                <label className="field">
                  학급 코드
                  <input required name="classId" autoComplete="organization" />
                </label>
              )}
              <label className="field">
                {loginType === "student" ? "학생 아이디" : "이메일"}
                <input
                  required
                  type={loginType === "student" ? "text" : "email"}
                  name="email"
                  autoComplete="username"
                />
              </label>
              <label className="field">
                비밀번호
                <input
                  required
                  type="password"
                  name="password"
                  autoComplete="current-password"
                />
              </label>
              {error && (
                <p className="error-text" role="alert">
                  {error}
                </p>
              )}
              <button
                className="btn primary full"
                disabled={busy || !firebaseReady}
              >
                로그인
              </button>
            </form>
            {loginType === "teacher" && (
              <button
                className="btn full"
                disabled={!firebaseReady || busy}
                onClick={() =>
                  void signInWithPopup(
                    clientAuth(),
                    new GoogleAuthProvider(),
                  ).catch(() => setError("Google 로그인을 완료하지 못했어요."))
                }
              >
                Google로 로그인
              </button>
            )}
            <p className="footnote muted">
              교사 권한은 서버에서 별도로 등록합니다. 가입만으로 관리자 권한을
              얻을 수 없어요.
            </p>
          </section>
        </div>
      )}
      {passwordChange && (
        <div className="overlay">
          <section className="modal-panel">
            <h2>나만의 새 비밀번호 만들기</h2>
            <p>처음 받은 비밀번호를 바꾸면 우리 반에 들어갈 수 있어요.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  if (f.get("password") !== f.get("confirm"))
                    throw Error("비밀번호가 서로 달라요.");
                  await api("/api/password", {
                    method: "POST",
                    body: JSON.stringify({ password: f.get("password") }),
                  });
                  await signOut(clientAuth());
                  setPasswordChange(false);
                  setLogin(true);
                  setToast("새 비밀번호로 다시 로그인해 주세요.");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <label className="field">
                새 비밀번호 (12자 이상)
                <input
                  type="password"
                  name="password"
                  minLength={12}
                  maxLength={100}
                  required
                  autoComplete="new-password"
                />
              </label>
              <label className="field">
                한 번 더 입력
                <input
                  type="password"
                  name="confirm"
                  minLength={12}
                  required
                  autoComplete="new-password"
                />
              </label>
              {error && <p className="error-text">{error}</p>}
              <button className="btn primary full">변경하기</button>
            </form>
          </section>
        </div>
      )}
      {credentials && (
        <div className="overlay">
          <section className="modal-panel">
            <h2>학생 계정이 준비되었어요</h2>
            <p>
              초기 비밀번호는 닫으면 다시 볼 수 없습니다. 학생에게 개별
              전달하세요.
            </p>
            <button
              className="btn primary full"
              onClick={() =>
                download(
                  "학생계정_비공개.csv",
                  "\uFEFF학급코드,이름,아이디,초기비밀번호\n" +
                    credentials
                      .map((c) =>
                        [actor.classId, c.name, c.id, c.password]
                          .map((v) => '"' + v.replaceAll('"', '""') + '"')
                          .join(","),
                      )
                      .join("\n"),
                  "text/csv",
                )
              }
            >
              계정표 다운로드
            </button>
            <button className="btn full" onClick={() => setCredentials(null)}>
              안전하게 보관했어요
            </button>
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={16} />
          </span>
          {toast}
        </div>
      )}
    </div>
  );
  function tradeDialog(q: Quote, side: "buy" | "sell") {
    ask({
      title: `${q.name} ${side === "buy" ? "가상 매수" : "가상 매도"}`,
      description: `1주 약 ${money(Math.ceil(q.price / state!.settings.coinKrw))} · 현재 통장 ${money(me?.balance ?? 0)} · 실제 주문은 발생하지 않아요.`,
      fields: [
        {
          name: "quantity",
          label: "몇 주를 거래할까요? (최대 20)",
          type: "number",
          value: "1",
        },
        {
          name: "reason",
          label: "이 기업을 선택한 이유 (선택)",
          type: "textarea",
          required: false,
        },
      ],
      submit: side === "buy" ? "확인하고 모의 매수" : "확인하고 모의 매도",
      action: async (v) =>
        act({
          type: "trade",
          symbol: q.symbol,
          quantity: Number(v.quantity),
          side,
          reason: v.reason ?? "",
        }),
    });
  }
}
function LedgerList({
  state,
  directory,
  money,
  max,
  onReverse,
}: {
  state: State;
  directory: { id: string; name: string }[];
  money: (n: number) => string;
  max: number;
  onReverse?: (id: string) => void;
}) {
  const rows = [...state.ledger].reverse().slice(0, max);
  if (!rows.length)
    return (
      <Empty text="아직 경제활동 기록이 없어요. 첫 활동을 시작해 보세요." />
    );
  return (
    <div className="ledger-list">
      {rows.map((l) => (
        <div className="ledger-row" key={l.id}>
          <span className={`transaction-icon ${l.amount >= 0 ? "in" : "out"}`}>
            {l.amount >= 0 ? (
              <ArrowDownLeft size={18} />
            ) : (
              <ArrowUpRight size={18} />
            )}
          </span>
          <div className="ledger-info">
            <strong>
              {l.kind}
              <span>
                {" "}
                ·{" "}
                {directory.find((a) => a.id === l.studentId)?.name ??
                  "학급 정부"}
              </span>
            </strong>
            <small>{l.note}</small>
          </div>
          <div className="ledger-money">
            <strong className={l.amount >= 0 ? "blue-text" : ""}>
              {l.amount > 0 ? "+" : ""}
              {money(l.amount)}
              {l.savingsDelta !== 0 && (
                <small>
                  저축 {l.savingsDelta > 0 ? "+" : ""}
                  {money(l.savingsDelta)}
                </small>
              )}
            </strong>
            <small>{stamp(l.time)}</small>
          </div>
          {onReverse &&
            ["보너스", "저축", "저축 인출", "저축 이자"].includes(l.kind) && (
              <button className="text-btn" onClick={() => onReverse(l.id)}>
                보정
              </button>
            )}
        </div>
      ))}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <div>
        <Sprout size={26} />
      </div>
      <p>{text}</p>
    </div>
  );
}
function SearchBox({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (s: string) => void;
  label: string;
}) {
  return (
    <label className="search-box">
      <Search size={18} />
      <input
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function median(values: number[]) {
  if (!values.length) return 0;
  const a = [...values].sort((a, b) => a - b);
  const n = a.length;
  return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
}
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
