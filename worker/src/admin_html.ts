import { DashboardData } from './stats';

export function renderLoginPage(errorMessage?: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>دليلي الدوائي - تسجيل دخول لوحة الإدارة</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", sans-serif; }
    body { background-color: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 16px; direction: rtl; }
    .card { background: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); width: 100%; max-width: 400px; padding: 32px 24px; text-align: center; }
    .logo { width: 56px; height: 56px; background: #0d9488; border-radius: 14px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; color: white; font-size: 28px; }
    h1 { font-size: 20px; color: #1e293b; margin-bottom: 8px; }
    p { font-size: 14px; color: #64748b; margin-bottom: 24px; }
    .error { background: #fee2e2; color: #b91c1c; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; text-align: right; }
    input[type="password"], input[type="text"] { width: 100%; padding: 12px 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; font-size: 15px; outline: none; margin-bottom: 18px; direction: ltr; text-align: center; }
    input:focus { border-color: #0d9488; box-shadow: 0 0 0 3px rgba(13,148,136,0.15); }
    button { width: 100%; background: #0d9488; color: white; border: none; padding: 13px; font-size: 15px; font-weight: 600; border-radius: 10px; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #0f766e; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">💊</div>
    <h1>دليلي الدوائي</h1>
    <p>لوحة التحكم والإحصائيات الخاصة بالمشرف</p>
    ${errorMessage ? `<div class="error">${errorMessage}</div>` : ''}
    <form method="GET" action="/admin">
      <input type="password" name="key" placeholder="أدخل مفتاح الإدارة السري" required autofocus autocomplete="off">
      <button type="submit">تسجيل الدخول</button>
    </form>
  </div>
</body>
</html>`;
}

function renderFailuresTable(failuresByType: Record<string, number> = {}, totalFailures = 0): string {
  const entries = Object.entries(failuresByType || {});
  if (entries.length === 0 || totalFailures === 0) {
    return '<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 12px;">لا توجد أخطاء مسجلة في هذه الفترة 🎉</p>';
  }

  const labelMap: Record<string, { label: string; desc: string }> = {
    'UPSTREAM_OVERLOADED_503': { label: 'ضغط مؤقت (Google 503)', desc: 'خوادم Gemini تحت ضغط مؤقت في مراكز البيانات' },
    'UPSTREAM_TIMEOUT_504': { label: 'تجاوز مهلة الخادم (Timeout)', desc: 'استغرق اتصال Gemini وقتاً أطول من المهلة المسموحة' },
    'INVALID_JSON': { label: 'مخرجات JSON مبتورة', desc: 'توقف التوليد أو لم يكتمل الـ JSON' },
    'EMPTY_RESPONSE': { label: 'استجابة فارغة (Safety)', desc: 'لم يُرجع Gemini نصاً في الاستجابة' },
    'UPSTREAM_RATE_LIMIT_429': { label: 'تجاوز حد الاستدعاء (429)', desc: 'تجاوز الكوتا المسموحة في الدقيقة' },
    'UPSTREAM_ERROR_500': { label: 'خطأ خادم Google (500)', desc: 'خطأ داخلي في خوادم Google Gemini' },
    'BAD_REQUEST_400': { label: 'طلب غير صالح (400)', desc: 'صورة غير صالحة أو خطأ في صيغة الطلب' },
    'UNKNOWN': { label: 'أخطاء غير مصنفة', desc: 'أخطاء سابقة لتسجيل الرموز' }
  };

  return `
    <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: right;">
      <thead>
        <tr style="border-bottom: 2px solid var(--border); color: var(--text-muted);">
          <th style="padding: 8px 6px;">نوع الخطأ</th>
          <th style="padding: 8px 6px;">التفسير</th>
          <th style="padding: 8px 6px; text-align: center;">العدد</th>
          <th style="padding: 8px 6px; text-align: center;">النسبة</th>
        </tr>
      </thead>
      <tbody>
        \${entries.map(([code, count]) => {
          const info = labelMap[code] || { label: code, desc: 'خطأ تشغيلي مسجل' };
          const pct = Math.round((count / totalFailures) * 100);
          return \`
            <tr style="border-bottom: 1px solid var(--border);">
              <td style="padding: 8px 6px; font-weight: 600; color: var(--text-main);">\${info.label}</td>
              <td style="padding: 8px 6px; color: var(--text-muted); font-size: 12px;">\${info.desc}</td>
              <td style="padding: 8px 6px; text-align: center; font-weight: 700; color: var(--danger);">\${count}</td>
              <td style="padding: 8px 6px; text-align: center; color: var(--text-muted);">\${pct}%</td>
            </tr>
          \`;
        }).join('')}
      </tbody>
    </table>
  `;
}

export function renderDashboardPage(data: DashboardData, adminKey: string): string {
  const geminiLimitPercent = Math.min(100, Math.round((data.todayRequestsCount / data.dailyGeminiLimit) * 100));
  const geminiLimitColor = geminiLimitPercent > 85 ? '#ef4444' : geminiLimitPercent > 60 ? '#f59e0b' : '#0d9488';

  // Calculate max daily count for SVG chart scaling
  const maxChartCount = Math.max(1, ...data.dailyChart.map(p => p.total));

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>لوحة تحكم دليلي الدوائي</title>
  <style>
    :root {
      --primary: #0d9488;
      --primary-dark: #0f766e;
      --primary-light: #ccfbf1;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --success: #16a34a;
      --danger: #dc2626;
      --warning: #d97706;
      --border: #e2e8f0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", sans-serif; }
    body { background-color: var(--bg); color: var(--text-main); padding: 16px; direction: rtl; min-height: 100vh; }
    .container { max-width: 900px; margin: 0 auto; }
    
    /* Header */
    header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-icon { width: 44px; height: 44px; background: var(--primary); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 22px; }
    .brand-title { font-size: 20px; font-weight: 700; color: var(--text-main); }
    .brand-subtitle { font-size: 12px; color: var(--text-muted); }
    .header-actions { display: flex; gap: 8px; }
    .btn-secondary { background: #ffffff; border: 1px solid var(--border); padding: 8px 14px; border-radius: 8px; font-size: 13px; color: var(--text-muted); cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
    .btn-secondary:hover { background: #f1f5f9; color: var(--text-main); }

    /* Alert / Quota Banner */
    .quota-card { background: var(--card-bg); border-radius: 14px; padding: 16px; border: 1px solid var(--border); margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }
    .quota-header { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
    .quota-bar-bg { height: 10px; background: #e2e8f0; border-radius: 5px; overflow: hidden; }
    .quota-bar-fill { height: 100%; border-radius: 5px; transition: width 0.3s; }

    /* Period Tabs */
    .tabs-container { display: flex; background: #e2e8f0; border-radius: 10px; padding: 4px; margin-bottom: 16px; gap: 4px; }
    .tab-btn { flex: 1; border: none; background: transparent; padding: 9px 4px; border-radius: 7px; font-size: 13px; font-weight: 600; color: var(--text-muted); cursor: pointer; transition: all 0.2s; }
    .tab-btn.active { background: #ffffff; color: var(--primary-dark); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }

    /* Cards Grid */
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .metric-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
    .metric-title { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
    .metric-value { font-size: 20px; font-weight: 700; color: var(--text-main); }
    .metric-sub { font-size: 11px; margin-top: 4px; color: var(--text-muted); }
    .text-success { color: var(--success); }
    .text-danger { color: var(--danger); }
    .text-warning { color: var(--warning); }
    .text-primary { color: var(--primary); }

    /* Detailed Sections */
    .section-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 14px; padding: 18px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
    .section-title { font-size: 15px; font-weight: 700; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }

    .split-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .split-box { flex: 1; min-width: 140px; background: #f8fafc; border-radius: 10px; padding: 12px; border: 1px solid #edf2f7; }
    .split-title { font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; }
    .split-count { font-size: 18px; font-weight: 700; }

    /* Daily Chart */
    .chart-container { overflow-x: auto; padding: 10px 0; }
    .chart-flex { display: flex; align-items: flex-end; gap: 8px; height: 140px; min-width: 320px; padding-bottom: 24px; border-bottom: 1px solid var(--border); }
    .chart-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
    .chart-bar-wrap { width: 100%; max-width: 28px; background: #f1f5f9; border-radius: 6px 6px 0 0; display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden; position: relative; }
    .chart-bar-pres { background: #3b82f6; width: 100%; }
    .chart-bar-box { background: var(--primary); width: 100%; }
    .chart-label { font-size: 10px; color: var(--text-muted); margin-top: 6px; transform: rotate(-30deg); white-space: nowrap; }
    .chart-val { font-size: 10px; font-weight: 600; color: var(--text-main); margin-bottom: 3px; }
    .chart-legend { display: flex; gap: 14px; font-size: 11px; margin-top: 12px; justify-content: center; }
    .legend-item { display: flex; align-items: center; gap: 5px; }
    .legend-dot { width: 10px; height: 10px; border-radius: 2px; }

    /* Footer */
    footer { text-align: center; font-size: 12px; color: var(--text-muted); margin-top: 24px; padding-bottom: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <div class="brand-icon">💊</div>
        <div>
          <div class="brand-title">دليلي الدوائي</div>
          <div class="brand-subtitle">لوحة التحكم والمتابعة المباشرة</div>
        </div>
      </div>
      <div class="header-actions">
        <a href="/admin?key=${encodeURIComponent(adminKey)}" class="btn-secondary">🔄 تحديث</a>
        <a href="/admin" class="btn-secondary">خروج</a>
      </div>
    </header>

    <!-- Quota Card -->
    <div class="quota-card">
      <div class="quota-header">
        <span>استهلاك Gemini اليومي: ${data.todayRequestsCount} / ${data.dailyGeminiLimit} طلب</span>
        <span style="color: ${geminiLimitColor}; font-weight: 700;">${geminiLimitPercent}%</span>
      </div>
      <div class="quota-bar-bg">
        <div class="quota-bar-fill" style="width: ${geminiLimitPercent}%; background-color: ${geminiLimitColor};"></div>
      </div>
    </div>

    <!-- Period Tabs -->
    <div class="tabs-container">
      <button class="tab-btn active" onclick="switchPeriod('today', this)">اليوم</button>
      <button class="tab-btn" onclick="switchPeriod('sevenDays', this)">آخر 7 أيام</button>
      <button class="tab-btn" onclick="switchPeriod('thirtyDays', this)">آخر 30 يوماً</button>
      <button class="tab-btn" onclick="switchPeriod('allTime', this)">من البداية</button>
    </div>

    <!-- Top Key Metrics (Dynamic by Period) -->
    <div class="grid">
      <div class="metric-card">
        <div class="metric-title">إجمالي الطلبات</div>
        <div class="metric-value text-primary" id="m-total">${data.today.totalRequests}</div>
        <div class="metric-sub" id="m-resp">متوسط الاستجابة: ${data.today.avgResponseTimeMs} مللي ثانية</div>
      </div>
      <div class="metric-card">
        <div class="metric-title">نسبة النجاح</div>
        <div class="metric-value text-success" id="m-success">${data.today.successRate}%</div>
        <div class="metric-sub" id="m-success-sub">${data.today.successCount} ناجح / ${data.today.failureCount} غير ناجح</div>
      </div>
      <div class="metric-card">
        <div class="metric-title">تقييمات المستخدمين</div>
        <div class="metric-value text-success" id="m-feedback">${data.today.feedbackCorrectRate}%</div>
        <div class="metric-sub" id="m-feedback-sub">👍 ${data.today.feedbackCorrect} صحيح | 👎 ${data.today.feedbackWrong} غير صحيح</div>
      </div>
      <div class="metric-card">
        <div class="metric-title">المستخدمون النشطون</div>
        <div class="metric-value" id="m-active">${data.today.activeUsers}</div>
        <div class="metric-sub">أجهزة فريدة متصلة</div>
      </div>
    </div>

    <!-- Breakdown: Box vs Prescription -->
    <div class="section-card">
      <div class="section-title">📷 تصنيف الصور والتحليلات</div>
      <div class="split-row">
        <div class="split-box">
          <div class="split-title">علب الأدوية (Medicine Box)</div>
          <div class="split-count text-primary" id="m-box-count">${data.today.boxCount}</div>
          <div class="metric-sub">صورة تم فحصها وتحليلها</div>
        </div>
        <div class="split-box">
          <div class="split-title">الروشتات الطبية (Prescriptions)</div>
          <div class="split-count" style="color: #3b82f6;" id="m-pres-count">${data.today.prescriptionCount}</div>
          <div class="metric-sub">روشتة تم قراءتها بالذكاء الاصطناعي</div>
        </div>
      </div>
    </div>

    <!-- Prescriptions Breakdown -->
    <div class="section-card">
      <div class="section-title">🩺 تفاصيل قراءة الروشتات</div>
      <div class="split-row">
        <div class="split-box">
          <div class="split-title">أدوية تم قراءتها واستخراجها</div>
          <div class="split-count text-success" id="m-meds-read">${data.today.totalMedicinesRead}</div>
          <div class="metric-sub">عنصر دواء تم التعرف عليه</div>
        </div>
        <div class="split-box">
          <div class="split-title">أدوية غير واضحة بالروشتة</div>
          <div class="split-count text-warning" id="m-meds-unclear">${data.today.totalUnclearMedicines}</div>
          <div class="metric-sub">حُددت كغير واضحة لحماية المريض</div>
        </div>
        <div class="split-box">
          <div class="split-title">إعادة المحاولات الذكية (Retries)</div>
          <div class="split-count text-primary" id="m-retries-needed">${data.today.prescriptionRetryNeededCount}</div>
          <div class="metric-sub" id="m-retries-sub">${data.today.prescriptionRetryImprovedCount} روشتة تحسنت قراءتها</div>
        </div>
      </div>
    </div>

    <!-- Libyan National Formulary Validation Stats -->
    <div class="section-card">
      <div class="section-title">🇱🇾 مطابقة الدليل الوطني الليبي للأدوية (LNF)</div>
      <div class="split-row">
        <div class="split-box">
          <div class="split-title">أدوية تمت مطابقتها (Matched)</div>
          <div class="split-count text-success" id="m-lnf-matched">${data.today.lnfMatchedCount}</div>
          <div class="metric-sub">دواء مؤكد في الدليل الوطني</div>
        </div>
        <div class="split-box">
          <div class="split-title">أدوية تم تصحيحها (Corrected)</div>
          <div class="split-count" style="color: #8b5cf6;" id="m-lnf-corrected">${data.today.lnfCorrectedCount}</div>
          <div class="metric-sub">أخطاء طباعية/خط يد صححها الدليل</div>
        </div>
        <div class="split-box">
          <div class="split-title">أدوية غير مسجلة (Not Found)</div>
          <div class="split-count text-warning" id="m-lnf-not-found">${data.today.lnfNotFoundCount}</div>
          <div class="metric-sub">خُفضت ثقتها درجة واحدة تلقائياً</div>
        </div>
      </div>
    </div>

    <!-- System Performance & Safety -->
    <div class="section-card">
      <div class="section-title">⚙️ أداء الخادم وحدود الاستخدام</div>
      <div class="grid" style="margin-bottom: 0;">
        <div class="metric-card">
          <div class="metric-title">أخطاء Gemini (429)</div>
          <div class="metric-value text-danger" id="m-429">${data.today.gemini429Count}</div>
          <div class="metric-sub">تجاوز سرعة الاستدعاء</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">روشتات صعبة (Hard Mode)</div>
          <div class="metric-value" style="color: #6366f1;" id="m-hard-count">${data.today.hardCount || 0}</div>
          <div class="metric-sub" id="m-hard-sub">${data.today.deepImprovedCount || 0} تحسنت بالتدقيق العميق</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">إجمالي المستخدمين</div>
          <div class="metric-value">${data.totalUsersAllTime}</div>
          <div class="metric-sub">منذ إطلاق النظام</div>
        </div>
        <div class="metric-card">
          <div class="metric-title">مستخدمون جدد يومياً</div>
          <div class="metric-value">${data.newUsersAvgPerDay}</div>
          <div class="metric-sub">متوسط آخر 7 أيام (اليوم: ${data.newUsersToday})</div>
        </div>
      </div>
    </div>

    <!-- Failures by Type -->
    <div class="section-card">
      <div class="section-title">⚠️ تحليل أسباب الفشل (Failures by Type)</div>
      <div id="failures-table-container">
        ${renderFailuresTable(data.today.failuresByType, data.today.failureCount)}
      </div>
    </div>

    <!-- Daily Chart -->
    <div class="section-card">
      <div class="section-title">📊 نشاط الطلبات اليومي (آخر 14 يوماً)</div>
      ${data.dailyChart.length === 0 ? '<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 24px;">لا توجد بيانات مسجلة حتى الآن.</p>' : `
      <div class="chart-container">
        <div class="chart-flex">
          ${data.dailyChart.map(point => {
            const heightPercent = Math.max(6, Math.round((point.total / maxChartCount) * 100));
            const presPercent = point.total > 0 ? Math.round((point.prescription / point.total) * 100) : 0;
            const boxPercent = 100 - presPercent;
            const shortDate = point.day.slice(5); // MM-DD
            return `
            <div class="chart-col">
              <div class="chart-val">${point.total}</div>
              <div class="chart-bar-wrap" style="height: ${heightPercent}%;">
                <div class="chart-bar-pres" style="height: ${presPercent}%;"></div>
                <div class="chart-bar-box" style="height: ${boxPercent}%;"></div>
              </div>
              <div class="chart-label">${shortDate}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="chart-legend">
        <div class="legend-item"><span class="legend-dot" style="background: var(--primary);"></span> علب الأدوية</div>
        <div class="legend-item"><span class="legend-dot" style="background: #3b82f6;"></span> الروشتات</div>
      </div>
      `}
    </div>

    <footer>
      نظام دليلي الدوائي &copy; 2026 &bull; لوحة الإدارة المشفرة
    </footer>
  </div>

  <script>
    const periods = ${JSON.stringify({
      today: data.today,
      sevenDays: data.sevenDays,
      thirtyDays: data.thirtyDays,
      allTime: data.allTime
    })};

    function switchPeriod(key, btn) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const p = periods[key];
      if (!p) return;

      document.getElementById('m-total').innerText = p.totalRequests;
      document.getElementById('m-resp').innerText = 'متوسط الاستجابة: ' + p.avgResponseTimeMs + ' مللي ثانية';
      document.getElementById('m-success').innerText = p.successRate + '%';
      document.getElementById('m-success-sub').innerText = p.successCount + ' ناجح / ' + p.failureCount + ' غير ناجح';
      document.getElementById('m-feedback').innerText = p.feedbackCorrectRate + '%';
      document.getElementById('m-feedback-sub').innerText = '👍 ' + p.feedbackCorrect + ' صحيح | 👎 ' + p.feedbackWrong + ' غير صحيح';
      document.getElementById('m-active').innerText = p.activeUsers;
      document.getElementById('m-box-count').innerText = p.boxCount;
      document.getElementById('m-pres-count').innerText = p.prescriptionCount;
      document.getElementById('m-meds-read').innerText = p.totalMedicinesRead;
      document.getElementById('m-meds-unclear').innerText = p.totalUnclearMedicines;
      const retriesEl = document.getElementById('m-retries-needed');
      if (retriesEl) retriesEl.innerText = p.prescriptionRetryNeededCount || 0;
      const retriesSubEl = document.getElementById('m-retries-sub');
      if (retriesSubEl) retriesSubEl.innerText = (p.prescriptionRetryImprovedCount || 0) + ' روشتة تحسنت قراءتها';
      const lnfMatchedEl = document.getElementById('m-lnf-matched');
      if (lnfMatchedEl) lnfMatchedEl.innerText = p.lnfMatchedCount || 0;
      const lnfCorrectedEl = document.getElementById('m-lnf-corrected');
      if (lnfCorrectedEl) lnfCorrectedEl.innerText = p.lnfCorrectedCount || 0;
      const lnfNotFoundEl = document.getElementById('m-lnf-not-found');
      if (lnfNotFoundEl) lnfNotFoundEl.innerText = p.lnfNotFoundCount || 0;
      const hardEl = document.getElementById('m-hard-count');
      if (hardEl) hardEl.innerText = p.hardCount || 0;
      const hardSubEl = document.getElementById('m-hard-sub');
      if (hardSubEl) hardSubEl.innerText = (p.deepImprovedCount || 0) + ' تحسنت بالتدقيق العميق';

      const failContainer = document.getElementById('failures-table-container');
      if (failContainer) {
        const entries = Object.entries(p.failuresByType || {});
        if (entries.length === 0 || p.failureCount === 0) {
          failContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 12px;">لا توجد أخطاء مسجلة في هذه الفترة 🎉</p>';
        } else {
          const labelMap = {
            'UPSTREAM_OVERLOADED_503': { label: 'ضغط مؤقت (Google 503)', desc: 'خوادم Gemini تحت ضغط مؤقت في مراكز البيانات' },
            'UPSTREAM_TIMEOUT_504': { label: 'تجاوز مهلة الخادم (Timeout)', desc: 'استغرق اتصال Gemini وقتاً أطول من المهلة المسموحة' },
            'INVALID_JSON': { label: 'مخرجات JSON مبتورة', desc: 'توقف التوليد أو لم يكتمل الـ JSON' },
            'EMPTY_RESPONSE': { label: 'استجابة فارغة (Safety)', desc: 'لم يُرجع Gemini نصاً في الاستجابة' },
            'UPSTREAM_RATE_LIMIT_429': { label: 'تجاوز حد الاستدعاء (429)', desc: 'تجاوز الكوتا المسموحة في الدقيقة' },
            'UPSTREAM_ERROR_500': { label: 'خطأ خادم Google (500)', desc: 'خطأ داخلي في خوادم Google Gemini' },
            'BAD_REQUEST_400': { label: 'طلب غير صالح (400)', desc: 'صورة غير صالحة أو خطأ في صيغة الطلب' },
            'UNKNOWN': { label: 'أخطاء غير مصنفة', desc: 'أخطاء سابقة لتسجيل الرموز' }
          };
          let html = '<table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: right;"><thead><tr style="border-bottom: 2px solid var(--border); color: var(--text-muted);"><th style="padding: 8px 6px;">نوع الخطأ</th><th style="padding: 8px 6px;">التفسير</th><th style="padding: 8px 6px; text-align: center;">العدد</th><th style="padding: 8px 6px; text-align: center;">النسبة</th></tr></thead><tbody>';
          entries.forEach(function(entry) {
            var code = entry[0];
            var count = entry[1];
            var info = labelMap[code] || { label: code, desc: 'خطأ تشغيلي مسجل' };
            var pct = Math.round((count / p.failureCount) * 100);
            html += '<tr style="border-bottom: 1px solid var(--border);"><td style="padding: 8px 6px; font-weight: 600; color: var(--text-main);">' + info.label + '</td><td style="padding: 8px 6px; color: var(--text-muted); font-size: 12px;">' + info.desc + '</td><td style="padding: 8px 6px; text-align: center; font-weight: 700; color: var(--danger);">' + count + '</td><td style="padding: 8px 6px; text-align: center; color: var(--text-muted);">' + pct + '%</td></tr>';
          });
          html += '</tbody></table>';
          failContainer.innerHTML = html;
        }
      }
    }
  </script>
</body>
</html>`;
}
