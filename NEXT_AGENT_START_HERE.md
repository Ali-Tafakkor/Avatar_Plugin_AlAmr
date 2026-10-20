# نقطهٔ شروع ایجنت بعدی — آواتار ترکیبی

**وضعیت جاری ۲۰۲۶/۱۰/۲۰:** مالک اکنون آماده‌سازی برای الامر و ثبت در Git را مجاز کرده است؛ محدودیت آماده‌سازی مرحلهٔ قبلی لغو شده. ابتدا [گزارش آماده‌سازی 0.1.2](AVATAR_HYBRID_RELEASE_PREPARATION_FA.md) را بخوانید. نسخهٔ پیشنهادی Plugin `AvatarHybrid` است، با رابط‌های سازگار `Avatar03` و `AvatarWebV2`. منبع پذیرفته‌شدهٔ آزمایش حفظ شده؛ پرداخت چهره/حرکت و تست دیداری تازه مجاز نیست. نتیجهٔ واقعی بررسی، Git و Registry را از گزارش جاری بخوانید؛ بندهای بعد سابقه‌اند.

فایل‌ها آماده‌اند: Plugin در `آواتار`، میزبان تولید در `avatar-lab/src/App.tsx`، کیت مستقل در `releases/avatar-hybrid-0.1.2`. بررسی ریپو ۲۸/۱۲ و کپی مستقل ۲۶/۱۲ آزمون موفق دارد؛ artifact معتبر است و فقط اتصال حساب/وضعیت نسخهٔ Registry تأیید نشده. برای build bump نکنید؛ برای ارسال واقعی، مجوز و status زنده لازم است. نسخهٔ 0.1.1 و آزمایش پذیرفته‌شده را دست‌نخورده نگه دارید.

## سابقهٔ مرحلهٔ محلی، پیش از دستور ۲۰ اکتبر

**مرحلهٔ دوم پذیرفته شده و کار متوقف است.** مالک پس از مشاهده گفت «خروجی رو دارم میبینم، خیلی خوب شده، برای مرحله فعلی کافیه». محیط فعلی را حفظ کنید؛ تست یا تغییر بیشتر، Git و آماده‌سازی انتشار انجام نشود. ابتدا [گزارش مرحلهٔ دوم](AVATAR_HYBRID_PHASE2_FA.md) و دستور تازهٔ مالک را مبنای ادامه قرار دهید. توضیحات بعد، سابقهٔ ساخت و بررسی همین تحویل‌اند.

**نمونهٔ مرحلهٔ دوم با چهرهٔ تازه آمادهٔ بازخورد مالک است؛ فقط محلی.** مالک پس از دیدن آشفتگی انتقال مستقیم صورت، چهرهٔ تازه با مرجع تصویری V1 و سیستم احساسات V2 را مجاز کرد. بدن/لباس و هشت حرکت V1، پرش V2، هر ۶۶ morph صورت و گردن پویا حفظ شده‌اند؛ صورت کپی دقیق V1 نیست. ابتدا [گزارش مرحلهٔ دوم](AVATAR_HYBRID_PHASE2_FA.md) را بخوانید. مسیر فعال `avatar-lab/experiments/hybrid-v2-face` با `head-mount.mjs`، `sculpted-face.mjs` و `HybridTestApp.tsx` است؛ `face-transfer.mjs` آزمایش کنارگذاشته‌شده است. ۱۵ آزمون و رندر واقعی ثبت‌اند؛ خروجی عادی `dist-hybrid-test` با preview `pv_39b6cdd6087d482599402d080ab7ed0b` ready و باز گذاشته شد. ادامه از بازخورد مالک، با حفظ منابع و مرحلهٔ اول؛ Git/انتشار آماده نشود.

## سابقهٔ مرحلهٔ اول

به‌روزرسانی: ۲۰۲۶/۱۰/۱۹، تهران. **دستور جاری، اصلاح تماس پاشنه و حالت راحت انگشت‌ها در نمونهٔ انتقال حرکت است.** دو لایهٔ محلی با ۱۵ آزمون موفق و هفت capture پس از اصلاح، عددی و دیداری بررسی شده‌اند؛ خروجی عادی تازه برای بررسی مالک باز است و تأیید نهایی او هنوز ثبت نشده. مرجع [گزارش مرحلهٔ اول حرکت](AVATAR_MOTION_PHASE1_FA.md) است. بخش دوم، صورت و لباس، هنوز آغاز نشده؛ Git و آماده‌سازی انتشار در این بخش مجاز نیستند.

