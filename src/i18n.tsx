import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang } from './types';

const en = {
  appName: 'Daily Journal',
  otherLang: 'العربية',
  greetMorning: 'Good morning',
  greetAfternoon: 'Good afternoon',
  greetEvening: 'Good evening',
  newJournal: 'New day journaling',
  history: 'Journals',
  savedCount: '{n} journals saved',
  privacy: 'Your journals are stored privately on this device.',
  writeTitle: 'Journal your day',
  date: 'Date',
  q1: 'How was your day?',
  q1ph: 'Good, hard, ordinary… in a few words',
  q2: 'How are you today? (Feelings)',
  q2ph: 'Name what you feel right now',
  q3: 'Describe your day. What happened?',
  q3ph: 'Write freely. No one is judging.',
  forgiveTitle: 'I forgive myself for today',
  forgiveHint: 'for anything and everything.',
  forgivePh: 'I forgive myself for…',
  save: 'Save journal',
  saving: 'Saving…',
  saved: 'Saved. Rest well.',
  emptyMsg: 'Write something before saving.',
  saveError: 'Could not save. Try again.',
  editingNote: 'You already journaled this day. You are editing it.',
  historyTitle: 'Your journals',
  search: 'Search your journals',
  noEntries: 'No journals yet. Your first one is waiting.',
  noResults: 'No journals match your search.',
  loading: 'Loading…',
  edit: 'Edit',
  del: 'Delete',
  confirmDelete: 'Delete this journal permanently?',
  exportBtn: 'Export backup',
  importBtn: 'Import backup',
  importDone: 'Imported {n} journals.',
  importFail: 'That file is not a valid backup.',
  ratings: ['Very bad', 'Bad', 'Okay', 'Good', 'Great'],
  phrases: [
    'Be gentle with yourself; you are doing the best you can.',
    'Every day ends, and every ending is a quiet new beginning.',
    'Writing your day is how you truly keep it.',
    'Small steps, taken daily, change a whole life.',
    "You don't have to be perfect to be proud of today.",
    'Let go of today, so tomorrow can arrive lighter.',
    'Peace begins when you listen to your own heart.',
    'Gratitude turns what we have into enough.',
  ],
};

export type Dict = typeof en;

const ar: Dict = {
  appName: 'يومياتي',
  otherLang: 'English',
  greetMorning: 'صباح الخير',
  greetAfternoon: 'نهارك سعيد',
  greetEvening: 'مساء الخير',
  newJournal: 'تدوين يوم جديد',
  history: 'اليوميات',
  savedCount: '{n} يومية محفوظة',
  privacy: 'تُحفظ يومياتك بخصوصية على هذا الجهاز.',
  writeTitle: 'دوّن يومك',
  date: 'التاريخ',
  q1: 'كيف كان يومك؟',
  q1ph: 'جيد، صعب، عادي… بكلمات قليلة',
  q2: 'كيف حالك اليوم؟ (المشاعر)',
  q2ph: 'سمِّ ما تشعر به الآن',
  q3: 'صف يومك. ماذا حدث؟',
  q3ph: 'اكتب بحرية، لا أحد يحاسبك.',
  forgiveTitle: 'أسامح نفسي على اليوم',
  forgiveHint: 'على كل شيء وأي شيء.',
  forgivePh: 'أسامح نفسي على…',
  save: 'حفظ اليومية',
  saving: 'جارٍ الحفظ…',
  saved: 'تم الحفظ. نم قرير العين.',
  emptyMsg: 'اكتب شيئًا قبل الحفظ.',
  saveError: 'تعذّر الحفظ. حاول مرة أخرى.',
  editingNote: 'دوّنت هذا اليوم من قبل. أنت تعدّله الآن.',
  historyTitle: 'يومياتك',
  search: 'ابحث في يومياتك',
  noEntries: 'لا توجد يوميات بعد. أول يومية في انتظارك.',
  noResults: 'لا توجد يوميات مطابقة للبحث.',
  loading: 'جارٍ التحميل…',
  edit: 'تعديل',
  del: 'حذف',
  confirmDelete: 'حذف هذه اليومية نهائيًا؟',
  exportBtn: 'تصدير نسخة احتياطية',
  importBtn: 'استيراد نسخة احتياطية',
  importDone: 'تم استيراد {n} يومية.',
  importFail: 'هذا الملف ليس نسخة احتياطية صالحة.',
  ratings: ['سيئ جدًا', 'سيئ', 'عادي', 'جيد', 'رائع'],
  phrases: [
    'ارفق بنفسك، فأنت تبذل ما في وسعك.',
    'كل يوم ينتهي، وكل نهاية بداية هادئة جديدة.',
    'حين تكتب يومك فأنت تحفظه حقًا.',
    'الخطوات الصغيرة كل يوم تغيّر حياة كاملة.',
    'لا يلزمك الكمال لتفخر بيومك.',
    'دع يومك يمضي ليأتي غدك أخف.',
    'السلام يبدأ حين تُصغي إلى قلبك.',
    'الامتنان يجعل ما نملك كافيًا.',
  ],
};

const dicts: Record<Lang, Dict> = { en, ar };

interface I18nValue { lang: Lang; setLang: (l: Lang) => void; t: Dict }
const Ctx = createContext<I18nValue | null>(null);

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('lang');
    if (saved === 'en' || saved === 'ar') return saved;
  } catch { /* storage unavailable */ }
  return navigator.language.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = dicts[lang].appName;
    try { localStorage.setItem('lang', lang); } catch { /* ignore */ }
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t: dicts[lang] }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
