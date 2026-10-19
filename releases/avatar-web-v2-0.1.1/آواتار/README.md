# آواتار ۳ — Web V2

نسخهٔ فنی این بسته `0.1.1` و نام مرحلهٔ محصول «نسخهٔ دوم» است. این همان محصول avatar03 با شناسه و ناشر قبلی است؛ نسخهٔ `0.1.0` قبلاً ارسال و قفل شده و این پوشه برای ارسال نسخهٔ تازه آماده می‌شود. آماده‌سازی محلی به معنی ارسال، تأیید مسئول یا انتشار در Registry نیست.

`AvatarWebV2` آواتار وب کامل را با ۷۳ مفصل، ۶۶ کانال صورت، شش احساس، پلک، نگاه و کنترل دستی صورت ارائه می‌کند. جهت کفش و زانو، محدودهٔ خم‌شدن، تماس زمین و گذار حرکت اصلاح شده‌اند. هندسه، وزن‌دهی پوست و مدل اصلی تغییر نکرده‌اند. سرعت پیشنهادی میزبان برای راه‌رفتن ۲٫۲۵ و دویدن ۶٫۲ متر بر ثانیه است.

## نصب و میزبان سازگار

میزبان یک Environment وب با React `>=19 <19.3`، Three `>=0.185.1 <0.186.0` و React Three Fiber `>=9.6.1 <10` است. نمونهٔ کامل مصرف‌کننده در `../avatar-lab` از Player Rig رسمی `1.0.0` استفاده می‌کند. Plugin خودش Player Rig، Canvas، renderer، دوربین، ورودی یا حرکت جهان دیگری نمی‌سازد؛ فقط از کنترلر و navigation عمومی میزبان استفاده می‌کند.

پس از انتشار واقعی، از `alamr add usr-20dfea67-47be-4f4a-b48c-02c5f210a079/avatar03@0.1.1 --json` در میزبان و دستور نصب بازگردانده‌شده استفاده شود. تا پیش از انتشار، مثال مستقل از وابستگی محلی `file:../آواتار` استفاده می‌کند. فهرست managed `plugins` میزبان را دستی تغییر ندهید.

## اتصال Web V2

داخل Canvas موجود، با renderer مناسب Player Rig و Suspense/error boundary میزبان:

```tsx
import { useRef, Suspense } from 'react';
import {
  AvatarWebV2, LOCOMOTION_PROFILE,
  type AvatarWebV2Handle,
} from '@al-amr-community/usr-20dfea67-47be-4f4a-b48c-02c5f210a079--avatar03';
import {
  PlayerRig, createPlayerController, createFlatNavigationSurface,
} from '@al-amr-community/usr-1328ef22-14d5-4f87-992f-10c9540c9a86--player-rig';

const controller = createPlayerController({ position: [0, 0, 0], yaw: 0 });
const navigation = createFlatNavigationSurface(0);
const modelUrl = new URL('./avatar-v2/avatar.gltf', document.baseURI).href;
const motionsUrl = new URL('./avatar-v2/motions.json', document.baseURI).href;

export function Character() {
  const avatar = useRef<AvatarWebV2Handle>(null);
  return <Suspense fallback={null}>
    <PlayerRig controller={controller} navigation={navigation}
      movement={{walkSpeed: LOCOMOTION_PROFILE.walkSpeed,
        sprintSpeed: LOCOMOTION_PROFILE.runSpeed}}
      onAnimationFrame={motion => avatar.current?.setLocomotion(motion)}
      avatar={<AvatarWebV2 ref={avatar} controller={controller}
        navigation={navigation} modelUrl={modelUrl} motionsUrl={motionsUrl} />}/>
  </Suspense>;
}
```

کد کاملِ ساخته‌شده، شامل Canvas، WebGPURenderer، نور، زمین، مدیریت خطا، lifecycle و دکمه‌های صورت/حرکت در `../avatar-lab/src/main.tsx` است. اسکریپت `../avatar-lab/scripts/prepare-avatar-v2.mjs` پوشهٔ `dist/assets/avatar-v2` همین Plugin را با تمام زیرپوشه‌ها در `public/avatar-v2` میزبان کپی می‌کند. glTF، bin و تصاویر باید کنار هم بمانند. واردکردن glTF به‌تنهایی با یک import در bundler تضمین نمی‌کند تصاویر هم کپی شوند.

اگر ماژول و پوشهٔ assets با همان ساختار بسته در میزبان می‌مانند، `modelUrl` و `motionsUrl` اختیاری‌اند. در bundlerهایی که فایل‌ها را تغییر نام می‌دهند، از روش کپی کامل و URL صریح مثال استفاده کنید. هیچ مدل، بافت، motion یا decoder در شروع برنامه از اینترنت دریافت نمی‌شود.

## API و تنظیم‌ها

ویژگی‌های `AvatarWebV2`: کنترلر با `getPoseSnapshot()`، navigation با `sampleGround()`، URL مدل و motion، `height` (پیش‌فرض ۱٫۷۸ متر)، `lighting` (`scene` یا `unlit`)، `rotationY` (پیش‌فرض PI)، `portrait`، `onReady` و `onError`.