اصلاح کفش با `foot-contact.mjs` و حالت هر پنج انگشت دو دست در Stand/Walk/Run با `relaxed-hands.mjs` پس از retarget خام اعمال می‌شوند. HandRaise از اصلاح دست معاف است و لایه‌ها در `jumpWeight > 0` اعمال نمی‌شوند. [۱۵ آزمون](avatar-lab/experiments/v1-motion/evidence/heel-hands-fix/tests-final.log) موفق‌اند؛ [ممیزی پس از اصلاح](avatar-lab/experiments/v1-motion/evidence/heel-hands-fix/posture-after.json) در پنج فاز Stand فاصلهٔ پاشنه را حدود ۰٫۸۰۰۷ میلی‌متر ثبت می‌کند، در برابر حداکثر حدود ۱۵٫۸ میلی‌متر در [نسخهٔ پیشین](avatar-lab/experiments/v1-motion/evidence/heel-hands-fix/posture-before.json). هفت تصویر پسین شامل پاشنه، دو دست، تمام بدن، Walk، HandRaise و Sitting بازبینی شدند: شکاف شناور پاشنه رفع شده و هر پنج انگشت دو دست بدون تقاطع آشکار، راحت دیده می‌شوند. تصاویر قبل/بعد و رسیدها در `evidence/heel-hands-fix/` هستند؛ این مرور ایجنت با پذیرش نهایی مالک جداست.

آخرین خروجی عادی اصلاح‌شده هنگام تحویل باز است: `pv_f7e9bf54cb644a819386b38ffe0fb76a` با digest برابر `sha256:cbb6680cd4c0b7970d2bfdd52161ec597df5d6d070087f3bec2f456b3e606021`. [تصویر](avatar-lab/experiments/v1-motion/evidence/heel-hands-fix/normal-final.jpg)، [رسید اجرا](avatar-lab/experiments/v1-motion/evidence/heel-hands-fix/normal-dev.json) و [راستی‌آزمایی ready](avatar-lab/experiments/v1-motion/evidence/heel-hands-fix/normal-verify.json) همان نسخه محفوظ‌اند؛ validate و doctor موفق‌اند.

## ابتدا چه بخوانید

۱. `AGENTS.md` و بخش جاری `PROJECT_HANDOFF.md`.
۲. [مرحلهٔ اول: حرکت و مرز آزمون](AVATAR_MOTION_PHASE1_FA.md)، [طرح ادغام و معیارهای صورت/بدن](AVATAR_HYBRID_DESIGN_FA.md)، سپس [روند پروژه](PROJECT_HISTORY_FA.md) و [نمایهٔ اسناد](DOCUMENTATION_INDEX_FA.md).
۳. [گزارش مقایسه و اصلاح V1](AVATAR_COMPARISON_TEST_FA.md)، [اصلاح حرکت V2](AVATAR_V2_LOCAL_TEST_FA.md) و [بستهٔ انتشار](AVATAR_V2_RELEASE_PREPARATION_FA.md).
۴. پیش از تغییر هر محصول، AGENTS.md، skill الامر و مستندات دقیق Player Rig در همان محصول.

## منابع معتبر فعلی

