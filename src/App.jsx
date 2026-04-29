import { useState, useEffect, useContext, createContext, useCallback } from "react";
import {
  LayoutDashboard, Building2, GraduationCap, Shuffle, ClipboardList,
  LogOut, Search, Plus, Eye, EyeOff, BookOpen, FileText, User,
  ShieldCheck, ChevronRight, ChevronLeft, CheckCircle2, Clock, AlertCircle,
  Loader2, Lock, Users, Activity, Check, X, MessageSquare, Award,
  Briefcase, BarChart3, Mail, Phone, Code2, ExternalLink, MapPin, UserCheck, TrendingUp, CheckCircle, KeyRound
} from "lucide-react";
import {
  supabase, signIn, signOut, registerUser,
  getAllUsers, getUsersByRole, getUserById, updateUser,
  getOrgsByStatus, approveOrg, rejectOrg,
  allocateStudent, deallocateStudent,
  getAllLogbooks, getStudentLogbooks, submitLogbook, reviewLogbook,
  submitSupReport, getSupReports,
  getAllAssessments, submitAssessment,
  createIndustrialSupervisor,
  getOrganisationIndustrialSupervisors,
  setDefaultIndustrialSupervisor,
  getStudentsBySupervisor,       
  getGlobalUniversitySupervisor,
} from "./supabase";


// ─────────────────────────────────────────────────────────────
// Reference data (must be defined before components)
// ─────────────────────────────────────────────────────────────
const LOCS = ["Gaborone","Francistown","Maun","Serowe","Lobatse","Palapye","Molepolole","Kanye","Jwaneng","Orapa"];
const PROGRAMMES = ["BSc Computer Science","BSc Information Technology","BSc Information Systems","BSc Computing with Finance","BCom Information Systems","BCom Finance","BCom Accounting","BSc Electrical Engineering","BSc Networks & Security","BSc Data Science","BA Business Administration"];
const INDUSTRIES = ["Information Technology","Finance & Banking","Telecommunications","Healthcare & Medical","Government & Public Sector","Education & Research","Mining & Natural Resources","Retail & Commerce","Energy & Utilities","Construction & Engineering"];
const PREF_ROLES = ["Software Developer","Data Analyst","Network Administrator","Cybersecurity Analyst","Business Analyst","Systems Analyst","Database Administrator","Finance Analyst","Project Manager","DevOps Engineer","UX/UI Designer"];
const SKILLS_LIST = ["React","Node.js","Python","Django","Java","SQL","Android","iOS","Networks","Cybersecurity","Data Science","Machine Learning","DevOps","Cloud (AWS/Azure)","PHP","C#/.NET","TypeScript","Excel/VBA","Power BI","Accounting Software","C/C++","R"];
const STU_BACKGROUNDS = ["Computer Science","Information Technology","Information Systems","Computing with Finance","Engineering","Finance","Accounting","Business Administration","Data Science","Any STEM"];
const IND_RATE_KEYS = ["Technical Competence","Professionalism","Communication","Teamwork","Problem Solving","Punctuality"];
const UNI_RATE_KEYS = ["Technical Knowledge","Work Quality","Professional Conduct","Progress vs Objectives","Documentation Quality"];

// ─────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────
function pwStrength(p) {
  return [p.length >= 8, p.length >= 12, /[A-Z]/.test(p), /[0-9]/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length;
}

const AV_COLORS = ["#6B1A2A","#4A0E1C","#B8892A","#1A4E8A","#1A7A3C","#6B3D60"];
function Avatar({ name = "?", size = 30 }) {
  const bg = AV_COLORS[(name || "?").charCodeAt(0) % AV_COLORS.length];
  const ini = (name || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * .36), fontWeight: 700, flexShrink: 0 }}>{ini}</div>;
}
function Bdg({ status = "" }) {
  const s = status.toLowerCase();
  let cls = "bdg-gray";
  if (["approved","confirmed","submitted","open","allocated"].includes(s)) cls = "bdg-green";
  else if (["pending","under review","pending approval"].includes(s)) cls = "bdg-amber";
  else if (["rejected","full","not approved"].includes(s)) cls = "bdg-red";
  else if (s === "revision") cls = "bdg-gold";
  return <span className={"bdg " + cls}>{status}</span>;
}
function CardTitle({ children }) { return <div className="ct"><div className="ct-bar" />{children}</div>; }
function Toasts({ list }) { return <div className="toast-stack">{list.map(t => <div key={t.id} className={"toast " + t.type}>{t.type === "ok" ? <CheckCircle2 /> : <AlertCircle />}{t.msg}</div>)}</div>; }
function Boot() {
  return (
    <div className="boot">
      <Loader2 style={{ width: 16, height: 16, color: "#B8892A", animation: "spin 1s linear infinite" }} />
      <p style={{ fontSize: 12, color: "rgba(255,255,255,.32)" }}>Loading…</p>
    </div>
  );
}
function StatCard({ n, label, color, Icon }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (n === 0) { setV(0); return; }
    let i = 0;
    const t = setInterval(() => { i += Math.ceil(n / 10); if (i >= n) { setV(n); clearInterval(t); } else { setV(i); } }, 50);
    return () => clearInterval(t);
  }, [n]);
  return <div className="stat"><div className="stat-stripe" style={{ background: color }} /><div className="stat-ico"><Icon /></div><div className="stat-n">{v}</div><div className="stat-l">{label}</div></div>;
}
function RatingRows({ keys, ratings, setRatings }) {
  return <div>{keys.map(k => <div key={k} className="rating-row"><div className="rating-lbl">{k}</div><select className="rating-sel" value={ratings[k] || "3"} onChange={e => setRatings(p => ({ ...p, [k]: e.target.value }))}>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}</select></div>)}</div>;
}
function matchScore(stu, org) {
  let s = 0;
  const sk = (stu.skills || []).filter(x => (org.skills || []).includes(x)).length;
  s += Math.min(sk * 18, 36);
  if (stu.preferred_location === org.location) s += 22;
  if ((org.allocated_count || 0) < org.capacity) s += 14;
  if ((org.preferred_background || []).some(b => (stu.programme || "").toLowerCase().includes(b.toLowerCase().split(" ")[0]))) s += 16;
  if (stu.preferred_industry === org.industry) s += 20;
  return Math.min(s, 99);
}

// ─────────────────────────────────────────────────────────────
// Navigation configuration
// ─────────────────────────────────────────────────────────────
const NAV = {
  coordinator: [
  { k: "dashboard", l: "Dashboard", I: LayoutDashboard },
  { k: "organisations", l: "Organisations", I: Building2 },
  { k: "students", l: "Students", I: GraduationCap },
  { k: "matching", l: "Matching Engine", I: Shuffle },
  { k: "submissions", l: "Submissions", I: ClipboardList },
  { k: "approvals", l: "Org Approvals", I: UserCheck },
  ],
  student: [
    { k: "dashboard", l: "Dashboard", I: LayoutDashboard },
    { k: "profile", l: "My Profile", I: User },
    { k: "allocation", l: "My Placement", I: Briefcase },
    { k: "logbook", l: "Logbook", I: BookOpen },
    { k: "assessments", l: "My Assessments", I: Award },
  ],
  organization: [
  { k: "dashboard", l: "Dashboard", I: LayoutDashboard },
  { k: "profile", l: "Org Profile", I: Building2 },
  { k: "students", l: "My Students", I: Users },
  ],

  supervisor: [
    { k: "dashboard", l: "Dashboard", I: LayoutDashboard },
    { k: "reports", l: "Reports", I: FileText },
  ],
};
const PAGE_META = {
  dashboard: { l: "Dashboard", d: "Overview and key metrics" },
  organisations: { l: "Organisations", d: "Registered partner organisations" },
  students: { l: "Students", d: "All students and placements" },
  matching: { l: "Matching Engine", d: "AI-assisted placement recommendations" },
  submissions: { l: "Submissions", d: "Logbooks, reports and assessments" },
  approvals: { l: "Org Approvals", d: "Review and approve organisation registrations" },
  profile: { l: "Profile", d: "Manage your details" },
  allocation: { l: "My Placement", d: "Your internship details" },
  logbook: { l: "Logbook", d: "Weekly activity documentation" },
  "logbook-review": { l: "Logbook Review", d: "Review student entries" },
  reports: { l: "Reports & Assessments", d: "Submit and track reports" },
};

