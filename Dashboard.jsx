import React, { useState, useMemo, useEffect, useLayoutEffect, useRef, createContext, useContext } from "react";

/* ── تتبع صامت للزيارات وسلوك الملاك (Supabase) ── */
const SUPABASE_URL = "https://codnqkeycfhznzbqlpds.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_L1yElSU0fd6a6BNQS6Qgsw_0Ale7aNu";
/* رقم جلسة عشوائي مؤقت يتولّد مرة وحدة لكل تحميل صفحة — بدون أي معنى شخصي،
   هدفه فقط تجميع أحداث نفس الزيارة ببعض لتقدير الوقت المقضي (تحليل كلي وليس فردي) */
const SESSION_ID =
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
function logEvent(event_type, category, value, extra) {
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
  Search, X, ChevronDown, CheckCircle2, XCircle, Clock, Users, Layers, ShieldAlert,
  RotateCcw, User, Calendar, Hash, Ruler, Droplet, ArrowLeft, Home,
  Upload, RefreshCw, AlertTriangle, Copy, Check, Sparkles, Sun, Moon, Monitor, History,
  LayoutGrid, Table, Laptop, Smartphone,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   نسخة أساسية مدمجة — تعمل فورًا بدون رفع أي ملف.
   يستبدلها التحديث المنشور عند وجوده.
   ═══════════════════════════════════════════════════════════ */
const MODELS = ["جميع النماذج", "جميع النماذج عدا امانيثير", "أورورا", "امانيثير و آلبا", "البا و امانيثير"];
const LOCS = ["كامل الفيلا", "الدور الأول", "الدور الأرضي", "دورات المياه", "السطح", "الشارع", "الدرج", "غير محدد", "المطبخ", "المطبخ ودورات المياه", "كامل الفيلا (بين الفلل المتلاصقة)", "الدور الأرضي والأول", "موقع الخزان", "الحوش الخلفي (الدور الأرضي)", "الحوش الخلفي (الدور الأرضي) والسطح"];
const PRI_ORDER = ["عالية جدًا", "عالية", "متوسطة", "عادية"];
const STA_ORDER = ["معتمدة", "تم الرفض", "قيد الدراسة", "تم التصويت"];
const OWN = ["م/محمد عبدالمعطي", "م/رواحه", "غير محدد", "أبو سلطان"];
const MON = ["2026-05", "2026-07", "2025-12", "2025-05", "2026-03", "", "2026-08"];

const RAW = [[1, 0, 0, 0, 0, 1, 0, 0, 1, 0, "التصميم الحالي للأبواب الداخليه غير مناسب من الناحية الجمالية — الحل المقترح: تغيير تصميم الأبواب الداخليه إلى نموذج أكثر ملاءمة", "سوف يتم إعاده تصميم الأبواب الداخليه لجميع النماذج إلى لون اخر ( غالبا اوف وايت )"], [2, 0, 0, 0, 0, 1, 0, 0, 1, 0, "عدم وجود شفافيه بطريقه العزل المائي و نوع العزل الذي سوف يستخدم في المطبخ و دورات المياه — الحل المقترح: التاكد من وجود عزل مائي جيد للمطبخ و جميع دورات المياه على ان يكون ارتفاع العزل المائي ٢٠ سم على الجدار لتجنب الرطوبه", "نوع العزل المستخدم هو(اللفائف البيتومينيه ) في المطابخ و الحمامات وبارتفاع ٢٠ سم بكل الجدران"], [3, 0, 1, 0, 0, 1, 0, 0, 1, 0, "طريقة التنفيذ الكسارات على النافذه الحالية قد تؤدي إلى تجمع المياه وحدوث رطوبة على الواجهة — الحل المقترح: إعادة تنفيذ الكسارات بطريقة تمنع تجمع المياه وتسرب الرطوبة", "سوف يتم تركيب الكسارات خارج إطار الالمونيوم مع ميول للخارج حيث انه يضمن عدم تجمع الماء مستقبلا"], [4, 0, 0, 0, 0, 1, 0, 1, 1, 0, "السيراميك أقل جودة من البورسلان ويعد أقل تحمّلًا للاستخدام طويل المدى — الحل المقترح: ترقيه التشطيب الى بورسلان", "تم ترقيه التشطيبات من سيراميك إلى بورسلان"], [5, 0, 0, 0, 0, 1, 1, 2, 1, 0, "لايوجد جبس بورد في الدور الأول و الثاني — الحل المقترح: ترقيه جميع الأدوار الى جبس بورد ماعدا السطح", "تمت الترقيه إلى جبس بورد في جميع غرف النوم بدون الاسياب"], [6, 0, 2, 0, 0, 1, 1, 2, 1, 0, "عدم وجود تأسيس مسبق لكاميرات المراقبة في جميع النماذج — الحل المقترح: اعتماد تنفيذ وتمديد نقاط كاميرات مراقبة خارجية لجميع النماذج", "تم اعتماد تأسيس نقاط مراقبه للكاميرات في جميع النماذج"], [7, 0, 0, 0, 0, 1, 1, 2, 1, 0, "عدم تزويد المستحقين بكيفية الحصول على العرض — الحل المقترح: تزويد الملاك بطريقه الاستفاده من التخفيض", "سوف يتم تزويد الملاك بطريقه الاستفاده من العرض بعد تسليم الوحدات"], [8, 0, 2, 0, 0, 1, 1, 3, 1, 0, "عدم توضيح ما نوع العازل الذي سوف يستخدم في الأحواض الزراعية الخارجيه — الحل المقترح: توضيح نوع العزل المائي المستخدم في الأحواض الزراعيه الخارجية", "سوف يتم عزل الأحواض الزراعية الخارجية بالكامل لتفادي الرطوبه والإضرار بالهيكل الإنشائي فيما بعد"], [9, 0, 0, 0, 0, 1, 0, 3, 1, 0, "عدد الأفياش في جميع النماذج — الحل المقترح: زياده عدد الافياش في جميع النماذج", "تم بالفعل إعاده تأسيس عدد الأفياش وزياده عددها كما هي في فيلا العرض"], [10, 0, 2, 0, 0, 1, 0, 1, 1, 0, "موقع الخزان اسفل موقف السياره — الحل المقترح: تغيير موقع الخزان الارضي الى اسفل الحديقة لتفادي المشاكل المستقبلية من الهبوط و انكسار خزان المياه وتهريب المياه", "سوف يتم تدعيم الخزان الارضي بكمرات وجسور وسيتم تسليح الارضيه لتحمل الاوزان العالية مثل السيارات"], [11, 0, 2, 0, 0, 1, 0, 1, 1, 0, "عدم توضيح عن آلية هل سوف يتم تأسيس كوابل CAT6 داخل المشروع — الحل المقترح: تمديد وتأسيس كوابل CAT6 وذلك ليسهل تحويل المنزل الى منزل ذكي و تركيب إنترنت ألياف بصريه في المستقبل", "سوف يتم تمديد وتاسيس وتوريد الكوابل في كل الادوار وتاسيس موقع سيفر في المستودع( بدون تركيب كاميرات وسيرفرات )"], [12, 0, 0, 0, 0, 1, 0, 1, 1, 0, "أرضية المنور تفتقر تماماً لوجود صفاية أو ماسورة لتصريف مياه الأمطار أو مياه غسيل المنور مستقبل — الحل المقترح: تأسيس نظام صرف أو توضيح الإجراء الهندسي المقترح لحل هذه المشكله", "لا يحتاج فتحة تصريف وذلك لتنفيذه بطريقه تمنع دخول السوائل داخل المنور مع اقفاله بشبك لمنع دخول الحشرات بالمستقبل"], [13, 0, 0, 0, 0, 1, 0, 1, 1, 0, "التبليط فوق بقايا أخشاب ومسامير في المشروع مما قد يتسبب بالنمل الأبيض وهبوط الارضيه — الحل المقترح: إلزام المقاولين بتنظيف الارضيه قبل البدء بأعمال التبليط في المشروع", "سوف يتم تنبيه المقاولين بذلك"], [14, 0, 2, 0, 0, 1, 0, 1, 1, 0, "مقاس الماصوره الصرف الصحي الداخليه 4 بوصه غير كافيه — الحل المقترح: تركيب ماصوره صرف صحي مقاس 6 بوصه وذلك لتجنب انسداد الصرف مستقبلا", "سوف يتم تعديل ذلك في نموذج البادا فقط (اكبر نموذج)"], [15, 0, 3, 0, 1, 1, 0, 1, 1, 0, "تبليط جدار دورات المياه إلى منتصف الجدار مما قد يسبب تجمع المياه والرطوبه داخل الجدار — الحل المقترح: إكمال بناء وتبليط جدار دورات المياه كامله لتجنب الرطوبه داخل الجدار مستقبلا", "سوف يتم اعتماده كما هو في فيلا العرض"], [16, 0, 2, 0, 1, 1, 1, 2, 1, 0, "سعة الخزان 5000 لتر فقط لا تتناسب مع حجم الاستخدام المتوقع — الحل المقترح: توسيع حجم الخزان الأرضي لاكثر من 7000 لتر", "تم اعتماد ٥ متر مكعب لجميع النماذج"], [17, 0, 3, 0, 1, 1, 1, 2, 1, 0, "عدم توفير تمديد الماء الحار (شطاف) لا يتوافق مع الاستخدام الطبيعي لدورات المياه — الحل المقترح: تمديد شطاف حار لجميع دورات المياه", "تم اعتماد بارد فقط"], [18, 0, 2, 0, 1, 1, 1, 2, 1, 0, "وجود حوض واحد في مغاسل المجلس لا يتوافق مع المخطط الإنشائي المعتمد — الحل المقترح: تعديل المغسله في المجلس الى حوضين كما في المخطط الانشائي", "تم اعتماد حوض واحد فقط"], [19, 0, 2, 1, 0, 1, 0, 0, 1, 0, "ارتفاع السور الخارجي غير متوافق مع ارتفاع الديكور الخارجي لجميع النماذج — الحل المقترح: تعديل ارتفاع السور و الديكور الخارجي", "سوف يتم اعتماد ارتفاع السور الخارجي لجميع فلل المشروع ٢.٧ متر وجعل السور موازي لارتفاع الديكور الخارجي"], [20, 0, 2, 1, 0, 1, 0, 0, 1, 0, "التصميم الحالي للأبواب الخارجية غير مناسب من الناحية الجمالية — الحل المقترح: تغيير تصميم الأبواب الخارجية إلى نموذج أكثر ملاءمة للطابع المعماري للمشروع", "سوف يتم إعاده تصميم الأبواب الخارجيه لجميع النماذج"], [21, 0, 3, 1, 0, 1, 1, 2, 1, 0, "افرنجي ارضي في جميع دورات المياه — الحل المقترح: تركيب افرنجي معلق في دورة المياه المجلس و الغرفه الماستر", "تم اعتماد تركيب معلق لدورة المياه المجلس و الغرفه الماستر"], [22, 0, 0, 1, 0, 1, 1, 3, 1, 0, "عدم توضيح نوع الأدوات الصحيه المستخدمه في المشروع — الحل المقترح: تزويد الملاك بنوع الأدوات الصحيه التي سوف تستخدم في المشروع", "الأدوات الصحيه المستخدمه سوف تكون محلية من شركة الخزف السعودية"], [23, 0, 2, 1, 0, 1, 0, 0, 1, 0, "عدم وجود رداد في الماصوره بين الفيلا و الصرف الصحي الخارجي مما قد يسبب وجود حشرات والروائح — الحل المقترح: تركيب (رداد) في خط الصرف الرئيسي الخارج من الفيلا لمنع ارتداد الروائح والحشرات وضمان انسيابية التدفق", "سوف يتم تركيب رداد خارجي بين الفيلا و الصرف الرئيسي"], [24, 0, 4, 1, 0, 1, 0, 1, 1, 0, "خطوط تغذية الماء للخزان العلوي عددها (3) خطوط، ولكن لا يوجد عليها إلا محبس رئيسي واحد فقط — الحل المقترح: إضافة محابس فرعية لكل خط تغذية لضمان سهولة الصيانة والتحكم المستقبلي", "يوجد محابس فرعيه لكل دور وقد تم العمل عليها بالفعل"], [25, 0, 5, 1, 0, 1, 0, 1, 1, 0, "تاسيس موقع الاناره للحي أمام باب الكراج لبعض النماذج — الحل المقترح: اعاده تاسيس انارة الحي وذلك لوجود مشكلة متعلقة بمواقع الاناره ( شركة الصاعدي )", "تمت مخاطبه الخدمات الارضيه و الرد هو ان التعديل يتم وقت ارصفه الشوارع"], [26, 0, 6, 1, 0, 1, 0, 1, 1, 0, "التصميم الحالي للدرابزين الداخلي لا يتناسب مع الطابع المعماري للفيلا ومنعدم الامان للأطفال — الحل المقترح: تعديل تصميم ولون درابزين الدرج الداخلي بما يتناسب مع التصميم العام للفيلا", "الفتحات ٩ سم وهي في نطاق الحد الامن ولا تشكل خطوره وسوف يتم تعديل الدرابزين بشكل بسيط اضافات خشبية بالاعلى"], [27, 0, 7, 1, 0, 1, 0, 1, 1, 0, "خزانات المياه الارضيه لأغلب فلل المشروع غير مقفله مما قد يتسبب بوقوع العاملين او الاتربه او ماشابه — الحل المقترح: تنبيه المقاولين بضروره اقفال الخزانات وذلك تجنبا لوقوع الحيوانات او دخول الاتربه داخل الخزانات", "سوف يتم تنبيه المقاولين بأقفال الخزانات الارضية"], [28, 0, 2, 1, 0, 1, 0, 1, 1, 0, "موقع السخان فوق المغاسل يعيق الصيانة والتنظيف، ويتسبب في اتساخ منطقة المغاسل وتضرر الديكور — الحل المقترح: إعادة توطين السخان داخل دورة المياه لسهولة الخدمة والحفاظ على نظافة وسلامة ديكورات المغاسل", "سيتم نقله في المراحل التي لازالت في مرحله التاسيس الثالثة و الرابعه"], [29, 0, 2, 1, 0, 1, 0, 0, 1, 0, "مجرى الباب الحالي منفذ بطريقة بارزة عن مستوى سطح الأرض (البلاط) وبحواف حادة — الحل المقترح: إعادة تنفيذ مجرى باب الكراج بطريقة (غاطسة) لتكون بمستوى بلاط الحوش", "سوف يتم إعاده التصميم بطريقه غاطسه مع الميول لضمان عدم تجمع المياه"], [30, 0, 2, 1, 2, 1, 0, 1, 0, 0, "شكل نافذه المجلس لا يتناسب مع الطابع المعماري — الحل المقترح: تحسين التصميم الالمونيوم إلى باب سحب للاستفادة المستقبليه", "سوف يتم النظر في ذلك"], [31, 0, 2, 1, 0, 1, 0, 0, 1, 0, "موقع المكيف فوق الباب قد يؤثر على توزيع الهواء والجمالية — الحل المقترح: تعديل موقع التكييف الى ظهر جدار مجلس", "سوف يتم تغيير موقع لمكيف لنموذج (البادا اورورا و البا) فقط"], [32, 0, 6, 1, 1, 1, 0, 1, 1, 0, "حواف الدرج الداخليه حاده ويشكل خطر على الماره — الحل المقترح: تعديل حواف الدرج إلى تقويس للحد من خطوره أثناء الاستخدام", "الحواف غير حاده وسوف يتم اعتمادها كما هي في فيلا العرض"], [33, 0, 7, 1, 1, 1, 0, 1, 1, 0, "سطح الملحق غير مبلط وتم الاكتفاء بفرش البحص فقط — الحل المقترح: إلزام المقاول بإنهاء أعمال التبليط الخاصة بسطح الملحق بالكامل", "سوف يتم اعتماد البحص وذلك لوجود التكييف في السطح الملحق"], [34, 0, 0, 1, 1, 1, 0, 4, 1, 0, "شكل نعله السيراميك لا تتناسب مع التصاميم الحديثه — الحل المقترح: تغيير النعله التقليديه إلى نعله سيراميك مخفيه", "لا يمكن تركيب نعله مخفيه وذلك بسبب انه يحتاج تصحيح انشائي وقد تم تجاوز هذه المرحله"], [35, 0, 1, 1, 1, 1, 0, 1, 1, 0, "لا يوجد بيت ستارة مخصص لتركيب الستارة ضمن تصميم الجبس بورد في جميع الغرف النوم في الدور الأول — الحل المقترح: تعديل تصميم الجبس بورد من جهة النافذة بما يسمح بتركيب بيت الستارة بشكل مناسب", "لن يتم تركيب بيت ستاره وذلك لصغر النافذه حيث انه سوف يسبب تشوه بصري"], [36, 0, 4, 2, 0, 1, 0, 1, 0, 0, "وجود قوس اعلى غرفه الغسيل مما قد يصعب استغلال المساحه مستقبلا — الحل المقترح: ازاله الجدار القوسي فوق غرفه الغسيل في الدور الأخير لكي يسهل مستقبلاً استغلال المساحه", "سوف يتم ازالته في الفلل الي لازالت في مرحله الانشاء"], [37, 0, 1, 2, 0, 1, 0, 1, 1, 0, "عدم وجود تاسيس كهرباء لنوافذ غرف النوم — الحل المقترح: تاسيس كهرباء لجميع النوافذ غرف النوم لتركيب سترات كهربائيه في المستقبل", "سوف يتم تاسيس ذلك في المراحل الي لازالت على قيد الانشاء"], [38, 0, 4, 2, 3, 1, 0, 1, 0, 0, "باب السطح يسبب تشوه بصري — الحل المقترح: توحيد تصميمه مع النماذج المعتمدة", "من الممكن تغييره إلى شكل اخر ( تم التصويت على باب بدون زجاج بنسبه ٤٩٪ )"], [39, 0, 6, 2, 1, 1, 0, 1, 1, 0, "لون رخام الدرج ( ترافرتينو ) إسباني — الحل المقترح: تغيير لون الرخام إلى لون اخر", "لن يتم تغيير اللون وسوف يتم اعتماده كما هو في فيلا العرض"], [40, 0, 3, 2, 1, 1, 0, 1, 1, 0, "لون السيراميك المستخدم في جميع دورات المياه من ثلاث ألوان — الحل المقترح: تغيير لون السيراميك لدورات المياه إلى لون واحد أو إلى لونين", "سوف يتم اعتماده كما هو في فيلا العرض"], [41, 0, 4, 2, 1, 1, 0, 1, 1, 0, "الخزن العلوي مكشوف وغير مزود بمظلة وغطاء حمايه من أشعه الشمس — الحل المقترح: تركيب مظله واقيه أو غطاء مخصص لحماية الخزان من العوامل الجوية", "من غير الممكن تركيبها وسوف يتم اعتماده كما هو في فيلا العرض"], [42, 0, 2, 2, 1, 1, 0, 1, 1, 0, "التصريف الخاص بالسطح يصب مباشرة عند مدخل الفيلا، مما قد يسبب تراكم المياه أو تلفاً للمنطقة المحيطة — الحل المقترح: تغيير مسار أنبوب التصريف ليمر إلى شبكة الصرف الرئيسية أو إلى منطقة مخصصة لتصريف المياه بعيداً عن المدخل", "لن يتم تعديله وسوف يتم اعتماده كما هو في فيلا العرض"], [43, 0, 2, 2, 1, 1, 1, 3, 1, 0, "التكييف المتعمد في جميع النماذج في المطبخ نوع اسبيلت — الحل المقترح: هل من الممكن تعديله من اسبليت الى كاسيت في المطبخ لجميع النماذج", "سوف يتم اعتماد اسبليت في المطبخ"], [44, 0, 0, 3, 0, 1, 0, 1, 1, 0, "لون طلاء الجدران اوف وايت في جميع التماذج — الحل المقترح: هل سوف يتم اختيار نفس لون طلاء الجدران نفس البروفايل المعتمد في فيلا العرض", "سوف يتم اعتماد اللون كما هو في فيلا العرض وسوف يتم تزويدكم مستقبلا بالبروفايل المستخدم"], [45, 1, 2, 0, 0, 1, 0, 1, 1, 0, "تأسيس صرف يبعد عن النافذه الصاله الطعام اقل من ١٠ سم مما قد يتسبب بمشاكل مستقبليه عند التشطيب — الحل المقترح: ابعاد التاسيس عن النافذه لتفادي مشاكل المستقبليه عند تركيب الالمونيوم للنافذه", "تم اعتماد بناء بلوك ١٠ سم مصمت وذلك لتفادي المشاكل المستقبليه"], [46, 1, 2, 2, 1, 1, 0, 0, 1, 0, "الاناره عند مدخل العائله ضعيفه مما قد يسبب صعوبه في الرؤيه — الحل المقترح: أعاده توزيع إضاءة مدخل العائله لتسهل الرؤيه", "لن يكون هناك اضاءة إضافيه وسوف يتم اعتماده كما هو في فيلا العرض"], [47, 1, 2, 2, 1, 1, 0, 0, 1, 0, "بيت الستاره في الصاله صغير ويوثر على الشكل النهائي — الحل المقترح: تمديد بيت الستارة حتى مستوى الفريم العلوي", "لن يتم تركيب بيت ستاره وذلك لصغر النافذه حيث انه سوف يسبب تشوه بصري"], [48, 2, 1, 0, 0, 1, 0, 0, 1, 0, "عدم وجود نظام تصريف لمياه الأمطار بالبلكونة العلويه مما يؤدي لتجمع المياه واحتمالية حدوث تسريبات — الحل المقترح: تأسيس نظام تصريف مياه (صفاية) وربطه بشبكة الصرف، مع التأكد من ميول الأرضية لمنع تجمع المياه مستقبلاً", "توجد صفايه وقد تم تأسيسها بالفعل"], [49, 3, 8, 0, 0, 1, 0, 1, 1, 0, "غياب التأسيس فتحت دكت مقاس ٤ بوصه يمنع تركيب شفاط مركزي مستقبلاً — الحل المقترح: تنفيذ فتحة 4 بوصة وتمديد الجرجور قبل إغلاق الأعمال", "تم اعتماد فتحتين بالمطبخ للشفاط و مروحه التهويه"], [50, 4, 3, 0, 0, 1, 0, 1, 1, 0, "عدم معرفه طريقه تمديد الجرجور بمزرعه التهويه بالمنور في الحمام المستقل للصاله — الحل المقترح: توضيح اليه تمديد الجرجور للشفاط في الحمام المستقبل الموجود في الدور الاول", "تم سحب جر جور الى المنور والمنور غير مقفل من الاعلى"], [51, 0, 9, 1, 0, 1, 0, 1, 1, 1, "استخدام جبس بورد عادي بالمطبخ ودورات المياه معرض للتلف نتيجة الرطوبة والحرارة العالية — الحل المقترح: استخدام جبس بورد مقاوم للحرارة بالمطبخ، وجبس بورد أخضر مقاوم للرطوبة بدورات المياه", "تم الاعتماد: جبس بورد أحمر مقاوم للحريق بالمطابخ، وجبس بورد أخضر مقاوم للرطوبة بدورات المياه والأماكن الرطبة، وجبس بورد عادي بباقي الفيلا — اشتراطات ثابتة معتمدة لجميع الفلل"], [52, 0, 2, 2, 0, 1, 0, 1, 1, 1, "تصميم الجبس بورد بالصالة قطعة واحدة كاملة — طُلب سابقًا تعديله بنفس تصميم المجلس ولم يُعتمد، والآن يجري تعديله بما يسمح مستقبلاً بفصل الصالة لغرفتين عند الحاجة", "تم اعتماد تعديل تصميم الجبس بالصالة بما يسهّل فصلها لغرفتين مستقبلاً"], [53, 2, 1, 1, 2, 0, 0, 1, 0, 1, "مقترح سابق بخصوص نافذة الشرفة بالدور الأول (أورورا) — الحل الجديد المقترح: تحويلها لدريشة سحب بارتفاع 90سم عن الأرضية حتى لا تُصنّف بلكونة حسب كود البناء", "جارٍ دراسة حل بديل: تحويل النافذة لدريشة سحب بارتفاع 90سم عن الأرضية حتى لا تُصنّف بلكونة حسب كود البناء"], [54, 0, 0, 2, 0, 1, 0, 1, 1, 1, "عمال الجبس بدأوا التنفيذ قبل تمديد أسلاك الكهرباء بالسقف — استفسار عن آلية وتوقيت تمديد الكهرباء قبل تركيب الجبس لتفادي أعمال هدم وإعادة", "يتم تمديد الكهرباء بعد إقفال جميع الأبواب والنوافذ لأسباب أمنية (منع سرقة الأسلاك)، ثم تُنفذ أعمال الجبس"], [55, 0, 0, 1, 0, 1, 0, 1, 1, 1, "السباكة معلقة مما يزيد خطر انتقال الصوت — استفسار: هل سيُطبق بفلل المشروع نفس مستوى العزل الصوتي (بين الفلل وللسباكة المعلقة) الموجود بفيلا العرض كمرجع فقط؟", "السباكة المعلقة أفقية وليست رأسية، وبالتالي لا يصدر عنها صوت جريان مياه، إضافة لاستخدام روبر عازل بنقاط التعليق، والجبس نفسه يوفر عزل صوتي كافٍ"], [56, 0, 2, 2, 2, 1, 0, 1, 0, 1, "اقتراح من المهندس: تركيب باب سحب للصالة بجميع النماذج — مطلوب اختيار آلية الفتح: ضغط (Push) أو مسكة سحب (Pull Handle)", "تم عرض خيارين لآلية فتح باب السحب: ضغط أو مسكة — بانتظار اختيار الملاك"], [57, 0, 10, 1, 0, 1, 0, 1, 1, 1, "استفسار عن تكوين جدار الفصل بين الفلل المتلاصقة", "الجدار الفاصل بين الفلل المتلاصقة سمكه الإجمالي 25سم: طوب بسمك 10سم من كل جهة + طبقة عزل 5سم بالمنتصف، مع عدم السماح بمرور أي تمديدات سباكة أو كهرباء داخل هذا الجدار"], [64, 0, 0, 2, 0, 1, 0, 1, 1, 1, "اللون الحالي لمفاتيح التشغيل لون (الرمادي) لا يتناسب مع النمط العام للتصميم الداخلي، مما يسبب تشتتاً بصرياً — الحل المقترح: استبدال الأغطية باللون الأسود لضمان التناغم مع التصميم الداخلي وسهولة الصيانة والتوفر مستقبلاً", "تمت الموافقة على اللون الأسود"], [59, 0, 4, 1, 0, 1, 0, 1, 1, 1, "استفسار عن نوع وسمك طبقة العزل الحراري والمائي المستخدمة أعلى سقف السطح، أسفل طبقة الميول والتشطيب النهائي", "تم اعتماد طبقة عزل حراري ومائي بسمك 7.5سم فوق سقف السطح الخرساني مباشرة، أسفل طبقة الميول والبلاط"], [60, 0, 0, 1, 0, 1, 0, 1, 1, 1, "استفسار عن وجود غرف تفتيش لشبكة الصرف الصحي تسهّل أعمال الصيانة عند حدوث انسداد", "تم اعتماد تركيب غرفتي تفتيش لشبكة الصرف الصحي، لتسهيل الصيانة والوصول إليها في حال الانسداد"], [61, 0, 11, 2, 0, 1, 0, 1, 1, 1, "استفسار عن إمكانية فتح الباب الرئيسي من الداخل عن طريق جهاز الانتركوم", "تم اعتماد ربط جهاز الانتركوم بقفل الباب الرئيسي بالدور الأرضي والأول، بحيث يمكن فتح الباب من الداخل عند الرغبة"], [62, 0, 12, 1, 0, 1, 0, 1, 1, 1, "استفسار عن طريقة تركيب قاعدة الخزان وضمان توزيع الأحمال بشكل هندسي سليم", "سيتم تركيب الخزان بطريقة هندسية تضمن توزيع الحمل على كامل مساحة الأرضية، من خلال شبكة حديد تسليح متقاطعة بتباعد 10 إلى 12سم داخل قاعدة خرسانية بسمك 15سم"], [63, 0, 13, 2, 2, 0, 2, 5, 0, 0, "استفسار عن مقاس ماسورة تصريف مياه الفناء الخلفي بالبوصة، وعدد صفايات التصريف الموجودة به، للتأكد من كفاية شبكة تصريف المياه", ""], [65, 0, 13, 1, 2, 0, 2, 5, 0, 0, "لوحظ تمديد ماسورة تصريف مياه الحوش الخلفي (PVC) ظاهرة فوق سطح الأرض، وممتدة من داخل الفيلا عبر فتحة بالجدار الخارجي باتجاه الحوش الخلفي دون طمر أو تثبيت نهائي. استفسار عن طريقة التنفيذ المعتمدة لهذا الخط، ومدى ضرورة تركيب رداد (صمام عدم رجوع) لمنع رجوع مياه الصرف والروائح والحشرات من الشبكة", ""], [66, 0, 14, 1, 2, 0, 2, 5, 0, 0, "استفسار عن إمكانية تركيب أفياش كهربائية خارجية في الحوش والسطح، على أن تكون مقاومة للعوامل الجوية ومياه الأمطار (IP-rated)", ""], [67, 0, 0, 1, 2, 0, 2, 5, 0, 0, "استفسار عن إمكانية تنفيذ شبكة بيانات (LAN) بكابلات من نوع Cat6A في جميع أنحاء الفيلا بدلاً من Cat6، لضمان جاهزية أكبر للتقنيات المستقبلية", ""], [68, 0, 0, 1, 2, 0, 2, 5, 0, 0, "استفسار عن مدى توفر فتحات صيانة مناسبة لوحدات تكييف الإسبلت، بما يتيح سهولة الوصول إليها عند إجراء أعمال الصيانة الدورية أو الطارئة", ""], [69, 0, 8, 2, 2, 0, 2, 5, 0, 0, "استفسار عن إمكانية زيادة عدد الأفياش الكهربائية في المطبخ بما يتناسب مع احتياجات الأجهزة الكهربائية الحالية والمستقبلية (غسالة صحون، فرن كهربائي، ميكروويف، غلاية، خلاط... إلخ)", ""], [70, 0, 0, 1, 2, 0, 2, 5, 0, 0, "استفسار عن إمكانية تزويدنا بمخطط توضيحي (MEP) يبيّن جميع مقاسات مواسير شبكتي المياه والصرف الصحي الداخلية للفيلا، ومطابقتها للمواصفات الفنية المعتمدة", ""], [71, 0, 0, 1, 2, 0, 2, 5, 0, 0, "استفسار عن مقاسات (سماكات) الأسلاك الكهربائية المستخدمة في جميع الغرف، مع بيان قدرة تحمل كل دائرة كهربائية، والتأكد من توافقها مع الأحمال المتوقعة وفق كود البناء السعودي (SBC 401)", ""], [72, 0, 8, 2, 0, 1, 3, 6, 1, 0, "استفسار عن نوع ومواصفات الجبس بورد المستخدم بسقف المطبخ", "جبس بورد من نوع Fire Resistant (مقاوم حريق) ماركة MADA، سماكة 12.5مم — تم تأكيده ميدانياً بالمعاينة والتصوير، وهو تنفيذ مطابق للقرار المعتمد سابقاً باستخدام نوع مقاوم للحرارة بالمطبخ"]];

const EN_TEXT = {
  1: { note: "The current interior door design isn't visually appropriate — proposed solution: change the interior door design to a more suitable model.", reply: "The interior doors will be redesigned for all models in a different color (mostly off-white)." },
  2: { note: "No clarity on the waterproofing method and material to be used in the kitchen and bathrooms — proposed solution: ensure proper waterproofing for the kitchen and all bathrooms, with the waterproofing height on walls reaching 20 cm to prevent moisture.", reply: "The waterproofing material used is bituminous membrane rolls in kitchens and bathrooms, at a height of 20 cm on all walls." },
  3: { note: "The current window sill drip-edge installation method may cause water pooling and moisture on the facade — proposed solution: reinstall the drip edges in a way that prevents water pooling and moisture penetration.", reply: "The drip edges will be installed outside the aluminum frame with an outward slope, which ensures water does not pool in the future." },
  4: { note: "Ceramic tile is lower quality than porcelain and less durable for long-term use — proposed solution: upgrade the finish to porcelain.", reply: "Finishes have been upgraded from ceramic to porcelain." },
  5: { note: "No gypsum board ceiling on the first and second floors — proposed solution: upgrade all floors to gypsum board ceilings except the roof.", reply: "Upgraded to gypsum board ceilings in all bedrooms, excluding the wire/cable runs." },
  6: { note: "No pre-installed wiring for surveillance cameras across all models — proposed solution: approve installation and wiring of outdoor camera points for all models.", reply: "Approved: wiring points for camera surveillance will be installed in all models." },
  7: { note: "Eligible owners were not informed how to claim the offer — proposed solution: inform owners how to benefit from the discount.", reply: "Owners will be informed how to benefit from the offer after unit handover." },
  8: { note: "No clarity on the type of waterproofing to be used for the outdoor planting beds — proposed solution: clarify the waterproofing material used for the outdoor planting beds.", reply: "The outdoor planting beds will be fully waterproofed to prevent moisture damage to the structure." },
  9: { note: "Number of electrical outlets across all models — proposed solution: increase the number of outlets in all models.", reply: "The outlet count has already been re-established and increased to match the show villa." },
  10: { note: "Tank location is under the car parking area — proposed solution: relocate the ground tank beneath the garden to avoid future settlement problems and tank cracking/water leakage.", reply: "The ground tank will be reinforced with beams and girders, and the floor slab will be reinforced to bear heavy loads such as vehicles." },
  11: { note: "No clarity on whether CAT6 cabling will be installed throughout the project — proposed solution: run and install CAT6 cabling to make future smart-home conversion and fiber internet installation easier.", reply: "Cabling will be run and installed on all floors, with a server point established in the storage room (without installing cameras or servers)." },
  12: { note: "The light well floor completely lacks a floor drain or pipe for rainwater or light-well cleaning water drainage — proposed solution: install a drainage system or clarify the intended engineering solution.", reply: "No drain opening is needed, as it will be constructed to prevent liquid entry into the light well, with a mesh cover to prevent insects." },
  13: { note: "Tiling is being laid over leftover wood scraps and nails on site, which may cause termite issues and floor settlement — proposed solution: require contractors to clean the floor before starting tiling work.", reply: "Contractors will be notified accordingly." },
  14: { note: "The internal sewage pipe diameter of 4 inches is insufficient — proposed solution: install a 6-inch sewage pipe to prevent future drainage blockage.", reply: "This will be adjusted for the Bada model only (the largest model)." },
  15: { note: "Bathroom wall tiling stops at mid-wall height, which may cause water accumulation and moisture inside the wall — proposed solution: complete the bathroom wall tiling fully to prevent future moisture inside the wall.", reply: "Will be approved as-is, matching the show villa." },
  16: { note: "Tank capacity of 5,000 liters is insufficient for expected usage — proposed solution: increase the ground tank capacity to more than 7,000 liters.", reply: "Approved at 5 cubic meters for all models." },
  17: { note: "No hot water line provided for the bidet shower (shattaf), which doesn't match normal bathroom usage — proposed solution: run a hot water line to all bathroom bidet showers.", reply: "Approved: cold water only." },
  18: { note: "Single basin in the majlis (reception) restroom doesn't match the approved structural plan — proposed solution: modify the majlis restroom to a double basin as shown in the structural plan.", reply: "Approved: single basin only." },
  19: { note: "The exterior wall height doesn't match the exterior decor height across all models — proposed solution: adjust the wall and exterior decor heights.", reply: "The exterior wall height for all project villas will be set at 2.7 m, aligned with the exterior decor height." },
  20: { note: "The current exterior door design isn't visually appropriate — proposed solution: change the exterior door design to better match the project's architectural style.", reply: "The exterior doors will be redesigned for all models." },
  21: { note: "Floor-mounted toilets in all bathrooms — proposed solution: install wall-hung toilets in the majlis and master bathroom.", reply: "Approved: wall-hung installation for the majlis and master bathroom." },
  22: { note: "No clarity on the type of sanitary fixtures to be used in the project — proposed solution: inform owners of the sanitary fixtures brand/type to be used.", reply: "The sanitary fixtures used will be local, from Saudi Ceramics." },
  23: { note: "No trap installed on the pipe between the villa and the external sewage line, which may cause insects and odors — proposed solution: install a trap on the main sewage line exiting the villa to prevent odor and insect backflow and ensure smooth flow.", reply: "An external trap will be installed between the villa and the main sewage line." },
  24: { note: "There are 3 supply lines to the upper tank, but only a single main shutoff valve — proposed solution: add sub-valves for each supply line for easier maintenance and future control.", reply: "Sub-valves exist for each floor and have already been installed." },
  25: { note: "Neighborhood street lighting positioned in front of the garage door for some models — proposed solution: relocate the street lighting due to an issue with the lighting positions (contractor: Al-Saedi Company).", reply: "The site utilities department was contacted; response: the adjustment will happen during street paving/curbing works." },
  26: { note: "The current interior handrail design doesn't match the villa's architectural style and poses a safety concern for children — proposed solution: adjust the interior staircase handrail design and color to match the overall villa design.", reply: "The gaps are 9 cm, within the safe limit and not a hazard; a simple adjustment with added wood elements at the top will be made to the handrail." },
  27: { note: "Ground tanks for most project villas are left unlocked, risking worker injury, debris, or similar issues — proposed solution: instruct contractors on the need to keep tanks locked to prevent animals or debris from entering.", reply: "Contractors will be notified to keep the ground tanks locked." },
  28: { note: "Water heater location above the sinks hampers maintenance and cleaning, and causes dirt buildup and decor damage around the sinks — proposed solution: relocate the water heater inside the bathroom for easier servicing and to preserve sink decor cleanliness.", reply: "It will be relocated in the villas still in the 3rd and 4th foundation phases." },
  29: { note: "The current garage door track is installed protruding above ground/tile level with sharp edges — proposed solution: reinstall the garage door track recessed, flush with the courtyard tile level.", reply: "It will be redesigned recessed with a slope to prevent water pooling." },
  30: { note: "The majlis window shape doesn't match the architectural style — proposed solution: upgrade the aluminum design to a sliding door for future benefit.", reply: "This will be reviewed." },
  31: { note: "AC unit location above the door may affect air distribution and aesthetics — proposed solution: relocate the AC unit to the back wall of the majlis.", reply: "The AC location will be changed for the Bada, Aurora, and Alba models only." },
  32: { note: "Sharp interior staircase edges pose a hazard to those passing — proposed solution: round the staircase edges to reduce risk during use.", reply: "The edges are not sharp and will be approved as-is, matching the show villa." },
  33: { note: "The annex roof isn't tiled and was left with only gravel fill — proposed solution: require the contractor to complete tiling work for the entire annex roof.", reply: "The gravel will be approved as-is, due to the AC unit being located on the annex roof." },
  34: { note: "The ceramic skirting shape doesn't match modern designs — proposed solution: replace the traditional skirting with a concealed/reveal ceramic skirting.", reply: "A concealed skirting cannot be installed, as it requires a structural correction and this stage has already passed." },
  35: { note: "No dedicated curtain pocket for curtain installation within the gypsum board ceiling design in any first-floor bedrooms — proposed solution: adjust the gypsum board design at the window side to allow a properly fitted curtain pocket.", reply: "No curtain pocket will be installed, as the window is too small and it would cause a visual defect." },
  36: { note: "An arch above the laundry room may make it difficult to utilize the space in the future — proposed solution: remove the arched wall above the laundry room on the top floor to allow easier future use of the space.", reply: "It will be removed in the villas still under construction." },
  37: { note: "No electrical wiring provided for bedroom windows — proposed solution: run electrical wiring to all bedroom windows for future installation of electric curtains/shutters.", reply: "This will be installed in the villas still under construction." },
  38: { note: "The roof door causes a visual defect — proposed solution: unify its design with the approved models.", reply: "It could be changed to a different style (a vote favored a door without glass, at 49%)." },
  39: { note: "Staircase marble color (Travertino) is Spanish — proposed solution: change the marble color to a different one.", reply: "The color will not be changed and will be approved as-is, matching the show villa." },
  40: { note: "The ceramic color used across all bathrooms comes in three different colors — proposed solution: change the bathroom ceramic color to one or two colors.", reply: "Will be approved as-is, matching the show villa." },
  41: { note: "The upper tank is exposed with no canopy or protective cover from sun exposure — proposed solution: install a protective canopy or dedicated cover to shield the tank from weather elements.", reply: "Installing one is not feasible; it will be approved as-is, matching the show villa." },
  42: { note: "Roof drainage discharges directly at the villa entrance, which may cause water accumulation or damage to the surrounding area — proposed solution: reroute the drainage pipe to the main sewage network or to a dedicated area away from the entrance.", reply: "It will not be modified and will be approved as-is, matching the show villa." },
  43: { note: "The intended AC type for the kitchen in all models is split — proposed solution: is it possible to change it from split to cassette type in the kitchen for all models?", reply: "Split units will be approved for the kitchen." },
  44: { note: "Wall paint color is off-white across all models — proposed solution: will the same wall paint color/profile approved in the show villa be used?", reply: "The color will be approved as-is, matching the show villa, and the paint profile used will be shared with owners later." },
  45: { note: "Drainage piping is installed less than 10 cm from the dining room window, which may cause future issues during finishing — proposed solution: move the piping farther from the window to avoid future problems when installing the aluminum window frame.", reply: "Approved: a solid 10 cm block will be built to avoid future problems." },
  46: { note: "Lighting at the family entrance is weak, which may make visibility difficult — proposed solution: redistribute the family entrance lighting for better visibility.", reply: "No additional lighting will be added; it will be approved as-is, matching the show villa." },
  47: { note: "The curtain pocket in the living room (sala) is small and affects the final appearance — proposed solution: extend the curtain pocket up to the top frame level.", reply: "No curtain pocket will be installed, as the window is too small and it would cause a visual defect." },
  48: { note: "No rainwater drainage system on the upper balcony, which may lead to water pooling and possible leaks — proposed solution: install a drainage system (floor drain) connected to the drainage network, ensuring proper floor slope to prevent future water pooling.", reply: "A floor drain already exists and has been installed." },
  49: { note: "No provision for a 4-inch duct opening, preventing future installation of a central extractor fan — proposed solution: create a 4-inch opening and run the duct before closing up the works.", reply: "Approved: two openings in the kitchen for the extractor fan and ventilation fan." },
  50: { note: "Unclear how the ventilation duct will be routed from the light well to the independent living-room bathroom exhaust fan — proposed solution: clarify the method for routing the duct to the fan in the future bathroom located on the first floor.", reply: "The duct has been routed to the light well, and the light well is not sealed at the top." },
  51: { note: "Standard gypsum board used in the kitchen and bathrooms is prone to damage from humidity and high heat — proposed solution: use heat-resistant gypsum board in the kitchen and moisture-resistant green gypsum board in bathrooms.", reply: "Approved: fire-resistant red gypsum board in kitchens, moisture-resistant green gypsum board in bathrooms and other damp areas, and standard gypsum board elsewhere in the villa — fixed specification approved for all villas." },
  52: { note: "The gypsum ceiling design in the living room (sala) is a single continuous piece — a previous request to match the majlis design was not approved, and it is now being revised to allow the living room to be split into two rooms in the future if needed.", reply: "Approved: modifying the living room's gypsum ceiling design to make it easier to divide it into two rooms in the future." },
  53: { note: "Previous proposal regarding the first-floor balcony window (Aurora) — new proposed solution: convert it into a sliding vent/window set at 90 cm above floor level so it isn't classified as a balcony under building code.", reply: "An alternative solution is under study: converting the window into a sliding vent set at 90 cm above floor level so it isn't classified as a balcony under building code." },
  54: { note: "Gypsum crew began work before the ceiling electrical wiring was run — inquiry about the process and timing for running electrical wiring before installing gypsum board, to avoid demolition/rework.", reply: "Electrical wiring is run after all doors and windows are locked for security reasons (to prevent wire theft), then the gypsum work is carried out." },
  55: { note: "Plumbing is suspended, increasing the risk of sound transmission — inquiry: will the same level of acoustic insulation (between villas and for suspended plumbing) seen in the show villa (as a reference only) be applied to the project villas?", reply: "The suspended plumbing runs horizontally, not vertically, so it does not produce water-flow noise; in addition, insulating rubber is used at hanger points, and the gypsum board itself provides sufficient acoustic insulation." },
  56: { note: "Engineer's proposal: install a sliding door for the living room across all models — need to choose the opening mechanism: push or pull handle.", reply: "Two opening-mechanism options were presented — push or pull handle — pending the owners' selection." },
  57: { note: "Inquiry about the composition of the party wall between attached villas.", reply: "The party wall between attached villas has a total thickness of 25 cm: 10 cm brick on each side plus a 5 cm insulation layer in between, with no plumbing or electrical runs permitted inside this wall." },
  64: { note: "The current light switch color (gray) doesn't match the overall interior design style, causing visual inconsistency — proposed solution: replace the covers with black for better harmony with the interior design and easier future maintenance/availability.", reply: "The black color has been approved." },
  59: { note: "Inquiry about the type and thickness of the thermal and waterproof insulation layer used above the roof slab, beneath the slope and finishing layer.", reply: "Approved: a 7.5 cm thermal and waterproof insulation layer directly above the concrete roof slab, beneath the slope and tiling layer." },
  60: { note: "Inquiry about the presence of sewage inspection chambers to ease maintenance in case of blockage.", reply: "Approved: installation of two sewage inspection chambers to ease maintenance and access in case of blockage." },
  61: { note: "Inquiry about the possibility of opening the main door from the inside via the intercom device.", reply: "Approved: linking the intercom device to the main door lock on the ground and first floors, allowing the door to be opened from the inside when desired." },
  62: { note: "Inquiry about the tank base installation method and ensuring proper engineering load distribution.", reply: "The tank will be installed using an engineering method ensuring load distribution across the full floor area, via a crossed reinforcement steel mesh spaced 10–12 cm within a 15 cm-thick concrete base." },
  63: { note: "Inquiry about the diameter (in inches) of the backyard drainage pipe, and the number of drainage gullies present, to confirm the drainage network's adequacy.", reply: "" },
  65: { note: "It was observed that a backyard drainage pipe (PVC) is exposed above ground level, running from inside the villa through an opening in the exterior wall toward the backyard, without final burial or fixing. Inquiry about the approved installation method for this line, and whether a trap (non-return valve) is needed to prevent sewage, odors, and insects from backing up through the network.", reply: "" },
  66: { note: "Inquiry about installing outdoor electrical outlets in the backyard and on the roof, required to be weather- and rain-resistant (IP-rated).", reply: "" },
  67: { note: "Inquiry about running the data network (LAN) throughout the villa using Cat6A cabling instead of Cat6, to ensure better readiness for future technologies.", reply: "" },
  68: { note: "Inquiry about the availability of adequate service access panels for split AC units, allowing easy access for routine or emergency maintenance.", reply: "" },
  69: { note: "Inquiry about increasing the number of kitchen electrical outlets to match current and future appliance needs (dishwasher, electric oven, microwave, kettle, blender, etc.).", reply: "" },
  70: { note: "Inquiry about providing an MEP drawing showing all pipe sizes for the villa's internal water supply and sewage networks, and confirming compliance with approved technical specifications.", reply: "" },
  71: { note: "Inquiry about the gauge (thickness) of electrical wiring used in all rooms, including each circuit's load capacity, and confirming compliance with expected loads per the Saudi Building Code (SBC 401).", reply: "" },
  72: { note: "Inquiry about the type and specifications of the gypsum board used on the kitchen ceiling.", reply: "Fire-resistant gypsum board, MADA brand, 12.5mm thickness — confirmed on-site through inspection and photos, matching the previously approved decision to use heat-resistant board in the kitchen." },
};

/* ── تتبّع "الجديد" — تاريخ آخر تعديل حقيقي على كل بند (إضافة، رد، أو تغيّر حالة).
   يُحدَّث يدويًا عند كل تحديث بيانات فعلي؛ العلامة تختفي تلقائيًا بعد ٧ أيام من هذا التاريخ. */
const CHANGED = {
  65: "2026-07-29", 66: "2026-07-29", 67: "2026-07-29",
  68: "2026-07-29", 69: "2026-07-29", 70: "2026-07-29", 71: "2026-07-29",
  72: "2026-08-02",
};
const CHANGE_WINDOW_DAYS = 7;
function isRecentlyChanged(id) {
  const d = CHANGED[id];
  if (!d) return false;
  const days = (Date.now() - new Date(d + "T00:00:00").getTime()) / 86400000;
  return days >= 0 && days <= CHANGE_WINDOW_DAYS;
}

/* ── ترجمة المفردات الثابتة (المنطق الداخلي يبقى بالعربي دائمًا) ── */
const PRI_EN = { "عالية جدًا": "Very High", "عالية": "High", "متوسطة": "Medium", "عادية": "Low" };
const STA_EN = { "معتمدة": "Approved", "تم الرفض": "Rejected", "قيد الدراسة": "Under Review", "تم التصويت": "Voted" };
const MODEL_EN = { "امانيثير": "Amanither", "اورورا": "Aurora", "البادا": "Bada", "البا": "Alba" };
const SCOPE_EN = {
  "جميع النماذج": "All models", "جميع النماذج عدا امانيثير": "All models except Amanither",
  "أورورا": "Aurora", "امانيثير و آلبا": "Amanither & Alba", "البا و امانيثير": "Alba & Amanither",
};
const trScope = (lang, v) => (lang === "en" ? SCOPE_EN[v] || v : v);
const ZONE_EN = {
  roof: "Roof", first: "First Floor", slab: "Ground + First", ground: "Ground Floor",
  wet: "Kitchen & Bathrooms", stairs: "Staircase", whole: "Whole Villa",
  party: "Party Wall", tank: "Tank Location", street: "Street", na: "Unspecified / Other",
};
const LOC_EN = {
  "كامل الفيلا": "Whole Villa", "الدور الأول": "First Floor", "الدور الأرضي": "Ground Floor",
  "دورات المياه": "Bathrooms", "السطح": "Roof", "الشارع": "Street", "الدرج": "Staircase",
  "غير محدد": "Unspecified", "المطبخ": "Kitchen", "المطبخ ودورات المياه": "Kitchen & Bathrooms",
  "كامل الفيلا (بين الفلل المتلاصقة)": "Whole Villa (Party Wall)", "الدور الأرضي والأول": "Ground + First Floor",
  "موقع الخزان": "Tank Location", "الحوش الخلفي (الدور الأرضي)": "Backyard (Ground Floor)",
  "الحوش الخلفي (الدور الأرضي) والسطح": "Backyard (Ground Floor) & Roof",
};
const OWN_EN = { "م/محمد عبدالمعطي": "Eng. Mohammed Abdulmuti", "م/رواحه": "Eng. Rawaha", "غير محدد": "Unspecified", "أبو سلطان": "Abu Sultan" };
const MEETING_EN = { "الاجتماع الثالث": "3rd Meeting" };
const MONTH_EN_LABEL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const trPri = (lang, v) => (lang === "en" ? PRI_EN[v] || v : v);
const trSta = (lang, v) => (lang === "en" ? STA_EN[v] || v : v);
const trModel = (lang, v) => (lang === "en" ? MODEL_EN[v] || v : v);
const trZone = (lang, k) => (lang === "en" ? ZONE_EN[k] || k : (ZONES.find((z) => z.key === k) || {}).label || k);
const trLoc = (lang, v) => (lang === "en" ? LOC_EN[v] || v : v);
const trOwn = (lang, v) => (lang === "en" ? OWN_EN[v] || v : v);
const trMeeting = (lang, v) => (lang === "en" ? MEETING_EN[v] || v : v);
const trMonth = (lang, m) => {
  if (!/^\d{4}-\d{2}$/.test(m || "")) return lang === "en" ? "—" : "—";
  const i = +m.slice(5, 7) - 1;
  return lang === "en" ? `${MONTH_EN_LABEL[i]} ${m.slice(0, 4)}` : `${MONTH_AR[i]} ${m.slice(0, 4)}`;
};
const trNote = (lang, r) => (lang === "en" ? (EN_TEXT[r.id]?.note || r.note) : r.note);
const trReply = (lang, r) => (lang === "en" ? (EN_TEXT[r.id]?.reply || r.reply) : r.reply);

/* ═══════════════════════════════════════════════════════════
   نظامان للألوان — فاتح للنهار وداكن لليل.
   الفلسفة: فصل بالمسافات والارتفاع، لا بالخطوط.
   ═══════════════════════════════════════════════════════════ */
const THEMES = {
  light: {
    bg: "#F7F9FB", surface: "#FFFFFF", sunken: "#F1F5F8",
    paper: "#1F2C35", muted: "#5F7280", faint: "#7E8F9A",
    brass: "#1B7F8E", line: "rgba(20,45,60,.08)", lineSoft: "rgba(20,45,60,.05)",
    shadow: "0 1px 2px rgba(20,45,60,.04), 0 8px 22px -16px rgba(20,45,60,.16)",
    shadowUp: "0 2px 5px rgba(20,45,60,.06), 0 18px 38px -18px rgba(20,45,60,.22)",
    zone: "#7FA0B2", zoneOn: "#1B7F8E",
    sta: { "معتمدة": "#1F7A5C", "تم الرفض": "#A8443C", "قيد الدراسة": "#8A6318", "تم التصويت": "#4E6474" },
    pri: { "عالية جدًا": "#A8443C", "عالية": "#8F5A1E", "متوسطة": "#2E6C86", "عادية": "#5F7280" },
    extra: ["#5E5488", "#1F7368", "#84544A", "#4E6474"],
    onAccent: "#FFFFFF",
  },
  dark: {
    bg: "#141C22", surface: "#1C262D", sunken: "#111920",
    paper: "#DBE3E8", muted: "#8FA0AB", faint: "#6E808C",
    brass: "#5FBCCB", line: "rgba(255,255,255,.07)", lineSoft: "rgba(255,255,255,.045)",
    shadow: "0 1px 2px rgba(0,0,0,.3), 0 12px 28px -20px rgba(0,0,0,.7)",
    shadowUp: "0 2px 6px rgba(0,0,0,.4), 0 22px 46px -22px rgba(0,0,0,.85)",
    zone: "#7C9CAD", zoneOn: "#5FBCCB",
    sta: { "معتمدة": "#74B698", "تم الرفض": "#D48D87", "قيد الدراسة": "#D8B274", "تم التصويت": "#93A7B8" },
    pri: { "عالية جدًا": "#D48D87", "عالية": "#D6A578", "متوسطة": "#8AB0C2", "عادية": "#93A4AE" },
    extra: ["#AC9EC2", "#8CBEB0", "#C2A399", "#93A7B8"],
    onAccent: "#101820",
  },
};

const ThemeCtx = createContext({ T: THEMES.light, mode: "light", setMode: () => {}, resolved: "light" });
const useT = () => useContext(ThemeCtx);

const LangCtx = createContext({ lang: "ar", setLang: () => {} });
const useLang = () => useContext(LangCtx);

const hashPick = (s, arr) => arr[Math.abs([...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0)) % arr.length];

/* ── نص عربي: توحيد للبحث والمطابقة ── */
const norm = (s = "") =>
  String(s).replace(/[\u064B-\u0652\u0640]/g, "").replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .replace(/\s+/g, " ").trim().toLowerCase();

/* ── نماذج المشروع الأربعة الفعلية ──
   عمود «نوع النموذج» في الملف يصف نطاق الملاحظة لا اسم نموذج واحد
   (مثل «جميع النماذج» أو «جميع النماذج عدا امانيثير»)، فنحلّله إلى النماذج المشمولة. */
const MODEL_LIST = ["امانيثير", "اورورا", "البادا", "البا"];
const MODEL_ALIAS = {
  "امانيثير": "امانيثير", "اورورا": "اورورا",
  "البادا": "البادا", "بادا": "البادا", "البا": "البا",
};

function modelTokens(scope) {
  return norm(scope).split(/[\s،,/+()]+/).filter(Boolean).flatMap((w) => {
    if (w === "و") return [];
    if (w.startsWith("و") && w.length > 2 && MODEL_ALIAS[w.slice(1)]) return [w.slice(1)];
    return [w];
  });
}

/* يرجّع قائمة النماذج التي تنطبق عليها الملاحظة.
   ملاحظة: «البادا» و«البا» نموذجان مختلفان، فالمطابقة بالكلمة كاملة لا بجزء منها. */
function modelsOf(scope) {
  const tk = modelTokens(scope);
  const isAll = tk.some((w) => w === "جميع" || w === "كل" || w === "الكل" || w === "كافه");
  if (isAll) {
    const i = tk.findIndex((w) => w === "عدا" || w === "ماعدا");
    if (i >= 0) {
      const excl = tk.slice(i + 1).map((w) => MODEL_ALIAS[w]).filter(Boolean);
      return MODEL_LIST.filter((m) => !excl.includes(m));
    }
    return [...MODEL_LIST];
  }
  const named = tk.map((w) => MODEL_ALIAS[w]).filter(Boolean);
  return named.length ? [...new Set(named)] : [];
}

/* ── مناطق المخطط ── */
const ZONES = [
  { key: "roof", label: "السطح" }, { key: "first", label: "الدور الأول" },
  { key: "slab", label: "الأرضي والأول" }, { key: "ground", label: "الدور الأرضي" },
  { key: "wet", label: "المطبخ ودورات المياه" }, { key: "stairs", label: "الدرج" },
  { key: "whole", label: "كامل الفيلا" }, { key: "party", label: "جدار الفلل المتلاصقة" },
  { key: "tank", label: "موقع الخزان" }, { key: "street", label: "الشارع" },
  { key: "na", label: "غير محدد / أخرى" },
];
function zoneOf(loc) {
  const s = norm(loc);
  if (!s || s === "غير محدد") return "na";
  if (s.includes("متلاصق")) return "party";
  if (s.includes("خزان")) return "tank";
  if (s.includes("شارع")) return "street";
  if (s.includes("درج")) return "stairs";
  if (s.includes("مطبخ") || s.includes("دورات") || s.includes("حمام")) return "wet";
  if (s.includes("سطح")) return "roof";
  if (s.includes("ارضي") && s.includes("اول")) return "slab";
  if (s.includes("كامل")) return "whole";
  if (s.includes("ارضي")) return "ground";
  if (s.includes("اول")) return "first";
  return "na";
}

/* ── التاريخ ── */
const MONTH_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const fmtDate = (iso) => {
  try { const d = new Date(iso); return `${d.getDate()} ${MONTH_AR[d.getMonth()]} ${d.getFullYear()}`; }
  catch { return ""; }
};

/* ── النسخة الأساسية كسجلات نصية ── */
const BASE = RAW.map((r) => ({
  id: r[0], model: MODELS[r[1]], loc: LOCS[r[2]], pri: PRI_ORDER[r[3]], sta: STA_ORDER[r[4]],
  answered: !!r[5], owner: OWN[r[6]], month: MON[r[7]], closed: !!r[8],
  meeting: r[9] ? "الاجتماع الثالث" : null, note: r[10], reply: r[11],
}));

/* ═══════════════════════════════════════════════════════════
   تقدم التنفيذ — من ورقة KPIs في ملف «تقدم الوحدة والمراحل»
   جدولان: متوسط تقدم المراحل مقابل الهدف، وتقدم كل بلوك.
   ═══════════════════════════════════════════════════════════ */
const PG_MONTHS = ["فبراير", "مارس", "أبريل", "مايو", "يونيو"];
const PG_TARGET = [31.25, 34.38, 37.5, 40.62, 43.75];
const PG_PHASES = [
  { key: "total", label: "إجمالي المشروع", note: "كل البلوكات", v: [37.1, 39.05, 40.91, 41.73, 43.43] },
  { key: "p1", label: "المرحلة الأولى", note: "بلوكات ١-٥", v: [44.21, 46.15, 48.7, 49.94, 51.84] },
  { key: "p2", label: "المرحلة الثانية", note: "بلوكات ٦-٨", v: [40.1, 42.41, 43.86, 44.39, 47.47] },
  { key: "p3", label: "المرحلة الثالثة", note: "بلوكات ٩-١٥", v: [34.49, 35.87, 37.41, 38.01, 38.5] },
  { key: "p4", label: "المرحلة الرابعة", note: "بلوكات ٢٢ و٢٣", v: [22.63, 25.77, 27.52, 28.37, 31.14] },
];
const PG_BLOCKS = [
  { b: 1, ph: "p1", v: [47.64, 50.02, 51.88, 53.56, 54.44] },
  { b: 2, ph: "p1", v: [45.28, 46.26, 48.93, 50.29, 52.63] },
  { b: 3, ph: "p1", v: [43.75, 46.52, 49.3, 50.22, 51.93] },
  { b: 5, ph: "p1", v: [41.5, 43.58, 48.52, 49.92, 51.71] },
  { b: 4, ph: "p1", v: [42.89, 44.37, 44.87, 45.71, 48.5] },
  { b: 7, ph: "p2", v: [41.2, 42.7, 44.78, 45.03, 48.05] },
  { b: 6, ph: "p2", v: [39.41, 43.04, 43.56, 44.34, 47.89] },
  { b: 8, ph: "p2", v: [39.68, 41.48, 43.25, 43.8, 46.46] },
  { b: 9, ph: "p3", v: [33.08, 39.38, 42.45, 43.8, 43.95] },
  { b: 10, ph: "p3", v: [34.46, 38.2, 41.27, 42.23, 43.95] },
  { b: 14, ph: "p3", v: [43.45, 44.2, 44.45, 44.45, 44.45] },
  { b: 13, ph: "p3", v: [40.7, 42.25, 43.95, 44.2, 44.2] },
  { b: 22, ph: "p4", v: [26.16, 32.04, 35.53, 37.23, 42.78] },
  { b: 12, ph: "p3", v: [34.01, 28.38, 29.51, 30.42, 31.51] },
  { b: 15, ph: "p3", v: [21.26, 22.81, 22.85, 22.94, 22.94] },
  { b: 23, ph: "p4", v: [19.1, 19.5, 19.5, 19.5, 19.5] },
];
const PG_NOTE = "بلوك ٢٣: لا توجد بيانات جديدة لمايو ويونيو، فتم ترحيل آخر نسبة مسجَّلة (١٩٫٥٠٪ في أبريل) بدل تجاهله.";
const PG_PHASE_NAME = { p1: "المرحلة الأولى", p2: "المرحلة الثانية", p3: "المرحلة الثالثة", p4: "المرحلة الرابعة" };
const PG_BASE = { months: PG_MONTHS, target: PG_TARGET, phases: PG_PHASES, blocks: PG_BLOCKS, note: PG_NOTE, updatedAt: null, label: "", start: { y: 2026, m: 2 } };

/* ── هدف التنفيذ: خطة خطّية تُحسب من التقويم ──
   الخطوة ٣٫١٢٥ نقطة شهريًا = ١٠٠٪ خلال ٣٢ شهرًا، من مايو ٢٠٢٥ حتى ديسمبر ٢٠٢٧.
   محقَّقة بمطابقتها للأهداف الخمسة المسجَّلة (فبراير–يونيو ٢٠٢٦) قبل الاعتماد.
   الفائدة: هدف الشهر يتقدّم وحده مع التقويم بلا أي تعديل على هذا الملف،
   بينما يبقى الإنجاز الفعلي فارغًا حتى تصل قراءة المطور الشهرية.
   الأهداف التاريخية المسجَّلة تبقى كما هي حرفيًا؛ الحساب يخصّ الأشهر الجديدة فقط. */
const PLAN_STEP = 3.125;
const PLAN_ANCHOR_Y = 2025, PLAN_ANCHOR_M = 4;   /* أبريل ٢٠٢٥ = الخطوة صفر */
const PLAN_END_Y = 2027, PLAN_END_M = 12;        /* نهاية الخطة عند ١٠٠٪ */
const planTarget = (y, m) =>
  Math.max(0, Math.min(100, +(PLAN_STEP * ((y - PLAN_ANCHOR_Y) * 12 + (m - PLAN_ANCHOR_M))).toFixed(2)));

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const arNum = (n) => String(n).replace(/[0-9]/g, (d) => AR_DIGITS[+d]);
const trYear = (lang, y) => (y == null ? "" : lang === "en" ? String(y) : arNum(y));

/* توسعة السلسلة حتى الشهر الحالي: أشهر جديدة بأهداف محسوبة وإنجاز فارغ (null) */
function extendPlan(data, now) {
  const st = data && data.start;
  const months = data && Array.isArray(data.months) ? data.months : null;
  if (!st || !months || !months.length || !Array.isArray(data.target)) return { ...data, years: null, added: 0 };

  const n = months.length;
  const years = [];
  for (let i = 0; i < n; i++) years.push(st.y + Math.floor((st.m - 1 + i) / 12));
  const lastIdx = st.m - 1 + (n - 1);
  const lastY = st.y + Math.floor(lastIdx / 12);
  const lastM = (lastIdx % 12) + 1;

  const maxAdd = (PLAN_END_Y - lastY) * 12 + (PLAN_END_M - lastM);
  let add = (now.getFullYear() - lastY) * 12 + (now.getMonth() + 1 - lastM);
  add = Math.max(0, Math.min(add, Math.max(0, maxAdd)));
  if (!add) return { ...data, years, added: 0 };

  const outM = [...months], outT = [...data.target];
  for (let k = 1; k <= add; k++) {
    const t = (lastM - 1) + k;
    const y = lastY + Math.floor(t / 12);
    const m = (t % 12) + 1;
    outM.push(MONTH_AR[m - 1]);
    years.push(y);
    outT.push(planTarget(y, m));
  }
  const pad = (v) => [...(Array.isArray(v) ? v : []), ...Array(add).fill(null)];
  return {
    ...data,
    months: outM, target: outT, years, added: add,
    phases: (data.phases || []).map((p) => ({ ...p, v: pad(p.v) })),
    blocks: (data.blocks || []).map((b) => ({ ...b, v: pad(b.v) })),
  };
}

/* ── ترجمة محتوى تقدم التنفيذ (النسخة الأساسية المدمجة فقط؛ التحديثات الحيّة تبقى كما رُفعت) ── */
const PG_PHASE_NAME_EN = { p1: "Phase 1", p2: "Phase 2", p3: "Phase 3", p4: "Phase 4" };
const PG_LABEL_EN = { "إجمالي المشروع": "Total Project", "المرحلة الأولى": "Phase 1", "المرحلة الثانية": "Phase 2", "المرحلة الثالثة": "Phase 3", "المرحلة الرابعة": "Phase 4" };
const PG_PNOTE_EN = { "كل البلوكات": "All Blocks", "بلوكات ١-٥": "Blocks 1–5", "بلوكات ٦-٨": "Blocks 6–8", "بلوكات ٩-١٥": "Blocks 9–15", "بلوكات ٢٢ و٢٣": "Blocks 22 & 23" };
const PG_NOTE_EN = "Block 23: no new data for May or June, so the last recorded reading (19.50% in April) was carried forward for the average rather than ignored.";
const trPGMonth = (lang, m) => { const i = MONTH_AR.indexOf(m); return lang === "en" && i >= 0 ? MONTH_EN_LABEL[i] : m; };
const trPGLabel = (lang, v) => (lang === "en" ? PG_LABEL_EN[v] || v : v);
const trPGPNote = (lang, v) => (lang === "en" ? PG_PNOTE_EN[v] || v : v);

/* ── الترتيب المنطقي ── */
const rank = (order) => (v) => { const i = order.indexOf(v); return i === -1 ? order.length + 1 : i; };
const uniqSorted = (arr, order) => [...new Set(arr)].filter(Boolean).sort((a, b) => rank(order)(a) - rank(order)(b) || a.localeCompare(b, "ar"));

/* ── تخزين ── */
const SKEY = "owners-inquiries-v1";
const PGKEY = "owners-progress-v1";
const TKEY = "owners-inquiries-theme";
const hasStore = () => typeof window !== "undefined" && !!window.storage;
async function loadShared(key = SKEY) {
  if (!hasStore()) return null;
  try { const r = await window.storage.get(key, true); return r ? JSON.parse(r.value) : null; }
  catch { return null; }
}
async function saveShared(payload, key = SKEY) {
  if (!hasStore()) throw new Error("التخزين المشترك غير متاح في هذه البيئة.");
  const r = await window.storage.set(key, JSON.stringify(payload), true);
  if (!r) throw new Error("تعذّر حفظ التحديث.");
  return r;
}
async function clearShared(key = SKEY) {
  if (!hasStore()) return;
  try { await window.storage.delete(key, true); } catch { /* لا يوجد ما يُحذف */ }
}

function usePrefersReduced() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(mq.matches);
    const h = (e) => setR(e.matches);
    mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, []);
  return r;
}