| مسیر | نقش |
| --- | --- |
| `آواتار/` | Plugin اصلیِ قابل ساخت و انتخاب در الامر؛ نسخهٔ فنی `0.1.1` |
| `avatar-lab/` | میزبان فعلی مقایسهٔ V1 و V2؛ خروجی پذیرفته‌شده در `dist` |
| `avatar-lab/experiments/v1-motion/` | آزمایش جاری انتقال حرکت؛ runtime، آزمون‌ها و شواهد محلی |
| `avatar-lab/dist-motion-test/` و `avatar-lab/dist-motion-review/` | خروجی عادی مستقل و خروجی مرور داخلی؛ جایگزین `dist` پذیرفته‌شده نیستند |
| `releases/avatar-web-v2-0.1.1/` | کپی قابل انتقال Plugin و میزبان؛ در تحویل ۱۹ اکتبر با مقایسه هماهنگ شد |
| `Avatar_V2_WebBase/AvatarRuntime/` | مرجع استخراج خصوصی/محلی؛ میزبان فعلی از Plugin اصلی استفاده می‌کند |
| `Avatar_V2_WebBase/AvatarMotionLab/` | ورودی اصلی مالک؛ کد آن حفظ شده و cache مدل/vendor آن وارد Git نمی‌شود |
| `source/` و `AlAmr-Avatar03-Environment_2/` | منابع اصلی چهار آواتار و محیط تحویل‌شده؛ تغییر ندهید |
| `versions/avatar-plugin-0.1.0/` | snapshot بازیابی Plugin پیش از انتقال V2 |
| `versions/avatar-lab-single-avatar-delivery-2026-10-17/` | منبع میزبان تک‌آواتار، قبل از هماهنگی تحویل Git با محیط مقایسه |

## مبنای پذیرفته‌شده پیش از آزمایش جاری

هر دو آواتار در همان صحنهٔ قبلی نمایش داده می‌شوند. تنها یک Player Rig رسمی نسخهٔ ۱٫۰٫۰، ورودی و دوربین را به نسخهٔ انتخاب‌شده می‌دهد. هر مدل، موقعیت و نمونهٔ مستقل دارد. دکمهٔ تعویض یا V کنترل را جابه‌جا می‌کند؛ R بازگشت هر دو، H نمای فیلم و Esc بازگشت پنل است. W/A/S/D، Shift، Space و F برقرارند.

V2 با export واقعی `AvatarWebV2` بارگذاری می‌شود: ۷۳ مفصل، ۶۶ کانال صورت، اصلاح کفش و زانو و حرکت ورزشی. سرعت راه‌رفتن/دویدن V2 برابر ۲٫۲۵/۶٫۲ متر بر ثانیه است. V1 همان مدل دارای ۴۱ مفصل و نه کلیپ است؛ سرعت پیش‌فرض اصلی آن ۵/۹ باقی مانده است.

ظاهر دو بدن روی هم در V1 از alpha BLEND و نبود depth write بود. `avatar-lab/src/LegacyComparisonAvatar.tsx` و `legacy-preview.mjs` فقط متریال clone نمونهٔ تست را اصلاح می‌کنند. GLB، بافت، اسکلت و انیمیشن منبع تغییر نکردند. این اصلاح مخصوص میزبان است؛ API قدیمی Plugin را خودکار تغییر نداده‌ایم.

## سابقهٔ شواهد انتقال حرکت پیش از اصلاح جاری

در ۱۹ اکتبر، هشت آزمون مستقل انتقال حرکت موفق شدند. مشکل viewport خاکستری رفع شد و [تصویر مالک](avatar-lab/experiments/v1-motion/evidence/user-visible-standing.png) و [capture رسمی ایستاده](avatar-lab/experiments/v1-motion/evidence/inspection-01.jpg) رندر هر دو آواتار را نشان می‌دهند. preview ایستادهٔ ثبت‌شده `pv_a02fc066139d4366886d8c1136c6977d` با digest برابر `sha256:5629af3009357debf9a4d8fc26191e579cd73f7f7d4bd84428bce69582625541` رسماً ready است. ۱۳ capture بعدی، هفت حرکت غیرStand از روبه‌رو، چهار نیم‌رخ و دو احساس لبخند/تعجب را پوشش می‌دهند؛ تصاویر `review-*.jpg` با رسیدهای `-dev-final.json` و `-capture.json` در `avatar-lab/experiments/v1-motion/evidence/` هستند.