// ─────────────────────────────────────────────────────────────
// CSS (full original styling – keep as is)
// ─────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--mr:#6B1A2A;--mr-dk:#4A0E1C;--mr-md:#852236;--mr-xs:rgba(107,26,42,.07);--mr-sm:rgba(107,26,42,.13);--gold:#B8892A;--gold-lt:#F4E8CC;--bg:#F8F4F5;--s1:#fff;--s2:#F7F2F3;--s3:#EDE4E6;--b1:rgba(107,26,42,.09);--b2:rgba(107,26,42,.16);--b3:rgba(107,26,42,.24);--t1:#1A080D;--t2:#5C3040;--t3:#9B7885;--green:#1A7A3C;--green-bg:rgba(26,122,60,.10);--green-bd:rgba(26,122,60,.22);--amber:#8A5C00;--amber-bg:rgba(138,92,0,.10);--amber-bd:rgba(138,92,0,.20);--red:#B01C1C;--red-bg:rgba(176,28,28,.10);--red-bd:rgba(176,28,28,.20);--blue:#1A4E8A;--blue-bg:rgba(26,78,138,.10);--r:6px;--r2:10px;--r3:14px}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--t1);min-height:100vh;-webkit-font-smoothing:antialiased}
h1,h2,h3,h4{font-family:'Space Grotesk',sans-serif}
input,select,textarea,button{font-family:'Inter',sans-serif;font-size:13px}
.shell{display:flex;min-height:100vh}
.sidebar{width:240px;background:var(--mr-dk);display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;z-index:50}
.sb-brand{background:var(--mr);padding:16px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:10px}
.sb-icon{width:34px;height:34px;border-radius:8px;background:rgba(184,137,42,.18);border:1px solid rgba(184,137,42,.25);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sb-icon svg{width:17px;height:17px;color:var(--gold)}
.sb-title{font-size:14px;font-weight:800;color:#fff}.sb-sub{font-size:10px;color:rgba(255,255,255,.38);letter-spacing:.5px;text-transform:uppercase;margin-top:1px}
.sb-role{margin:8px 10px;padding:5px 9px;background:rgba(184,137,42,.10);border:1px solid rgba(184,137,42,.18);border-radius:5px;display:flex;align-items:center;gap:6px}
.sb-role svg{width:11px;height:11px;color:var(--gold)}.sb-role span{font-size:10px;font-weight:700;color:var(--gold);letter-spacing:.5px;text-transform:uppercase}
.nav{flex:1;padding:5px 7px;overflow-y:auto}
.ni{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:var(--r);font-size:13px;font-weight:500;color:rgba(255,255,255,.55);cursor:pointer;transition:all .14s;margin-bottom:1px;border:1px solid transparent;position:relative}
.ni:hover{background:rgba(255,255,255,.06);color:rgba(255,255,255,.88)}
.ni.active{background:rgba(184,137,42,.13);border-color:rgba(184,137,42,.2);color:#fff}
.ni.active::before{content:'';position:absolute;left:-1px;top:50%;transform:translateY(-50%);width:3px;height:16px;background:var(--gold);border-radius:0 3px 3px 0}
.ni svg{width:14px;height:14px;flex-shrink:0}
.ni-badge{margin-left:auto;background:var(--red);color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700;min-width:18px;text-align:center}
.sb-foot{padding:10px;border-top:1px solid rgba(255,255,255,.07)}
.sb-user{display:flex;align-items:center;gap:8px;padding:7px 9px;margin-bottom:7px}
.uname{font-size:13px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px}
.uemail{font-size:11px;color:rgba(255,255,255,.32);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;margin-top:1px}
.logout-btn{width:100%;padding:7px;background:transparent;border:1px solid rgba(255,255,255,.12);border-radius:var(--r);color:rgba(255,255,255,.5);font-size:12px;font-weight:500;cursor:pointer;transition:all .14s;display:flex;align-items:center;justify-content:center;gap:6px}
.logout-btn:hover{background:var(--red-bg);border-color:var(--red-bd);color:#ef9999}
.logout-btn svg{width:13px;height:13px}
.main{margin-left:240px;flex:1;display:flex;flex-direction:column;min-height:100vh}
.topbar{background:var(--s1);border-bottom:1px solid var(--b1);padding:14px 28px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:30}
.tb-bc{font-size:10px;color:var(--t3);letter-spacing:.4px;text-transform:uppercase;font-weight:600;margin-bottom:2px;display:flex;align-items:center;gap:3px}
.tb-bc svg{width:10px;height:10px}
.tb-h{font-size:18px;font-weight:800;color:var(--t1);letter-spacing:-.3px}
.tb-sub{font-size:12px;color:var(--t3);margin-top:1px}
.tb-badge{padding:4px 9px;background:var(--mr-xs);border:1px solid var(--b1);border-radius:5px;font-size:10px;font-weight:700;color:var(--mr);letter-spacing:.4px;text-transform:uppercase}
.page{padding:22px 28px;flex:1}
.auth-shell{min-height:100vh;display:flex;background:var(--bg)}
.auth-left{width:400px;background:var(--mr-dk);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 40px;flex-shrink:0;position:relative;overflow:hidden}
.auth-left::after{content:'';position:absolute;bottom:-80px;right:-80px;width:260px;height:260px;border-radius:50%;background:rgba(184,137,42,.06);pointer-events:none}
.auth-inner{position:relative;z-index:1;width:100%;text-align:center}
.auth-crest{width:54px;height:54px;background:rgba(184, 137, 42, 0);border:1px solid rgba(184, 137, 42, 0);border-radius:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px}
.auth-crest svg{width:26px;height:26px;color:var(--gold)}
.auth-left h1{font-size:24px;font-weight:800;color:#fff;letter-spacing:-.4px;margin-bottom:4px}
.auth-bar{width:32px;height:3px;background:var(--gold);border-radius:2px;margin:10px auto 12px}
.auth-left p{font-size:13px;color:rgba(255,255,255,.48);line-height:1.6;margin-bottom:24px}
.auth-feat{display:flex;flex-direction:column;gap:8px;text-align:left}
.auth-feat-item{display:flex;align-items:center;gap:9px}
.auth-feat-dot{width:17px;height:17px;border-radius:50%;background:rgba(184,137,42,.15);border:1px solid rgba(184,137,42,.25);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.auth-feat-dot svg{width:9px;height:9px;color:var(--gold)}
.auth-feat span{font-size:12px;color:rgba(255,255,255,.58)}
.auth-right{flex:1;display:flex;align-items:center;justify-content:center;padding:40px}
.auth-box{width:100%;max-width:390px}
.auth-box h2{font-size:20px;font-weight:800;color:var(--t1);margin-bottom:4px;letter-spacing:-.3px}
.auth-box .af-sub{font-size:13px;color:var(--t2);margin-bottom:20px;line-height:1.5}
.role-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:4px;margin-bottom:18px}
.role-btn{padding:7px 4px;background:transparent;border:none;border-radius:5px;font-size:10px;font-weight:700;cursor:pointer;color:var(--t3);letter-spacing:.3px;text-transform:uppercase;display:flex;flex-direction:column;align-items:center;gap:3px;transition:all .14s}
.role-btn svg{width:13px;height:13px}
.role-btn.active{background:var(--mr);color:#fff;box-shadow:0 2px 8px rgba(107,26,42,.25)}
.forgot-link{background:none;border:none;cursor:pointer;font-size:12px;color:var(--t3);padding:0;text-decoration:underline;text-underline-offset:2px}
.forgot-link:hover{color:var(--mr)}
.demo-link{background:none;border:none;cursor:pointer;font-size:11px;color:var(--t3);text-decoration:underline;text-underline-offset:2px;padding:0}
.demo-link:hover{color:var(--mr)}
.fg{margin-bottom:12px}
.fg label{display:block;font-size:10px;font-weight:700;margin-bottom:4px;color:var(--t2);letter-spacing:.45px;text-transform:uppercase}
.fg label .opt{text-transform:none;font-weight:400;color:var(--t3);font-size:10px;margin-left:4px}
.fi{width:100%;padding:8px 10px;background:var(--s1);border:1.5px solid var(--b2);border-radius:var(--r);font-size:13px;color:var(--t1);outline:none;transition:border-color .14s,box-shadow .14s;-webkit-appearance:none}
.fi:focus{border-color:var(--mr);box-shadow:0 0 0 3px rgba(107,26,42,.09)}
.fi::placeholder{color:var(--t3)}
.fi[readonly]{background:var(--s2);color:var(--t2);cursor:not-allowed;border-color:var(--b1)}
select.fi{cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%239B7885' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;padding-right:28px}
textarea.fi{resize:vertical;min-height:80px;line-height:1.6}
.fi-wrap{position:relative}
.fi-wrap .fi-ico{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--t3);pointer-events:none;display:flex;align-items:center}
.fi-wrap .fi-ico svg{width:13px;height:13px}
.fi-wrap .fi{padding-left:30px}
.fi-wrap .fi-eye{position:absolute;right:9px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--t3);display:flex;align-items:center;padding:2px}
.fi-wrap .fi-eye svg{width:13px;height:13px}
.fi-hint{font-size:11px;color:var(--t3);margin-top:3px}
.fi-hint.ok{color:var(--green)}
.fr{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.str-bar{display:flex;gap:3px;margin-top:5px}
.str-seg{flex:1;height:3px;border-radius:3px;transition:background .25s}
.btn{padding:8px 16px;border:none;border-radius:var(--r);font-size:13px;font-weight:600;cursor:pointer;transition:all .14s;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.btn svg{width:13px;height:13px;flex-shrink:0}
.btn-primary{background:var(--mr);color:#fff}.btn-primary:hover{background:var(--mr-md)}.btn-primary:disabled{opacity:.45;cursor:not-allowed}
.btn-ghost{background:transparent;border:1.5px solid var(--b2);color:var(--t1)}.btn-ghost:hover{background:var(--s2)}
.btn-success{background:var(--green-bg);border:1px solid var(--green-bd);color:var(--green)}.btn-success:hover{background:rgba(26,122,60,.16)}
.btn-danger{background:var(--red-bg);border:1px solid var(--red-bd);color:var(--red)}.btn-danger:hover{background:rgba(176,28,28,.16)}
.btn-full{width:100%;justify-content:center;padding:10px}
.btn-sm{padding:5px 11px;font-size:12px}.btn-xs{padding:3px 8px;font-size:11px}
.card{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r2);padding:18px 20px;margin-bottom:13px}
.card-lift{transition:border-color .14s,box-shadow .14s}.card-lift:hover{border-color:var(--b2);box-shadow:0 2px 12px rgba(107,26,42,.07)}
.ct{font-size:10px;font-weight:700;color:var(--t3);letter-spacing:.9px;text-transform:uppercase;margin-bottom:13px;display:flex;align-items:center;gap:5px}
.ct-bar{width:3px;height:11px;background:var(--gold);border-radius:2px;flex-shrink:0}
.sec-hd{font-size:10px;font-weight:700;color:var(--mr);letter-spacing:.6px;text-transform:uppercase;margin:16px 0 10px;padding-bottom:4px;border-bottom:2px solid var(--gold-lt);display:inline-block}
.sec-hd:first-child{margin-top:0}
.stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:18px}
.stat{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r2);padding:14px 16px;position:relative;overflow:hidden}
.stat-stripe{height:3px;position:absolute;top:0;left:0;right:0}
.stat-n{font-family:'Space Grotesk',sans-serif;font-size:26px;font-weight:800;letter-spacing:-1px;line-height:1;color:var(--t1);margin-top:3px}
.stat-l{font-size:10px;color:var(--t3);font-weight:600;margin-top:3px;letter-spacing:.35px;text-transform:uppercase}
.stat-ico{position:absolute;top:11px;right:12px;opacity:.1}
.stat-ico svg{width:18px;height:18px;color:var(--mr)}
.tbl-wrap{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r2);overflow:hidden;margin-bottom:13px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{padding:8px 13px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--t3);border-bottom:1px solid var(--b1);text-align:left;background:var(--s2);white-space:nowrap}
td{padding:10px 13px;border-bottom:1px solid var(--b1);vertical-align:middle}
tr:last-child td{border-bottom:none}
tbody tr:hover td{background:var(--s2)}
.bdg{display:inline-flex;align-items:center;gap:3px;padding:3px 7px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap}
.bdg::before{content:'';width:5px;height:5px;border-radius:50%;flex-shrink:0}
.bdg-green{background:var(--green-bg);color:var(--green)}.bdg-green::before{background:var(--green)}
.bdg-amber{background:var(--amber-bg);color:var(--amber)}.bdg-amber::before{background:var(--amber)}
.bdg-red{background:var(--red-bg);color:var(--red)}.bdg-red::before{background:var(--red)}
.bdg-blue{background:var(--blue-bg);color:var(--blue)}.bdg-blue::before{background:var(--blue)}
.bdg-maroon{background:var(--mr-xs);color:var(--mr)}.bdg-maroon::before{background:var(--mr)}
.bdg-gold{background:rgba(184,137,42,.12);color:var(--gold)}.bdg-gold::before{background:var(--gold)}
.bdg-gray{background:var(--s3);color:var(--t2)}.bdg-gray::before{background:var(--t3)}
.alert{padding:9px 11px;border-radius:var(--r);font-size:13px;margin-bottom:11px;display:flex;align-items:flex-start;gap:7px;line-height:1.5}
.alert svg{width:14px;height:14px;flex-shrink:0;margin-top:1px}
.a-ok{background:var(--green-bg);border:1px solid var(--green-bd);color:var(--green)}
.a-err{background:var(--red-bg);border:1px solid var(--red-bd);color:var(--red)}
.a-inf{background:var(--blue-bg);border:1px solid rgba(26,78,138,.2);color:var(--blue)}
.a-warn{background:var(--amber-bg);border:1px solid var(--amber-bd);color:var(--amber)}
.toast-stack{position:fixed;top:14px;right:14px;z-index:999;display:flex;flex-direction:column;gap:6px;pointer-events:none}
.toast{background:var(--s1);border:1px solid var(--b2);border-radius:var(--r);padding:10px 13px;font-size:13px;font-weight:500;min-width:250px;max-width:320px;box-shadow:0 6px 20px rgba(107,26,42,.13);display:flex;align-items:center;gap:7px;animation:tslide .18s ease;pointer-events:all}
.toast svg{width:14px;height:14px;flex-shrink:0}
.toast.ok{border-left:3px solid var(--green)}.toast.ok svg{color:var(--green)}
.toast.err{border-left:3px solid var(--red)}.toast.err svg{color:var(--red)}
@keyframes tslide{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}
.tag{display:inline-block;padding:2px 6px;background:var(--mr-xs);border:1px solid var(--mr-sm);border-radius:4px;font-size:11px;font-weight:600;color:var(--mr);margin:2px}
.chip{padding:4px 10px;border:1.5px solid var(--b2);border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;color:var(--t2);background:transparent;display:inline-block;margin:2px;transition:all .13s}
.chip:hover{border-color:var(--b3);color:var(--t1)}
.chip.on{background:var(--mr);border-color:var(--mr);color:#fff}
.chip-wrap{display:flex;flex-wrap:wrap;gap:3px;margin-top:4px}
.ab{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px}
.sw{position:relative}.sw svg{position:absolute;left:8px;top:50%;transform:translateY(-50%);width:13px;height:13px;color:var(--t3)}
.si{background:var(--s1);border:1.5px solid var(--b1);border-radius:var(--r);padding:7px 9px 7px 27px;font-size:13px;color:var(--t1);outline:none;width:200px}
.si:focus{border-color:var(--mr);box-shadow:0 0 0 3px rgba(107,26,42,.08)}
.si::placeholder{color:var(--t3)}
.empty{text-align:center;padding:40px 20px;color:var(--t3)}
.empty svg{width:28px;height:28px;margin-bottom:8px;opacity:.2}
.empty p{font-size:13px}
.lb-card{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r2);padding:13px 16px;margin-bottom:8px}
.lb-card:hover{border-color:var(--b2)}
.lb-wk{font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
.lb-title{font-size:14px;font-weight:700;color:var(--t1);margin-bottom:4px}
.lb-body{font-size:13px;color:var(--t2);line-height:1.6}
.lb-cmt{margin-top:8px;padding:8px 10px;background:var(--mr-xs);border:1px solid var(--mr-sm);border-left:3px solid var(--mr);border-radius:var(--r);font-size:12px;color:var(--mr)}
.mc{background:var(--s1);border:1.5px solid var(--b1);border-radius:var(--r2);padding:13px;cursor:pointer;margin-bottom:7px;transition:all .15s}
.mc:hover{border-color:var(--b2);box-shadow:0 2px 8px rgba(107,26,42,.07)}
.mc.sel{border-color:var(--mr);background:var(--mr-xs)}
.score-n{font-family:'Space Grotesk',sans-serif;font-size:20px;font-weight:800;color:var(--mr);line-height:1}
.score-bar{height:4px;background:var(--s3);border-radius:4px;overflow:hidden;margin-top:4px}
.score-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,var(--mr),var(--gold));transition:width .5s}
.rating-row{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--b1)}
.rating-row:last-child{border-bottom:none}
.rating-lbl{flex:1;font-size:13px;color:var(--t1)}
.rating-sel{background:var(--s2);border:1.5px solid var(--b1);border-radius:6px;padding:5px 8px;font-size:13px;color:var(--t1);outline:none;width:78px;cursor:pointer}
.rating-sel:focus{border-color:var(--mr)}
.tabs{display:flex;background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:3px;margin-bottom:15px}
.tab{flex:1;padding:6px 8px;border:none;background:transparent;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer;color:var(--t3);letter-spacing:.2px;text-transform:uppercase;transition:all .14s}
.tab.active{background:var(--s1);color:var(--mr);box-shadow:0 1px 4px rgba(107,26,42,.1)}
.overlay{position:fixed;inset:0;background:rgba(26,8,13,.55);display:flex;align-items:center;justify-content:center;z-index:200;backdrop-filter:blur(3px)}
.modal{background:var(--s1);border:1px solid var(--b2);border-radius:var(--r3);width:560px;max-width:96vw;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(107,26,42,.2)}
.modal-hd{padding:16px 20px;border-bottom:1px solid var(--b1);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.modal-hd h3{font-size:16px;font-weight:800;color:var(--t1);letter-spacing:-.3px}
.modal-close{background:none;border:none;cursor:pointer;color:var(--t3);display:flex;align-items:center;padding:4px;border-radius:5px}
.modal-close:hover{background:var(--s3);color:var(--t1)}
.modal-close svg{width:15px;height:15px}
.modal-steps{padding:9px 20px;border-bottom:1px solid var(--b1);display:flex;gap:5px;flex-shrink:0}
.step-track{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px}
.step-bar{width:100%;height:3px;border-radius:3px;transition:background .2s}
.step-lbl{font-size:9px;font-weight:700;letter-spacing:.35px;text-transform:uppercase;transition:color .2s}
.modal-body{padding:18px 20px;overflow-y:auto;flex:1}
.modal-ft{padding:12px 20px;border-top:1px solid var(--b1);display:flex;align-items:center;justify-content:flex-end;gap:7px;background:var(--s2);border-radius:0 0 var(--r3) var(--r3);flex-shrink:0}
.prof-hero{display:flex;align-items:center;gap:12px;padding:13px 14px;background:linear-gradient(135deg,var(--mr-dk),var(--mr));border-radius:var(--r2);margin-bottom:14px}
.ph-name{font-size:15px;font-weight:800;color:#fff;letter-spacing:-.2px}
.ph-sub{font-size:12px;color:rgba(255,255,255,.5);margin-top:2px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
.info-cell{padding:9px 11px;background:var(--s2);border-radius:var(--r);border:1px solid var(--b1)}
.ic-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--t3);margin-bottom:2px}
.ic-val{font-size:13px;font-weight:600;color:var(--t1)}
.status-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg)}
.status-box{text-align:center;max-width:440px;padding:40px}
.status-icon{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px}
.status-icon svg{width:28px;height:28px}
.boot{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--mr-dk);gap:10px}
/* Improve card shadows and hover */
.card {
  transition: all 0.2s ease;
  border: 1px solid var(--b1);
}
.card:hover {
  border-color: var(--b2);
  box-shadow: 0 4px 12px rgba(107,26,42,0.08);
}