Ref شامل `setLocomotion`، `setEmotion`، `setManual`، `setIntensity`، `setFaceOptions`، `blink`، `reset` و `getStatus` است. `getRuntime` برای بازرسی محیط تست موجود است؛ میزبان همچنان مالک پایان عمر است. شش نام احساس: `neutral`، `smile`، `laugh`، `sad`، `angry` و `surprise`. گروه‌های دستی: `jaw`، `smile`، `frown`، `brows`، `browDown` و `wide`.

`setFaceOptions` گزینه‌های `blinkEnabled`، `gazeEnabled`، `microEnabled` و `ikEnabled` را می‌پذیرد. وضعیت شامل کلیپ، سرعت/پروفایل، وزن‌های صورت، تعداد مفاصل منطبق، اندازه‌گیری واقعی کفش و زانو است. خطاهای بارگذاری در error boundary میزبان رسیدگی شوند؛ خطاهای ساخت runtime به `onError` می‌رسند. خطاهای مهم: `avatar_v2_invalid_height` و `avatar_v2_source_integrity_mismatch` هنگام build.

موقعیت و جهت جهان را Player Rig اعمال می‌کند؛ runtime دوباره آن‌ها را به root اضافه نمی‌کند. `yaw=0` کنترلر رسمی به -Z می‌رود و چرخش PI آواتار را با آن هماهنگ می‌کند. ثبت فریم runtime بعد از آماده‌شدن async انجام می‌شود تا snapshot جاری میزبان استفاده شود. با unmount، mixer، اسکلت، هندسه، material و texture متعلق به نمونه آزاد می‌شوند. نمونه‌ها و cache مدل روی هم اثر نمی‌گذارند. `dispose()` runtime تکرارپذیر است.

## سازگاری با نسخهٔ قبلی

`Avatar03`، `Avatar03Animator`، `AVATAR03_CLIPS`، `AVATAR03_MODEL_URL`، `AVATAR03_HEIGHT` و `MOTION_CLIPS` با مدل و نه کلیپ قبلی حفظ شده‌اند. این API قدیمی به‌صورت خودکار به Web V2 تبدیل نمی‌شود. محیطی که مدل جدید را می‌خواهد باید `AvatarWebV2` را مطابق مثال متصل کند. میزبان‌های دارای release قفل‌شدهٔ `0.1.0` تغییر نمی‌کنند.

کلیپ‌های قدیمی: Stand، Walk، Run، Fly، Jump، HandRaise، StandToSit، Sitting و SittoStand. Web V2 از سه منبع idle/walk/run به‌همراه لایه‌های procedural پرش/فرود/پرواز و صورت استفاده می‌کند؛ نام کلیپ‌های قدیمی به‌عنوان موشن‌کپچر تازه برای مدل وب معرفی نمی‌شوند.

Exportهای دیگر: `AVATAR_V2_MODEL_URL`، `AVATAR_V2_MOTIONS_URL`، `AVATAR_V2_HEIGHT`، `EMOTIONS`، `FACE_GROUPS`، `LOCOMOTION_PROFILE` و `createWebAvatarRuntime`. مسیرهای مستقل بسته: `./web-v2`، `./runtime`، `./web-model`، `./web-motions` و `./web-asset-manifest`. قرارداد در `integration.md` و نوع‌ها در `dist/index.d.ts` است.

## ساخت، بررسی و ارسال

این پوشه برای build به source یا runtime خارج از خودش نیاز ندارد. با `npm ci`، `npm run build` و `npm test` ساخته و بررسی می‌شود. دو مقدار نسخه در `package.json` و `al-amr.plugin.json` باید `0.1.1` بمانند؛ هر بار ساخت یا تلاش دوباره شماره را بالا نبرید. `contractVersion` همان قرارداد platform است و نسخهٔ محصول نیست.

CLI دقیق در `AGENTS.md` ثبت شده است. پیش از ارسال، `alamr validate --json` و `alamr doctor --profile publish --json` اجرا شوند. دکمهٔ «نسخه تازه را بفرست» Desktop از همین پوشه می‌سازد و خود الامر بسته را آماده می‌کند؛ pack دستی یا npm pack لازم نیست. `alamr test` آپلود/اتصال candidate و `alamr publish` ارسال برای بررسی است و دستور آزمون محلی نیست.

## مجوز و حدود

مجوز کد با حقوق مدل، بافت و motion جداست؛ `LICENSE`، `CODE-LICENSE.txt` و `THIRD_PARTY_NOTICES.md` همراه بسته‌اند. فایل AvatarSDK منبع برای استفادهٔ غیرتجاری معرفی شده است؛ آماده‌سازی این پوشه مجوز تجاری یا اجازهٔ مستقل بازتوزیع عمومی ایجاد نمی‌کند. پیش از Git عمومی یا توزیع Registry، شرایط دارایی‌ها بررسی شود.

Plugin به backend، حساب، مجوز platform یا ذخیرهٔ credential نیاز ندارد. رهگیری واقعی Quest، lip-sync از صوت، شبکه و جایگزینی خودکار آواتار همهٔ Environmentها در این تحویل اضافه نشده‌اند؛ کانال‌های صورت موجود حفظ شده‌اند.