[probe زندهٔ Walk](avatar-lab/experiments/v1-motion/evidence/body-probe-walk.jpg) در نسخهٔ پیش از اصلاح جاری، اختلاف نُه بردار اندام مرجع/منبع و مرجع/مقصد را پس از حذف تبدیل ریشه، با دقت نمایش `0.000°` نشان می‌دهد؛ preview آن `pv_d4903497f9254c8eb6ef19f8fa154c3d` با digest برابر `sha256:b0c25ffe29adb9b2179b38e43645ecd821e6d5c5a4c25325f28e710d34c77613` است. این تطابق، یکسان بودن silhouette را ثابت نمی‌کند؛ زاویهٔ دید دو مدل حدود ±۱۲ درجه متفاوت و برخی نماهای نیم‌رخ دارای هم‌پوشانی‌اند. در آن نسخه سه انگشت میانی/حلقه/کوچک V2 در rest می‌ماندند؛ این محدودیت اکنون در Stand/Walk/Run با لایهٔ حالت راحت هر پنج انگشت جایگزین شده است. پس از مجوز تازهٔ مالک، کنترل native کار کرد و پرش و بازگشت به ایستادن دیده شد؛ capture ثابت اوج پرش نداریم و حفظ دقیق pose هر ۷۳ bone با آزمون تطبیقی سنجیده شده است. پذیرش نهایی کیفیت همچنان باز است.

خروجی عادی پیش از اصلاح پاشنه و دست با preview `pv_3fc0d90c3bf14ecfb48a3846a0296bdc` و digest برابر `sha256:5e403f6f4aef9348594da806cddd33f34a9c0945af7c5b22e44ee3c9decd37bd` باز گذاشته شده بود. [تصویر](avatar-lab/experiments/v1-motion/evidence/normal-final.jpg)، [رسید اجرا](avatar-lab/experiments/v1-motion/evidence/normal-dev-final.json) و [راستی‌آزمایی ready](avatar-lab/experiments/v1-motion/evidence/normal-final-verify.json) همان نسخه محفوظ‌اند؛ validate و doctor همان ساخت موفق‌اند. این رسید، build دارای اصلاح تازه را تأیید نمی‌کند.

در ۱۷ اکتبر، ۲۳ آزمون Plugin و ۸ آزمون میزبان، ساخت TypeScript/Vite و بررسی رسمی پروژه موفق بودند. پیش‌نمایش پذیرفته‌شدهٔ آن تحویل `pv_c8063d95e1664f7180d0cb11bc5111f7` با digest `sha256:1c6f987f0ae967bb4a975d4d64513f4511a764af5588ecec2d2f880ff863ce02` ready و capture شد. تصویر و رسید در `docs/tests/2026-10-17-avatar-comparison/` هستند.

مالک گفت: «تست کافیه، همه چیز بنظر خوب میرسه». برای تحویل Git تست تصویری یا عملکردی تکرار نشد. در تغییرات آینده، آزمون متناسب با همان تغییر را انجام دهید؛ صرفاً برای بازسازی تأیید قبلی، کلاینت یا مرورگر تازه باز نکنید. بازبودن پنجره در ۱۷ اکتبر، شاهد بازبودن آن در روز اجرای ایجنت بعدی نیست.

## ساخت در یک clone تازه

Node.js و npm لازم‌اند؛ محیط قبلی با Node 24.21.0 کار کرده است. lockfileها را نگه دارید. از ریشه:

```powershell
npm --prefix './آواتار' ci
npm --prefix './avatar-lab' ci
npm --prefix './avatar-lab' run build
```

ساخت میزبان ابتدا Plugin را می‌سازد و glTF، buffer و تصاویر را از خروجی همان Plugin کپی می‌کند. به `AvatarRuntime` یا cache پروژهٔ ورودی وابسته نیست. اگر اجرای Desktop خواسته شد، `Open-Avatar-Lab.cmd` یا launcher رسمی درج‌شده در AGENTS.md میزبان را اجرا کنید. الامر باید نصب و پنجره‌اش هنگام بارگذاری نمایان باشد. `avatar.bin` فایل داخلی مدل است؛ بازکردن دستی آن لازم نیست.

## Git و نسخه‌ها

شاخهٔ این نسخه `avatar-v2` و مقصد `https://github.com/Ali-Tafakkor/Avatar_Plugin_AlAmr.git` است. commit تحویل پذیرفته‌شدهٔ قبلی `c557934` روی سرور تأیید شده و upstream شاخه `origin/avatar-v2` است. `main` و tag `v1.0.0` روی refهای V1 باقی ماندند. مجوز Git در ۱۹ اکتبر مربوط به همان تحویل قبلی بود؛ به آزمایش جاری انتقال حرکت تعمیم ندارد. Registry الامر در آن تحویل تغییر نکرد. [رسید read-back](docs/releases/v2.0/git-handoff/git-publication-2026-10-19.json) مرجع ارسال کد قبلی است؛ HEAD فعلی را از خود Git بخوانید.