/* Better table styling */
.tbl-wrap {
  border-radius: var(--r2);
  overflow: hidden;
}
th {
  background: var(--s2);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Improve buttons */
.btn-primary {
  background: linear-gradient(135deg, var(--mr), var(--mr-dk));
  border: none;
}
.btn-primary:hover {
  background: var(--mr-dk);
  transform: translateY(-1px);
}
.btn-ghost {
  background: transparent;
  border: 1px solid var(--b2);
}
.btn-ghost:hover {
  background: var(--s2);
  border-color: var(--b3);
}

/* Better empty states */
.empty {
  background: var(--s2);
  border-radius: var(--r2);
  padding: 48px 20px;
}
.empty svg {
  opacity: 0.3;
  stroke-width: 1.5;
}

/* Sidebar subtle improvement */
.sidebar {
  background: linear-gradient(180deg, var(--mr-dk) 0%, #2E0A16 100%);
}
.sb-brand {
  background: rgba(0,0,0,0.2);
}
.ni.active {
  background: rgba(184,137,42,0.15);
  border-color: rgba(184,137,42,0.3);
}

/* Stats cards */
.stat {
  transition: transform 0.2s, box-shadow 0.2s;
}
.stat:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(107,26,42,0.1);
}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pg{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
.pg{animation:pg .18s ease}
`;

// ─────────────────────────────────────────────────────────────
// Forgot Password Modal
// ─────────────────────────────────────────────────────────────
function ForgotPasswordModal({ onClose }) {
  return (
    <div className="overlay">
      <div className="modal" style={{ width: 400 }}>
        <div className="modal-hd">
          <h3>Forgot Password</h3>
          <button className="modal-close" onClick={onClose}><X /></button>
        </div>
        <div className="modal-body">
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--amber-bg)", border: "1px solid var(--amber-bd)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <KeyRound style={{ width: 22, height: 22, color: "var(--amber)" }} />
            </div>
            <h3 style={{ marginBottom: 8, fontSize: 17 }}>Password Reset</h3>
            <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.65, marginBottom: 10 }}>Password reset is not yet available in this release.</p>
            <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.65, marginBottom: 16 }}>Please contact the IT Help Desk or your system coordinator for assistance.</p>
            <div style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: "var(--r)", padding: "11px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--t3)", marginBottom: 5 }}>IT Help Desk</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>it-support@ub.ac.bw</div>
              <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>+267 355 0000</div>
            </div>
          </div>
        </div>
        <div className="modal-ft">
          <button className="btn btn-primary" onClick={onClose}><Check />Got it</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Org status screens
// ─────────────────────────────────────────────────────────────
function OrgPendingScreen({ user, onLogout }) {
  const steps = ["Registration received", "Coordinator reviews your details", "Approval notification sent", "Full system access granted"];
  return (
    <div className="status-screen">
      <div className="status-box">
        <div className="status-icon" style={{ background: "var(--amber-bg)", border: "1px solid var(--amber-bd)" }}>
          <Clock style={{ color: "var(--amber)" }} />
        </div>
        <h2 style={{ marginBottom: 8 }}>Pending Approval</h2>
        <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.65, marginBottom: 20 }}><strong>{user.name}</strong> is registered and awaiting coordinator verification. You will have full system access once approved.</p>
        <div className="card" style={{ textAlign: "left", marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--t3)", marginBottom: 10 }}>What happens next</div>
          {steps.map((s,i)=>(
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: i===0?"var(--green-bg)":"var(--mr-xs)", border: "1px solid "+(i===0?"var(--green-bd)":"var(--mr-sm)"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: i===0?"var(--green)":"var(--mr)", flexShrink: 0 }}>
                {i===0?<Check style={{ width: 10, height: 10 }}/>:i+1}
              </div>
              <span style={{ fontSize: 13, color: i===0?"var(--green)":"var(--t2)", fontWeight: i===0?600:400 }}>{s}</span>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost" style={{ margin: "0 auto" }} onClick={onLogout}><LogOut />Sign Out</button>
      </div>
    </div>
  );
}
function OrgRejectedScreen({ user, onLogout }) {
  return (
    <div className="status-screen">
      <div className="status-box">
        <div className="status-icon" style={{ background: "var(--red-bg)", border: "1px solid var(--red-bd)" }}>
          <X style={{ color: "var(--red)" }} />
        </div>
        <h2 style={{ marginBottom: 8, color: "var(--red)" }}>Registration Not Approved</h2>
        <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.65, marginBottom: 14 }}><strong>{user.name}</strong> was not approved to access IAMS.</p>
        {user.rejection_reason && (
          <div className="alert a-err" style={{ textAlign: "left", marginBottom: 14 }}>
            <AlertCircle />
            <div><strong>Reason: </strong>{user.rejection_reason}</div>
          </div>
        )}
        <p style={{ fontSize: 13, color: "var(--t3)", marginBottom: 20 }}>Contact the coordinator at <strong>coordinator@ub.ac.bw</strong> for further information.</p>
        <button className="btn btn-ghost" style={{ margin: "0 auto" }} onClick={onLogout}><LogOut />Sign Out</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Login Page
// ─────────────────────────────────────────────────────────────
function LoginPage({ onLogin, onRegister }) {
  const [role, setRole] = useState("coordinator");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const placeholders = {
    coordinator: "coordinator@ub.ac.bw",
    student: "202300001@ub.ac.bw",
    organization: "organisation@company.co.bw",
    supervisor: "supervisor@company.co.bw"
  };

  const roles = [
    { k: "coordinator", l: "Coord", I: BarChart3 },
    { k: "student", l: "Student", I: GraduationCap },
    { k: "organization", l: "Org", I: Building2 },
    { k: "supervisor", l: "Sup", I: Award }
  ];

  async function login() {
    if (!email || !pw) {
      setErr("Email and password required.");
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const user = await signIn(email.trim().toLowerCase(), pw);
      if (user.role !== role) {
        setErr("Wrong role selected for this account.");
      } else {
        onLogin(user);
      }
    } catch {
      setErr("Invalid credentials. Check email, password, and selected role.");
    }
    setLoading(false);
  }

  return (
    <div className="auth-shell">
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
      <div className="auth-left">
        <div className="auth-inner">
          <div className="auth-crest">
            <img src="/UB.png" alt="UB Logo" style={{ width: "133px", height: "150px", objectFit: "contain" }} />
          </div>
          <br />
          <div className="auth-bar" />
          <p style={{ color: "white", font: "bold" }}>
            University of Botswana <br />
            Industrial Attachment Management System
          </p>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-box">
          <h2>Welcome Back</h2>
          <p className="af-sub">Select your role and sign in to continue.</p>
          <div className="role-grid">
            {roles.map(({ k, l, I }) => (
              <button
                key={k}
                className={"role-btn" + (role === k ? " active" : "")}
                onClick={() => {
                  setRole(k);
                  setEmail("");
                  setErr("");
                }}
              >
                <I />
                {l}
              </button>
            ))}
          </div>
          {err && (
            <div className="alert a-err">
              <AlertCircle />
              {err}
            </div>
          )}
          <div className="fg">
            <label>Email Address</label>
            <div className="fi-wrap">
              <div className="fi-ico"><Lock /></div>
              <input
                className="fi"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={placeholders[role]}
                onKeyDown={(e) => e.key === "Enter" && login()}
              />
            </div>
          </div>
          <div className="fg">
            <label>Password</label>
            <div className="fi-wrap">
              <input
                className="fi"
                type={showPw ? "text" : "password"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="••••••••"
                onKeyDown={(e) => e.key === "Enter" && login()}
                style={{ paddingRight: 34 }}
              />
              <button className="fi-eye" onClick={() => setShowPw((v) => !v)}>
                {showPw ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </div>
          <button className="btn btn-primary btn-full" onClick={login} disabled={loading}>
            {loading ? <Loader2 style={{ animation: "spin 1s linear infinite" }} /> : <Lock />}
            {loading ? "Authenticating…" : "Sign In"}
          </button>
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <button className="forgot-link" onClick={() => setShowForgot(true)}>
              Forgot your password?
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ flex: 1, justifyContent: "center" }}
              onClick={() => onRegister("student")}
            >
              <Plus /> Register Student
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ flex: 1, justifyContent: "center" }}
              onClick={() => onRegister("organization")}
            >
              <Plus /> Register Org
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────
// Sidebar and TopBar
// ─────────────────────────────────────────────────────────────
function Sidebar({ user, active, onNav, onLogout }) {
  const items = NAV[user.role] || [];
  const pendingOrgs = user.role === "coordinator" ? 0 : 0; // placeholder, you can fetch count if needed
  return (
    <div className="sidebar">
      <div className="sb-brand">
        <div><div className="sb-title">IAMS</div><div className="sb-sub">Univ. of Botswana</div></div>
      </div>
      <div className="sb-role"><ShieldCheck /><span>{user.role}{user.sup_type ? " · " + user.sup_type : ""}</span></div>
      <nav className="nav">
        {items.map(({k,l,I}) => (
          <div key={k} className={"ni"+(active===k?" active":"")} onClick={()=>onNav(k)}>
            <I />{l}
            {k === "approvals" && pendingOrgs > 0 && <span className="ni-badge">{pendingOrgs}</span>}
          </div>
        ))}
      </nav>
      <div className="sb-foot">
        <div className="sb-user">
          <Avatar name={user.name} size={28} />
          <div><div className="uname">{user.name}</div><div className="uemail">{user.email}</div></div>
        </div>
        <button className="logout-btn" onClick={onLogout}><LogOut />Sign Out</button>
      </div>
    </div>
  );
}
function TopBar({ page }) {
  const m = PAGE_META[page] || { l: page, d: "" };
  return (
    <div className="topbar">
      <div>
        <div className="tb-bc"><ChevronRight />{m.l}</div>
        <div className="tb-h">{m.l}</div>
        {m.d && <div className="tb-sub">{m.d}</div>}
      </div>
    </div>
  );
}

// ==================== COORDINATOR VIEWS ====================

function CoordDashboard() {
  const [stats, setStats] = useState({
    students: 0,
    allocated: 0,
    organisations: 0,
    pendingOrgs: 0,
    pendingLogbooks: 0,
    pendingReports: 0,
    pendingAssessments: 0,
  });
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      const [students, orgs, logbooks, reports, assessments] = await Promise.all([
        getUsersByRole('student'),
        getUsersByRole('organization'),
        getAllLogbooks(),
        getSupReports(null),
        getAllAssessments(),
      ]);
      const allocated = students.filter(s => s.allocated_org).length;
      const pendingOrgs = orgs.filter(o => o.org_status === 'pending').length;
      const pendingLogbooks = logbooks.filter(l => l.status === 'pending').length;
      const pendingReports = reports.filter(r => r.status === 'pending').length;
      const pendingAssessments = assessments.filter(a => a.status === 'pending').length;
      setStats({
        students: students.length,
        allocated,
        organisations: orgs.length,
        pendingOrgs,
        pendingLogbooks,
        pendingReports,
        pendingAssessments,
      });
      // trend data: group logbooks by week
      const weeks = [1,2,3,4,5,6,7,8,9,10,11,12];
      const weekCounts = {};
      logbooks.forEach(l => { weekCounts[l.week] = (weekCounts[l.week] || 0) + 1; });
      setTrend(weeks.map(w => ({ week: w, count: weekCounts[w] || 0 })));
      setLoading(false);
    }
    loadStats();
  }, []);

  if (loading) return <div className="pg"><div className="empty"><Loader2 style={{animation:"spin 1s linear infinite"}}/><p>Loading statistics…</p></div></div>;

  const allocationRate = stats.students ? (stats.allocated / stats.students * 100).toFixed(0) : 0;

  return (
    <div className="pg">
      <div className="stats">
        <StatCard n={stats.students} label="Total Students" color="var(--mr)" Icon={Users} />
        <StatCard n={stats.allocated} label="Allocated" color="var(--green)" Icon={CheckCircle} />
        <StatCard n={stats.students - stats.allocated} label="Unallocated" color="var(--amber)" Icon={Clock} />
        <StatCard n={stats.organisations} label="Organisations" color="var(--gold)" Icon={Building2} />
        <StatCard n={stats.pendingLogbooks} label="Pending Logbooks" color="var(--red)" Icon={BookOpen} />
        <StatCard n={stats.pendingReports} label="Pending Reports" color="var(--blue)" Icon={FileText} />
      </div>

      {/* Allocation Donut (simple CSS) */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <CardTitle>Allocation Progress</CardTitle>
          <div style={{ width: 140, height: 140, borderRadius: '50%', background: `conic-gradient(var(--green) 0deg ${allocationRate * 3.6}deg, var(--s3) ${allocationRate * 3.6}deg 360deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
            <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--s1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 24, fontWeight: 800 }}>{allocationRate}%</span>
              <span style={{ fontSize: 11, color: 'var(--t3)' }}>Allocated</span>
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span>Pending Organisation Approvals</span>
              <strong>{stats.pendingOrgs}</strong>
            </div>
            <div style={{ height: 8, background: 'var(--s3)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (stats.pendingOrgs / stats.organisations) * 100)}%`, height: '100%', background: 'var(--red)' }} />
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span>Pending Assessments</span>
              <strong>{stats.pendingAssessments}</strong>
            </div>
            <div style={{ height: 8, background: 'var(--s3)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (stats.pendingAssessments / (stats.students * 2)) * 100)}%`, height: '100%', background: 'var(--blue)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Logbook Submission Trend */}
      <div className="card">
        <CardTitle>Weekly Logbook Submissions (Last 12 Weeks)</CardTitle>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 150, marginTop: 12 }}>
          {trend.map(t => {
            const maxCount = Math.max(...trend.map(x => x.count), 1);
            const height = (t.count / maxCount) * 130;
            return (
              <div key={t.week} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ height: height, background: 'var(--gold)', borderRadius: '4px 4px 0 0', width: '100%', transition: 'height 0.3s' }} />
                <div style={{ fontSize: 10, marginTop: 5, color: 'var(--t3)' }}>W{t.week}</div>
                <div style={{ fontSize: 11, fontWeight: 600 }}>{t.count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending Logbooks List (top 5) */}
      <div className="card">
        <CardTitle>Recent Pending Logbooks</CardTitle>
        <TablePendingLogbooks limit={5} />
      </div>
    </div>
  );
}

// Helper component to show pending logbooks (reuse existing logic)
function TablePendingLogbooks({ limit }) {
  const [logbooks, setLogbooks] = useState([]);
  useEffect(() => {
    getAllLogbooks().then(lb => {
      const pending = lb.filter(l => l.status === 'pending').slice(0, limit);
      setLogbooks(pending);
    });
  }, [limit]);
  return (
    <div className="tbl-wrap">
      <table>
        <thead><tr><th>Student</th><th>Week</th><th>Title</th><th>Submitted</th></tr></thead>
        <tbody>
          {logbooks.map(l => (
            <tr key={l.id}>
              <td>{l.student?.name}</td>
              <td>Week {l.week}</td>
              <td>{l.title}</td>
              <td>{l.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function CoordApprovals() {
  const { toast } = useApp();
  const [rejectReasons, setRejectReasons] = useState({});
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [rejected, setRejected] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function load() {
      const [p, a, r] = await Promise.all([getOrgsByStatus("pending"), getOrgsByStatus("approved"), getOrgsByStatus("rejected")]);
      setPending(p); setApproved(a); setRejected(r); setLoading(false);
    }
    load();
  }, []);
  async function approve(org) { await approveOrg(org.id); toast("ok", org.name + " approved successfully."); const [p, a] = await Promise.all([getOrgsByStatus("pending"), getOrgsByStatus("approved")]); setPending(p); setApproved(a); }
  async function reject(org) { const reason = rejectReasons[org.id] || ""; if (!reason.trim()) { toast("err", "Please enter a rejection reason."); return; } await rejectOrg(org.id, reason); toast("ok", org.name + " has been rejected."); const [p, r] = await Promise.all([getOrgsByStatus("pending"), getOrgsByStatus("rejected")]); setPending(p); setRejected(r); }
  if (loading) return <div className="pg"><div className="empty"><Loader2 style={{animation:"spin 1s linear infinite"}}/><p>Loading…</p></div></div>;
  return (
    <div className="pg">
      <div className="stats">
        <StatCard n={pending.length} label="Pending" color="var(--amber)" Icon={Clock} />
        <StatCard n={approved.length} label="Approved" color="var(--green)" Icon={CheckCircle2} />
        <StatCard n={rejected.length} label="Rejected" color="var(--red)" Icon={X} />
      </div>
      {pending.length===0 && <div className="alert a-ok"><CheckCircle2 />No organisations pending approval right now.</div>}
      {pending.map(org => (
        <div key={org.id} className="card" style={{borderLeft:"3px solid var(--amber)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:11}}>
            <div style={{display:"flex",alignItems:"center",gap:11}}>
              <Avatar name={org.name} size={40}/>
              <div>
                <div style={{fontWeight:700,fontSize:14}}>{org.name}</div>
                <div style={{fontSize:12,color:"var(--t3)"}}>{org.industry} · {org.location}</div>
                <div style={{fontSize:12,color:"var(--t3)"}}>{org.contact_person} · {org.contact_phone}</div>
                <div style={{fontSize:12,color:"var(--t3)"}}>{org.email}</div>
              </div>
            </div>
            <Bdg status="pending"/>
          </div>
          {org.internship_description && <p style={{fontSize:13,color:"var(--t2)",lineHeight:1.6,marginBottom:10}}>{org.internship_description}</p>}
          <div style={{marginBottom:11}}>{(org.skills||[]).map(s=><span key={s} className="tag">{s}</span>)}</div>
          <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
            <input className="fi" style={{flex:1,minWidth:180,fontSize:12,padding:"6px 10px"}} placeholder="Rejection reason (required to reject)…" value={rejectReasons[org.id]||""} onChange={e=>setRejectReasons(p=>({...p,[org.id]:e.target.value}))}/>
            <button className="btn btn-success btn-sm" onClick={()=>approve(org)}><Check/>Approve</button>
            <button className="btn btn-danger btn-sm" onClick={()=>reject(org)}><X/>Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}


function OrgsList() {
  const [search, setSearch] = useState("");
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getUsersByRole("organization");
        setOrgs(data);
      } catch (err) {
        console.error("Failed to load organisations:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = orgs.filter(o =>
    [o.name, o.location, o.industry, o.email].some(field =>
      field?.toLowerCase().includes(search.toLowerCase())
    )
  );

  if (loading) {
    return (
      <div className="pg">
        <div className="empty">
          <Loader2 style={{ animation: "spin 1s linear infinite" }} />
          <p>Loading organisations…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pg">
      <div className="ab">
        <div className="sw">
          <Search />
          <input
            className="si"
            placeholder="Search organisations by name, location, industry or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span style={{ fontSize: 12, color: "var(--t3)", fontWeight: 600 }}>
          {filtered.length} organisation{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Organisation</th>
              <th>Industry</th>
              <th>Contact</th>
              <th>Location</th>
              <th>Skills</th>
              <th>Slots</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <Avatar name={o.name} size={24} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{o.name}</div>
                      <div style={{ fontSize: 11, color: "var(--t3)" }}>{o.email}</div>
                    </div>
                  </div>
                </td>
                <td><span className="bdg bdg-maroon">{o.industry || "—"}</span></td>
                <td style={{ fontSize: 12 }}>
                  <div style={{ fontWeight: 600 }}>{o.contact_person}</div>
                  <div style={{ color: "var(--t3)" }}>{o.contact_phone}</div>
                </td>
                <td style={{ fontSize: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <MapPin style={{ width: 11, height: 11 }} /> {o.location}
                  </div>
                </td>
                <td>
                  {(o.skills || []).slice(0, 3).map((s) => (
                    <span key={s} className="tag">{s}</span>
                  ))}
                  {(o.skills || []).length > 3 && (
                    <span className="tag">+{o.skills.length - 3}</span>
                  )}
                </td>
                <td>
                  <span className="bdg bdg-blue">
                    {(o.allocated_count || 0)} / {o.capacity}
                  </span>
                </td>
                <td>
                  <Bdg
                    status={
                      o.org_status === "pending"
                        ? "pending"
                        : (o.allocated_count || 0) < o.capacity
                        ? "open"
                        : "full"
                    }
                  />
                </td>
                <td>
                  <button
                    className="btn btn-xs btn-ghost"
                    onClick={() => setSelectedOrg(o)}
                  >
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="empty">
          <Search size={28} />
          <p>No organisations match your search.</p>
        </div>
      )}

      {/* Modal for full organisation details */}
      {selectedOrg && (
        <div className="overlay">
          <div className="modal" style={{ width: 650, maxWidth: "90vw" }}>
            <div className="modal-hd">
              <h3>{selectedOrg.name}</h3>
              <button className="modal-close" onClick={() => setSelectedOrg(null)}>
                <X />
              </button>
            </div>
            <div className="modal-body">
              <div className="info-grid">
                <div className="info-cell">
                  <div className="ic-lbl">Industry</div>
                  <div className="ic-val">{selectedOrg.industry || "—"}</div>
                </div>
                <div className="info-cell">
                  <div className="ic-lbl">Location</div>
                  <div className="ic-val">{selectedOrg.location || "—"}</div>
                </div>
                <div className="info-cell">
                  <div className="ic-lbl">Contact Person</div>
                  <div className="ic-val">{selectedOrg.contact_person || "—"}</div>
                </div>
                <div className="info-cell">
                  <div className="ic-lbl">Phone</div>
                  <div className="ic-val">{selectedOrg.contact_phone || "—"}</div>
                </div>
                <div className="info-cell">
                  <div className="ic-lbl">Email</div>
                  <div className="ic-val">{selectedOrg.email}</div>
                </div>
                <div className="info-cell">
                  <div className="ic-lbl">Capacity</div>
                  <div className="ic-val">{selectedOrg.capacity} students</div>
                </div>
                <div className="info-cell">
                  <div className="ic-lbl">Status</div>
                  <div className="ic-val">
                    <Bdg
                      status={
                        selectedOrg.org_status === "pending"
                          ? "pending"
                          : (selectedOrg.allocated_count || 0) < selectedOrg.capacity
                          ? "open"
                          : "full"
                      }
                    />
                  </div>
                </div>
                <div className="info-cell">
                  <div className="ic-lbl">Registered</div>
                  <div className="ic-val">
                    {selectedOrg.created_at
                      ? new Date(selectedOrg.created_at).toLocaleDateString()
                      : "—"}
                  </div>
                </div>
              </div>

              {selectedOrg.internship_description && (
                <div style={{ marginTop: 12, marginBottom: 12 }}>
                  <div className="ic-lbl">Description</div>
                  <p style={{ fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>
                    {selectedOrg.internship_description}
                  </p>
                </div>
              )}

              {selectedOrg.custom_skills && (
                <div style={{ marginBottom: 12 }}>
                  <div className="ic-lbl">Additional Skills</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    {selectedOrg.custom_skills}
                  </div>
                </div>
              )}

              {selectedOrg.skills && selectedOrg.skills.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div className="ic-lbl">Technical Skills</div>
                  <div style={{ marginTop: 4 }}>
                    {selectedOrg.skills.map((s) => (
                      <span key={s} className="tag">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedOrg.preferred_background &&
                selectedOrg.preferred_background.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div className="ic-lbl">Preferred Backgrounds</div>
                    <div style={{ marginTop: 4 }}>
                      {selectedOrg.preferred_background.map((b) => (
                        <span key={b} className="tag">{b}</span>
                      ))}
                    </div>
                  </div>
                )}

              {selectedOrg.certificate_url && (
                <div style={{ marginBottom: 12 }}>
                  <div className="ic-lbl">Certificate of Incorporation</div>
                  <div style={{ marginTop: 4 }}>
                    <a
                      href={selectedOrg.certificate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-xs btn-ghost"
                      style={{ gap: 4 }}
                    >
                      <ExternalLink size={12} /> View Document
                    </a>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-ft">
              <button className="btn btn-primary" onClick={() => setSelectedOrg(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function StudentsList() {
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const all = await getUsersByRole("student");
      setStudents(all);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = students.filter(s =>
    [s.name, s.student_id, s.programme].some(f => f?.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <div className="pg"><div className="empty"><Loader2 /><p>Loading students…</p></div></div>;

  return (
    <div className="pg">
      <div className="ab">
        <div className="sw"><Search /><input className="si" placeholder="Search students…" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <span>{filtered.length} students</span>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr><th>Student</th><th>Programme</th><th>Preferred Role</th><th>Skills</th><th>Placement</th><th>Industrial Supervisor</th><th>University Supervisor</th></tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const allSkills = [...(s.skills||[]), ...(s.custom_skills ? s.custom_skills.split(",").map(x => x.trim()) : [])];
              const allocated = !!s.allocated_org;
              const industrialName = s.industrial_supervisor?.name || (allocated ? "Not set by organisation" : "N/A (not allocated)");
              const universityName = s.university_supervisor?.name || "None";
              return (
                <tr key={s.id}>
                  <td><div style={{display:"flex",alignItems:"center",gap:7}}><Avatar name={s.name} size={24}/><div><div style={{fontWeight:600}}>{s.name}</div><div style={{fontSize:11,color:"var(--t3)"}}>{s.student_id||"—"}</div></div></div></td>
                  <td>{s.programme || "—"}</td>
                  <td>{s.preferred_role || "—"}</td>
                  <td>{allSkills.slice(0,2).map(sk=><span key={sk} className="tag">{sk}</span>)}{allSkills.length>2 && <span className="tag">+{allSkills.length-2}</span>}</td>
                  <td><span className={allocated ? "bdg bdg-green" : "bdg bdg-amber"}>{allocated ? "Allocated" : "Unallocated"}</span></td>
                  <td style={{fontSize:12}}>{industrialName}</td>
                  <td style={{fontSize:12}}>{universityName}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function MatchingPage() {
  const { toast } = useApp();
  const [sel, setSel] = useState(null);
  const [tick, setTick] = useState(0);
  const [unalloc, setUnalloc] = useState([]);
  const [openOrgs, setOpenOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function load() {
      const stus = await getUsersByRole("student");
      const orgs = await getUsersByRole("organization");
      setUnalloc(stus.filter(s=>!s.allocated_org));
      setOpenOrgs(orgs.filter(o=>o.org_status==="approved" && (o.allocated_count||0) < o.capacity));
      setLoading(false);
    }
    load();
  }, [tick]);
  async function allocate(stu, org) { await allocateStudent(stu.id, org.id); toast("ok", stu.name + " allocated to " + org.name); setTick(n=>n+1); setSel(null); }
  if(loading) return <div className="pg"><div className="empty"><Loader2 style={{animation:"spin 1s linear infinite"}}/><p>Loading matching engine…</p></div></div>;
  return (
    <div className="pg" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
      <div>
        <CardTitle>Unallocated Students ({unalloc.length})</CardTitle>
        {unalloc.length===0 && <div className="empty"><CheckCircle2/><p>All students allocated.</p></div>}
        {unalloc.map(s=>(
          <div key={s.id} className={"mc"+(sel?.id===s.id?" sel":"")} onClick={()=>setSel(s)}>
            <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:6}}>
              <Avatar name={s.name} size={32}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:13}}>{s.name}</div>
                <div style={{fontSize:11,color:"var(--t3)",fontFamily:"monospace"}}>{s.student_id} · {s.programme}</div>
                <div style={{fontSize:11,color:"var(--t2)",marginTop:1}}>{s.preferred_role} · {s.preferred_industry}</div>
              </div>
              {sel?.id===s.id && <div style={{width:7,height:7,borderRadius:"50%",background:"var(--mr)"}}/>}
            </div>
            <div>{(s.skills||[]).map(sk=><span key={sk} className="tag">{sk}</span>)}</div>
          </div>
        ))}
      </div>
      <div>
        <CardTitle>{sel?"Matches — "+sel.name:"← Select a student"}</CardTitle>
        {!sel && <div className="empty"><Shuffle/><p>Select a student to view ranked matches.</p></div>}
        {sel && [...openOrgs].sort((a,b)=>matchScore(sel,b)-matchScore(sel,a)).map(o=>{
          const sc=matchScore(sel,o);
          const common=(sel.skills||[]).filter(x=>(o.skills||[]).includes(x));
          return <div key={o.id} className="mc">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:9}}>
                <Avatar name={o.name} size={32}/>
                <div><div style={{fontWeight:700,fontSize:13}}>{o.name}</div><div style={{fontSize:11,color:"var(--t3)"}}>{o.industry} · {o.location}</div><div style={{fontSize:11,color:"var(--t3)"}}>{o.allocated_count||0}/{o.capacity} students</div></div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}><div className="score-n">{sc}%</div><div className="score-bar" style={{width:50}}><div className="score-fill" style={{width:sc+"%"}}/></div></div>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:7}}>
              {common.length>0 && <span style={{fontSize:11,color:"var(--green)",fontWeight:700}}>✓ Skills: {common.join(", ")}</span>}
              {sel.preferred_industry===o.industry && <span style={{fontSize:11,color:"var(--mr)",fontWeight:700,marginLeft:6}}>✓ Industry</span>}
            </div>
            <button className="btn btn-primary btn-xs" onClick={()=>allocate(sel,o)}><CheckCircle2/>Confirm Allocation</button>
          </div>;
        })}
        {sel && openOrgs.length===0 && <div className="empty"><Building2/><p>No open approved organisations available.</p></div>}
      </div>
    </div>
  );
}
function AllSubmissions() {
  const { toast } = useApp();
  const [tab, setTab] = useState("logbooks");
  const [logbooks, setLogbooks] = useState([]);
  const [supReports, setSupReports] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{
    async function load(){ const [lb, sr, as] = await Promise.all([getAllLogbooks(), getSupReports(null), getAllAssessments()]); setLogbooks(lb); setSupReports(sr); setAssessments(as); setLoading(false); }
    load();
  },[tab]);
  async function approveLb(lb) { await reviewLogbook(lb.id, "approved", ""); toast("ok", "Logbook approved."); setLogbooks(await getAllLogbooks()); }
  if(loading) return <div className="pg"><div className="empty"><Loader2 style={{animation:"spin 1s linear infinite"}}/><p>Loading submissions…</p></div></div>;
  return (
    <div className="pg">
      <div className="tabs">
        {["logbooks","supReports","uniAssessments"].map((k,i)=><button key={k} className={"tab"+(tab===k?" active":"")} onClick={()=>setTab(k)}>{["Logbooks","Industrial Reports","University Assessments"][i]}</button>)}
      </div>
      {tab==="logbooks" && <div className="tbl-wrap"><table><thead><tr><th>Student</th><th>Week</th><th>Title</th><th>Date</th><th>Status</th><th>Action</th></tr></thead><tbody>{logbooks.map(lb=><tr key={lb.id}><td><div style={{display:"flex",alignItems:"center",gap:6}}><Avatar name={lb.student?.name||"?"} size={22}/><span style={{fontWeight:600}}>{lb.student?.name}</span></div></td><td>Week {lb.week}</td><td>{lb.title}</td><td>{lb.date}</td><td><Bdg status={lb.status}/></td><td>{lb.status==="pending" && <button className="btn btn-success btn-xs" onClick={()=>approveLb(lb)}><Check/>Approve</button>}</td></tr>)}</tbody></table></div>}
      {tab==="supReports" && <div className="tbl-wrap"><table><thead><tr><th>Student</th><th>Organisation</th><th>Supervisor</th><th>Date</th><th>Rating</th><th>Status</th></tr></thead><tbody>{supReports.map(r=><tr key={r.id}><td>{r.student?.name}</td><td>{r.student?.allocated_org_name}</td><td>{r.supervisor?.name}</td><td>{r.date}</td><td><span className="bdg bdg-maroon">{r.overall}/5</span></td><td><Bdg status={r.status}/></td></tr>)}</tbody></table></div>}
      {tab==="uniAssessments" && <div className="tbl-wrap"><table><thead><tr><th>Student</th><th>Supervisor</th><th>Type</th><th>Date</th><th>Grade</th><th>Status</th></tr></thead><tbody>{assessments.map(a=><tr key={a.id}><td>{a.student?.name}</td><td>{a.coordinator?.name}</td><td><span className="bdg bdg-blue">{a.assess_type}</span></td><td>{a.date}</td><td><span className="bdg bdg-gold">{a.score}%</span></td><td><Bdg status={a.status}/></td></tr>)}</tbody></table></div>}
    </div>
  );
}
// ==================== COORDINATOR ASSIGNMENTS ====================

// ==================== STUDENT VIEWS ====================
function StudentDashboard({ user }) {
  const [org, setOrg] = useState(null);
  const [logbooks, setLogbooks] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function load() {
      if (user.allocated_org) setOrg(await getUserById(user.allocated_org));
      setLogbooks(await getStudentLogbooks(user.id));
      setLoading(false);
    }
    load();
  }, [user]);
  if (loading) return <div className="pg"><div className="empty"><Loader2 style={{animation:"spin 1s linear infinite"}}/><p>Loading dashboard…</p></div></div>;
  return (
    <div className="pg">
      <div className="stats">
        <StatCard n={logbooks.length} label="Total Entries" color="var(--mr)" Icon={BookOpen}/>
        <StatCard n={logbooks.filter(l=>l.status==="approved").length} label="Approved" color="var(--green)" Icon={CheckCircle2}/>
        <StatCard n={logbooks.filter(l=>l.status==="pending").length} label="Pending" color="var(--amber)" Icon={Clock}/>
      </div>
      {org ? (
        <div className="card">
          <CardTitle>Current Placement</CardTitle>
          <div className="prof-hero"><Avatar name={org.name} size={40}/><div style={{flex:1}}><div className="ph-name">{org.name}</div><div className="ph-sub">{org.industry} · {org.location} · {org.contact_person}</div></div><Bdg status="confirmed"/></div>
          {org.internship_description && <p style={{fontSize:13,color:"var(--t2)",lineHeight:1.65,marginBottom:10}}>{org.internship_description}</p>}
          <div>{(org.skills||[]).map(s=><span key={s} className="tag">{s}</span>)}</div>
        </div>
      ) : (
        <div className="alert a-inf"><AlertCircle />You have not been allocated to an organisation yet.</div>
      )}
      {logbooks.length>0 && (
        <div className="card">
          <CardTitle>Recent Entries</CardTitle>
          {logbooks.slice(-3).reverse().map(l=>(
            <div key={l.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid var(--b1)"}}>
              <div><div style={{fontSize:13,fontWeight:600}}>{l.title}</div><div style={{fontSize:11,color:"var(--t3)"}}>Week {l.week} · {l.date}</div></div>
              <Bdg status={l.status}/>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function StudentProfile({ user }) {
  const { toast } = useApp();
  const [f, setF] = useState({ skills: [] });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function load() { const u = await getUserById(user.id); setF(u); setLoading(false); }
    load();
  }, [user]);
  function toggleSkill(s) { const has = (f.skills||[]).includes(s); setF(p=>({...p, skills: has ? p.skills.filter(x=>x!==s) : [...(p.skills||[]), s]})); }
  async function save() { await updateUser(user.id, f); toast("ok","Profile saved."); }
  if (loading) return <div className="pg"><div className="empty"><Loader2 style={{animation:"spin 1s linear infinite"}}/><p>Loading profile…</p></div></div>;
  return (
    <div className="pg">
      <div className="card">
        <div className="prof-hero"><Avatar name={f.name} size={40}/><div><div className="ph-name">{f.name}</div><div className="ph-sub">{f.programme} · <span style={{fontFamily:"monospace",fontSize:11}}>{f.student_id}</span></div></div></div>
        <div className="sec-hd">Personal Information</div>
        <div className="fr"><div className="fg"><label>Full Name</label><input className="fi" value={f.name||""} onChange={e=>setF({...f,name:e.target.value})}/></div><div className="fg"><label>Student ID</label><input className="fi" value={f.student_id||""} readOnly/></div></div>
        <div className="fg"><label>Email</label><input className="fi" type="email" value={f.email||""} readOnly/><div className="fi-hint">Email is tied to your student ID and cannot be changed.</div></div>
        <div className="fg"><label>Bio<span className="opt">(optional)</span></label><textarea className="fi" rows={3} placeholder="Background and aspirations…" value={f.bio||""} onChange={e=>setF({...f,bio:e.target.value})}/></div>
        <div className="sec-hd">Preferences</div>
        <div className="fr"><div className="fg"><label>Programme</label><select className="fi" value={f.programme||""} onChange={e=>setF({...f,programme:e.target.value})}><option value="">Select…</option>{PROGRAMMES.map(p=><option key={p}>{p}</option>)}</select></div><div className="fg"><label>Preferred Location</label><select className="fi" value={f.preferred_location||""} onChange={e=>setF({...f,preferred_location:e.target.value})}><option value="">Select…</option>{LOCS.map(l=><option key={l}>{l}</option>)}</select></div></div>
        <div className="fr"><div className="fg"><label>Preferred Industry</label><select className="fi" value={f.preferred_industry||""} onChange={e=>setF({...f,preferred_industry:e.target.value})}><option value="">Select…</option>{INDUSTRIES.map(i=><option key={i}>{i}</option>)}</select></div><div className="fg"><label>Preferred Role</label><select className="fi" value={f.preferred_role||""} onChange={e=>setF({...f,preferred_role:e.target.value})}><option value="">Select…</option>{PREF_ROLES.map(r=><option key={r}>{r}</option>)}</select></div></div>
        <div className="sec-hd">Skills</div>
        <div className="fg"><label>Select Skills</label><div className="chip-wrap">{SKILLS_LIST.map(s=><span key={s} className={"chip"+((f.skills||[]).includes(s)?" on":"")} onClick={()=>toggleSkill(s)}>{s}</span>)}</div></div>
        <div className="fg"><label>Additional Skills<span className="opt">(comma-separated)</span></label><input className="fi" placeholder="e.g. GraphQL, Docker, Figma" value={f.custom_skills||""} onChange={e=>setF({...f,custom_skills:e.target.value})}/></div>
        <button className="btn btn-primary" style={{marginTop:4}} onClick={save}><Check/>Save Profile</button>
      </div>
    </div>
  );
}
function StudentAllocation({ user }) {
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function load() { if (user.allocated_org) setOrg(await getUserById(user.allocated_org)); setLoading(false); }
    load();
  }, [user]);
  if (loading) return <div className="pg"><div className="empty"><Loader2 style={{animation:"spin 1s linear infinite"}}/><p>Loading placement…</p></div></div>;
  if (!org) return <div className="pg"><div className="empty" style={{paddingTop:80}}><Clock style={{width:34,height:34,opacity:.2}}/><p style={{fontSize:15,fontWeight:600,color:"var(--t1)",marginTop:10}}>Awaiting allocation</p><p style={{marginTop:4}}>The coordinator will assign you shortly.</p></div></div>;
  const infoItems = [["Contact Person", org.contact_person], ["Email", org.email], ["Phone", org.contact_phone||"—"], ["Location", org.location], ["Industry", org.industry||"—"], ["Capacity", (org.allocated_count||0)+"/"+org.capacity+" students"]];
  return (
    <div className="pg">
      <div className="card">
        <CardTitle>Placement Details</CardTitle>
        <div className="prof-hero"><Avatar name={org.name} size={40}/><div style={{flex:1}}><div className="ph-name">{org.name}</div><div className="ph-sub">{org.industry} · {org.location}</div></div><Bdg status="confirmed"/></div>
        <div className="info-grid">{infoItems.map(([k,v])=><div key={k} className="info-cell"><div className="ic-lbl">{k}</div><div className="ic-val">{v}</div></div>)}</div>
        {org.internship_description && <div style={{background:"var(--s2)",borderRadius:"var(--r)",padding:"10px 12px",marginBottom:11}}><div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:".5px",color:"var(--t3)",marginBottom:4}}>Description</div><p style={{fontSize:13,lineHeight:1.65}}>{org.internship_description}</p></div>}
        <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:".5px",color:"var(--t3)",marginBottom:5}}>Required Skills</div>
        {(org.skills||[]).map(s=><span key={s} className="tag">{s}</span>)}
      </div>
    </div>
  );
}

function LogbookPage({ user }) {
  const { toast } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [logbooks, setLogbooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAllocated, setIsAllocated] = useState(false);

  useEffect(() => {
    async function load() {
      // Check if student has an allocated organisation
      const currentUser = await getUserById(user.id);
      setIsAllocated(!!currentUser.allocated_org);
      setLogbooks(await getStudentLogbooks(user.id));
      setLoading(false);
    }
    load();
  }, [showForm, user]);

  const myLb = [...logbooks].sort((a,b)=>b.week - a.week);
  const nextWeek = myLb.length>0 ? Math.max(...myLb.map(l=>l.week))+1 : 1;

  async function submit() {
    if (!isAllocated) {
      toast("err", "You cannot submit a logbook because you have not been allocated to any organisation yet.");
      return;
    }
    if (!title.trim()||!body.trim()) {
      toast("err","Please complete the title and description.");
      return;
    }
    await submitLogbook({
      studentId: user.id,
      week: nextWeek,
      title: title.trim(),
      body: body.trim(),
      date: new Date().toISOString().slice(0,10)
    });
    setTitle(""); setBody(""); setShowForm(false);
    toast("ok","Week "+nextWeek+" entry submitted.");
    setLogbooks(await getStudentLogbooks(user.id));
  }

  if (loading) return <div className="pg"><div className="empty"><Loader2 style={{animation:"spin 1s linear infinite"}}/><p>Loading logbook…</p></div></div>;

  return (
    <div className="pg">
      <div className="ab">
        <span style={{fontSize:12,color:"var(--t3)",fontWeight:600}}>{myLb.length} entries</span>
        {!showForm && isAllocated && (
          <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(true)}>
            <Plus/>Week {nextWeek} Entry
          </button>
        )}
        {!isAllocated && (
          <div className="alert a-warn" style={{marginBottom:0}}>
            <AlertCircle/> You must be allocated to an organisation before submitting logbooks.
          </div>
        )}
      </div>
      {showForm && (
        <div className="card" style={{borderColor:"var(--mr)",borderWidth:1.5}}>
          <CardTitle>New Entry — Week {nextWeek}</CardTitle>
          <div className="fg"><label>Title *</label><input className="fi" placeholder="e.g. Sprint Planning & Workshop" value={title} onChange={e=>setTitle(e.target.value)}/></div>
          <div className="fg"><label>Activities & Learnings *</label><textarea className="fi" rows={5} placeholder="Describe what you worked on, key learnings, and challenges…" value={body} onChange={e=>setBody(e.target.value)}/></div>
          <div style={{display:"flex",gap:7}}><button className="btn btn-primary" onClick={submit}><Check/>Submit</button><button className="btn btn-ghost" onClick={()=>{setShowForm(false);setTitle("");setBody("");}}><X/>Cancel</button></div>
        </div>
      )}
      {myLb.length===0 && !showForm && <div className="empty" style={{paddingTop:60}}><BookOpen/><p>No entries yet. {!isAllocated && "You will be able to submit once allocated."}</p></div>}
      {myLb.map(lb=>(
        <div key={lb.id} className="lb-card">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}><div className="lb-wk">Week {lb.week} · {lb.date}</div><Bdg status={lb.status}/></div>
          <div className="lb-title">{lb.title}</div>
          <div className="lb-body">{lb.body}</div>
          {lb.comment && <div className="lb-cmt"><strong>Supervisor:</strong> {lb.comment}</div>}
        </div>
      ))}
    </div>
  );
}
function StudentAssessments({ user }) {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const all = await getAllAssessments();
        // Filter by the logged‑in student’s ID
        const myAssessments = all.filter(a => a.student_id === user.id);
        setAssessments(myAssessments);
      } catch (err) {
        console.error("Failed to load assessments:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user.id]);

  if (loading) {
    return (
      <div className="pg">
        <div className="empty">
          <Loader2 style={{ animation: "spin 1s linear infinite" }} />
          <p>Loading assessment results…</p>
        </div>
      </div>
    );
  }

  if (assessments.length === 0) {
    return (
      <div className="pg">
        <div className="empty">
          <Award />
          <p>No assessment results available yet.</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>
            Your university supervisor will submit assessments after your review.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pg">
      <CardTitle>My Assessment Results</CardTitle>
      {assessments.map(a => (
        <div key={a.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong>{a.assess_type === 'midterm' ? 'Mid‑Term Assessment' : 'Final Assessment'}</strong>
            <Bdg status={a.status || 'submitted'} />
          </div>
          <div><strong>Score:</strong> {a.score}%</div>
          <div><strong>Feedback:</strong> {a.feedback || 'No feedback provided'}</div>
          <div><strong>Date:</strong> {a.date}</div>
          <div><strong>Assessed by:</strong> {a.coordinator?.name || 'University Supervisor'}</div>
        </div>
      ))}
    </div>
  );
}
// ==================== ORGANISATION VIEWS ====================
function OrgDashboard({ user }) {
  const [students, setStudents] = useState([]);
  const [logbooks, setLogbooks] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function load() {
      const allStus = await getUsersByRole("student");
      const myStus = allStus.filter(s=>s.allocated_org===user.id);
      setStudents(myStus);
      setLogbooks(await getAllLogbooks());
      setLoading(false);
    }
    load();
  }, [user]);
  const myLb = logbooks.filter(l=>students.some(s=>s.id===l.student_id));
  const pendingLb = myLb.filter(l=>l.status==="pending").length;
  const approvedLb = myLb.filter(l=>l.status==="approved").length;
  if (loading) return <div className="pg"><div className="empty"><Loader2 style={{animation:"spin 1s linear infinite"}}/><p>Loading dashboard…</p></div></div>;
  return (
    <div className="pg">
      <div className="stats">
        <StatCard n={students.length} label="My Students" color="var(--mr)" Icon={GraduationCap}/>
        <StatCard n={user.capacity - students.length} label="Open Slots" color="var(--gold)" Icon={Activity}/>
        <StatCard n={pendingLb} label="Pending Logbooks" color="var(--amber)" Icon={Clock}/>
        <StatCard n={approvedLb} label="Approved" color="var(--green)" Icon={CheckCircle2}/>
      </div>
      {students.length===0 ? (
        <div className="alert a-inf"><AlertCircle/>No students allocated yet.</div>
      ) : (
        <div className="card">
          <CardTitle>Allocated Students</CardTitle>
          {students.map(s=>(
            <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid var(--b1)"}}>
              <Avatar name={s.name} size={30}/>
              <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13}}>{s.name}</div><div style={{fontSize:11,color:"var(--t3)",fontFamily:"monospace"}}>{s.student_id} · {s.programme}</div></div>
              {(s.skills||[]).slice(0,2).map(sk=><span key={sk} className="tag">{sk}</span>)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function OrgProfile({ user }) {
  const { toast } = useApp();
  const [f, setF] = useState({
    skills: [],
    preferred_background: [],
    default_industrial_supervisor_id: "",
    custom_skills: "",
    certificate_url: "",
  });
  const [industrialSupervisors, setIndustrialSupervisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSup, setNewSup] = useState({ name: "", email: "", password: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const u = await getUserById(user.id);
        setF(u);
        const sups = await getOrganisationIndustrialSupervisors(user.id);
        setIndustrialSupervisors(sups);
      } catch (err) {
        toast("err", "Failed to load organisation data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user.id, toast]);

  async function save() {
    try {
      await updateUser(user.id, {
        name: f.name,
        industry: f.industry,
        contact_person: f.contact_person,
        contact_phone: f.contact_phone,
        email: f.email,
        location: f.location,
        capacity: f.capacity,
        internship_description: f.internship_description,
        skills: f.skills,
        preferred_background: f.preferred_background,
        default_industrial_supervisor_id: f.default_industrial_supervisor_id,
        custom_skills: f.custom_skills,
      });
      toast("ok", "Profile updated.");
    } catch (err) {
      toast("err", "Save failed.");
    }
  }

  async function createSupervisor() {
    if (!newSup.name.trim()) { toast("err", "Full name is required."); return; }
    const email = newSup.email.trim().toLowerCase();
    const freeDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com', 'icloud.com', 'protonmail.com', 'mail.com'];
    const domain = email.split('@')[1];
    if (!domain || freeDomains.includes(domain)) {
      toast("err", "Please use a work email (not a free email provider).");
      return;
    }
    const pw = newSup.password;
    const strongPassword = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!strongPassword.test(pw)) {
      toast("err", "Password must be at least 8 characters, one uppercase, one number, and one special character.");
      return;
    }
    setCreating(true);
    try {
      await createIndustrialSupervisor(user.id, email, pw, newSup.name.trim());
      toast("ok", "Industrial supervisor created. They can now log in.");
      setShowCreateModal(false);
      setNewSup({ name: "", email: "", password: "" });
      const sups = await getOrganisationIndustrialSupervisors(user.id);
      setIndustrialSupervisors(sups);
    } catch (err) {
      toast("err", err.message);
    } finally {
      setCreating(false);
    }
  }

  function toggleSkill(s) {
    const has = (f.skills || []).includes(s);
    setF(p => ({ ...p, skills: has ? p.skills.filter(x => x !== s) : [...(p.skills || []), s] }));
  }

  function toggleBg(b) {
    const has = (f.preferred_background || []).includes(b);
    setF(p => ({ ...p, preferred_background: has ? p.preferred_background.filter(x => x !== b) : [...(p.preferred_background || []), b] }));
  }

  if (loading) {
    return (
      <div className="pg">
        <div className="empty">
          <Loader2 style={{ animation: "spin 1s linear infinite" }} />
          <p>Loading profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pg">
      <div className="card">
        <div className="prof-hero">
          <Avatar name={f.name} size={40} />
          <div>
            <div className="ph-name">{f.name}</div>
            <div className="ph-sub">{f.industry} · {f.location}</div>
          </div>
        </div>

        <div className="sec-hd">Organisation Details</div>
        <div className="fg"><label>Name</label><input className="fi" value={f.name || ""} onChange={e => setF({ ...f, name: e.target.value })} /></div>
        <div className="fg"><label>Industry</label><select className="fi" value={f.industry || ""} onChange={e => setF({ ...f, industry: e.target.value })}>{INDUSTRIES.map(i => <option key={i}>{i}</option>)}</select></div>

        <div className="sec-hd">Contact</div>
        <div className="fr"><div className="fg"><label>Contact Person</label><input className="fi" value={f.contact_person || ""} onChange={e => setF({ ...f, contact_person: e.target.value })} /></div>
        <div className="fg"><label>Phone</label><div className="fi-wrap"><div className="fi-ico"><Phone /></div><input className="fi" value={f.contact_phone || ""} onChange={e => setF({ ...f, contact_phone: e.target.value })} /></div></div></div>
        <div className="fr"><div className="fg"><label>Email</label><input className="fi" type="email" value={f.email || ""} onChange={e => setF({ ...f, email: e.target.value })} /></div>
        <div className="fg"><label>Location</label><select className="fi" value={f.location} onChange={e => setF({ ...f, location: e.target.value })}>{LOCS.map(l => <option key={l}>{l}</option>)}</select></div></div>

        <div className="sec-hd">Programme</div>
        <div className="fg"><label>Capacity</label><input className="fi" type="number" min={1} max={30} value={f.capacity} onChange={e => setF({ ...f, capacity: parseInt(e.target.value) || 1 })} /></div>
        <div className="fg"><label>Description</label><textarea className="fi" rows={4} value={f.internship_description || ""} onChange={e => setF({ ...f, internship_description: e.target.value })} /></div>

        <div className="sec-hd">Additional Skills & Certificate</div>
        <div className="fg"><label>Custom Skills (comma‑separated)</label><input className="fi" placeholder="e.g., Project Management, Data Analysis, AutoCAD" value={f.custom_skills || ""} onChange={e => setF({ ...f, custom_skills: e.target.value })} /></div>
        {f.certificate_url && (
          <div className="fg"><label>Certificate of Incorporation</label><div><a href={f.certificate_url} target="_blank" rel="noopener noreferrer">View Document</a></div></div>
        )}

        <div className="sec-hd">Industrial Supervisors</div>
        <div className="fg">
          <label>Current Industrial Supervisors</label>
          {industrialSupervisors.length === 0 ? (
            <div className="alert a-inf">No industrial supervisors created yet. Use the button below to add one.</div>
          ) : (
            <ul style={{ marginBottom: 12 }}>
              {industrialSupervisors.map(s => (
                <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span><strong>{s.name}</strong> ({s.email})</span>
                  {f.default_industrial_supervisor_id === s.id && <span className="bdg bdg-green">Default</span>}
                </li>
              ))}
            </ul>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}><Plus /> Create Industrial Supervisor</button>
        </div>

        <div className="fg">
          <label>Default Industrial Supervisor (assigned to students)</label>
          <select className="fi" value={f.default_industrial_supervisor_id || ""} onChange={e => setF({ ...f, default_industrial_supervisor_id: e.target.value })}>
            <option value="">– None –</option>
            {industrialSupervisors.map(sup => (
              <option key={sup.id} value={sup.id}>{sup.name} ({sup.email})</option>
            ))}
          </select>
          <div className="fi-hint">This supervisor will be automatically assigned to any student allocated to your organisation.</div>
        </div>

        <div className="sec-hd">Requirements</div>
        <div className="fg"><label>Skills</label><div className="chip-wrap">{SKILLS_LIST.map(s => <span key={s} className={"chip" + ((f.skills || []).includes(s) ? " on" : "")} onClick={() => toggleSkill(s)}>{s}</span>)}</div></div>
        <div className="fg"><label>Preferred Backgrounds</label><div className="chip-wrap">{STU_BACKGROUNDS.map(b => <span key={b} className={"chip" + ((f.preferred_background || []).includes(b) ? " on" : "")} onClick={() => toggleBg(b)}>{b}</span>)}</div></div>

        <button className="btn btn-primary" onClick={save}><Check /> Save Changes</button>
      </div>

      {/* Modal for creating industrial supervisor */}
      {showCreateModal && (
        <div className="overlay">
          <div className="modal" style={{ width: 450 }}>
            <div className="modal-hd"><h3>Create Industrial Supervisor</h3><button className="modal-close" onClick={() => setShowCreateModal(false)}><X /></button></div>
            <div className="modal-body">
              <div className="fg"><label>Full Name *</label><input className="fi" value={newSup.name} onChange={e => setNewSup({ ...newSup, name: e.target.value })} /></div>
              <div className="fg"><label>Work Email *</label><input className="fi" type="email" value={newSup.email} onChange={e => setNewSup({ ...newSup, email: e.target.value })} /><div className="fi-hint">Must be a company email (not free provider like gmail.com).</div></div>
              <div className="fg"><label>Password *</label><input className="fi" type="password" value={newSup.password} onChange={e => setNewSup({ ...newSup, password: e.target.value })} /><div className="fi-hint">Minimum 8 characters, one uppercase, one number, one special character.</div></div>
              <div className="alert a-inf"><AlertCircle /> This supervisor will be able to log in and review logbooks of students allocated to your organisation.</div>
            </div>
            <div className="modal-ft">
              <button className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createSupervisor} disabled={creating}>{creating ? <Loader2 /> : <Check />} Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function OrgStudents({ user }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function load() { const allStus = await getUsersByRole("student"); setStudents(allStus.filter(s=>s.allocated_org===user.id)); setLoading(false); }
    load();
  }, [user]);
  if (loading) return <div className="pg"><div className="empty"><Loader2 style={{animation:"spin 1s linear infinite"}}/><p>Loading students…</p></div></div>;
  if (students.length===0) return <div className="pg"><div className="empty" style={{paddingTop:60}}><GraduationCap/><p>No students allocated yet.</p></div></div>;
  return (
    <div className="pg">
      {students.map(s=>{
        const allSkills=[...(s.skills||[]),...(s.custom_skills?s.custom_skills.split(",").map(x=>x.trim()).filter(Boolean):[])];
        return (
          <div key={s.id} className="card card-lift" style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{display:"flex",alignItems:"center",gap:11}}>
                <Avatar name={s.name} size={38}/>
                <div>
                  <div style={{fontWeight:700,fontSize:14}}>{s.name}</div>
                  <div style={{fontSize:12,color:"var(--t3)",fontFamily:"monospace"}}>{s.student_id} · {s.email}</div>
                  <div style={{fontSize:12,color:"var(--t2)"}}>{s.programme} · {s.preferred_role}</div>
                  <div style={{marginTop:5}}>{allSkills.map(sk=><span key={sk} className="tag">{sk}</span>)}</div>
                </div>
              </div>
              <Bdg status="confirmed"/>
            </div>
            {s.bio && <p style={{fontSize:13,color:"var(--t2)",marginTop:10,lineHeight:1.65,borderTop:"1px solid var(--b1)",paddingTop:9}}>{s.bio}</p>}
          </div>
        );
      })}
    </div>
  );
}
function OrgLogbookReview({ user }) {
  const { toast } = useApp();
  const [comments, setComments] = useState({});
  const [logbooks, setLogbooks] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function load() {
      const allLb = await getAllLogbooks();
      const students = (await getUsersByRole("student")).filter(s=>s.allocated_org===user.id);
      const myLb = allLb.filter(l=>students.some(s=>s.id===l.student_id));
      setLogbooks(myLb);
      setLoading(false);
    }
    load();
  }, [user]);
  async function approve(lb) { await reviewLogbook(lb.id, "approved", ""); toast("ok","Logbook approved."); setLogbooks(await getAllLogbooks()); }
  async function revise(lb) { const c = comments[lb.id]||""; if (!c.trim()) { toast("err","Add a comment before requesting revision."); return; } await reviewLogbook(lb.id, "revision", c); toast("ok","Revision requested."); setComments(p=>({...p,[lb.id]:""})); setLogbooks(await getAllLogbooks()); }
  if (loading) return <div className="pg"><div className="empty"><Loader2 style={{animation:"spin 1s linear infinite"}}/><p>Loading logbooks…</p></div></div>;
  if (logbooks.length===0) return <div className="pg"><div className="empty" style={{paddingTop:60}}><ClipboardList/><p>No logbook entries from your students yet.</p></div></div>;
  return (
    <div className="pg">
      {logbooks.map(l=>{
        const studentName = l.student?.name;
        return (
          <div key={l.id} className="lb-card">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <Avatar name={studentName||"?"} size={24}/>
                <div><div className="lb-wk">Week {l.week} · {l.date} · {studentName}</div><div className="lb-title" style={{marginBottom:0}}>{l.title}</div></div>
              </div>
              <Bdg status={l.status}/>
            </div>
            <div className="lb-body">{l.body}</div>
            {l.status==="pending" && (
              <div style={{marginTop:9,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                <input className="fi" style={{flex:1,minWidth:160,fontSize:12,padding:"5px 9px"}} placeholder="Comment (required for revision)…" value={comments[l.id]||""} onChange={e=>setComments(p=>({...p,[l.id]:e.target.value}))}/>
                <button className="btn btn-success btn-sm" onClick={()=>approve(l)}><Check/>Approve</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>revise(l)}><MessageSquare/>Revision</button>
              </div>
            )}
            {l.comment && l.status!=="pending" && <div className="lb-cmt"><strong>Your note:</strong> {l.comment}</div>}
          </div>
        );
      })}
    </div>
  );
}
// ==================== INDUSTRIAL SUPERVISOR LOGBOOK REVIEW ====================
function IndusLogbookReview({ user }) {
  const { toast } = useApp();
  const [comments, setComments] = useState({});
  const [logbooks, setLogbooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const assignedStudents = await getStudentsBySupervisor(user.id, 'industrial');
      const allLb = await getAllLogbooks();
      const myLb = allLb.filter(l => assignedStudents.some(s => s.id === l.student_id));
      setLogbooks(myLb);
      setLoading(false);
    }
    load();
  }, [user]);

  async function approve(lb) {
    await reviewLogbook(lb.id, 'approved', '');
    toast('ok', 'Logbook approved');
    const assignedStudents = await getStudentsBySupervisor(user.id, 'industrial');
    const allLb = await getAllLogbooks();
    setLogbooks(allLb.filter(l => assignedStudents.some(s => s.id === l.student_id)));
  }
  async function revise(lb) {
    const c = comments[lb.id] || '';
    if (!c.trim()) { toast('err', 'Add a comment before requesting revision.'); return; }
    await reviewLogbook(lb.id, 'revision', c);
    toast('ok', 'Revision requested');
    setComments(p => ({ ...p, [lb.id]: '' }));
    const assignedStudents = await getStudentsBySupervisor(user.id, 'industrial');
    const allLb = await getAllLogbooks();
    setLogbooks(allLb.filter(l => assignedStudents.some(s => s.id === l.student_id)));
  }

  if (loading) return <div className="pg"><div className="empty"><Loader2 style={{animation:"spin 1s linear infinite"}}/><p>Loading logbooks...</p></div></div>;
  if (logbooks.length === 0) return <div className="pg"><div className="empty"><ClipboardList/><p>No logbooks from your assigned students.</p></div></div>;

  return (
    <div className="pg">
      {logbooks.map(l => {
        const studentName = l.student?.name;
        return (
          <div key={l.id} className="lb-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Avatar name={studentName || '?'} size={24} />
                <div>
                  <div className="lb-wk">Week {l.week} · {l.date} · {studentName}</div>
                  <div className="lb-title">{l.title}</div>
                </div>
              </div>
              <Bdg status={l.status} />
            </div>
            <div className="lb-body">{l.body}</div>
            {l.status === 'pending' && (
              <div style={{ marginTop: 9, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <input className="fi" style={{ flex: 1, minWidth: 160 }} placeholder="Comment (required for revision)" value={comments[l.id] || ''} onChange={e => setComments(p => ({ ...p, [l.id]: e.target.value }))} />
                <button className="btn btn-success btn-sm" onClick={() => approve(l)}><Check/>Approve</button>
                <button className="btn btn-ghost btn-sm" onClick={() => revise(l)}><MessageSquare/>Revision</button>
              </div>
            )}
            {l.comment && l.status !== 'pending' && <div className="lb-cmt"><strong>Your note:</strong> {l.comment}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ==================== SUPERVISOR VIEWS ====================
function SupDashboard({ user }) {
  const [students, setStudents] = useState([]);
  const [reports, setReports] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function load() {
      const allStus = await getUsersByRole("student");
      const allocatedStus = allStus.filter(s=>s.allocated_org);
      setStudents(allocatedStus);
      if (user.sup_type==="industrial") setReports(await getSupReports(user.id));
      else setAssessments(await getAllAssessments());
      setLoading(false);
    }
    load();
  }, [user]);
  if (loading) return <div className="pg"><div className="empty"><Loader2 style={{animation:"spin 1s linear infinite"}}/><p>Loading dashboard…</p></div></div>;
  const mine = user.sup_type==="industrial" ? reports : assessments.filter(a=>a.coordinator_id===user.id);
  const pending = students.length - mine.length;
  return (
    <div className="pg">
      <div className="stats">
        <StatCard n={students.length} label="On Attachment" color="var(--mr)" Icon={Briefcase}/>
        <StatCard n={mine.length} label="Submitted" color="var(--green)" Icon={CheckCircle2}/>
        <StatCard n={Math.max(0,pending)} label="Pending" color="var(--amber)" Icon={Clock}/>
      </div>
      <div className="card">
        <CardTitle>Students on Attachment</CardTitle>
        {students.length===0 && <div className="empty"><GraduationCap/><p>No students on attachment.</p></div>}
        {students.map(s=>{
          const org = s.allocated_org;
          const isDone = user.sup_type==="industrial" ? reports.some(r=>r.student_id===s.id) : assessments.filter(a=>a.student_id===s.id && a.coordinator_id===user.id).length;
          return (
            <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid var(--b1)"}}>
              <Avatar name={s.name} size={30}/>
              <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13}}>{s.name} · <span style={{fontFamily:"monospace",fontSize:11}}>{s.student_id}</span></div><div style={{fontSize:12,color:"var(--t3)"}}>{s.programme} · {org}</div></div>
              {user.sup_type==="industrial"?<Bdg status={isDone?"submitted":"pending"}/>:<span className={"bdg bdg-"+(isDone>=2?"green":isDone>=1?"blue":"amber")}>{isDone}/2 assessments</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
function IndustrialForm({ user }) {
  const { toast } = useApp();
  const [students, setStudents] = useState([]);
  const [sel, setSel] = useState("");
  const [ratings, setRatings] = useState(Object.fromEntries(IND_RATE_KEYS.map(k=>[k,"3"])));
  const [overall, setOverall] = useState("3");
  const [comments, setComments] = useState("");
  const [recommend, setRecommend] = useState("yes");
  const [loading, setLoading] = useState(false);
  const [existing, setExisting] = useState(null);
  useEffect(() => {
    async function load() {
      const allStus = await getUsersByRole("student");
      const myStus = allStus.filter(s=>s.allocated_org===user.org_id);
      setStudents(myStus);
      if (myStus.length) setSel(myStus[0].id);
    }
    load();
  }, [user]);
  useEffect(() => {
    async function check() { if (sel) { const reports = await getSupReports(user.id); const exists = reports.find(r=>r.student_id===sel); setExisting(exists); } }
    check();
  }, [sel]);
  async function submit() {
    if (!sel||!comments.trim()) { toast("err","Select a student and provide comments."); return; }
    if (existing) { toast("err","Report already submitted."); return; }
    setLoading(true);
    await submitSupReport({ studentId:sel, supervisorId:user.id, content:comments, week:null });
    toast("ok","Report submitted.");
    setComments("");
    setLoading(false);
    setExisting({});
  }
  return (
    <div>
      <div className="card"><div className="sec-hd">Student</div><div className="fg"><label>Student *</label><select className="fi" value={sel} onChange={e=>setSel(e.target.value)}>{students.length===0 && <option value="">No students at your organisation</option>}{students.map(s=><option key={s.id} value={s.id}>{s.name} ({s.student_id})</option>)}</select></div>{existing && <div className="alert a-warn"><AlertCircle/>Already submitted for this student.</div>}</div>
      <div className="card"><div className="sec-hd">Performance Ratings (1–5)</div><RatingRows keys={IND_RATE_KEYS} ratings={ratings} setRatings={setRatings}/><div className="rating-row" style={{borderBottom:"none"}}><div className="rating-lbl" style={{fontWeight:700}}>Overall Rating</div><select className="rating-sel" value={overall} onChange={e=>setOverall(e.target.value)}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></div></div>
      <div className="card"><div className="sec-hd">Comments</div><div className="fg"><label>Assessment Comments *</label><textarea className="fi" rows={5} value={comments} onChange={e=>setComments(e.target.value)}/></div><div className="fg"><label>Recommendation</label><select className="fi" value={recommend} onChange={e=>setRecommend(e.target.value)}><option value="yes">Yes — highly recommended</option><option value="conditional">Yes — with conditions</option><option value="no">No — not recommended</option></select></div><button className="btn btn-primary" onClick={submit} disabled={!!existing || loading} style={{opacity:existing?0.45:1}}>{loading?<Loader2 style={{animation:"spin 1s linear infinite"}}/>:<FileText/>}{loading?"Submitting…":"Submit Report"}</button></div>
    </div>
  );
}
function UniAssessForm({ user }) {
  const { toast } = useApp();
  const [students, setStudents] = useState([]);
  const [sel, setSel] = useState("");
  const [atype, setAtype] = useState("midterm");
  const [ratings, setRatings] = useState(Object.fromEntries(UNI_RATE_KEYS.map(k => [k, "3"])));
  const [grade, setGrade] = useState("70");
  const [obs, setObs] = useState("");
  const [loading, setLoading] = useState(false);
  const [existing, setExisting] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Load only students assigned to this university supervisor
  useEffect(() => {
    async function load() {
      try {
        setPageLoading(true);
        setErrorMsg("");
        const assigned = await getStudentsBySupervisor(user.id, 'university');
        console.log("Assigned students:", assigned);
        setStudents(assigned || []);
        if (assigned && assigned.length > 0) {
          setSel(assigned[0].id);
        } else {
          setSel("");
        }
      } catch (err) {
        console.error("Error loading assigned students:", err);
        setErrorMsg("Failed to load assigned students. " + err.message);
        toast("err", "Could not load students: " + err.message);
      } finally {
        setPageLoading(false);
      }
    }
    load();
  }, [user.id, toast]);

  // Check if assessment already submitted for this student & type
  useEffect(() => {
    async function check() {
      if (!sel) return;
      try {
        const assessments = await getAllAssessments();
        const exists = assessments.find(a =>
          a.student_id === sel &&
          a.coordinator_id === user.id &&
          a.assess_type === atype
        );
        setExisting(exists);
      } catch (err) {
        console.error("Error checking existing assessments:", err);
      }
    }
    check();
  }, [sel, atype, user.id]);

  async function submit() {
    if (!sel) {
      toast("err", "No student selected.");
      return;
    }
    if (!obs.trim()) {
      toast("err", "Please provide observations/feedback.");
      return;
    }
    if (existing) {
      toast("err", "Assessment already submitted for this student and type.");
      return;
    }
    setLoading(true);
    try {
      await submitAssessment({
        studentId: sel,
        coordinatorId: user.id,
        score: parseInt(grade),
        feedback: obs,
        assessType: atype
      });
      toast("ok", `${atype === "midterm" ? "Mid-term" : "Final"} assessment submitted.`);
      setObs("");
      // Reset existing so the same student/type cannot be resubmitted without refresh
      setExisting({});
    } catch (err) {
      console.error("Submit error:", err);
      toast("err", err.message || "Submission failed.");
    }
    setLoading(false);
  }

  if (pageLoading) {
    return (
      <div className="pg">
        <div className="empty">
          <Loader2 style={{ animation: "spin 1s linear infinite" }} />
          <p>Loading assessment form…</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="pg">
        <div className="alert a-err">
          <AlertCircle />
          {errorMsg}
        </div>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="pg">
        <div className="empty">
          <Award />
          <p>No students assigned to you yet.</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>Please contact the coordinator to assign students to you.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="sec-hd">Setup</div>
        <div className="fr">
          <div className="fg">
            <label>Student *</label>
            <select className="fi" value={sel} onChange={e => setSel(e.target.value)}>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.student_id || 'no ID'})</option>
              ))}
            </select>
          </div>
          <div className="fg">
            <label>Assessment Type *</label>
            <select className="fi" value={atype} onChange={e => setAtype(e.target.value)}>
              <option value="midterm">Mid-Term Assessment</option>
              <option value="final">Final Assessment</option>
            </select>
          </div>
        </div>
        {existing && (
          <div className="alert a-warn">
            <AlertCircle /> Already submitted for this student and type on {existing.date}.
          </div>
        )}
      </div>
      <div className="card">
        <div className="sec-hd">Criteria (1–5)</div>
        <RatingRows keys={UNI_RATE_KEYS} ratings={ratings} setRatings={setRatings} />
        <div className="rating-row" style={{ borderBottom: "none" }}>
          <div className="rating-lbl" style={{ fontWeight: 700 }}>Grade (%)</div>
          <input
            type="number"
            min={0}
            max={100}
            value={grade}
            onChange={e => setGrade(e.target.value)}
            className="rating-sel"
          />
        </div>
      </div>
      <div className="card">
        <div className="sec-hd">Feedback</div>
        <div className="fg">
          <label>Observations / Feedback *</label>
          <textarea className="fi" rows={5} value={obs} onChange={e => setObs(e.target.value)} />
        </div>
        <button
          className="btn btn-primary"
          onClick={submit}
          disabled={!!existing || loading}
          style={{ opacity: existing ? 0.45 : 1 }}
        >
          {loading ? <Loader2 style={{ animation: "spin 1s linear infinite" }} /> : <Award />}
          {loading ? "Submitting…" : "Submit Assessment"}
        </button>
      </div>
    </div>
  );
}
function SupReports({ user }) {
  const [tab, setTab] = useState("form");
  const [reports, setReports] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function load() {
      if (user.sup_type==="industrial") setReports(await getSupReports(user.id));
      else setAssessments(await getAllAssessments());
      setLoading(false);
    }
    load();
  }, [user]);
  if (loading) return <div className="pg"><div className="empty"><Loader2 style={{animation:"spin 1s linear infinite"}}/><p>Loading reports…</p></div></div>;
  const mine = user.sup_type==="industrial" ? reports : assessments.filter(a=>a.coordinator_id===user.id);
  return (
    <div className="pg">
      <div className="tabs" style={{maxWidth:300}}>
        <button className={"tab"+(tab==="form"?" active":"")} onClick={()=>setTab("form")}>Submit New</button>
        <button className={"tab"+(tab==="history"?" active":"")} onClick={()=>setTab("history")}>Submitted ({mine.length})</button>
      </div>
      {tab==="form" && (user.sup_type==="industrial"?<IndustrialForm user={user}/>:<UniAssessForm user={user}/>)}
      {tab==="history" && mine.length===0 && <div className="empty" style={{paddingTop:60}}><FileText/><p>No submissions yet.</p></div>}
      {tab==="history" && mine.map(r=>{
        const st = r.student;
        const typeLabel = r.assess_type ? (r.assess_type==="midterm"?"Mid-Term":"Final")+" Assessment" : "End-of-Attachment Report";
        return (
          <div key={r.id} className="card card-lift" style={{marginBottom:9}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{display:"flex",alignItems:"center",gap:9}}>
                <Avatar name={st?.name||"?"} size={34}/>
                <div><div style={{fontWeight:700,fontSize:14}}>{st?.name}</div><div style={{fontSize:12,color:"var(--t3)"}}>{typeLabel} · {r.date}</div></div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                {r.overall!==undefined && <span className="bdg bdg-maroon">Overall: {r.overall}/5</span>}
                {r.score!==undefined && <span className="bdg bdg-gold">{r.score}%</span>}
                <Bdg status={r.status}/>
              </div>
            </div>
            {(r.comments||r.feedback) && <p style={{fontSize:13,color:"var(--t2)",marginTop:9,lineHeight:1.65}}>{r.comments||r.feedback}</p>}
          </div>
        );
      })}
    </div>
  );
}

// ==================== REGISTRATION MODAL ====================
function RegModal({ role, onClose }) {
  const { toast } = useApp();
  const steps = role === "student" ? ["Account", "Preferences", "Skills"] : ["Account", "Organisation", "Requirements"];
  const [step, setStep] = useState(1);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [certificateFile, setCertificateFile] = useState(null);
  const [customSkillsText, setCustomSkillsText] = useState("");

  const [f, setF] = useState({
    name: "", email: "", pw: "", confirmPw: "",
    student_id: "", programme: "", bio: "", preferred_location: "", preferred_industry: "", preferred_role: "",
    skills: [], custom_skills: "", portfolio: "", linkedin: "",
    contact_person: "", contact_phone: "", location: "Gaborone", industry: "", capacity: "2",
    internship_description: "", preferred_background: [],
  });

  const str = pwStrength(f.pw);
  const strColors = ["", "#B01C1C", "#8A5C00", "#8A5C00", "#1A7A3C", "#1A7A3C"];
  const strLabels = ["", "Weak", "Fair", "Fair", "Strong", "Very Strong"];

  function toggleSkill(s) {
    const has = f.skills.includes(s);
    setF(p => ({ ...p, skills: has ? p.skills.filter(x => x !== s) : [...p.skills, s] }));
  }
  function toggleBg(b) {
    const has = f.preferred_background.includes(b);
    setF(p => ({ ...p, preferred_background: has ? p.preferred_background.filter(x => x !== b) : [...p.preferred_background, b] }));
  }

  function validate(s) {
    setErr("");
    if (s === 1) {
      if (!f.name.trim()) {
        setErr(role === "student" ? "Full name is required." : "Organisation name is required.");
        return false;
      }
      if (!f.email.trim() || !f.email.includes("@")) {
        setErr("A valid email is required.");
        return false;
      }
      if (role === "student" && !f.email.endsWith("@ub.ac.bw")) {
        setErr("Student email must end with @ub.ac.bw.");
        return false;
      }
      if (f.pw.length < 8) {
        setErr("Password must be at least 8 characters.");
        return false;
      }
      if (f.pw !== f.confirmPw) {
        setErr("Passwords do not match.");
        return false;
      }
      return true;
    }
    if (s === 2 && role === "student") {
      if (!/^\d{9}$/.test(f.student_id)) {
        setErr("Student ID must be exactly 9 digits.");
        return false;
      }
      if (!f.programme) {
        setErr("Please select your programme.");
        return false;
      }
      if (!f.preferred_location) {
        setErr("Please select a preferred location.");
        return false;
      }
      if (!f.preferred_industry) {
        setErr("Please select a preferred industry.");
        return false;
      }
      if (!f.preferred_role) {
        setErr("Please select a preferred role.");
        return false;
      }
      return true;
    }
    if (s === 2 && role === "organization") {
      if (!f.contact_person.trim()) {
        setErr("Contact person name is required.");
        return false;
      }
      if (!f.contact_phone.trim()) {
        setErr("Contact phone is required.");
        return false;
      }
      if (!f.industry) {
        setErr("Please select your industry.");
        return false;
      }
      if (!certificateFile) {
        setErr("Please upload the Certificate of Incorporation (PDF or image).");
        return false;
      }
      return true;
    }
    return true;
  }

  function next() { if (validate(step)) setStep(s => s + 1); }

  async function submit() {
    if (!validate(step)) return;
    setLoading(true);
    setErr("");
    try {
      // Prepare profile data
      const profileData = {
        role,
        name: f.name.trim(),
        email: f.email.trim().toLowerCase(),
        student_id: f.student_id?.trim(),
        programme: f.programme,
        bio: f.bio,
        skills: f.skills,
        custom_skills: role === "organization" ? customSkillsText : f.custom_skills,
        preferred_location: f.preferred_location,
        preferred_industry: f.preferred_industry,
        preferred_role: f.preferred_role,
        portfolio: f.portfolio,
        linkedin: f.linkedin,
        org_status: role === "organization" ? "pending" : undefined,
        contact_person: f.contact_person,
        contact_phone: f.contact_phone,
        location: f.location,
        industry: f.industry,
        capacity: parseInt(f.capacity) || 2,
        internship_description: f.internship_description,
        preferred_background: f.preferred_background,
      };

      // 1. Register user (creates auth + profile)
      const authUser = await registerUser(profileData, f.pw);

      // 2. If organisation, upload certificate (required) and update profile
      if (role === "organization") {
        if (!certificateFile) throw new Error("Certificate file missing.");
        const fileExt = certificateFile.name.split('.').pop();
        const fileName = `${authUser.id}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('certificates')
          .upload(fileName, certificateFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('certificates').getPublicUrl(fileName);
        await updateUser(authUser.id, { certificate_url: urlData.publicUrl });
      }

      toast("ok", role === "student" ? "Registration complete. Please sign in." : "Registration submitted. Awaiting approval.");
      onClose();
    } catch (e) {
      console.error("Registration error:", e);
      toast("err", e.message || "Registration failed. Check console.");
    } finally {
      setLoading(false);
    }
  }

  const nameLabel = role === "student" ? "Full Name *" : "Organisation Name *";
  const namePlaceholder = role === "student" ? "e.g. Kagiso Sithole" : "e.g. Botswana Innovation Hub";

  return (
    <div className="overlay">
      <div className="modal">
        <div className="modal-hd">
          <h3>Register — {role === "organization" ? "Organisation" : role.charAt(0).toUpperCase() + role.slice(1)}</h3>
          <button className="modal-close" onClick={onClose}><X /></button>
        </div>
        <div className="modal-steps">
          {steps.map((l, i) => (
            <div key={i} className="step-track">
              <div className="step-bar" style={{ background: i + 1 <= step ? "var(--mr)" : "var(--s3)" }} />
              <div className="step-lbl" style={{ color: i + 1 <= step ? "var(--mr)" : "var(--t3)" }}>{l}</div>
            </div>
          ))}
        </div>
        <div className="modal-body">
          {err && <div className="alert a-err"><AlertCircle />{err}</div>}
          {step === 1 && (
            <div>
              <div className="sec-hd">Account Credentials</div>
              <div className="fg"><label>{nameLabel}</label><input className="fi" placeholder={namePlaceholder} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
              <div className="fg"><label>Email Address *</label><div className="fi-wrap"><div className="fi-ico"><Lock /></div><input className="fi" type="email" placeholder={role === "student" ? "e.g. 202300001@ub.ac.bw" : "your@company.co.bw"} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div></div>
              <div className="fg"><label>Password *{f.pw && <span className="opt"> — {strLabels[str]}</span>}</label><div className="fi-wrap"><input className="fi" type={showPw ? "text" : "password"} value={f.pw} onChange={e => setF({ ...f, pw: e.target.value })} placeholder="Minimum 8 characters" style={{ paddingRight: 34 }} /><button className="fi-eye" onClick={() => setShowPw(v => !v)}>{showPw ? <EyeOff /> : <Eye />}</button></div>{f.pw && <div className="str-bar">{[1,2,3,4,5].map(i => <div key={i} className="str-seg" style={{ background: i <= str ? strColors[str] : "var(--s3)" }} />)}</div>}</div>
              <div className="fg"><label>Confirm Password *</label><input className="fi" type="password" value={f.confirmPw} onChange={e => setF({ ...f, confirmPw: e.target.value })} /></div>
              {role === "organization" && <div className="alert a-warn" style={{ marginTop: 4 }}><AlertCircle /><div>Organisation accounts require <strong>coordinator approval</strong> before you can access the system.</div></div>}
            </div>
          )}
          {step === 2 && role === "student" && (
            <div>
              <div className="sec-hd">Academic</div>
              <div className="fr"><div className="fg"><label>Student ID * <span className="opt">(9 digits)</span></label><input className="fi" placeholder="e.g. 202300001" maxLength={9} value={f.student_id} onChange={e => { const sid = e.target.value.replace(/\D/g, "").slice(0, 9); setF(p => ({ ...p, student_id: sid, email: sid.length === 9 ? sid + "@ub.ac.bw" : p.email })); }} /></div><div className="fg"><label>Programme *</label><select className="fi" value={f.programme} onChange={e => setF({ ...f, programme: e.target.value })}><option value="">Select…</option>{PROGRAMMES.map(p => <option key={p}>{p}</option>)}</select></div></div>
              <div className="fg"><label>Bio<span className="opt">(optional)</span></label><textarea className="fi" rows={2} placeholder="Background and interests…" value={f.bio} onChange={e => setF({ ...f, bio: e.target.value })} /></div>
              <div className="sec-hd">Preferences</div>
              <div className="fr"><div className="fg"><label>Location *</label><select className="fi" value={f.preferred_location} onChange={e => setF({ ...f, preferred_location: e.target.value })}><option value="">Select…</option>{LOCS.map(l => <option key={l}>{l}</option>)}</select></div><div className="fg"><label>Industry *</label><select className="fi" value={f.preferred_industry} onChange={e => setF({ ...f, preferred_industry: e.target.value })}><option value="">Select…</option>{INDUSTRIES.map(i => <option key={i}>{i}</option>)}</select></div></div>
              <div className="fg"><label>Preferred Role *</label><select className="fi" value={f.preferred_role} onChange={e => setF({ ...f, preferred_role: e.target.value })}><option value="">Select…</option>{PREF_ROLES.map(r => <option key={r}>{r}</option>)}</select></div>
            </div>
          )}
          {step === 2 && role === "organization" && (
            <div>
              <div className="sec-hd">Organisation Details</div>
              <div className="fg"><label>Industry *</label><select className="fi" value={f.industry} onChange={e => setF({ ...f, industry: e.target.value })}><option value="">Select…</option>{INDUSTRIES.map(i => <option key={i}>{i}</option>)}</select></div>
              <div className="sec-hd">Contact</div>
              <div className="fr"><div className="fg"><label>Contact Person *</label><input className="fi" value={f.contact_person} onChange={e => setF({ ...f, contact_person: e.target.value })} /></div><div className="fg"><label>Phone *</label><div className="fi-wrap"><div className="fi-ico"><Phone /></div><input className="fi" placeholder="+267 71 000 000" value={f.contact_phone} onChange={e => setF({ ...f, contact_phone: e.target.value })} /></div></div></div>
              <div className="fr"><div className="fg"><label>Email</label><input className="fi" type="email" value={f.email} readOnly /></div><div className="fg"><label>Location</label><select className="fi" value={f.location} onChange={e => setF({ ...f, location: e.target.value })}>{LOCS.map(l => <option key={l}>{l}</option>)}</select></div></div>
              <div className="sec-hd">Programme</div>
              <div className="fg"><label>Capacity</label><input className="fi" type="number" min={1} max={30} value={f.capacity} onChange={e => setF({ ...f, capacity: e.target.value })} /></div>
              <div className="fg"><label>Description<span className="opt">(optional)</span></label><textarea className="fi" rows={3} value={f.internship_description} onChange={e => setF({ ...f, internship_description: e.target.value })} /></div>
              <div className="fg"><label>Custom Skills <span className="opt">(comma‑separated)</span></label><input className="fi" placeholder="e.g., Project Management, Data Analysis, AutoCAD" value={customSkillsText} onChange={e => setCustomSkillsText(e.target.value)} /></div>
              <div className="fg">
                <label>Certificate of Incorporation * (PDF/Image)</label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setCertificateFile(e.target.files[0])} />
                <div className="fi-hint">Upload your company registration certificate (required).</div>
              </div>
            </div>
          )}
          {step === 3 && role === "student" && (
            <div>
              <div className="sec-hd">Skills</div>
              <div className="fg"><label>Select Skills</label><div className="chip-wrap">{SKILLS_LIST.map(s => <span key={s} className={"chip" + (f.skills.includes(s) ? " on" : "")} onClick={() => toggleSkill(s)}>{s}</span>)}</div></div>
              <div className="fg"><label>Additional Skills<span className="opt">(comma-separated)</span></label><input className="fi" placeholder="e.g. GraphQL, Docker, Figma" value={f.custom_skills} onChange={e => setF({ ...f, custom_skills: e.target.value })} /></div>
              <div className="sec-hd">Online Presence<span style={{ fontWeight: 400, fontSize: 10, color: "var(--t3)", textTransform: "none", marginLeft: 6 }}>— optional</span></div>
              <div className="fg"><label>Portfolio / GitHub</label><div className="fi-wrap"><div className="fi-ico"><Code2 /></div><input className="fi" placeholder="https://github.com/…" value={f.portfolio} onChange={e => setF({ ...f, portfolio: e.target.value })} /></div></div>
              <div className="fg"><label>LinkedIn</label><div className="fi-wrap"><div className="fi-ico"><ExternalLink /></div><input className="fi" placeholder="https://linkedin.com/in/…" value={f.linkedin} onChange={e => setF({ ...f, linkedin: e.target.value })} /></div></div>
            </div>
          )}
          {step === 3 && role === "organization" && (
            <div>
              <div className="sec-hd">Required Skills</div>
              <div className="fg"><label>Select Skills</label><div className="chip-wrap">{SKILLS_LIST.map(s => <span key={s} className={"chip" + (f.skills.includes(s) ? " on" : "")} onClick={() => toggleSkill(s)}>{s}</span>)}</div></div>
              <div className="sec-hd">Preferred Backgrounds</div>
              <div className="fg"><label>Select Backgrounds</label><div className="chip-wrap">{STU_BACKGROUNDS.map(b => <span key={b} className={"chip" + (f.preferred_background.includes(b) ? " on" : "")} onClick={() => toggleBg(b)}>{b}</span>)}</div></div>
            </div>
          )}
        </div>
        <div className="modal-ft">
          {step > 1 && <button className="btn btn-ghost btn-sm" onClick={() => { setErr(""); setStep(s => s - 1); }}><ChevronLeft /> Back</button>}
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X /> Cancel</button>
          {step < steps.length ? (
            <button className="btn btn-primary btn-sm" onClick={next}>Next <ChevronRight /></button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={submit} disabled={loading}>
              {loading ? <Loader2 style={{ animation: "spin 1s linear infinite" }} /> : <Check />}
              {loading ? "Registering…" : "Complete"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
// ==================== APP CONTEXT ====================
const AppCtx = createContext(null);
function useApp() { return useContext(AppCtx); }

// ==================== MAIN APP ====================
export default function App() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [regRole, setRegRole] = useState(null);
  const [toasts, setToasts] = useState([]);
  useEffect(() => { setReady(true); }, []);
  const toast = useCallback((type, msg) => {
    const id = Date.now();
    setToasts(p => [...p, { id, type, msg }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);
  function handleLogout() { signOut(); setUser(null); setPage("dashboard"); }
  function renderPage() {
  if (!user) return null;
  const r = user.role;
  if (r === "coordinator") {
    if (page === "dashboard") return <CoordDashboard />;
    if (page === "organisations") return <OrgsList />;
    if (page === "students") return <StudentsList />;
    if (page === "matching") return <MatchingPage />;
    if (page === "submissions") return <AllSubmissions />;
    if (page === "approvals") return <CoordApprovals />;
  }
  if (r === "student") {
    if (page === "dashboard") return <StudentDashboard user={user} />;
    if (page === "profile") return <StudentProfile user={user} />;
    if (page === "allocation") return <StudentAllocation user={user} />;
    if (page === "logbook") return <LogbookPage user={user} />;
    if (page === "assessments") return <StudentAssessments user={user} />;
  }
  if (r === "organization") {
    if (page === "dashboard") return <OrgDashboard user={user} />;
    if (page === "profile") return <OrgProfile user={user} />;
    if (page === "students") return <OrgStudents user={user} />;
  }
  if (r === "supervisor") {
    if (page === "dashboard") return <SupDashboard user={user} />;
    if (page === "reports") return <SupReports user={user} />;
    if (user.sup_type === "industrial" && page === "logbook-review") return <IndusLogbookReview user={user} />;   // NEW
  }
  return null;
}
  if (!ready) return <><style>{CSS}</style><Boot /></>;
  if (user && user.role === "organization" && user.org_status === "pending")
    return <AppCtx.Provider value={{ user, setUser, toast }}><style>{CSS}</style><Toasts list={toasts} /><OrgPendingScreen user={user} onLogout={handleLogout} /></AppCtx.Provider>;
  if (user && user.role === "organization" && user.org_status === "rejected")
    return <AppCtx.Provider value={{ user, setUser, toast }}><style>{CSS}</style><Toasts list={toasts} /><OrgRejectedScreen user={user} onLogout={handleLogout} /></AppCtx.Provider>;
  return (
    <AppCtx.Provider value={{ user, setUser, toast }}>
      <style>{CSS}</style>
      <Toasts list={toasts} />
      {regRole && <RegModal role={regRole} onClose={() => setRegRole(null)} />}
      {!user ? (
        <LoginPage onLogin={u => { setUser(u); setPage("dashboard"); }} onRegister={r => setRegRole(r)} />
      ) : (
        <div className="shell">
          <Sidebar user={user} active={page} onNav={p => setPage(p)} onLogout={handleLogout} />
          <main className="main">
            <TopBar page={page} />
            {renderPage()}
          </main>
        </div>
      )}
    </AppCtx.Provider>
  );
}