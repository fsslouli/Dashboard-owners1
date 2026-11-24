/* legal-copy.jsx — الإقرار القانوني (انفصل عن سجل الإصدارات 7.16.0 عشان تفاصيل السجل ما تنحمّل مع الموقع العام) */

/* ── إقرار قانوني — يظهر في كل زيارة، بدون تذكّر الموافقة ── */
export const LEGAL_COPY = {
  ar: {
    eyebrow: "قبل ما تكمل",
    title: "تنويه وإخلاء مسؤولية قانونية",
    points: [
      ["طبيعة المنصة", "هذه اللوحة هي مبادرة واجتهاد شخصي وودّي من ممثلي الملاك، ولا تُعد منصة رسمية أو متحدثًا رسميًا باسم أي جهة حكومية، خريطة طريق، أو الشركة المطوّرة."],
      ["طبيعة البيانات", "المعلومات والإحصائيات الواردة في هذه الصفحة هي بيانات استرشادية، مصدرها ما يتوفر للملاك من مراسلات ومواد منشورة واستبيانات داخلية، وهي قابلة للتحديث والتصحيح في أي وقت. لا تُعدّ هذه الصفحة مرجعًا رسميًا، ولا يتحمّل ممثلو الملاك مسؤولية عن دقتها أو اكتمالها أو أي تغيير لاحق عليها."],
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
      ["Nature of the Data", "Information and statistics on this page are indicative. They are based on correspondence, published materials and internal surveys available to the owners, and may be updated or corrected at any time. This page is not an official reference, and the owners' representatives accept no responsibility for its accuracy, completeness or any later changes."],
      ["Disclaimer of Role & Liability", "Owner representatives bear no legal, financial, or administrative liability arising from use of this data, decisions made based on it, or any response or action taken by any party or developer regarding demands or inquiries conveyed."],
    ],
    consent: "By clicking \u201cI Agree,\u201d you acknowledge full awareness of the above and agree to fully release the dashboard administrators from liability.",
    agree: "I Agree",
  },
};
