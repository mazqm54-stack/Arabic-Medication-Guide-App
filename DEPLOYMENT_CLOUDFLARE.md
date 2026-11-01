# دليل نشر خادم Cloudflare Worker لتطبيق "دليلي الدوائي"

يوفر هذا الدليل خطوات سهلة ومباشرة لنشر خادم الذكاء الاصطناعي على منصة **Cloudflare Workers**، والتي تعمل مجاناً في جميع الدول وبدون أي حظر أو تعقيدات.

---

### الخطوة 1: تسجيل الدخول إلى Cloudflare عبر الحاسوب
افتح موجه الأوامر (PowerShell أو Terminal) في مجلد المشروع، ونفّذ الأمر التالي:

```bash
npx wrangler login
```

* سيفتح المتصفح تلقائياً صفحة Cloudflare.
* قم بتسجيل الدخول بحسابك أو أنشئ حساباً مجانياً جديداً بالبريد الإلكتروني، ثم اضغط على **Allow** لمنح الإذن لـ Wrangler.

---

### الخطوة 2: إضافة مفتاح الذكاء الاصطناعي بأمان تام (Secret)
لحماية مفتاحك السري وعدم ظهوره في الكود أو التطبيق، قم بتنفيذ هذا الأمر في موجه الأوامر الخاص بك:

```bash
cd worker
npx wrangler secret put GEMINI_API_KEY
```

* سيطلب منك موجه الأوامر إدخال المفتاح: الصق مفتاح **Google Gemini API** الخاص بك واضغط `Enter`.
* يتم تشفير المفتاح وحفظه مباشرة في خوادم Cloudflare الآمنة دون أن يُكتب في أي ملف محلي.

---

### الخطوة 3: نشر الخادم (Deploy)
من داخل مجلد `worker`، نفّذ الأمر التالي:

```bash
npx wrangler deploy
```

* سيتم رفع الخادم فوراً، وستظهر لك في الشاشة رسالة نجاح مع رابط الـ Worker الخاص بك، مثل:
  ```text
  Published dalili-medication-guide-worker (1.2s)
  https://dalili-medication-guide-worker.<your-subdomain>.workers.dev
  ```

---

### الخطوة 4: ربط التطبيق بالخادم الجديد
افتح ملف `.env` في المجلد الرئيسي لتطبيقك، وضع رابط الخادم الذي حصلت عليه:

```env
VITE_API_URL=https://dalili-medication-guide-worker.<your-subdomain>.workers.dev
```

ثم أعد بناء التطبيق وتحديث الأندرويد بالأمرين التاليين:
```bash
npm.cmd run build
npx.cmd cap sync android
```
