/* app-bootstrap.jsx — تتبع صامت للزيارات وسلوك الملاك (Supabase) */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://codnqkeycfhznzbqlpds.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_L1yElSU0fd6a6BNQS6Qgsw_0Ale7aNu";
export const TELEGRAM_URL = "https://t.me/+thhB4M36VkFkYjZk";
/* عميل Supabase الحقيقي — يُستخدم بلوحة الإدارة (تسجيل الدخول + قراءة/كتابة البيانات).
   نفس الرابط والمفتاح العام أعلاه، آمنين للنشر بالمتصفح طالما RLS مفعّلة (راجع setup-supabase.sql) */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
/* v2.9.1 — دمج دفعة أحداث Realtime في قراءة واحدة: استيراد إكسل يولّد مئات
   الأحداث خلال ثوانٍ، وبدون الدمج كان كل زائر مفتوح عنده الموقع يرسل مئات الطلبات. */
export function debounceLive(fn, ms = 400) {
  let t = null;
  const run = () => { clearTimeout(t); t = setTimeout(fn, ms); };
  run.cancel = () => clearTimeout(t);
  return run;
}
/* رقم جلسة عشوائي مؤقت يتولّد مرة وحدة لكل تحميل صفحة — بدون أي معنى شخصي،
   هدفه فقط تجميع أحداث نفس الزيارة ببعض لتقدير الوقت المقضي (تحليل كلي وليس فردي) */
const SESSION_ID =
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function logEvent(event_type, category, value, extra) {
  try {
    fetch(`${SUPABASE_URL}/rest/v1/logs`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        event_type,
        category: category != null ? String(category) : null,
        value: value != null ? String(value) : null,
        extra: extra != null ? String(extra) : null,
        session_id: SESSION_ID,
      }),
    }).catch(() => {});
  } catch (e) {}
}
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import {
  Search, X, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, Users, Layers, ShieldAlert,
  RotateCcw, User, Calendar, Hash, Ruler, Droplet, ArrowLeft, Home,
  RefreshCw, Copy, Check, Sparkles, Sun, Moon, Monitor, History,
  LayoutGrid, Table, Laptop, Smartphone, Share2, ThumbsUp, ThumbsDown,
  ChevronLeft, ChevronRight, ArrowUp, SlidersHorizontal, FileText, ExternalLink, AlertTriangle,
  Play,
} from "lucide-react";
/* أيقونات إضافية للوحة الإدارة فقط */
import {
  LogIn, LogOut, Upload, Download, Star, ShieldCheck, FileSpreadsheet,
  PlusCircle, Pencil, MinusCircle, Lock, BarChart3, Eye, Filter,
  MousePointerClick, Tag, Trash2, UserPlus, ListPlus, TrendingUp,
  EyeOff, Link2, Clapperboard,
} from "lucide-react";

/* أيقونة تليجرام الرسمية (غير متوفرة في lucide-react) */
export const TelegramIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="120" cy="120" r="120" fill="#27A7E7" />
    <path d="M54 118.5l125-48.2c5.8-2.2 10.9 1.4 9 10l-21.3 100.4c-1.6 7.4-6 9.2-12.1 5.7l-33.5-24.7-16.2 15.6c-1.8 1.8-3.3 3.3-6.7 3.3l2.4-34.2 62.3-56.3c2.7-2.4-.6-3.7-4.2-1.3l-77 48.5-33.2-10.4c-7.2-2.3-7.4-7.2 1.5-10.4z" fill="#fff" />
  </svg>
);