نسخهٔ فنی Plugin `0.1.1`، نسخهٔ میزبان تست `0.1.0` و `contractVersion` برابر `1.0.0` است. «نسخهٔ محصول دوم» به معنی `2.0.0` در manifest نیست. شماره را برای clone، build یا Git push بالا نبرید. قبل از upload آینده، تاریخچهٔ مصرف نسخه و وضعیت حساب بررسی شود؛ GitHub و Registry دو مسیر مستقل‌اند.

## مرز ادامه

اصلاح پاشنه و دست‌ها با آزمون و مرور واقعی قبل/بعد تکمیل شده و خروجی برای بازخورد مالک باز است؛ پذیرش نهایی او هنوز ثبت نشده است. بخش صورت و لباس، مرحلهٔ بعدی خواستهٔ مالک است و هنوز آغاز نشده. runtime آزمایشی در `avatar-lab/experiments/v1-motion` و دو ساخت مستقل `dist-motion-test` و `dist-motion-review` هستند. build با `node experiments/v1-motion/build-local.mjs` از avatar-lab و اجرا با `alamr dev --bundle dist-motion-test --json` است. شواهد تازه در زیرپوشهٔ `evidence/heel-hands-fix` و سوابق ۱۳ capture و probe در evidence اصلی محفوظ‌اند. Git و آماده‌سازی انتشار انجام نشوند.

رسید جاری اصلاح‌شده، `pv_f7e9bf54cb644a819386b38ffe0fb76a` با digest برابر `sha256:cbb6680cd4c0b7970d2bfdd52161ec597df5d6d070087f3bec2f456b3e606021` است؛ [راستی‌آزمایی نهایی](avatar-lab/experiments/v1-motion/evidence/heel-hands-fix/normal-verify.json) را بخوانید. preview قدیمی `pv_3fc0d90c3bf14ecfb48a3846a0296bdc` و [نمایهٔ مرور پیش از اصلاح](avatar-lab/experiments/v1-motion/evidence/visual-review-index.json) تاریخی‌اند. پیش از راه‌اندازی تازه، وضعیت پنجرهٔ موجود را بررسی کنید.

برای بخش دومِ هنوز آغازنشده، پیشنهاد قبلی بررسی هندسهٔ نزدیک صورت و نمونهٔ مستقلِ چهارحالته با هویت V1 است: خنثی، پلک، لبخند و دهان‌باز. V1 هیچ morph ندارد و کد احساسات به‌تنهایی کافی نیست. عدم امکان topology موجود هنوز ثابت نشده؛ ظاهر نمونه باید تعیین‌کننده باشد. پرش V2 procedural است و اجرای کل runtime آن روی V1 حرکت‌های پذیرفته‌شده را عوض می‌کند. جزئیات و هش‌ها در طرح و `docs/reviews/2026-10-19-hybrid/source-audit.json` هستند. مسیر مشتق پیشنهادی `Avatar_Hybrid/` هنوز ایجاد نشده است. این پیشنهاد، مجوز شروع صورت و لباس پیش از پایان بخش جاری نیست.

WebXR/Quest، pose زندهٔ بدن و دست، شبکه و remote Fleet هنوز تحویل نشده‌اند. طرح و نقشهٔ راه در ریشه‌اند و پیشنهادهای قبلی، تصمیم قطعی مالک نیستند. کار بعدی را از پیام جدید مالک بگیرید؛ مأموریت قدیمی «فقط طراحی» یا متن شروع Quest را خودکار اجرا نکنید. Blender MCP راه‌اندازی نشود.

مجوز MIT کد و حقوق جداگانهٔ مدل/بافت/motion در LICENSE و THIRD_PARTY_NOTICES.md Plugin آمده‌اند. این تحویل مجوز دارایی‌ها را تغییر نمی‌دهد. فایل حساب، token، node_modules و وضعیت محلی `.al-amr` وارد Git نمی‌شوند؛ فقط مستندات عمومی دقیق Plugin مصرف‌شده حفظ می‌شوند.