/* ── يكشف دخول/خروج عنصر من نطاق الشاشة أثناء التمرير — يُستخدم لإعادة تشغيل تعبئة الأشرطة ── */
function useInView(threshold = 0.3) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView];
}

/* ── الوضع التلقائي: يتبع إعداد الجهاز ويتغيّر معه فورًا ── */
function useThemeMode() {
  const [mode, setMode] = useState("light");
  const [sysDark, setSysDark] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSysDark(mq.matches);
    const h = (e) => setSysDark(e.matches);
    mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, []);

  useEffect(() => {
    if (!hasStore()) return;
    let alive = true;
    window.storage.get(TKEY, false)
      .then((r) => { if (alive && r && ["auto", "light", "dark"].includes(r.value)) setMode(r.value); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const pick = (m) => {
    setMode(m);
    if (hasStore()) { try { window.storage.set(TKEY, m, false); } catch { /* تجاهل */ } }
  };

  const resolved = mode === "auto" ? (sysDark ? "dark" : "light") : mode;
  return { mode, setMode: pick, resolved };
}

/* لغة العرض — تُحفظ للمستخدم نفسه فقط، افتراضيًا عربي */
const LKEY = "owners-inquiries-lang";
function useLangMode() {
  const [lang, setLang] = useState("ar");
  useEffect(() => {
    if (!hasStore()) return;
    let alive = true;
    window.storage.get(LKEY, false)
      .then((r) => { if (alive && r && ["ar", "en"].includes(r.value)) setLang(r.value); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const pick = (l) => {
    setLang(l);
    if (hasStore()) { try { window.storage.set(LKEY, l, false); } catch { /* تجاهل */ } }
  };
  return { lang, setLang: pick };
}

/* ── شكل عرض النتائج: بطاقات أو جدول ──
   الافتراضي "تلقائي": بطاقات على الجوال، وجدول على الشاشات 1024px فأعلى.
   الزر متاح على كل الأجهزة — أول ضغطة تثبّت اختيار المستخدم ويتجاوز الافتراضي،
   فمن يبغى "وضع سطح المكتب" على جواله يقدر يختاره بنفسه. */
const VKEY = "owners-inquiries-view";
const WIDE_Q = "(min-width: 1024px)";
function useViewMode() {
  const [pref, setPref] = useState("auto");
  /* تُقرأ فورًا عند أول رسم حتى لا تومض البطاقات ثم يظهر الجدول على الحاسب */
  const [wide, setWide] = useState(() =>
    typeof window !== "undefined" && window.matchMedia ? window.matchMedia(WIDE_Q).matches : false);

  useEffect(() => {
    const mq = window.matchMedia(WIDE_Q);
    setWide(mq.matches);
    const h = (e) => setWide(e.matches);
    mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, []);

  useEffect(() => {
    if (!hasStore()) return;
    let alive = true;
    window.storage.get(VKEY, false)
      .then((r) => { if (alive && r && ["auto", "cards", "table"].includes(r.value)) setPref(r.value); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  /* التسجيل هنا فقط — عند ضغط المستخدم على الزر، وليس عند تغيّر حجم الشاشة */
  const pick = (v) => {
    setPref(v);
    logEvent("filter", "view", v, null);
    if (hasStore()) { try { window.storage.set(VKEY, v, false); } catch { /* تجاهل */ } }
  };

  /* الافتراضي يتبع حجم الشاشة، والاختيار اليدوي يتجاوزه على أي جهاز */
  const view = pref === "auto" ? (wide ? "table" : "cards") : pref;
  return { view, setView: pick };
}

/* ── وضع متصفح سطح المكتب ──
   يبدّل وسم viewport في الصفحة، فيرسم المتصفح الصفحة كاملة بعرض حاسب (1180px)
   ويصغّرها لتناسب الشاشة — نفس مبدأ "طلب موقع الكمبيوتر" في سفاري.
   كل استعلامات CSS تعمل كأنها على حاسب، والمستخدم يقدر يقرّب بأصبعيه.
   لا يُعرض الزر أصلًا على جهاز عرضه الفعلي 1024px فأكثر لأنه بلا فائدة هناك. */
const DESK_W = "width=1180";
const MOBILE_VP = "width=device-width, initial-scale=1";
function applyViewport(content) {
  if (typeof document === "undefined") return;
  let m = document.querySelector('meta[name="viewport"]');
  if (!m) {
    m = document.createElement("meta");
    m.setAttribute("name", "viewport");
    document.head.appendChild(m);
  }
  m.setAttribute("content", content);
}
function useDesktopView() {
  const [on, setOn] = useState(false);
  const originalRef = useRef(null);

  /* عرض الجهاز الفعلي — يُقرأ مرة واحدة قبل أي تغيير على viewport فلا يتأثر به */
  const [smallDevice] = useState(() => {
    if (typeof window === "undefined") return false;
    const sw = window.screen && window.screen.width ? window.screen.width : 9999;
    const iw = window.innerWidth || 9999;
    return Math.min(sw, iw) < 1024;
  });

  useEffect(() => {
    const m = document.querySelector('meta[name="viewport"]');
    originalRef.current = (m && m.getAttribute("content")) || MOBILE_VP;
    /* إرجاع الوضع الأصلي عند مغادرة اللوحة */
    return () => applyViewport(originalRef.current || MOBILE_VP);
  }, []);

  useEffect(() => {
    if (originalRef.current === null) return;
    applyViewport(on ? DESK_W : originalRef.current);
  }, [on]);

  const toggle = () => {
    const next = !on;
    setOn(next);
    logEvent("filter", "desktop_view", next ? "on" : "off", null);
  };

  return { deskOn: on, toggleDesk: toggle, smallDevice };
}

function CountUp({ value, dur = 850, suffix = "", onScroll = false }) {
  const reduced = usePrefersReduced();
  const [ref, inView] = useInView(0.35);
  const [n, setN] = useState(onScroll && !reduced ? 0 : value);
  const prev = useRef(onScroll && !reduced ? 0 : value);
  useEffect(() => {
    if (reduced) { setN(value); prev.current = value; return; }
    /* وضع السكرول: يبدأ من صفر عند كل ظهور، ويعود لصفر عند الخروج من الشاشة */
    if (onScroll && !inView) { setN(0); prev.current = 0; return; }
    const from = onScroll ? 0 : prev.current, to = value, t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      setN(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick); else prev.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, dur, reduced, onScroll, inView]);
  return <span className="mono" ref={onScroll ? ref : undefined}>{n}{suffix}</span>;
}

/* ── رقم يقفز قفزة صغيرة عند تغيّر قيمته — لتوضيح تغيّر عدد النتائج بعد الفلترة ── */
function TickNum({ value }) {
  const reduced = usePrefersReduced();
  const [shown, setShown] = useState(value);
  const [bump, setBump] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (value === prev.current) return;
    prev.current = value;
    if (reduced) { setShown(value); return; }
    setBump(true);
    const t1 = setTimeout(() => setShown(value), 150);
    const t2 = setTimeout(() => setBump(false), 460);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [value, reduced]);
  return <span className={`mono tick-n${bump ? " bump" : ""}`}>{shown}</span>;
}

/* ═══ مخطط الفيلا — كتل مصمتة بلا خطوط أو نقوش ═══ */
function VillaPlan({ counts, active, onPick, built }) {
  const { T } = useT();
  const { lang } = useLang();
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...Object.values(counts));

  const on = (k) => active === k || hover === k;
  const zone = (k, delay) => ({
    onClick: () => onPick(active === k ? null : k),
    onMouseEnter: () => setHover(k),
    onMouseLeave: () => setHover(null),
    fill: on(k) ? T.zoneOn : T.zone,
    fillOpacity: on(k) ? 0.3 : (counts[k] || 0) === 0 ? 0.06 : 0.1 + ((counts[k] || 0) / max) * 0.26,
    stroke: on(k) ? T.zoneOn : "transparent",
    strokeWidth: on(k) ? 1.6 : 0,
    style: {
      cursor: "pointer",
      opacity: built ? (active && active !== k ? 0.3 : 1) : 0,
      transition: `opacity .45s ease ${delay}ms, fill-opacity .2s ease, stroke .2s ease`,
    },
  });

  const pos = (x, y) => ({
    position: "absolute", left: `${(x / 560) * 100}%`, top: `${(y / 430) * 100}%`,
    transform: "translate(-50%,-50%)", whiteSpace: "nowrap", textAlign: "center",
  });
  const lbl = (k, delay) => ({
    opacity: built ? (active && active !== k ? 0.3 : 1) : 0,
    transition: `opacity .45s ease ${delay}ms`,
  });

  const Tag = ({ x, y, name, k, delay, big }) => (
    <div style={{ ...pos(x, y), ...lbl(k, delay) }}>
      <div style={{ fontSize: big ? 12.5 : 11, color: on(k) ? T.zoneOn : T.paper, fontFamily: big ? "'Reem Kufi',sans-serif" : "inherit" }}>{name}</div>
      <div className="mono" style={{ fontSize: big ? 19 : 14, fontWeight: 600, color: on(k) ? T.zoneOn : T.brass, marginTop: 2 }}>{counts[k] || 0}</div>
    </div>
  );

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox="0 0 560 430" className="w-full" style={{ height: "auto", display: "block" }}
        role="group" aria-label={lang === "en" ? "Interactive villa plan" : "مخطط الفيلا التفاعلي"}>
        {/* جسم الفيلا = كامل الفيلا */}
        <rect x="140" y="58" width="292" height="292" rx="10" {...zone("whole", 560)} />

        {/* جدار الفلل المتلاصقة */}
        <rect x="124" y="58" width="10" height="292" rx="4" {...zone("party", 520)} />

        {/* السطح */}
        <rect x="150" y="66" width="272" height="38" rx="7" {...zone("roof", 420)} />

        {/* الدور الأول */}
        <rect x="150" y="112" width="272" height="96" rx="7" {...zone("first", 340)} />

        {/* بلاطة الفصل */}
        <rect x="150" y="214" width="272" height="10" rx="4" {...zone("slab", 300)} />

        {/* الدور الأرضي */}
        <rect x="150" y="230" width="272" height="112" rx="7" {...zone("ground", 160)} />

        {/* المطبخ ودورات المياه — كتلة داخل الدورين */}
        <rect x="158" y="120" width="76" height="80" rx="6" {...zone("wet", 240)} />
        <rect x="158" y="240" width="76" height="94" rx="6" {...zone("wet", 240)} />

        {/* الدرج */}
        <rect x="352" y="120" width="62" height="214" rx="6" {...zone("stairs", 260)} />

        {/* منسوب الأرض */}
        <rect x="112" y="350" width="336" height="2" rx="1" fill={T.muted}
          opacity={built ? 0.28 : 0} style={{ transition: "opacity .5s ease" }} />

        {/* الخزان الأرضي */}
        <rect x="176" y="360" width="120" height="32" rx="7" {...zone("tank", 100)} />

        {/* الشارع */}
        <rect x="446" y="352" width="96" height="26" rx="7" {...zone("street", 60)} />

        {/* غير محدد */}
        <rect x="470" y="72" width="76" height="30" rx="8" {...zone("na", 600)} />
      </svg>

      {/* النصوص العربية كطبقة HTML — عنصر SVG text لا يُشكّل العربية بشكل موثوق */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <Tag x={330} y={278} name={trZone(lang, "ground")} k="ground" delay={160} big />
        <Tag x={330} y={152} name={trZone(lang, "first")} k="first" delay={340} big />
        <Tag x={286} y={84} name={trZone(lang, "roof")} k="roof" delay={420} />
        <Tag x={196} y={288} name={trZone(lang, "wet")} k="wet" delay={240} />
        <Tag x={383} y={220} name={trZone(lang, "stairs")} k="stairs" delay={260} />
        <Tag x={236} y={376} name={trZone(lang, "tank")} k="tank" delay={100} />
        <Tag x={494} y={365} name={trZone(lang, "street")} k="street" delay={60} />
        <Tag x={508} y={87} name={trZone(lang, "na")} k="na" delay={600} />

        <div style={{ ...pos(129, 204), ...lbl("party", 520), transform: "translate(-50%,-50%) rotate(180deg)", writingMode: "vertical-rl" }}>
          <span style={{ fontSize: 10, color: on("party") ? T.zoneOn : T.muted }}>{lang === "en" ? "Party Wall" : "جدار الفلل"}</span>
          <span className="mono" style={{ fontSize: 12, color: on("party") ? T.zoneOn : T.brass, marginTop: 4 }}>{counts.party || 0}</span>
        </div>

        <div style={{ ...pos(286, 219), ...lbl("slab", 300), fontSize: 9.5, color: on("slab") ? T.zoneOn : T.muted }}>
          {lang === "en" ? "Ground + First" : "الأرضي + الأول"} <span className="mono" style={{ color: on("slab") ? T.zoneOn : T.brass }}>{counts.slab || 0}</span>
        </div>

        <div style={{ ...pos(286, 46), ...lbl("whole", 560), fontSize: 10.5, color: on("whole") ? T.zoneOn : T.muted }}>
          {lang === "en" ? "Whole Villa" : "كامل الفيلا"} <span className="mono" style={{ color: on("whole") ? T.zoneOn : T.brass }}>{counts.whole || 0}</span>
        </div>
      </div>
    </div>
  );
}

/* ═══ عناصر ═══ */
function Chip({ on, onClick, children, color, count }) {
  const { T } = useT();
  return (
    <button onClick={onClick} className="chip" data-on={on ? "1" : "0"}
      style={on ? { borderColor: (color || T.brass) + "00", color: T.onAccent, background: color || T.brass } : undefined}>
      {children}{count != null && <span className="mono chip-n">{count}</span>}
    </button>
  );
}

function Select({ value, onChange, options, placeholder, icon: Icon }) {
  return (
    <div className="sel-wrap">
      {Icon && <Icon size={13} className="sel-ic" />}
      <select className="sel" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
      <ChevronDown size={13} className="sel-ch" />
    </div>
  );
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tip">
      <div className="tip-h">{label}</div>
      {payload.filter((p) => p.value > 0).map((p) => (
        <div key={p.dataKey} className="tip-r">
          <span className="tip-d" style={{ background: p.color }} />
          <span className="tip-l">{p.name}</span><span className="mono tip-v">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function StaIcon({ s, size = 13 }) {
  const { T } = useT();
  const p = { size, style: { color: T.sta[s] || hashPick(s, T.extra) }, strokeWidth: 2.1 };
  if (s === "معتمدة") return <CheckCircle2 {...p} />;
  if (s === "تم الرفض") return <XCircle {...p} />;
  if (s === "قيد الدراسة") return <Clock {...p} />;
  return <Users {...p} />;
}

function ThemeToggle() {
  const { mode, setMode, T } = useT();
  const { lang } = useLang();
  const opts = lang === "en"
    ? [["auto", Monitor, "Auto"], ["light", Sun, "Light"], ["dark", Moon, "Dark"]]
    : [["auto", Monitor, "تلقائي"], ["light", Sun, "فاتح"], ["dark", Moon, "داكن"]];
  return (
    <div className="seg" role="group" aria-label={lang === "en" ? "Dashboard appearance" : "مظهر اللوحة"}>
      {opts.map(([m, Ic, title]) => (
        <button key={m} onClick={() => setMode(m)} title={title} aria-label={title}
          className="seg-b" data-on={mode === m ? "1" : "0"}
          style={mode === m ? { background: T.brass, color: T.onAccent } : undefined}>
          <Ic size={13} />
        </button>
      ))}
    </div>
  );
}

function LangToggle() {
  const { T } = useT();
  const { lang, setLang } = useLang();
  return (
    <div className="seg" role="group" aria-label="Language / اللغة">
      {[["ar", "ع"], ["en", "EN"]].map(([l, label]) => (
        <button key={l} onClick={() => setLang(l)} title={l === "ar" ? "العربية" : "English"}
          className="seg-b seg-b-txt" data-on={lang === l ? "1" : "0"}
          style={lang === l ? { background: T.brass, color: T.onAccent } : undefined}>
          {label}
        </button>
      ))}
    </div>
  );
}

function ViewToggle({ view, setView }) {
  const { T } = useT();
  const { lang } = useLang();
  const opts = lang === "en"
    ? [["cards", LayoutGrid, "Card view"], ["table", Table, "Table view"]]
    : [["cards", LayoutGrid, "عرض بطاقات"], ["table", Table, "عرض جدول"]];
  return (
    <div className="seg view-seg no-print" role="group" aria-label={lang === "en" ? "Results layout" : "شكل عرض النتائج"}>
      {opts.map(([v, Ic, title]) => (
        <button key={v} onClick={() => setView(v)} title={title} aria-label={title}
          className="seg-b" data-on={view === v ? "1" : "0"}
          style={view === v ? { background: T.brass, color: T.onAccent } : undefined}>
          <Ic size={13} />
        </button>
      ))}
    </div>
  );
}

function Row({ r, onOpen }) {
  const { T } = useT();
  const { lang } = useLang();
  const sc = T.sta[r.sta] || hashPick(r.sta, T.extra);
  const pc = T.pri[r.pri] || T.muted;
  const open = () => onOpen(r);
  return (
    <tr className="trow" tabIndex={0} onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}>
      <td className="mono td-id">{String(r.id).padStart(2, "0")}</td>
      <td className="td-nw">
        <span className="td-sta" style={{ color: sc }}><StaIcon s={r.sta} />{trSta(lang, r.sta)}</span>
      </td>
      <td className="td-nw" style={{ color: pc }}>{trPri(lang, r.pri)}</td>
      <td className="td-note">
        <span className="td-note-t">{trNote(lang, r)}</span>
        {(r.isNew || !r.closed) && (
          <span className="td-tags">
            {r.isNew && <span className="tag tag-new"><Sparkles size={9} /> {lang === "en" ? "New" : "جديد"}</span>}
            {!r.closed && <span className="tag tag-open">{lang === "en" ? "Open" : "مفتوح"}</span>}
          </span>
        )}
      </td>
      <td className="td-m">{trLoc(lang, r.loc)}</td>
      <td className="td-m">{trScope(lang, r.model)}</td>
      <td className="td-m">{trMonth(lang, r.month)}</td>
    </tr>
  );
}

/* ── شريط توزيع الحالات — ينمو من صفر عند دخوله الشاشة ── */
function StatusBar({ cats, overview, staC, trSta, lang, openBoard, L }) {
  const reduced = usePrefersReduced();
  const [ref, inView] = useInView(0.4);
  const grow = reduced || inView;
  return (
    <div className="bar" ref={ref} role="img" aria-label={L("توزيع القرارات", "Decision breakdown")}>
      {cats.sta.map((s) => {
        const n = overview.byS[s] || 0;
        if (!n) return null;
        return <div key={s} className="bar-s" title={`${trSta(lang, s)} — ${n}`} onClick={() => openBoard({ sta: s })}
          style={{ flex: grow ? n : 0, background: staC(s) }} />;
      })}
    </div>
  );
}

function Card({ r, i, onOpen, reduced }) {
  const { T } = useT();
  const { lang } = useLang();
  const sc = T.sta[r.sta] || hashPick(r.sta, T.extra);
  const pc = T.pri[r.pri] || T.muted;
  const [pulsed, setPulsed] = useState(false);
  const open = () => {
    if (!reduced) { setPulsed(false); requestAnimationFrame(() => setPulsed(true)); }
    onOpen(r);
  };
  return (
    <div role="button" tabIndex={0} onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
      onAnimationEnd={(e) => { if (e.animationName === "pulseFlash") setPulsed(false); }}
      className={`card pulse-host${pulsed ? " pulsed" : ""}`} style={{
        animation: reduced ? "none" : `rise .4s cubic-bezier(.2,.7,.3,1) ${Math.min(i, 12) * 45}ms both`,
        borderRightColor: pc,
      }}>
      <div className="card-top">
        <span className="mono card-id">{String(r.id).padStart(2, "0")}</span>
        <span className="tag" style={{ color: pc }}>{trPri(lang, r.pri)}</span>
        {r.isNew && <span className="tag tag-new"><Sparkles size={9} /> {lang === "en" ? "New" : "جديد"}</span>}
        {!r.closed && <span className="tag tag-open">{lang === "en" ? "Open" : "مفتوح"}</span>}
        <span className="card-sta" style={{ color: sc }}>
          <StaIcon s={r.sta} />{trSta(lang, r.sta)}
        </span>
      </div>
      <div className="card-note">{trNote(lang, r)}</div>
      <div className="card-foot">
        <span className="fm">{trLoc(lang, r.loc)}</span>
        <span className="dot" />
        <span className="fm">{trScope(lang, r.model)}</span>
        <span className="dot" />
        <span className="fm">{trMonth(lang, r.month)}</span>
        {r.meeting && <><span className="dot" /><span className="fm">{trMeeting(lang, r.meeting)}</span></>}
      </div>
    </div>
  );
}

/* ── سجل إصدارات الموقع ──
   ترقيم الإصدارات بنظام "رئيسي.فرعي.تصحيحي" (Major.Minor.Patch)، مثل مواقع البرمجيات المعتادة:
     • يرتفع الرقم التصحيحي (مثل 1.1.1 → 1.1.2) مع أي تعديل صغير: إصلاح مشكلة،
       حذف/تعديل عنصر بسيط، تحسين نص أو تصميم — وهذا الغالب، يشمل أغلب الطلبات اليومية.
     • يرتفع الرقم الفرعي ويُصفَّر التصحيحي (مثل 1.1.4 → 1.2.0) عند إضافة ميزة جديدة
       فعلية (مثل لوحة أو خانة جديدة داخل تبويب موجود).
     • يرتفع الرقم الرئيسي ويُصفَّر البقية (مثل 1.x.x → 2.0.0) فقط عند تغيير جوهري
       كبير: إعادة تصميم شاملة، أو إضافة قسم/تبويب رئيسي جديد للوحة.
   عند كل تحديث كود مستقبلي على هذا الملف — مهما كان صغيرًا — يُضاف عنصر جديد
   بالأعلى برقم إصدار تالٍ حسب القاعدة أعلاه. لا تُعاد كتابة أو حذف الإصدارات السابقة. */
const CHANGELOG = [
  {
    version: "1.5.0",
    dateAr: "7 أغسطس 2026",
    dateEn: "August 7, 2026",
    ar: [
      "الأرقام الرئيسية (إجمالي الملاحظات، توزيع الحالات، المفتوحة والمقفلة، نسبة الاعتماد) صارت تعدّ تصاعديًا من صفر كل مرة تدخل الشاشة أثناء التمرير",
      "شريط توزيع الحالات ينمو من صفر عند ظهوره، بنفس روح أشرطة تقدّم التنفيذ",
      "صف حلقات جديد أعلى المراحل بخانة تقدم التنفيذ: ملخص بصري سريع يرتسم تدريجيًا، بنفس ألوان المتقدّم والمتأخّر — والأشرطة التفصيلية تحته كما هي بلا تغيير",
      "وميض خفيف يمر على بطاقة الاستفسار لحظة الضغط عليها، ولوحة التفاصيل تنزلق من أسفل الشاشة بالكامل بدل الظهور المفاجئ",
      "توهج هادئ ينبض حول شارة \u200f\"الجديد\"\u200f، ونبضة صغيرة تكبّر الفلتر المختار عند اختياره",
      "عدد النتائج يقفز قفزة صغيرة عند تغيّره بعد الفلترة، وانتقال ناعم عند التبديل بين عرض البطاقات والجدول",
      "زر \u200f\"ملخص\"\u200f صار يعرض شريطًا أخضر ينزلق داخله عند نجاح النسخ بدل تغيير الأيقونة فقط",
      "أثناء تحميل أحدث نسخة، يظهر هيكل رمادي متحرك بدل النص — مع بقاء كل البيانات ظاهرة ولا تُخفى",
      "تنظيف إضافي: حذف بقايا تنسيقات CSS غير مستخدمة تبقّت من تنظيف الإصدار السابق",
    ],
    en: [
      "Key figures (total notes, status breakdown, open and closed counts, approval rate) now count up from zero each time they enter the screen while scrolling",
      "The status breakdown bar grows from zero when it appears, matching the execution progress bars",
      "A new ring row above the phases in the Progress tab: a quick visual summary that draws in gradually, using the same ahead/behind colors — the detailed bars below remain unchanged",
      "A soft flash sweeps across an inquiry card the moment it's tapped, and the detail sheet now slides up fully from the bottom of the screen instead of appearing abruptly",
      "A gentle glow pulses around the \"New\" badge, and a small bounce scales up the selected filter chip",
      "The results count bounces slightly when it changes after filtering, and switching between card and table views now transitions smoothly",
      "The \"Summary\" button now shows a green bar sliding up inside it on a successful copy, instead of only swapping the icon",
      "While loading the latest version, an animated gray placeholder replaces the text — all data stays visible and is never hidden",
      "Additional cleanup: removed leftover unused CSS rules remaining from the previous version's cleanup",
    ],
  },
  {
    version: "1.4.4",
    dateAr: "7 أغسطس 2026",
    dateEn: "August 7, 2026",
    ar: [
      "تنظيف داخلي فقط: حذف كود غير مستخدم إطلاقًا من الواجهة (~480 سطر، ١٧٪ من حجم الملف) — لوحتا رفع تحديث كانتا معطّلتين تمامًا مع محرك قراءة ملفات Excel/CSV المرتبط بهما، ودوال مساعدة صارت بلا استخدام بعد إزالتهما",
      "شمل الحذف أيضًا استيراد مكتبة خارجية (xlsx) لم تعد مستخدمة أبدًا في أي مكان بالتطبيق",
      "لا يوجد أي تغيير في الشكل أو السلوك أو البيانات الظاهرة للمستخدم — الملف الناتج مطابق حرفيًا للسابق فيما يخص كل الأجزاء الحية، تم التحقق بمقارنة سطر بسطر",
    ],
    en: [
      "Internal cleanup only: removed ~480 lines (17% of the file) of code with zero references from the live UI — two update-upload panels that were fully disconnected, along with the Excel/CSV parsing engine that only fed them, and helper functions left unused once those were removed",
      "Also removed an external library import (xlsx) that was no longer used anywhere in the app",
      "No change to appearance, behavior, or data shown to users — the resulting file is byte-identical to the previous one for every live code path, verified with a line-by-line diff",
    ],
  },
  {
    version: "1.4.3",
    dateAr: "7 أغسطس 2026",
    dateEn: "August 7, 2026",
    ar: [
      "إصلاح تشوّه شكل الحروف بخط العنوان الزخرفي \u200f\"Reem Kufi\"\u200f عند فتح الصفحة لأول مرة — كان المتصفح يرسم النص بخط بديل مؤقت قبل اكتمال تحميل الخط الأصلي مما يشوّه الحروف العربية للحظة",
      "الآن ينتظر المتصفح تحميل الخط كاملًا قبل رسم العنوان، فيظهر بشكله الصحيح من أول لحظة بدون أي تشوّه أو حاجة لتحديث الصفحة",
    ],
    en: [
      "Fixed distorted lettering in the decorative \"Reem Kufi\" heading font on first page load — the browser was painting the text with a temporary fallback font before the real font finished loading, briefly garbling the Arabic shaping",
      "The browser now waits for the font to fully load before painting the heading, so it renders correctly from the first frame without needing a page refresh",
    ],
  },
  {
    version: "1.4.2",
    dateAr: "7 أغسطس 2026",
    dateEn: "August 7, 2026",
    ar: [
      "شريط التبويبات الرئيسي (نظرة عامة / متابعة الملاحظات / تقدم التنفيذ) صار له انتقال ناعم: تلاشي خفيف لمحتوى التبويب الجديد، ومؤشر رفيع بلون الهوية ينزلق تحت التبويب النشط",
      "المؤشر يحسب موضعه تلقائيًا حسب اتجاه اللغة (عربي/إنجليزي) وحجم الشاشة، بما في ذلك وضع سطح المكتب",
    ],
    en: [
      "The main tab bar (Overview / Notes Board / Progress) now has a smooth transition: a soft fade for the new tab's content, and a thin accent-colored indicator that slides under the active tab",
      "The indicator auto-calculates its position based on language direction (Arabic/English) and screen size, including desktop mode",
    ],
  },
  {
    version: "1.4.1",
    dateAr: "7 أغسطس 2026",
    dateEn: "August 7, 2026",
    ar: [
      "خانة \u200f\"تقدم التنفيذ\"\u200f فقط: أشرطة التقدّم (الإجمالي، المراحل، والبلوكات) صارت تفضى وتتعبى من جديد كل مرة تدخل نطاق الشاشة أثناء التمرير، مع لمعة ناعمة تمر عليها بعد اكتمال التعبئة",
      "لون الشريط لم يتغيّر: أخضر للمتقدّم، أحمر للمتأخّر، رمادي بلا بيانات — نفس المنطق السابق تمامًا",
      "إعداد \u200f\"تقليل الحركة\"\u200f بالجهاز مُحترَم بالكامل: الأشرطة تظهر فورًا بدون انتظار سكرول لمن يفعّله",
    ],
    en: [
      "\"Progress\" tab only: progress bars (total, phases, and blocks) now empty out and re-fill each time they enter the screen while scrolling, with a soft shimmer sweep once the fill completes",
      "Bar color is unchanged: green for ahead, red for behind, gray for no data — identical to the previous logic",
      "The device's \"reduce motion\" setting is fully respected: bars appear instantly with no scroll wait for those who enable it",
    ],
  },
  {
    version: "1.4.0",
    dateAr: "5 أغسطس 2026",
    dateEn: "August 5, 2026",
    ar: [
      "هدف التنفيذ صار يُحسب من التقويم مباشرة ويتقدّم شهريًا بنفسه — للمشروع كاملًا ولكل مرحلة وكل بلوك — سواء وصلت قراءة المطور الشهرية أو لا",
      "الخطة المعتمدة: ٣٫١٢٥ نقطة شهريًا، أي ١٠٠٪ خلال ٣٢ شهرًا حتى ديسمبر ٢٠٢٧، وهي مطابقة تمامًا للأهداف المسجَّلة سابقًا",
      "إضافة لوحة \u200f\"هدف هذا الشهر\"\u200f تعرض هدف الشهر الجاري وآخر قراءة وصلت من المطور والفارق بينهما",
      "الأشهر التي لم تصل قراءتها تظهر باهتة في شريط الأشهر، بهدف محسوب وإنجاز فارغ بدل ترحيل أرقام قديمة",
      "عناوين الفترات والسنوات صارت تُحسب تلقائيًا بدل كتابتها يدويًا، والرسم الزمني يعرض آخر ١٢ شهرًا كحد أقصى",
    ],
    en: [
      "The execution target is now derived from the calendar and advances monthly on its own — for the whole project, each phase and each block — whether or not the developer's monthly reading has arrived",
      "Approved plan: 3.125 points per month, i.e. 100% over 32 months through December 2027, matching the previously recorded targets exactly",
      "Added a \"This month's target\" panel showing the current month's target, the latest reading received from the developer, and the difference between them",
      "Months with no reading yet appear faded in the month bar, with a computed target and empty progress instead of carrying old figures forward",
      "Period and year labels are now computed automatically instead of being written by hand, and the timeline chart shows at most the last 12 months",
    ],
  },
  {
    version: "1.3.0",
    dateAr: "5 أغسطس 2026",
    dateEn: "August 5, 2026",
    ar: [
      "إضافة زر \u200f\"سطح المكتب\"\u200f في رأس الصفحة يحوّل الصفحة كاملة إلى عرض متصفح مكتبي — نفس مبدأ \u200f\"طلب موقع الكمبيوتر\"\u200f في المتصفح",
      "عند تفعيله تُرسم الصفحة بعرض 1180 بكسل وتُصغَّر لتناسب الشاشة، ويمكن التقريب بالأصبعين، وتتحوّل النتائج تلقائيًا إلى عرض الجدول",
      "الزر يتحوّل إلى \u200f\"عرض الجوال\"\u200f للرجوع، ولا يظهر إطلاقًا على الأجهزة التي عرضها الفعلي 1024 بكسل فأكثر لعدم الحاجة له",
    ],
    en: [
      "Added a \"Desktop\" button in the page header that switches the whole page to a desktop browser layout — the same idea as \"Request Desktop Website\" in a browser",
      "When active the page is laid out at 1180px and scaled to fit the screen, pinch-to-zoom works, and results switch to table view automatically",
      "The button becomes \"Mobile view\" to switch back, and never appears on devices whose actual screen is 1024px or wider, where it serves no purpose",
    ],
  },
  {
    version: "1.2.0",
    dateAr: "5 أغسطس 2026",
    dateEn: "August 5, 2026",
    ar: [
      "إضافة زر تبديل شكل عرض النتائج (بطاقات / جدول) في نهاية سطر \u200f\"النتائج\"\u200f داخل خانة متابعة الملاحظات",
      "الزر متاح على كل الأجهزة: الافتراضي بطاقات على الجوال وجدول على الشاشات 1024 بكسل فأكثر، ومن يريد وضع سطح المكتب على جواله يختاره بنفسه ويبقى مثبتًا",
      "في عرض الجدول على الشاشات الصغيرة يتم التمرير أفقيًا داخل إطار الجدول وحده دون تصغير الصفحة",
    ],
    en: [
      "Added a results layout toggle (cards / table) at the end of the \"Results\" line inside the Notes Board tab",
      "Available on every device: cards by default on phones and table on screens 1024px and wider, and anyone who wants the desktop layout on their phone can select it and it stays selected",
      "On small screens the table scrolls horizontally inside its own frame without shrinking the page",
    ],
  },
  {
    version: "1.1.2",
    dateAr: "29 يوليو 2026",
    dateEn: "July 29, 2026",
    ar: ["حذف عدّاد \u200f\"ملاحظة\"\u200f وعدّاد \u200f\"مهندسين\"\u200f من شريط المعلومات أعلى الصفحة، واستبدال عدّاد النماذج بذكر أسماء النماذج نفسها"],
    en: ["Removed the \"notes\" and \"engineers\" counts from the top info bar, and replaced the models count with the actual model names"],
  },
  {
    version: "1.1.1",
    dateAr: "29 يوليو 2026",
    dateEn: "July 29, 2026",
    ar: ["حذف زر الطباعة من رأس الصفحة لعدم وجود فائدة منه"],
    en: ["Removed the Print button from the header as it served no purpose"],
  },
  {
    version: "1.1.0",
    dateAr: "29 يوليو 2026",
    dateEn: "July 29, 2026",
    ar: [
      "إضافة زر تبديل اللغة (ع/EN) داخل نافذة الإقرار القانوني",
      "حذف ملاحظة \u200f\"لم يُنشر تحديث بعد\"\u200f غير المفيدة من الصفحة الرئيسية وخانة تقدم التنفيذ",
      "تصحيح عرض السنة والأرقام عند التبديل للغة الإنجليزية في خانة تقدم التنفيذ",
      "تصحيح موقع خط الهدف داخل أشرطة تقدم التنفيذ ليطابق اتجاه الصفحة بالإنجليزية",
      "تبسيط رأس الصفحة وتذييلها بحذف نصوص لا تضيف فائدة",
      "إضافة رقم إصدار اللوحة وسجل التحديثات (هذه النافذة)",
    ],
    en: [
      "Added a language toggle (ع/EN) inside the legal disclaimer window",
      "Removed the unhelpful \"no update published yet\" notice from the main page and the Progress tab",
      "Fixed year and number rendering when switching to English on the Progress tab",
      "Fixed the target-line position inside progress bars to match page direction in English",
      "Simplified the page header and footer by removing text that added no value",
      "Added a dashboard version number and update log (this window)",
    ],
  },
  {
    version: "1.0.0",
    dateAr: "—",
    dateEn: "—",
    ar: [
      "الإصدار الأساسي للوحة: النظرة العامة، متابعة الملاحظات، تقدم التنفيذ، المخطط التفاعلي للفيلا، الوضع الفاتح/الداكن، ثنائية اللغة الكاملة",
    ],
    en: [
      "Baseline release: Overview, Notes Board, Progress, the interactive villa plan, light/dark mode, and full bilingual support",
    ],
  },
];
const CURRENT_VERSION = CHANGELOG[0].version;

/* ── إقرار قانوني — يظهر في كل زيارة، بدون تذكّر الموافقة ── */
const LEGAL_COPY = {
  ar: {
    eyebrow: "قبل ما تكمل",
    title: "تنويه وإخلاء مسؤولية قانونية",
    points: [
      ["طبيعة المنصة", "هذه اللوحة هي مبادرة واجتهاد شخصي وودّي من ممثلي الملاك، ولا تُعد منصة رسمية أو متحدثًا رسميًا باسم أي جهة حكومية، خريطة طريق، أو الشركة المطوّرة."],
      ["طبيعة البيانات", "كافة المعلومات والإحصائيات الواردة هي بيانات استرشادية منقولة كما هي من المطوّر العقاري أو من استبيانات الملاك، دون أدنى مسؤولية عن دقتها أو صحتها أو أي تغييرات قد تطرأ عليها مستقبلًا من قِبل المطوّر."],
      ["نفي الصفة والمسؤولية", "لا يتحمّل ممثلو الملاك أي مسؤولية قانونية أو مالية أو إدارية ناتجة عن استخدام هذه البيانات، أو بناء أي قرارات عليها، أو عن أي ردود فعل أو إجراءات قد تتخذها أي جهة أو مطوّر تجاه ما يُنقل من مطالب أو استفسارات."],
    ],
    consent: "بالضغط على «أوافق»، فأنت تقرّ بعلمك التام بجميع ما ورد أعلاه وتوافق على إخلاء مسؤولية القائمين على اللوحة تمامًا.",
    agree: "أوافق",
  },
  en: {
    eyebrow: "Before you continue",
    title: "Legal Notice & Disclaimer",
    points: [
      ["Nature of the Platform", "This dashboard is a personal, voluntary initiative by owner representatives. It is not an official platform or spokesperson on behalf of any government entity, project roadmap, or the developer company."],
      ["Nature of the Data", "All information and statistics shown are indicative data, transferred as-is from the real estate developer or from owner surveys, with no responsibility for their accuracy, correctness, or any future changes made by the developer."],
      ["Disclaimer of Role & Liability", "Owner representatives bear no legal, financial, or administrative liability arising from use of this data, decisions made based on it, or any response or action taken by any party or developer regarding demands or inquiries conveyed."],
    ],
    consent: "By clicking \u201cI Agree,\u201d you acknowledge full awareness of the above and agree to fully release the dashboard administrators from liability.",
    agree: "I Agree",
  },
};

function LegalDisclaimer() {
  const { T } = useT();
  const { lang } = useLang();
  const [agreed, setAgreed] = useState(false);
  if (agreed) return null;
  const c = LEGAL_COPY[lang];
  const onAgree = () => setAgreed(true);
  return (
    <div className="ovl" style={{ zIndex: 90 }}>
      <div className="sheet" style={{ maxWidth: 480 }} role="dialog" aria-modal="true">
        <div className="sheet-top" style={{ borderBottom: `1px solid ${T.line}` }}>
          <div className="flex items-center gap-2">
            <span style={{
              width: 36, height: 36, borderRadius: 11, background: T.brass + "14",
              display: "flex", alignItems: "center", justifyContent: "center", flex: "none",
            }}>
              <ShieldAlert size={17} color={T.brass} />
            </span>
            <div>
              <div className="eyebrow">{c.eyebrow}</div>
              <div className="sec-t" style={{ marginTop: 2 }}>{c.title}</div>
            </div>
          </div>
          <LangToggle />
        </div>
        <div className="sheet-body">
          {c.points.map(([label, body], i) => (
            <div key={i} style={{ marginBottom: i < c.points.length - 1 ? 18 : 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: T.paper, marginBottom: 5 }}>{label}</div>
              <p style={{ fontSize: 13, lineHeight: 1.9, color: T.muted, margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>
        <div style={{ padding: "18px 19px 22px", borderTop: `1px solid ${T.line}`, background: T.sunken }}>
          <p style={{ fontSize: 11.5, lineHeight: 1.8, color: T.faint, margin: "0 0 14px" }}>{c.consent}</p>
          <button onClick={onAgree} className="big-btn" style={{ marginTop: 0 }}>{c.agree}</button>
        </div>
      </div>
    </div>
  );
}

function ChangelogSheet({ open, onClose }) {
  const { T } = useT();
  const { lang } = useLang();
  const L = (ar, en) => (lang === "en" ? en : ar);
  if (!open) return null;
  return (
    <div className="ovl" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }} role="dialog" aria-modal="true">
        <div className="sheet-top">
          <div className="flex items-center gap-2">
            <span style={{
              width: 36, height: 36, borderRadius: 11, background: T.brass + "14",
              display: "flex", alignItems: "center", justifyContent: "center", flex: "none",
            }}>
              <History size={17} color={T.brass} />
            </span>
            <div className="sec-t">{L("سجل إصدارات الموقع", "Site Update Log")}</div>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label={L("إغلاق", "Close")}><X size={16} /></button>
        </div>
        <div className="sheet-body">
          {CHANGELOG.map((entry, i) => (
            <div key={i} style={{ marginBottom: i < CHANGELOG.length - 1 ? 22 : 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: T.brass }}>v{entry.version}</span>
                <span className="mono" style={{ fontSize: 12, color: T.muted }}>
                  {lang === "en" ? entry.dateEn : entry.dateAr}
                </span>
              </div>
              <ul style={{
                margin: 0, paddingInlineStart: 18, fontSize: 13, lineHeight: 1.9, color: T.paper,
              }}>
                {(lang === "en" ? entry.en : entry.ar).map((line, j) => (<li key={j}>{line}</li>))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Sheet({ r, onClose }) {
  const { T } = useT();
  const { lang } = useLang();
  const L = (ar, en) => (lang === "en" ? en : ar);
  useEffect(() => {
    if (!r) return;
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [r, onClose]);
  if (!r) return null;
  const sc = T.sta[r.sta] || hashPick(r.sta, T.extra);
  return (
    <div className="ovl" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sheet-top">
          <div className="flex items-center gap-2">
            <span className="mono sheet-id">{L("ملاحظة", "Note")} {String(r.id).padStart(2, "0")}</span>
            <span className="tag" style={{ color: T.pri[r.pri] || T.muted }}>{trPri(lang, r.pri)}</span>
            {r.isNew && <span className="tag tag-new"><Sparkles size={9} /> {L("جديد", "New")}</span>}
          </div>
          <button onClick={onClose} className="icon-btn" aria-label={L("إغلاق", "Close")}><X size={16} /></button>
        </div>
        <div className="sheet-body">
          <div className="sec-lbl">{L("الملاحظة والحل المقترح", "Note & Proposed Solution")}</div>
          <p className="sheet-note">{trNote(lang, r)}</p>

          <div className="sec-lbl" style={{ marginTop: 24 }}>
            {L("الرد", "Reply")} <span style={{ color: sc }}>· {trSta(lang, r.sta)}</span>
          </div>
          <div className="reply-box" style={{ borderRightColor: sc }}>
            <p className="sheet-reply">{trReply(lang, r) || L("لا يوجد رد مسجّل.", "No reply recorded yet.")}</p>
          </div>

          <div className="meta-list">
            {[[Layers, L("الموقع", "Location"), trLoc(lang, r.loc)], [Home, L("النموذج", "Model"), trScope(lang, r.model)], [User, L("صاحب الرد", "Engineer"), trOwn(lang, r.owner)],
              [Calendar, L("شهر الرد", "Reply Month"), trMonth(lang, r.month)], [Ruler, L("حالة الإغلاق", "Closure Status"), r.closed ? L("مقفل", "Closed") : L("مفتوح", "Open")],
              [Droplet, L("حالة الرد", "Reply Status"), r.answered ? L("تم الرد", "Replied") : L("بانتظار الرد", "Awaiting reply")]].map(([Ic, k, v]) => (
              <div key={k} className="meta-row">
                <span className="meta-k"><Ic size={12} /> {k}</span>
                <span className="meta-v">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ خانة تقدم التنفيذ ═══ */
/* ── حلقات المراحل — ملخص بصري سريع، ترتسم تدريجيًا عند دخولها الشاشة ── */
function PhaseRings({ phases, mi, tgt, ahead, behind, muted, sunken, lang }) {
  const reduced = usePrefersReduced();
  const [ref, inView] = useInView(0.3);
  const draw = reduced || inView;
  const R = 26, C = 2 * Math.PI * R;
  return (
    <div className="rings" ref={ref}>
      {phases.map((p) => {
        const v = p.v[mi];
        const g = v == null || tgt == null ? null : v - tgt;
        const col = g == null ? muted : g >= 0 ? ahead : behind;
        const pct = v == null ? 0 : Math.max(0, Math.min(100, v));
        return (
          <div key={p.key} className="ring-i">
            <svg width="62" height="62" viewBox="0 0 62 62" className="ring-s">
              <circle cx="31" cy="31" r={R} fill="none" strokeWidth="6" stroke={sunken} />
              <circle cx="31" cy="31" r={R} fill="none" strokeWidth="6" stroke={col} strokeLinecap="round"
                className="ring-fg" strokeDasharray={C}
                strokeDashoffset={draw ? C * (1 - pct / 100) : C} />
              <text x="31" y="31" textAnchor="middle" dominantBaseline="central"
                fontSize="12.5" fill={col} className="mono" transform="rotate(90 31 31)">
                {v == null ? "—" : Math.round(v)}
              </text>
            </svg>
            <div className="ring-l">{trPGLabel(lang, p.label)}</div>
          </div>
        );
      })}
    </div>
  );
}

function ProgressTab({ reduced, data, loading }) {
  const { T } = useT();
  const { lang } = useLang();
  const L = (ar, en) => (lang === "en" ? en : ar);
  const D = useMemo(() => extendPlan(data, new Date()), [data]);
  const MONTHS = D.months, TARGET = D.target, PHASES = D.phases, BLOCKS = D.blocks, NOTE = D.note;
  const YEARS = D.years, ADDED = D.added || 0;
  const PHASE_NAME = data.phaseName || (lang === "en" ? PG_PHASE_NAME_EN : PG_PHASE_NAME);
  const last = MONTHS.length - 1;

  const ahead = T.sta["معتمدة"], behind = T.sta["تم الرفض"];
  const total = PHASES.find((p) => p.key === "total") || { v: MONTHS.map(() => null) };

  /* آخر شهر وصلت فيه قراءة فعلية من المطور */
  const lastData = useMemo(() => {
    for (let i = total.v.length - 1; i >= 0; i--) if (total.v[i] != null) return i;
    return -1;
  }, [total]);

  const [mi, setMi] = useState(lastData >= 0 ? lastData : last);
  useEffect(() => { setMi(lastData >= 0 ? lastData : MONTHS.length - 1); }, [lastData, MONTHS.length]);

  const yearOf = (i) => (YEARS ? YEARS[i] : null);
  const multiYear = YEARS ? new Set(YEARS).size > 1 : false;
  const mLabel = (i) => trPGMonth(lang, MONTHS[i]) + (multiYear ? ` ${trYear(lang, yearOf(i))}` : "");
  const mFull = (i) => `${trPGMonth(lang, MONTHS[i])} ${trYear(lang, yearOf(i))}`.trim();

  const cur = total.v[mi], tgt = TARGET[mi];
  const hasCur = cur != null && tgt != null;
  const gap = hasCur ? +(cur - tgt).toFixed(2) : null;
  const gapColor = gap == null ? T.muted : gap >= 0 ? ahead : behind;
  const scale = 60; /* أقصى نسبة على مقياس الأشرطة — يمنح الأشرطة مدى مقروءًا */

  /* هدف الشهر الحالي مقابل آخر قراءة وصلت */
  const nowGap = (ADDED > 0 && lastData >= 0 && TARGET[last] != null)
    ? +(total.v[lastData] - TARGET[last]).toFixed(2) : null;

  /* الرسم يعرض آخر ١٢ شهرًا كحد أقصى حتى لا تتراكم التسميات مع مرور الوقت */
  const chartFrom = Math.max(0, MONTHS.length - 12);
  const trend = useMemo(() => MONTHS.slice(chartFrom).map((m, k) => {
    const i = chartFrom + k;
    return {
      m: mLabel(i), "الإنجاز": total.v[i], "الهدف": TARGET[i],
      "الفجوة": total.v[i] == null || TARGET[i] == null ? null : +(total.v[i] - TARGET[i]).toFixed(2),
    };
  }), [total, MONTHS, TARGET, YEARS, lang, chartFrom]);

  const delta = (v, i) => (i === 0 || v[i] == null || v[i - 1] == null ? null : +(v[i] - v[i - 1]).toFixed(2));
  const dColor = (d) => (d === null ? T.muted : d > 0.05 ? ahead : d < -0.05 ? behind : T.muted);
  const dText = (d) => (d === null ? "—" : d > 0.05 ? `+${d.toFixed(2)}` : d < -0.05 ? d.toFixed(2) : L("متوقف", "Stalled"));

  const blocks = useMemo(() =>
    [...BLOCKS].sort((a, b) => (b.v[mi] == null ? -1 : b.v[mi]) - (a.v[mi] == null ? -1 : a.v[mi])), [mi, BLOCKS]);

  const stalled = blocks.filter((r) => mi > 0 && r.v[mi] != null && r.v[mi - 1] != null && Math.abs(r.v[mi] - r.v[mi - 1]) < 0.2);
  const grouped = ["p1", "p2", "p3", "p4"].map((k) => ({ k, rows: blocks.filter((r) => r.ph === k) }));

  const Bar = ({ val, color, target }) => {
    const [ref, inView] = useInView(0.35);
    const show = reduced || inView; /* بدون حركة النظام: يظهر مباشرة بدون انتظار السكرول */
    const w = val != null ? `${Math.min(100, (val / scale) * 100)}%` : "0%";
    return (
      <div className="gbar" ref={ref}>
        {val != null && (
          <div className={`gbar-f${!reduced && inView ? " in-view" : ""}`}
            style={{ width: show ? w : "0%", background: color }} />
        )}
        {target != null && (
          <span className="gbar-t" style={{
            [lang === "en" ? "left" : "right"]: `${Math.min(100, (target / scale) * 100)}%`,
            background: T.paper,
          }} />
        )}
      </div>
    );
  };

  return (
    <>
      {loading ? (
        <div className="skel skel-line" style={{ width: 210, height: 14, marginBottom: 16 }} />
      ) : data.updatedAt ? (
        <div className="stamp" style={{ marginBottom: 14 }}>
          <RefreshCw size={13} />
          {L("آخر تحديث:", "Last updated:")} <span className="mono">{fmtDate(data.updatedAt)}</span>{data.label ? ` — ${data.label}` : ""}
        </div>
      ) : null}

      {/* الحالة العامة مقابل الهدف */}
      <section className="surf" style={{ padding: "22px 20px", marginBottom: 14 }}>
        <div className="stats-top">
          <div>
            <div className="sec-t">{L("تقدم المشروع مقابل الهدف", "Project Progress vs. Target")}</div>
            <div className="eyebrow" style={{ marginTop: 4 }}>{L("متوسط الإنجاز لكل البلوكات", "Average completion across all blocks")} · {mFull(mi)}</div>
          </div>
          <div className="hero">
            <span className="hero-n mono">{hasCur ? `${cur.toFixed(2)}٪` : "—"}</span>
          </div>
        </div>

        <Bar val={cur} color={gapColor} target={tgt} />

        <div className="gmeta">
          <span className="gm"><span className="gm-k">{L("الهدف", "Target")}</span> <span className="mono">{tgt != null ? `${tgt.toFixed(2)}٪` : "—"}</span></span>
          {hasCur ? (
            <>
              <span className="dot" />
              <span className="gm" style={{ color: gapColor }}>
                {gap >= 0 ? L("متقدّم", "Ahead") : L("متأخّر", "Behind")} <span className="mono">{Math.abs(gap).toFixed(2)}</span> {L("نقطة", "pts")}
              </span>
              <span className="dot" />
              <span className="gm"><span className="gm-k">{L("التغيّر عن الشهر السابق", "Change vs. previous month")}</span>{" "}
                <span className="mono" style={{ color: dColor(delta(total.v, mi)) }}>{dText(delta(total.v, mi))}</span>
              </span>
            </>
          ) : (
            <>
              <span className="dot" />
              <span className="gm" style={{ color: T.muted }}>{L("بانتظار قراءة المطور لهذا الشهر", "Awaiting the developer's reading for this month")}</span>
            </>
          )}
        </div>

        {ADDED > 0 && lastData >= 0 && TARGET[last] != null && (
          <div className="note-box plan-now" style={{ marginTop: 14 }}>
            <div style={{ color: T.paper }}>
              {L("هدف هذا الشهر", "This month's target")} — {mFull(last)}: <span className="mono" style={{ color: T.brass }}>{TARGET[last].toFixed(2)}٪</span>
            </div>
            <div style={{ marginTop: 6 }}>
              {L("آخر قراءة وصلت من المطور:", "Latest reading received from the developer:")} {mFull(lastData)}{" "}
              <span className="mono">{total.v[lastData].toFixed(2)}٪</span>
              {nowGap != null && (
                <> — {L("الفارق عن هدف هذا الشهر", "difference from this month's target")}{" "}
                  <span className="mono" style={{ color: nowGap >= 0 ? ahead : behind }}>
                    {nowGap >= 0 ? `+${nowGap.toFixed(2)}` : nowGap.toFixed(2)}
                  </span> {L("نقطة", "pts")}</>
              )}
            </div>
            <div style={{ marginTop: 6 }}>
              {L("الهدف خطة خطّية ثابتة ٣٫١٢٥ نقطة شهريًا (١٠٠٪ خلال ٣٢ شهرًا حتى ديسمبر ٢٠٢٧)، ويتقدّم تلقائيًا مع التقويم سواء وصلت قراءة المطور أو لا. الإنجاز الفعلي يبقى فارغًا حتى تصل القراءة.",
                 "The target is a fixed linear plan of 3.125 points per month (100% over 32 months, through December 2027) and advances automatically with the calendar whether or not the developer's reading has arrived. Actual progress stays empty until the reading arrives.")}
            </div>
          </div>
        )}

        {(() => {
          const idx = MONTHS.map((_, i) => i).filter((i) => total.v[i] != null && TARGET[i] != null);
          if (idx.length < 2) return null;
          const i0 = idx[0], i1 = idx[idx.length - 1], span = idx.length - 1;
          const g0 = +(total.v[i0] - TARGET[i0]).toFixed(2);
          const g1 = +(total.v[i1] - TARGET[i1]).toFixed(2);
          const targetStep = (TARGET[i1] - TARGET[i0]) / span;
          const actualStep = (total.v[i1] - total.v[i0]) / span;
          const crossAt = idx.find((i) => total.v[i] - TARGET[i] < 0);
          return (
            <div className="note-box" style={{ marginTop: 16 }}>
              {L("الفجوة عن الهدف", "The gap to target")} {g1 <= g0 ? L("تتقلّص", "is narrowing") : L("تتّسع", "is widening")} {span > 0 ? L("شهرًا بعد شهر", "month over month") : ""}{L(": من", ": from")}{" "}
              <span className="mono" style={{ color: g0 >= 0 ? ahead : behind }}>{g0 >= 0 ? `+${g0.toFixed(2)}` : g0.toFixed(2)}</span>{" "}
              {L("في", "in")} {mFull(i0)} {L("إلى", "to")} <span className="mono" style={{ color: g1 >= 0 ? ahead : behind }}>{g1 >= 0 ? `+${g1.toFixed(2)}` : g1.toFixed(2)}</span>{" "}
              {L("في", "in")} {mFull(i1)}
              {crossAt != null && crossAt > i0 ? L(` — أول شهر يقع فيه المشروع خلف الهدف هو ${mFull(crossAt)}.`, ` — the first month the project fell behind target was ${mFull(crossAt)}.`) : "."}{" "}
              {L("الهدف يتطلّب تقدّمًا بنحو", "The target requires progress of about")} <span className="mono">{targetStep.toFixed(2)}</span> {L("نقطة شهريًا،", "points/month,")}
              {" "}{L("والمتحقّق فعليًا نحو", "while actual progress is about")} <span className="mono">{actualStep.toFixed(2)}</span>.
            </div>
          );
        })()}
      </section>

      {/* المسار الزمني */}
      <section className="surf" style={{ padding: "20px 16px 14px", marginBottom: 14 }}>
        <div style={{ paddingRight: 4 }}>
          <div className="sec-t">{L("المسار الزمني", "Timeline")}</div>
          <div className="eyebrow" style={{ marginTop: 4, marginBottom: 14 }}>
            {L("الإنجاز مقابل الهدف", "Progress vs. target")} · {mFull(chartFrom)} — {mFull(last)}
          </div>
        </div>
        <div style={{ height: 230, width: "100%" }}>
          <ResponsiveContainer>
            <ComposedChart data={trend} margin={{ top: 6, right: 4, left: -20, bottom: 4 }}>
              <CartesianGrid stroke={T.lineSoft} vertical={false} />
              <XAxis dataKey="m" reversed={lang === "ar"} tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false}
                interval="preserveStartEnd" minTickGap={12} />
              <YAxis orientation="right" domain={[20, 60]} tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={36}
                tickFormatter={(v) => `${v}٪`} />
              <Tooltip content={<ChartTip />} cursor={{ fill: T.brass + "12" }} />
              <Line type="monotone" dataKey="الهدف" name={L("الهدف", "Target")} stroke={T.muted} strokeWidth={2} strokeDasharray="5 4"
                dot={{ r: 2.5, fill: T.surface, stroke: T.muted, strokeWidth: 2 }} isAnimationActive={!reduced} />
              <Line type="monotone" dataKey="الإنجاز" name={L("الإنجاز", "Progress")} stroke={T.brass} strokeWidth={2.6}
                dot={{ r: 3.5, fill: T.surface, stroke: T.brass, strokeWidth: 2 }} isAnimationActive={!reduced} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap items-center" style={{ gap: 16, padding: "4px 4px 0" }}>
          <span className="flex items-center" style={{ gap: 7, fontSize: 11.5, color: T.muted }}>
            <span style={{ width: 14, height: 2.6, background: T.brass, display: "inline-block", borderRadius: 2 }} /> {L("الإنجاز الفعلي", "Actual progress")}
          </span>
          <span className="flex items-center" style={{ gap: 7, fontSize: 11.5, color: T.muted }}>
            <span style={{ width: 14, height: 0, borderTop: `2px dashed ${T.muted}`, display: "inline-block" }} /> {L("الهدف المخطَّط", "Planned target")}
          </span>
        </div>
      </section>

      {/* المراحل */}
      <section className="surf" style={{ padding: "20px 18px", marginBottom: 14 }}>
        <div className="sec-t">{L("المراحل", "Phases")}</div>
        <div className="eyebrow" style={{ marginTop: 4, marginBottom: 16 }}>
          {L("مقابل هدف", "Against")} {mFull(mi)} {L("", "target")} <span className="mono">{tgt != null ? `${tgt.toFixed(2)}٪` : "—"}</span> — {L("الخط الرأسي يمثّل الهدف", "the vertical line marks the target")}
        </div>
        <PhaseRings phases={PHASES.filter((p) => p.key !== "total")} mi={mi} tgt={tgt}
          ahead={ahead} behind={behind} muted={T.muted} sunken={T.sunken} lang={lang} />
        {PHASES.filter((p) => p.key !== "total").map((p) => {
          const v = p.v[mi];
          const g = v == null || tgt == null ? null : +(v - tgt).toFixed(2);
          const d = delta(p.v, mi);
          const col = g == null ? T.muted : g >= 0 ? ahead : behind;
          return (
            <div key={p.key} className="grow">
              <div className="grow-top">
                <span className="grow-l">{trPGLabel(lang, p.label)} <span className="grow-note">{trPGPNote(lang, p.note)}</span></span>
                <span className="grow-r">
                  <span className="mono grow-v">{v == null ? "—" : `${v.toFixed(2)}٪`}</span>
                  <span className="mono grow-g" style={{ color: col }}>{g == null ? "—" : g >= 0 ? `+${g.toFixed(2)}` : g.toFixed(2)}</span>
                </span>
              </div>
              <Bar val={v} color={col} target={tgt} />
              <div className="grow-d">{L("التغيّر عن الشهر السابق", "Change vs. previous month")} <span className="mono" style={{ color: dColor(d) }}>{dText(d)}</span></div>
            </div>
          );
        })}
      </section>

      {/* البلوكات */}
      <section className="surf" style={{ padding: "20px 18px" }}>
        <div className="gb-head">
          <div>
            <div className="sec-t">{L("البلوكات", "Blocks")}</div>
            <div className="eyebrow" style={{ marginTop: 4 }}>
              <span className="mono">{BLOCKS.length}</span> {L("بلوك · مرتّبة من الأعلى إنجازًا", "blocks · sorted by highest progress")}
            </div>
          </div>
          <div className="mseg no-print">
            {MONTHS.map((m, i) => {
              const empty = total.v[i] == null;
              return (
                <button key={`${m}-${i}`} className="mseg-b" data-on={mi === i ? "1" : "0"} onClick={() => setMi(i)}
                  title={empty ? L("بانتظار بيانات المطور", "Awaiting developer data") : undefined}
                  style={{
                    ...(mi === i ? { background: T.brass, color: T.onAccent } : null),
                    ...(empty && mi !== i ? { opacity: 0.5 } : null),
                  }}>{mLabel(i)}</button>
              );
            })}
          </div>
        </div>

        {ADDED > 0 && (
          <div className="eyebrow" style={{ marginTop: 10 }}>
            {L("الأشهر الباهتة لم تصل قراءتها بعد — الهدف فيها محسوب من الخطة والإنجاز بانتظار المطور.",
               "Faded months have no reading yet — their target comes from the plan and actual progress awaits the developer.")}
          </div>
        )}

        {mi > 0 && stalled.length > 0 && (
          <div className="note-box" style={{ marginTop: 14, marginBottom: 4 }}>
            {L("لم تتحرّك في", "No movement in")} {mFull(mi)}:{" "}
            <span style={{ color: T.paper }}>{stalled.map((r) => `${L("بلوك", "Block")} ${r.b}`).join(" · ")}</span>
          </div>
        )}

        {grouped.map(({ k, rows }) => rows.length > 0 && (
          <div key={k} className="gb-group">
            <div className="gb-gt">{PHASE_NAME[k] || k}</div>
            {rows.map((r) => {
              const v = r.v[mi], d = delta(r.v, mi);
              const g = v == null || tgt == null ? null : v - tgt;
              return (
                <div key={r.b} className="brow">
                  <span className="brow-b mono">{r.b}</span>
                  <div className="brow-bar">
                    <Bar val={v} color={g == null ? T.muted : g >= 0 ? ahead : behind} target={tgt} />
                  </div>
                  <span className="brow-v mono">{v == null ? "—" : `${v.toFixed(2)}٪`}</span>
                  <span className="brow-d mono" style={{ color: dColor(d) }}>{dText(d)}</span>
                </div>
              );
            })}
          </div>
        ))}

        {NOTE && <div className="note-box" style={{ marginTop: 16 }}>{lang === "en" && NOTE === PG_NOTE ? PG_NOTE_EN : NOTE}</div>}
        {(() => {
          const drops = BLOCKS.map((r) => {
            let worst = null;
            for (let i = 1; i < r.v.length; i++) {
              if (r.v[i] == null || r.v[i - 1] == null) continue;
              const d = r.v[i] - r.v[i - 1];
              if (d < -1 && (!worst || d < worst.d)) worst = { i, d };
            }
            return worst ? { b: r.b, from: r.v[worst.i - 1], to: r.v[worst.i], m0: worst.i - 1, m1: worst.i, d: worst.d } : null;
          }).filter(Boolean);
          if (!drops.length) return null;
          return (
            <div className="note-box" style={{ marginTop: 8 }}>
              {drops.map((r) => (
                <div key={r.b}>
                  {L("بلوك", "Block")} {r.b} {L("سجّل تراجعًا من", "recorded a drop from")} <span className="mono">{r.from.toFixed(2)}٪</span> {L("في", "in")} {mFull(r.m0)}{" "}
                  {L("إلى", "to")} <span className="mono">{r.to.toFixed(2)}٪</span> {L("في", "in")} {mFull(r.m1)} — {L("يُرجَّح أنه تصحيح لقياس سابق، وليس تراجعًا فعليًا في التنفيذ.", "likely a correction of an earlier reading, not an actual execution setback.")}
                </div>
              ))}
            </div>
          );
        })()}
      </section>
    </>
  );
}

/* ═══════════════ اللوحة ═══════════════ */
const EMPTY_F = { q: "", zone: null, pri: null, sta: null, model: null, own: null, mon: null, meeting: null, open: false, fresh: false };

export default function Dashboard() {
  const reduced = usePrefersReduced();
  const { mode, setMode, resolved } = useThemeMode();
  const { lang, setLang } = useLangMode();
  const { view, setView } = useViewMode();
  const { deskOn, toggleDesk, smallDevice } = useDesktopView();
  const L = (ar, en) => (lang === "en" ? en : ar);
  const T = THEMES[resolved];

  const [tab, setTab] = useState("overview");
  const [built, setBuilt] = useState(false);
  const [data, setData] = useState({ records: BASE, newKeys: [], updatedAt: null, label: "" });
  const [loading, setLoading] = useState(true);
  const [pg, setPg] = useState(PG_BASE);
  const [pgLoading, setPgLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [f, setF] = useState(EMPTY_F);
  const [sort, setSort] = useState("id");
  const [sel, setSel] = useState(null);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [limit, setLimit] = useState(12);
  const tabsRef = useRef(null);
  const indicatorRef = useRef(null);
  const [scrollPending, setScrollPending] = useState(false);

  /* موضع مؤشر التبويب النشط المتحرك — يُحدَّث عند تبديل التبويب أو اللغة أو تغيّر حجم الشاشة */
  useLayoutEffect(() => {
    const position = () => {
      const nav = tabsRef.current, ind = indicatorRef.current;
      if (!nav || !ind) return;
      const active = nav.querySelector('.tab[data-on="1"]');
      if (!active) return;
      ind.style.width = `${active.offsetWidth}px`;
      ind.style.left = `${active.offsetLeft}px`;
    };
    position();
    window.addEventListener("resize", position);
    return () => window.removeEventListener("resize", position);
  }, [tab, lang]);

  useEffect(() => { const t = setTimeout(() => setBuilt(true), reduced ? 0 : 100); return () => clearTimeout(t); }, [reduced]);

  /* تتبع صامت: زيارة عند التحميل */
  useEffect(() => { logEvent("visit", null, null, null); }, []);

  /* تتبع صامت: تبديل التبويب (يتجاهل التبويب الأول عند التحميل) */
  const firstTabRef = useRef(true);
  useEffect(() => {
    if (firstTabRef.current) { firstTabRef.current = false; return; }
    logEvent("tab", tab, null, null);
  }, [tab]);

  /* تتبع صامت: استخدام الفلاتر (يسجّل فقط الحقل الذي تغيّر فعليًا إلى قيمة) */
  const prevFRef = useRef(EMPTY_F);
  useEffect(() => {
    Object.keys(f).forEach((k) => {
      if (k === "q" || k === "fresh") return;
      const v = f[k];
      if (v !== prevFRef.current[k] && v !== null && v !== false && v !== "") {
        logEvent("filter", k, v, null);
      }
    });
    prevFRef.current = f;
  }, [f]);

  /* تتبع صامت: فتح تفاصيل استفسار */
  useEffect(() => {
    if (sel) logEvent("inquiry_open", sel.id, sel.pri, `${sel.model || ""} / ${sel.zone || sel.loc || ""}`);
  }, [sel]);

  useEffect(() => {
    if (tab !== "notes" || !scrollPending) return;
    tabsRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    setScrollPending(false);
  }, [tab, scrollPending, reduced]);

  useEffect(() => {
    let alive = true;
    loadShared().then((s) => {
      if (!alive) return;
      if (s?.records?.length) setData({ records: s.records, newKeys: s.newKeys || [], updatedAt: s.updatedAt, label: s.label || "" });
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    loadShared(PGKEY).then((s) => {
      if (!alive) return;
      if (s?.phases?.length && s?.blocks?.length) setPg(s);
      setPgLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const ALL = useMemo(() => {
    return data.records.map((r) => ({ ...r, zone: zoneOf(r.loc), models: modelsOf(r.model), isNew: isRecentlyChanged(r.id) }));
  }, [data]);

  const cats = useMemo(() => ({
    pri: uniqSorted(ALL.map((r) => r.pri), PRI_ORDER),
    sta: uniqSorted(ALL.map((r) => r.sta), STA_ORDER),
    models: MODEL_LIST.filter((m) => ALL.some((r) => r.models.includes(m))),
    owners: [...new Set(ALL.map((r) => r.owner))].filter(Boolean).sort((a, b) => a.localeCompare(b, "ar")),
    months: [...new Set(ALL.map((r) => r.month))].filter(Boolean).sort(),
    meetings: [...new Set(ALL.map((r) => r.meeting))].filter(Boolean),
  }), [ALL]);

  const newCount = ALL.filter((r) => r.isNew).length;
  const openCount = ALL.filter((r) => !r.closed).length;
  const staC = (s) => T.sta[s] || hashPick(s, T.extra);
  const monthValue = (r) => (/^\d{4}-\d{2}$/.test(r.month || "") ? r.month : "9999-99");

  /* الانتقال من النظرة العامة إلى لوحة المتابعة مع تطبيق تصفية */
  const openBoard = (patch = {}) => {
    const { __sort, ...filters } = patch;
    setF({ ...EMPTY_F, ...filters });
    setSort(__sort || "id");
    setLimit(12);
    setTab("notes");
    setScrollPending(true);
  };
  const set = (k, v) => { setF((p) => ({ ...p, [k]: p[k] === v ? (typeof v === "boolean" ? !v : null) : v })); setLimit(12); };
  const reset = () => { setF(EMPTY_F); setLimit(12); };
  const nq = useMemo(() => norm(f.q.trim()), [f.q]);

  const match = useMemo(() => (r, skip = {}) => {
    if (!skip.zone && f.zone && r.zone !== f.zone) return false;
    if (!skip.pri && f.pri && r.pri !== f.pri) return false;
    if (!skip.sta && f.sta && r.sta !== f.sta) return false;
    if (f.model && !r.models.includes(f.model)) return false;
    if (f.own && r.owner !== f.own) return false;
    if (f.mon && r.month !== f.mon) return false;
    if (f.meeting && r.meeting !== f.meeting) return false;
    if (f.open && r.closed) return false;
    if (f.fresh && !r.isNew) return false;
    if (nq && !norm(`${r.note} ${r.reply} ${r.loc} ${r.model} ${r.owner} ${r.pri} ${r.sta}`).includes(nq)) return false;
    return true;
  }, [f, nq]);

  const rows = useMemo(() => ALL.filter((r) => match(r)), [ALL, match]);

  const sorted = useMemo(() => {
    const a = [...rows];
    if (sort === "pri") a.sort((x, y) => rank(PRI_ORDER)(x.pri) - rank(PRI_ORDER)(y.pri) || x.id - y.id);
    else if (sort === "date") a.sort((x, y) => monthValue(y).localeCompare(monthValue(x)) || y.id - x.id);
    else if (sort === "open") a.sort((x, y) => x.closed - y.closed || rank(PRI_ORDER)(x.pri) - rank(PRI_ORDER)(y.pri));
    else if (sort === "new") a.sort((x, y) => (y.isNew ? 1 : 0) - (x.isNew ? 1 : 0) || x.id - y.id);
    else a.sort((x, y) => y.id - x.id);
    return a;
  }, [rows, sort]);

  /* النظرة العامة تعرض السجل كامل دائمًا — بلا تأثير من فلاتر لوحة المتابعة */
  const overview = useMemo(() => {
    const tot = ALL.length;
    const byS = {}; cats.sta.forEach((s) => (byS[s] = ALL.filter((r) => r.sta === s).length));
    const byP = {}; cats.pri.forEach((p) => (byP[p] = ALL.filter((r) => r.pri === p).length));
    const zc = {}; ZONES.forEach((z) => (zc[z.key] = 0));
    ALL.forEach((r) => (zc[r.zone] = (zc[r.zone] || 0) + 1));
    const ok = byS["معتمدة"] || 0, no = byS["تم الرفض"] || 0;
    let cum = 0;
    const tl = cats.months.map((m) => {
      const inM = ALL.filter((r) => r.month === m);
      cum += inM.length;
      const o = { m: trMonth(lang, m), "تراكمي": cum };
      cats.sta.forEach((s) => (o[s] = inM.filter((r) => r.sta === s).length));
      return o;
    });
    return { tot, byS, byP, zc, rate: ok + no ? Math.round((ok / (ok + no)) * 100) : 0, tl };
  }, [ALL, cats, lang]);

  const latest = useMemo(() =>
    [...ALL].sort((a, b) => monthValue(b).localeCompare(monthValue(a)) || b.id - a.id).slice(0, 3), [ALL]);

  const activeChips = useMemo(() => {
    const out = [];
    if (f.q) out.push({ k: "q", l: `${L("بحث:", "Search:")} ${f.q}` });
    if (f.zone) out.push({ k: "zone", l: trZone(lang, f.zone) });
    if (f.sta) out.push({ k: "sta", l: trSta(lang, f.sta) });
    if (f.pri) out.push({ k: "pri", l: trPri(lang, f.pri) });
    if (f.model) out.push({ k: "model", l: trModel(lang, f.model) });
    if (f.own) out.push({ k: "own", l: trOwn(lang, f.own) });
    if (f.mon) out.push({ k: "mon", l: trMonth(lang, f.mon) });
    if (f.meeting) out.push({ k: "meeting", l: trMeeting(lang, f.meeting) });
    if (f.open) out.push({ k: "open", l: L("مفتوحة فقط", "Open only") });
    if (f.fresh) out.push({ k: "fresh", l: L("الجديد فقط", "New only") });
    return out;
  }, [f, lang]);

  const copySummary = async () => {
    const lines = [
      L("سجل استفسارات الملاك", "Owner Inquiries Log"),
      data.updatedAt ? `${L("آخر تحديث:", "Last updated:")} ${fmtDate(data.updatedAt)}${data.label ? " — " + data.label : ""}` : "",
      "",
      `${L("الإجمالي:", "Total:")} ${ALL.length}`,
      `${L("معتمدة:", "Approved:")} ${overview.byS["معتمدة"] || 0}`,
      `${L("مرفوضة:", "Rejected:")} ${overview.byS["تم الرفض"] || 0}`,
      `${L("ما زالت مفتوحة:", "Still open:")} ${openCount}`,
      "",
    ];
    if (newCount) {
      lines.push(`${L("الجديد هذا التحديث", "New in this update")} (${newCount}):`);
      ALL.filter((r) => r.isNew).forEach((r) => lines.push(`• [${trSta(lang, r.sta)}] ${trNote(lang, r).slice(0, 110)}`));
      lines.push("");
    }
    const openItems = ALL.filter((r) => !r.closed);
    if (openItems.length) {
      lines.push(`${L("بنود ما زالت مفتوحة", "Items still open")} (${openItems.length}):`);
      openItems.forEach((r) => lines.push(`• ${trNote(lang, r).slice(0, 110)}`));
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true); setTimeout(() => setCopied(false), 1650);
    } catch { /* المتصفح منع النسخ */ }
  };

  return (
    <ThemeCtx.Provider value={{ T, mode, setMode, resolved }}>
      <LangCtx.Provider value={{ lang, setLang }}>
      <div dir={lang === "ar" ? "rtl" : "ltr"} className="dash" style={{ minHeight: "100%" }}>
        <style>{`
@import url('https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@400..600&display=block');
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

.dash{font-family:'IBM Plex Sans Arabic',system-ui,'Segoe UI',Tahoma,sans-serif;-webkit-font-smoothing:antialiased;
  background:${T.bg};color:${T.paper};transition:background .3s ease,color .3s ease;}
.dash ::selection{background:${T.brass}33;}
.mono{font-family:'IBM Plex Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;direction:ltr;display:inline-block;}
.disp{font-family:'Reem Kufi','IBM Plex Sans Arabic',sans-serif;}
.wrap{max-width:1120px;margin:0 auto;padding:18px 16px 40px;}
@media(min-width:768px){.wrap{padding:30px 28px 56px;}}

.surf{background:${T.surface};border-radius:18px;box-shadow:${T.shadow};}
.eyebrow{font-size:11.5px;color:${T.muted};}
.sec-t{font-family:'Reem Kufi',sans-serif;font-size:16.5px;color:${T.paper};}
.sec-lbl{font-size:11.5px;color:${T.muted};margin-bottom:9px;}

.head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;}
.h1{font-size:clamp(23px,5.2vw,33px);line-height:1.3;margin:6px 0 0;word-spacing:.22em;}
.meta-line{display:flex;flex-wrap:wrap;align-items:center;gap:9px;font-size:12px;color:${T.muted};margin-top:14px;}
.dot{width:3px;height:3px;border-radius:50%;background:${T.faint};display:inline-block;flex:none;}
.acts{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}

.seg{display:inline-flex;gap:2px;padding:3px;border-radius:11px;background:${T.sunken};}
.seg-b{display:inline-flex;align-items:center;justify-content:center;width:30px;height:26px;border:none;border-radius:8px;
  background:transparent;color:${T.muted};cursor:pointer;transition:.18s;}
.seg-b:hover{color:${T.paper};}
.seg-b-txt{width:auto;padding:0 10px;font-size:11.5px;font-weight:600;font-family:inherit;}

/* خانات التنقّل */
.tabs{position:sticky;top:0;z-index:20;display:flex;gap:6px;padding:10px 16px;margin:18px -16px 16px;
  background:${T.bg};}
@media(min-width:768px){.tabs{padding:10px 28px;margin:18px -28px 16px;}}
.tab{display:inline-flex;align-items:center;gap:8px;padding:11px 18px;border-radius:13px;border:1px solid ${T.line};
  background:${T.surface};color:${T.muted};font-family:inherit;font-size:14px;cursor:pointer;transition:.18s;}
.tab:hover{color:${T.paper};}
.tab[data-on="1"]{background:${T.brass};border-color:${T.brass};color:${T.onAccent};box-shadow:${T.shadow};}
.tab-n{font-size:11.5px;padding:2px 8px;border-radius:999px;background:${T.sunken};color:${T.muted};}
.tab[data-on="1"] .tab-n{background:rgba(255,255,255,.22);color:${T.onAccent};}
.tab-indicator{position:absolute;bottom:4px;height:3px;border-radius:3px;background:${T.brass};
  transition:left .32s cubic-bezier(.22,.9,.34,1),width .32s cubic-bezier(.22,.9,.34,1);pointer-events:none;}

/* تلاشي هادئ عند تبديل محتوى التبويب */
.tab-panel{animation:tabFadeIn .3s ease both;}
@keyframes tabFadeIn{from{opacity:0;}to{opacity:1;}}

/* ═══ إيفكتات v1.5.0 ═══ */

/* نبضة عند فتح استفسار — وميض لوني خفيف يمر على البطاقة */
.pulse-host{position:relative;overflow:hidden;}
.pulse-host::after{content:"";position:absolute;inset:0;background:${T.brass};opacity:0;
  pointer-events:none;border-radius:inherit;}
.pulse-host.pulsed::after{animation:pulseFlash .55s ease-out;}
@keyframes pulseFlash{0%{opacity:.16;}100%{opacity:0;}}

/* توهج شارة "الجديد" */
.chip-glow{animation:badgeGlow 2.6s ease-in-out infinite;}
@keyframes badgeGlow{
  0%,100%{box-shadow:0 0 0 0 transparent;}
  50%{box-shadow:0 0 0 4px ${T.brass}26;}
}

/* انتقال بطاقات ↔ جدول */
.view-swap{animation:viewIn .3s cubic-bezier(.22,.9,.34,1) both;}
@keyframes viewIn{from{opacity:0;transform:scale(.985);}to{opacity:1;transform:scale(1);}}

/* هيكل تحميل (Skeleton) */
.skel{background:linear-gradient(90deg,${T.sunken} 25%,${T.surface} 50%,${T.sunken} 75%);
  background-size:200% 100%;animation:skelSlide 1.3s infinite;border-radius:8px;}
@keyframes skelSlide{0%{background-position:200% 0;}100%{background-position:-200% 0;}}
.skel-line{height:12px;margin-bottom:9px;}

/* رسم الحلقات تدريجيًا (الدائرة + حلقات المراحل) */
.ring-fg{transition:stroke-dashoffset 1.25s cubic-bezier(.22,.9,.34,1);}
.rings{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-bottom:20px;
  padding-bottom:18px;border-bottom:1px solid ${T.lineSoft};}
.ring-i{text-align:center;flex:0 0 auto;width:74px;}
.ring-s{transform:rotate(-90deg);}
.ring-l{font-size:10.5px;color:${T.muted};margin-top:2px;line-height:1.4;}

/* تأكيد النسخ — شريط ينزلق داخل الزر */
.copy-host{position:relative;overflow:hidden;}
.copy-ok{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:6px;
  background:${T.sta["معتمدة"]};color:#fff;font-size:12.5px;transform:translateY(100%);pointer-events:none;}
.copy-ok.show{animation:copyUp 1.6s cubic-bezier(.22,.9,.34,1) both;}
@keyframes copyUp{
  0%{transform:translateY(100%);}
  14%,78%{transform:translateY(0);}
  100%{transform:translateY(-100%);}
}

/* نبض الفلتر المختار */
.chip{transition:all .22s cubic-bezier(.22,.9,.34,1);}
.chip[data-on="1"]{transform:scale(1.04);}

/* قفزة الرقم عند تغيّره */
.tick-n{display:inline-block;}
.tick-n.bump{animation:tickBump .45s cubic-bezier(.22,.9,.34,1);}
@keyframes tickBump{0%{transform:translateY(0);}35%{transform:translateY(-6px);opacity:.5;}100%{transform:translateY(0);}}

/* حالة السجل */
.stats{padding:22px 20px;margin-bottom:14px;}
.stats-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px;}
.hero{display:flex;align-items:baseline;gap:8px;}
.hero-n{font-size:44px;font-weight:600;line-height:1;color:${T.paper};}
.hero-k{font-size:13px;color:${T.muted};}
.bar{display:flex;height:12px;border-radius:999px;overflow:hidden;gap:2px;background:${T.sunken};}
.bar-s{cursor:pointer;transition:opacity .2s ease,flex 1.1s cubic-bezier(.22,.9,.34,1);}
.legend{display:grid;grid-template-columns:1fr;gap:2px;margin-top:16px;}
@media(min-width:620px){.legend{grid-template-columns:repeat(2,1fr);gap:2px 20px;}}
.lg{display:flex;align-items:center;gap:10px;padding:9px 10px;border:none;background:transparent;border-radius:10px;
  cursor:pointer;font-family:inherit;text-align:start;transition:background .16s;}
.lg:hover{background:${T.sunken};}
.lg-d{width:9px;height:9px;border-radius:3px;flex:none;}
.lg-l{flex:1;font-size:13px;color:${T.paper};}
.lg-n{font-size:14px;font-weight:600;color:${T.paper};}
.lg-p{font-size:11.5px;color:${T.faint};min-width:34px;text-align:left;}
.stats-foot{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:18px;padding-top:16px;
  border-top:1px solid ${T.lineSoft};font-size:12px;color:${T.muted};}
.ff{background:none;border:none;font-family:inherit;font-size:12px;color:${T.muted};cursor:pointer;padding:0;}
.ff:hover{color:${T.brass};}
.ff-static{color:${T.muted};}

.prow{display:block;width:100%;text-align:start;padding:10px 11px;border:none;background:transparent;border-radius:11px;
  cursor:pointer;font-family:inherit;transition:background .16s;}
.prow:hover{background:${T.sunken};}
.prow-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;}
.prow-l{font-size:13px;}
.prow-n{font-size:14px;font-weight:600;}
.pbar{height:6px;border-radius:999px;background:${T.sunken};overflow:hidden;}
.pbar>div{height:100%;border-radius:999px;transition:width .55s cubic-bezier(.2,.7,.3,1),opacity .2s;}

/* أحدث الملاحظات في النظرة العامة */
.latest{display:grid;grid-template-columns:1fr;gap:2px;}
.lrow{display:flex;align-items:flex-start;gap:11px;padding:13px 11px;border:none;background:transparent;
  border-radius:12px;cursor:pointer;font-family:inherit;text-align:start;transition:background .16s;}
.lrow:hover{background:${T.sunken};}
.lrow+.lrow{border-top:1px solid ${T.lineSoft};}
.lrow-d{width:8px;height:8px;border-radius:3px;margin-top:6px;flex:none;}
.lrow-t{flex:1;min-width:0;}
.lrow-n{font-size:13.5px;line-height:1.75;color:${T.paper};display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.lrow-m{font-size:11.5px;color:${T.muted};margin-top:5px;}

.chip{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:999px;font-size:12px;
  border:1px solid ${T.line};background:${T.surface};color:${T.muted};transition:all .18s ease;cursor:pointer;font-family:inherit;}
.chip:hover{color:${T.paper};border-color:${T.faint};}
.chip-n{font-size:10.5px;opacity:.9;}
.fchip{display:inline-flex;align-items:center;gap:7px;padding:6px 12px;border-radius:999px;font-size:12px;
  background:${T.brass}1A;color:${T.brass};border:none;font-family:inherit;cursor:pointer;}
.fchip:hover{background:${T.brass}2E;}

.sel-wrap{position:relative;display:inline-flex;align-items:center;}
.sel{appearance:none;background:${T.surface};border:1px solid ${T.line};color:${T.paper};font-size:12px;
  padding:8px 30px 8px 26px;border-radius:11px;font-family:inherit;cursor:pointer;max-width:210px;}
.sel:focus{outline:2px solid ${T.brass}66;outline-offset:1px;}
.sel option{background:${T.surface};color:${T.paper};}
.sel-ic{position:absolute;right:10px;color:${T.muted};pointer-events:none;}
.sel-ch{position:absolute;left:8px;color:${T.muted};pointer-events:none;}

.srch{width:100%;background:${T.surface};border:1px solid ${T.line};border-radius:13px;
  padding:13px 40px 13px 36px;color:${T.paper};font-size:14.5px;font-family:inherit;}
.srch::placeholder{color:${T.faint};}
.srch:focus{outline:none;border-color:${T.brass}88;box-shadow:0 0 0 3px ${T.brass}1A;}

.icon-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 12px;border-radius:11px;
  border:1px solid ${T.line};background:${T.surface};color:${T.muted};font-size:12px;cursor:pointer;transition:.18s;font-family:inherit;}
.icon-btn:hover{color:${T.paper};border-color:${T.faint};}
.icon-btn[data-primary="1"]{color:${T.onAccent};background:${T.brass};border-color:${T.brass};}
.icon-btn[data-primary="1"]:hover{color:${T.onAccent};filter:brightness(1.07);}
.big-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:16px;padding:14px;
  border-radius:13px;border:none;background:${T.brass};color:${T.onAccent};font-size:14px;font-family:inherit;cursor:pointer;transition:.18s;}
.big-btn:hover{filter:brightness(1.07);}
.wide-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:14px;padding:13px;
  border-radius:13px;border:1px solid ${T.line};background:${T.surface};color:${T.brass};font-size:13.5px;font-family:inherit;cursor:pointer;transition:.18s;}
.wide-btn:hover{border-color:${T.brass};background:${T.brass}0F;}

.note-box{margin-top:14px;padding:12px 14px;border-radius:12px;background:${T.sunken};color:${T.muted};font-size:12px;line-height:1.85;}

.stamp{display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-size:12px;color:${T.muted};
  background:${T.sunken};border-radius:13px;padding:11px 15px;margin-top:16px;}

.cards{display:grid;grid-template-columns:1fr;gap:11px;}
@media(min-width:900px){.cards{grid-template-columns:repeat(2,1fr);}}
.card{text-align:start;padding:17px 18px;border-radius:16px;background:${T.surface};box-shadow:${T.shadow};
  border-right:3px solid transparent;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease;}
.card:hover{transform:translateY(-2px);box-shadow:${T.shadowUp};}
.card:focus-visible{outline:2px solid ${T.brass};outline-offset:2px;}
.card-top{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:11px;}
.card-id{font-size:11.5px;color:${T.faint};}
.card-sta{display:inline-flex;align-items:center;gap:5px;font-size:12px;margin-right:auto;}
.tag{font-size:11px;color:${T.muted};}
.tag-new{display:inline-flex;align-items:center;gap:3px;color:${T.sta["معتمدة"]};animation:${reduced ? "none" : "tagPulse 2.4s ease-in-out infinite"};}
@keyframes tagPulse{0%,100%{opacity:1;}50%{opacity:.45;}}
.tag-open{color:${T.brass};}
.card-note{font-size:14.5px;line-height:1.95;color:${T.paper};margin-bottom:12px;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.card-foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px;}
.fm{font-size:11.5px;color:${T.muted};}

/* لوحة هدف الشهر الحالي — تتقدّم مع التقويم */
.plan-now{border-inline-start:3px solid ${T.brass};}

/* زر وضع سطح المكتب — يبقى واضحًا وسهل الوصول والصفحة مصغّرة */
.desk-btn{white-space:nowrap;flex:none;}
.desk-btn[data-primary="1"]{box-shadow:${T.shadowUp};}

/* عرض الجدول — الزر يجلس في نهاية سطر النتائج على كل الأجهزة */
.res-row{min-height:34px;}
.view-seg{margin-inline-start:auto;align-self:center;flex:none;}
.tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}
.tbl-wrap::-webkit-scrollbar{height:8px;}
.tbl-wrap::-webkit-scrollbar-track{background:transparent;}
.tbl-wrap::-webkit-scrollbar-thumb{background:${T.faint}55;border-radius:4px;}
.tbl{width:100%;min-width:760px;border-collapse:collapse;font-family:inherit;}
.tbl th{text-align:start;font-weight:500;font-size:11.5px;color:${T.muted};
  padding:14px 14px;border-bottom:1px solid ${T.line};white-space:nowrap;}
.trow{cursor:pointer;transition:background .16s;}
.trow:hover{background:${T.sunken};}
.trow:focus-visible{outline:2px solid ${T.brass};outline-offset:-2px;}
.trow td{padding:13px 14px;border-bottom:1px solid ${T.lineSoft};vertical-align:top;font-size:13px;}
.tbl tbody tr:last-child td{border-bottom:none;}
.td-id{width:46px;}
.tbl td.td-id{font-size:11.5px;color:${T.faint};}
.td-nw{white-space:nowrap;}
.td-sta{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;}
.tbl td.td-note{min-width:300px;color:${T.paper};line-height:1.85;}
.td-note-t{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.td-tags{display:flex;align-items:center;gap:8px;margin-top:7px;}
.tbl td.td-m{font-size:11.5px;color:${T.muted};white-space:nowrap;}

.zrow{display:block;width:100%;text-align:start;padding:9px 11px;border-radius:11px;cursor:pointer;
  font-family:inherit;background:transparent;border:none;transition:background .16s;}
.zrow:hover{background:${T.sunken};}
.zbar{height:3px;border-radius:2px;background:${T.sunken};overflow:hidden;margin-top:7px;}

.tip{background:${T.surface};border-radius:12px;padding:10px 13px;font-size:12px;box-shadow:${T.shadowUp};}
.tip-h{color:${T.muted};margin-bottom:6px;font-size:11.5px;}
.tip-r{display:flex;align-items:center;gap:8px;padding:2px 0;}
.tip-d{width:8px;height:8px;border-radius:3px;}
.tip-l{color:${T.muted};flex:1;}
.tip-v{color:${T.paper};}

.ovl{position:fixed;inset:0;background:${resolved === "dark" ? "rgba(4,10,14,.7)" : "rgba(30,45,58,.34)"};
  backdrop-filter:blur(6px);z-index:60;display:flex;align-items:flex-end;justify-content:center;animation:fade .2s ease;}
@media(min-width:640px){.ovl{align-items:center;padding:24px;}}
.sheet{background:${T.surface};border-radius:22px 22px 0 0;width:100%;max-width:680px;max-height:88vh;
  display:flex;flex-direction:column;box-shadow:${T.shadowUp};animation:up .3s cubic-bezier(.2,.7,.3,1);}
@media(min-width:640px){.sheet{border-radius:20px;}}
.sheet-top{display:flex;align-items:center;justify-content:space-between;padding:17px 19px 15px;}
.sheet-id{font-size:12.5px;color:${T.muted};}
.sheet-body{padding:4px 19px 24px;overflow-y:auto;}
.sheet-body::-webkit-scrollbar{width:8px;}
.sheet-body::-webkit-scrollbar-track{background:transparent;}
.sheet-body::-webkit-scrollbar-thumb{background:${T.faint}66;border-radius:4px;}
.sheet-note{font-size:15.5px;line-height:2.1;margin:0;color:${T.paper};}
.reply-box{background:${T.sunken};border-radius:13px;border-right:3px solid transparent;padding:14px 16px;}
.sheet-reply{font-size:14.5px;line-height:2.1;margin:0;color:${T.paper};}
.meta-list{margin-top:24px;}
.meta-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 2px;}
.meta-row+.meta-row{border-top:1px solid ${T.lineSoft};}
.meta-k{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:${T.muted};}
.meta-v{font-size:13px;color:${T.paper};text-align:left;}

/* تقدم التنفيذ */
.gbar{position:relative;height:10px;border-radius:999px;background:${T.sunken};overflow:hidden;}
.gbar-f{height:100%;border-radius:999px;transition:width 1.1s cubic-bezier(.22,.9,.34,1);position:relative;overflow:hidden;}
.gbar-f::after{content:"";position:absolute;top:0;bottom:0;left:-40%;width:40%;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);opacity:0;}
.gbar-f.in-view::after{animation:gbarShimmer 1.1s ease-in-out .35s 1;}
@keyframes gbarShimmer{0%{left:-40%;opacity:1;}90%{opacity:1;}100%{left:110%;opacity:0;}}
.gbar-t{position:absolute;top:-3px;width:2px;height:16px;border-radius:1px;opacity:.55;}
.gmeta{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:14px;font-size:12.5px;color:${T.muted};}
.gm{display:inline-flex;align-items:baseline;gap:5px;}
.gm-k{color:${T.faint};}
.grow{padding:13px 0;}
.grow+.grow{border-top:1px solid ${T.lineSoft};}
.grow-top{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:9px;}
.grow-l{font-size:13.5px;color:${T.paper};}
.grow-note{font-size:11px;color:${T.faint};margin-right:6px;}
.grow-r{display:inline-flex;align-items:baseline;gap:10px;}
.grow-v{font-size:14.5px;font-weight:600;color:${T.paper};}
.grow-g{font-size:12px;}
.grow-d{font-size:11px;color:${T.faint};margin-top:8px;}
.gb-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;}
.mseg{display:inline-flex;gap:2px;padding:3px;border-radius:11px;background:${T.sunken};flex-wrap:wrap;}
.mseg-b{padding:6px 11px;border:none;border-radius:8px;background:transparent;color:${T.muted};
  font-family:inherit;font-size:11.5px;cursor:pointer;transition:.18s;}
.mseg-b:hover{color:${T.paper};}
.gb-group{margin-top:18px;}
.gb-gt{font-size:11.5px;color:${T.faint};margin-bottom:8px;}
.brow{display:flex;align-items:center;gap:12px;padding:9px 2px;}
.brow+.brow{border-top:1px solid ${T.lineSoft};}
.brow-b{width:26px;flex:none;text-align:center;font-size:12px;color:${T.muted};}
.brow-bar{flex:1;min-width:60px;}
.brow-v{width:58px;flex:none;text-align:left;font-size:13px;font-weight:600;color:${T.paper};}
.brow-d{width:56px;flex:none;text-align:left;font-size:11.5px;}

@keyframes rise{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
@keyframes fade{from{opacity:0;}to{opacity:1;}}
@keyframes up{from{opacity:0;transform:translateY(100%);}to{opacity:1;transform:translateY(0);}}
@media(min-width:640px){@keyframes up{from{opacity:0;transform:translateY(22px);}to{opacity:1;transform:translateY(0);}}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;}}
@media print{.no-print{display:none!important;}.dash{background:#fff;color:#000;}.card,.surf,.stats{box-shadow:none!important;}.tabs{position:static;}}
        `}</style>

        <LegalDisclaimer />

        <div className="wrap">
          <header>
            <div className="head">
              <div className="min-w-0">
                <h1 className="disp h1">{L("استفسارات الملاك", "Owner Inquiries")}</h1>
              </div>
              <div className="acts no-print">
                <LangToggle />
                <ThemeToggle />
                {smallDevice && (
                  <button className="icon-btn desk-btn" onClick={toggleDesk}
                    data-primary={deskOn ? "1" : undefined}
                    aria-pressed={deskOn ? "true" : "false"}>
                    {deskOn ? <Smartphone size={13} /> : <Laptop size={13} />}
                    {deskOn ? L("عرض الجوال", "Mobile view") : L("سطح المكتب", "Desktop")}
                  </button>
                )}
                <button className="icon-btn" onClick={() => setChangelogOpen(true)}><History size={13} /> <span className="mono">{`v${CURRENT_VERSION}`}</span></button>
                <button className="icon-btn copy-host" onClick={copySummary}>
                  <Copy size={13} /> {L("ملخص", "Summary")}
                  {copied && <span className="copy-ok show"><Check size={13} /> {L("تم النسخ", "Copied")}</span>}
                </button>
              </div>
            </div>

            <div className="meta-line">
              <span>{cats.months.length ? `${trMonth(lang, cats.months[0])} — ${trMonth(lang, cats.months[cats.months.length - 1])}` : "—"}</span>
              <span className="dot" />
              <span>{cats.models.map((m) => trModel(lang, m)).join(L("، ", ", "))}</span>
            </div>

            {(loading || data.updatedAt || newCount > 0) && (
              <div className="stamp">
                {loading ? (
                  <span className="skel skel-line" style={{ width: 190, height: 13, margin: 0, display: "inline-block" }} />
                ) : data.updatedAt ? (
                  <>
                    <RefreshCw size={13} />
                    {L("آخر تحديث:", "Last updated:")} <span className="mono">{fmtDate(data.updatedAt)}</span>{data.label ? ` — ${data.label}` : ""}
                  </>
                ) : null}
                {newCount > 0 && (
                  <button className="chip chip-glow" style={{ marginRight: "auto" }} onClick={() => openBoard({ fresh: true, __sort: "new" })}>
                    <Sparkles size={11} /> {L("الجديد", "New")} <span className="mono chip-n">{newCount}</span>
                  </button>
                )}
              </div>
            )}
          </header>

          {/* الخانات */}
          <nav className="tabs no-print" role="tablist" ref={tabsRef}>
            <button className="tab" role="tab" aria-selected={tab === "overview"} data-on={tab === "overview" ? "1" : "0"}
              onClick={() => setTab("overview")}>
              {L("نظرة عامة", "Overview")}
            </button>
            <button className="tab" role="tab" aria-selected={tab === "notes"} data-on={tab === "notes" ? "1" : "0"}
              onClick={() => setTab("notes")}>
              {L("متابعة الملاحظات", "Notes Board")}
              <span className="tab-n mono">{ALL.length}</span>
            </button>
            <button className="tab" role="tab" aria-selected={tab === "progress"} data-on={tab === "progress" ? "1" : "0"}
              onClick={() => setTab("progress")}>
              {L("تقدم التنفيذ", "Progress")}
            </button>
            <span className="tab-indicator" ref={indicatorRef} />
          </nav>

          {tab === "overview" && (
            <div className="tab-panel">
              {/* حالة السجل */}
              <section className="surf stats">
                <div className="stats-top">
                  <div>
                    <div className="sec-t">{L("حالة السجل", "Record Status")}</div>
                    <div className="eyebrow" style={{ marginTop: 4 }}>{L("توزيع القرارات على كامل السجل", "Decision breakdown across the full record")}</div>
                  </div>
                  <div className="hero">
                    <span className="hero-n mono"><CountUp value={overview.tot} onScroll /></span>
                    <span className="hero-k">{L("ملاحظة", "notes")}</span>
                  </div>
                </div>

                <StatusBar cats={cats} overview={overview} staC={staC} trSta={trSta} lang={lang} openBoard={openBoard} L={L} />

                <div className="legend">
                  {cats.sta.map((s) => {
                    const n = overview.byS[s] || 0;
                    const pct = overview.tot ? Math.round((n / overview.tot) * 100) : 0;
                    return (
                      <button key={s} className="lg" onClick={() => openBoard({ sta: s })}>
                        <span className="lg-d" style={{ background: staC(s) }} />
                        <span className="lg-l">{trSta(lang, s)}</span>
                        <span className="lg-n mono"><CountUp value={n} onScroll dur={900} /></span>
                        <span className="lg-p mono"><CountUp value={pct} onScroll dur={900} suffix="٪" /></span>
                      </button>
                    );
                  })}
                </div>

                <div className="stats-foot">
                  <button className="ff" onClick={() => openBoard({ open: true })}>
                    <CountUp value={openCount} onScroll dur={900} /> {L("ما زالت مفتوحة", "still open")}
                  </button>
                  <span className="dot" />
                  <span className="ff-static"><CountUp value={overview.tot - openCount} onScroll dur={900} /> {L("مقفلة", "closed")}</span>
                  <span className="dot" />
                  <span className="ff-static">{L("نسبة الاعتماد من المحسوم", "Approval rate of decided items")} <CountUp value={overview.rate} onScroll dur={900} suffix="٪" /></span>
                </div>
              </section>

              {/* أحدث الملاحظات */}
              <section className="surf" style={{ padding: "20px 18px", marginBottom: 14 }}>
                <div className="sec-t">{L("أحدث الملاحظات", "Latest Notes")}</div>
                <div className="eyebrow" style={{ marginTop: 4, marginBottom: 14 }}>{L("آخر ما أُضيف أو جرى عليه رد", "Most recently added or replied to")}</div>
                <div className="latest">
                  {latest.map((r) => (
                    <button key={r.id} className="lrow" onClick={() => setSel(r)}>
                      <span className="lrow-d" style={{ background: staC(r.sta) }} />
                      <span className="lrow-t">
                        <span className="lrow-n">{trNote(lang, r)}</span>
                        <span className="lrow-m">
                          {trSta(lang, r.sta)} · {trLoc(lang, r.loc)} · {trMonth(lang, r.month)}
                          {r.isNew ? ` · ${L("جديد", "New")}` : ""}{!r.closed ? ` · ${L("مفتوح", "Open")}` : ""}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                <button className="wide-btn" onClick={() => openBoard()}>
                  {L("فتح لوحة المتابعة — كل الملاحظات", "Open Notes Board — All Notes")} <ArrowLeft size={14} />
                </button>
              </section>

              {/* المخطط + المواقع */}
              <section className="surf" style={{ padding: "20px 18px", marginBottom: 14 }}>
                <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: 18 }}>
                  <div className="lg:col-span-2">
                    <div className="sec-t">{L("أين ظهرت الملاحظات؟", "Where did the notes come from?")}</div>
                    <div className="eyebrow" style={{ marginTop: 4 }}>{L("اضغط أي منطقة لعرض ملاحظاتها", "Tap any area to view its notes")}</div>
                    <VillaPlan counts={overview.zc} active={null} onPick={(z) => z && openBoard({ zone: z })} built={built} />
                  </div>
                  <div>
                    <div className="sec-lbl" style={{ marginTop: 4 }}>{L("كل المواقع", "All Locations")}</div>
                    {[...ZONES].sort((a, b) => (overview.zc[b.key] || 0) - (overview.zc[a.key] || 0)).map((z) => {
                      const n = overview.zc[z.key] || 0;
                      const pct = Math.round((n / Math.max(1, overview.tot)) * 100);
                      return (
                        <div key={z.key} role="button" tabIndex={0} className="zrow"
                          onClick={() => n && openBoard({ zone: z.key })}
                          onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && n) { e.preventDefault(); openBoard({ zone: z.key }); } }}
                          style={{ opacity: n === 0 ? 0.45 : 1, cursor: n === 0 ? "default" : "pointer" }}>
                          <div className="flex items-center justify-between gap-2">
                            <span style={{ fontSize: 12.5 }}>{trZone(lang, z.key)}</span>
                            <span className="mono" style={{ fontSize: 12.5, color: T.muted }}>{n}</span>
                          </div>
                          <div className="zbar">
                            <div style={{ width: `${pct}%`, height: "100%", background: T.zone, opacity: .55, transition: "width .5s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* الزمن + الأولوية */}
              <section className="grid grid-cols-1 lg:grid-cols-5" style={{ gap: 14 }}>
                <div className="surf lg:col-span-3" style={{ padding: "20px 16px 12px" }}>
                  <div style={{ paddingRight: 4 }}>
                    <div className="sec-t">{L("مسار الردود والتراكم", "Reply Trend & Cumulative")}</div>
                    <div className="eyebrow" style={{ marginTop: 4, marginBottom: 14 }}>{L("حسب شهر الرد", "By reply month")}</div>
                  </div>
                  <div style={{ height: 250, width: "100%" }}>
                    <ResponsiveContainer>
                      <ComposedChart data={overview.tl} margin={{ top: 6, right: 4, left: -20, bottom: 4 }}>
                        <defs>
                          {cats.sta.map((s, i) => (
                            <linearGradient key={s} id={`bg${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={staC(s)} stopOpacity={0.95} />
                              <stop offset="100%" stopColor={staC(s)} stopOpacity={0.62} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid stroke={T.lineSoft} vertical={false} />
                        <XAxis dataKey="m" reversed={lang === "ar"} tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis orientation="right" tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                        <Tooltip content={<ChartTip />} cursor={{ fill: T.brass + "12" }} />
                        {cats.sta.map((s, i) => (
                          <Bar key={s} dataKey={s} name={trSta(lang, s)} stackId="a" fill={`url(#bg${i})`} maxBarSize={44} isAnimationActive={!reduced} />
                        ))}
                        <Line type="monotone" dataKey="تراكمي" name={L("تراكمي", "Cumulative")} stroke={T.brass} strokeWidth={2.2}
                          dot={{ r: 3, fill: T.surface, stroke: T.brass, strokeWidth: 2 }} isAnimationActive={!reduced} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap items-center" style={{ gap: 14, padding: "6px 4px 4px" }}>
                    {cats.sta.map((s) => (
                      <span key={s} className="flex items-center" style={{ gap: 6, fontSize: 11.5, color: T.muted }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: staC(s), display: "inline-block" }} /> {trSta(lang, s)}
                      </span>
                    ))}
                    <span className="flex items-center" style={{ gap: 6, fontSize: 11.5, color: T.muted }}>
                      <span style={{ width: 13, height: 2, background: T.brass, display: "inline-block" }} /> {L("تراكمي", "Cumulative")}
                    </span>
                  </div>
                </div>

                <div className="surf lg:col-span-2" style={{ padding: 20 }}>
                  <div className="sec-t">{L("حسب الأولوية", "By Priority")}</div>
                  <div className="eyebrow" style={{ marginTop: 4, marginBottom: 18 }}>{L("اضغط أي أولوية لعرض ملاحظاتها", "Tap any priority to view its notes")}</div>
                  {cats.pri.map((p) => {
                    const n = overview.byP[p] || 0;
                    const pct = Math.round((n / Math.max(1, overview.tot)) * 100);
                    const col = T.pri[p] || T.muted;
                    return (
                      <button key={p} className="prow" onClick={() => openBoard({ pri: p })}>
                        <div className="prow-top">
                          <span className="prow-l">{trPri(lang, p)}</span>
                          <span className="prow-n mono" style={{ color: T.muted }}>{n}</span>
                        </div>
                        <div className="pbar"><div style={{ width: `${pct}%`, background: col, opacity: .7 }} /></div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {tab === "notes" && (
            <div className="tab-panel">
              {/* أدوات لوحة المتابعة */}
              <section className="surf no-print" style={{ padding: 18, marginBottom: 16 }}>
                <div className="relative" style={{ marginBottom: 14 }}>
                  <Search size={17} style={{ position: "absolute", right: lang === "ar" ? 14 : "auto", left: lang === "ar" ? "auto" : 14, top: 14, color: T.faint }} />
                  <input className="srch" value={f.q} placeholder={L("ابحث في نص الملاحظة أو الرد…", "Search note or reply text…")}
                    onChange={(e) => { setF((p) => ({ ...p, q: e.target.value })); setLimit(12); }} />
                  {f.q && (
                    <button onClick={() => setF((p) => ({ ...p, q: "" }))} aria-label={L("مسح البحث", "Clear search")}
                      style={{ position: "absolute", left: lang === "ar" ? 12 : "auto", right: lang === "ar" ? "auto" : 12, top: 13, color: T.muted, background: "none", border: "none", cursor: "pointer" }}><X size={16} /></button>
                  )}
                </div>

                <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
                  <Chip on={f.fresh} onClick={() => set("fresh", true)} color={T.sta["معتمدة"]} count={newCount}>{L("الجديد", "New")}</Chip>
                  <Chip on={f.open} onClick={() => set("open", true)} color={T.brass} count={openCount}>{L("مفتوحة", "Open")}</Chip>
                  {cats.sta.map((s) => (
                    <Chip key={s} on={f.sta === s} onClick={() => set("sta", s)} color={staC(s)}
                      count={ALL.filter((r) => r.sta === s).length}>{trSta(lang, s)}</Chip>
                  ))}
                </div>

                <div className="flex flex-wrap items-center" style={{ gap: 8, marginTop: 12 }}>
                  <Select value={sort} onChange={(v) => setSort(v || "id")} placeholder={L("ترتيب", "Sort")} icon={Hash}
                    options={[{ v: "id", l: L("الأرقام: الأحدث أولاً", "Number: newest first") }, { v: "date", l: L("الأحدث أولاً (بالتاريخ)", "Newest first (by date)") }, { v: "new", l: L("الجديد أولاً", "New first") }, { v: "pri", l: L("الأولوية أولاً", "Priority first") }, { v: "open", l: L("المفتوحة أولاً", "Open first") }]} />
                  <Select value={f.pri} onChange={(v) => { setF((p) => ({ ...p, pri: v })); setLimit(12); }} placeholder={L("كل الأولويات", "All priorities")} icon={Layers} options={cats.pri.map((p) => ({ v: p, l: trPri(lang, p) }))} />
                  <Select value={f.model} onChange={(v) => { setF((p) => ({ ...p, model: v })); setLimit(12); }} placeholder={L("كل النماذج", "All models")} icon={Home}
                    options={cats.models.map((m) => ({ v: m, l: `${trModel(lang, m)} (${ALL.filter((r) => r.models.includes(m)).length})` }))} />
                  <Select value={f.zone} onChange={(v) => { setF((p) => ({ ...p, zone: v })); setLimit(12); }} placeholder={L("كل المواقع", "All locations")} icon={Layers}
                    options={ZONES.filter((z) => ALL.some((r) => r.zone === z.key)).map((z) => ({ v: z.key, l: trZone(lang, z.key) }))} />
                  <Select value={f.own} onChange={(v) => { setF((p) => ({ ...p, own: v })); setLimit(12); }} placeholder={L("كل المجيبين", "All engineers")} icon={User} options={cats.owners.map((m) => ({ v: m, l: trOwn(lang, m) }))} />
                  <Select value={f.mon} onChange={(v) => { setF((p) => ({ ...p, mon: v })); setLimit(12); }} placeholder={L("كل الأشهر", "All months")} icon={Calendar} options={cats.months.map((m) => ({ v: m, l: trMonth(lang, m) }))} />
                  {cats.meetings.map((m) => (
                    <Chip key={m} on={f.meeting === m} onClick={() => set("meeting", m)} color={T.zone}>{trMeeting(lang, m)}</Chip>
                  ))}
                </div>

                {activeChips.length > 0 && (
                  <div className="flex flex-wrap items-center" style={{ gap: 8, marginTop: 14 }}>
                    <span style={{ fontSize: 11.5, color: T.muted }}>{L("مُصفّى على:", "Filtered by:")}</span>
                    {activeChips.map((c) => (
                      <button key={c.k} className="fchip"
                        onClick={() => { setF((p) => ({ ...p, [c.k]: c.k === "open" || c.k === "fresh" ? false : c.k === "q" ? "" : null })); setLimit(12); }}>
                        {c.l} <X size={12} />
                      </button>
                    ))}
                    <button className="icon-btn" onClick={reset}><RotateCcw size={12} /> {L("مسح الكل", "Clear all")}</button>
                  </div>
                )}
              </section>

              <div className="flex items-baseline res-row" style={{ gap: 8, marginBottom: 14 }}>
                <span className="sec-t">{L("النتائج", "Results")}</span>
                <span style={{ color: T.brass, fontSize: 15 }}><TickNum value={rows.length} /></span>
                {rows.length !== ALL.length && <span style={{ fontSize: 12, color: T.muted }}>{L(`من ${ALL.length}`, `of ${ALL.length}`)}</span>}
                <ViewToggle view={view} setView={setView} />
              </div>

              {rows.length === 0 ? (
                <div className="surf" style={{ padding: "48px 20px", textAlign: "center" }}>
                  <p style={{ fontSize: 14.5, margin: "0 0 6px" }}>{L("لا توجد ملاحظات مطابقة", "No matching notes")}</p>
                  <p style={{ fontSize: 12.5, color: T.muted, margin: "0 0 18px" }}>{L("أزل أحد الفلاتر لتوسيع النتائج.", "Remove a filter to widen the results.")}</p>
                  <button className="icon-btn" onClick={reset}><RotateCcw size={13} /> {L("مسح كل الفلاتر", "Clear all filters")}</button>
                </div>
              ) : (
                <>
                  {view === "table" ? (
                    <div className="surf tbl-wrap view-swap" key="v-table">
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th className="td-id">#</th>
                            <th>{L("الحالة", "Status")}</th>
                            <th>{L("الأولوية", "Priority")}</th>
                            <th>{L("الملاحظة", "Note")}</th>
                            <th>{L("الموقع", "Location")}</th>
                            <th>{L("النموذج", "Model")}</th>
                            <th>{L("الشهر", "Month")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.slice(0, limit).map((r, i) => <Row key={`${r.id}-${i}`} r={r} onOpen={setSel} />)}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="cards view-swap" key="v-cards">
                      {sorted.slice(0, limit).map((r, i) => <Card key={`${r.id}-${i}`} r={r} i={i} onOpen={setSel} reduced={reduced} />)}
                    </div>
                  )}
                  {limit < sorted.length && (
                    <div className="no-print" style={{ textAlign: "center", marginTop: 18 }}>
                      <button className="icon-btn" onClick={() => setLimit((l) => l + 16)}>
                        <ArrowLeft size={13} /> {L(`عرض ${Math.min(16, sorted.length - limit)} ملاحظة إضافية`, `Show ${Math.min(16, sorted.length - limit)} more notes`)}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === "progress" && (
            <div className="tab-panel">
              <ProgressTab reduced={reduced} data={pg} loading={pgLoading} />
            </div>
          )}

          <div className="no-print" style={{ textAlign: "center", marginTop: 28 }}>
            <button className="mono" onClick={() => setChangelogOpen(true)} style={{
              background: "none", border: "none", cursor: "pointer", fontSize: 11.5, color: T.faint, padding: 4,
            }}>
              v{CURRENT_VERSION}
            </button>
          </div>
        </div>

        <Sheet r={sel} onClose={() => setSel(null)} />
        <ChangelogSheet open={changelogOpen} onClose={() => setChangelogOpen(false)} />
      </div>
      </LangCtx.Provider>
    </ThemeCtx.Provider>
  );
}
