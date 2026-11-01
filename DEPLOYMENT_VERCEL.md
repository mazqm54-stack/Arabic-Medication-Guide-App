# دليل نشر وتثبيت الخادم السحابي (Vercel Deployment Guide)

تطبيق **"دليلي الدوائي" (My Medication Guide)** يعتمد على بنية سحابية آمنة خالية تماماً من المفاتيح السرية في تطبيق العميل والهاتف الذكي (Zero-Secret Architecture). جميع طلبات تحليل صور الأدوية تمر عبر دالة سحابية (`/api/analyze`) مستضافة على منصة Vercel مع ضبط الارتباط الجغرافي بمركز بيانات فرانكفورت بألمانيا (`fra1`) لضمان أقل زمن استجابة (Latency) للمستخدمين في الشرق الأوسط وشمال أفريقيا (MENA).

---

## 1. المتطلبات الأساسية (Prerequisites)

1. حساب مفعل على منصة [Vercel](https://vercel.com).
2. مفتاح Google Gemini API سري من [Google AI Studio](https://aistudio.google.com).
3. بيئة Node.js 18+ مثبتة على جهازك.
4. أداة Vercel CLI (اختياري للنشر عبر سطر الأوامر):
   ```bash
   npm install -g vercel
   ```

---

## 2. مصفوفة المتغيرات البيئية (Environment Variables)

| اسم المتغير | إلزامي؟ | النطاق | القيمة الافتراضية / مثال | الوصف |
|---|---|---|---|---|
| `GEMINI_API_KEY` | **نعم** | خادم سحابي فقط (Server-side) | `AIzaSyD...` | مفتاح Gemini API السري. يُحفظ في بيئة Vercel ولا يصل للعميل أبداً. |
| `GEMINI_MODEL` | لا | خادم سحابي فقط (Server-side) | `gemini-1.5-flash` | نموذج الذكاء الاصطناعي المستخدم. يمكن تغييره إلى `gemini-2.0-flash` أو `gemini-2.5-flash`. |
| `VITE_API_URL` | لا | واجهة العميل (Client-side) | `/api/analyze` | رابط دالة التحليل. يُترك افتراضياً للويب، ويُعين كرابط كامل في تطبيق أندرويد. |

---

## 3. تهيئة المتغيرات على منصة Vercel

### الطريقة الأولى: عبر لوحة التحكم (Vercel Dashboard)
1. افتح المشروع في لوحة تحكم Vercel وانتقل إلى: **Settings > Environment Variables**.
2. أضف المفتاح السري:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: أدخل مفتاحك السري المستخرج من Google AI Studio
   - **Target Environments**: اختر Production و Preview و Development
3. (اختياري) أضف اسم النموذج:
   - **Key**: `GEMINI_MODEL`
   - **Value**: `gemini-1.5-flash`
   - **Target Environments**: Production و Preview و Development

### الطريقة الثانية: عبر سطر الأوامر (Vercel CLI)
```bash
# تسجيل الدخول وربط المشروع
vercel login
vercel link

# إضافة المتغيرات البيئية
vercel env add GEMINI_API_KEY production
vercel env add GEMINI_MODEL production
```

---

## 4. التشغيل والتجربة محلياً (Local Development)

لتشغيل الدالة السحابية مع واجهة التطبيق محلياً:
1. أنشئ ملف `.env.local` في المجلد الرئيسي للمشروع (الملف متجاهل تلقائياً في Git لمنع تسريب المفاتيح):
   ```env
   GEMINI_API_KEY=AIzaSyYourActualSecretKeyHere
   GEMINI_MODEL=gemini-1.5-flash
   ```
2. شغّل خادم التطوير عبر Vercel CLI:
   ```bash
   vercel dev
   ```
   سيبدأ الخادم المحلي على الرابط `http://localhost:3000`، حيث يتم توجيه طلبات `/api/analyze` مباشرة للدالة السحابية مع حقن المفتاح السري بأمان.

---

## 5. النشر على بيئة الإنتاج (Production Deployment)

### النشر التلقائي عبر Git:
عند ربط مستودع GitHub / GitLab مع Vercel، يتم النشر تلقائياً فورياً مع كل دمج في فرع الإنتاج (`main`).

### النشر اليدوي عبر CLI:
```bash
vercel --prod
```
ستحصل على رابط الإنتاج النهائي الخاص بك (مثال: `https://dalili-medication-guide.vercel.app`).

---

## 6. ربط تطبيق أندرويد (Android APK Configuration)

عند بناء تطبيق الهاتف الأصلي (APK) بواسطة Capacitor، يجب توجيه طلبات التحليل إلى الرابط السحابي الكامل:

1. في ملف `.env.production`:
   ```env
   VITE_API_URL=https://your-project.vercel.app/api/analyze
   ```
2. قم ببناء ملفات الإنتاج وتحديث منصة أندرويد:
   ```bash
   npm.cmd run build
   npx.cmd cap sync android
   ```

---

## 7. التحقق الأمني والفحص ضد التسريب (Secret Scan)

للتأكد من خلو ملفات العميل وحزم البناء من أي مفاتيح مسربة:
```bash
node scripts/verify-secret-scan.js
```
يجب أن يؤكد الفحص العثور على 0 مفاتيح أو عناصر واجهة لإدخال المفاتيح (Zero-Secret Conformance).
