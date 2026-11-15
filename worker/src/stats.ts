import type { D1Database } from './types';

export interface PeriodStats {
  totalRequests: number;
  boxCount: number;
  prescriptionCount: number;
  detailsCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  failureRate: number;
  avgResponseTimeMs: number;
  gemini429Count: number;
  totalMedicinesRead: number;
  totalUnclearMedicines: number;
  prescriptionRetryNeededCount: number;
  prescriptionRetryImprovedCount: number;
  lnfMatchedCount: number;
  lnfCorrectedCount: number;
  lnfNotFoundCount: number;
  hardCount: number;
  deepImprovedCount: number;
  deepAvgTimeMs: number;
  failuresByType: Record<string, number>;
  activeUsers: number;
  feedbackTotal: number;
  feedbackCorrect: number;
  feedbackWrong: number;
  feedbackCorrectRate: number;
  feedbackWrongRate: number;
}

export interface DailyChartPoint {
  day: string;
  total: number;
  box: number;
  prescription: number;
}

export interface DashboardData {
  today: PeriodStats;
  sevenDays: PeriodStats;
  thirtyDays: PeriodStats;
  allTime: PeriodStats;
  totalUsersAllTime: number;
  newUsersToday: number;
  newUsersAvgPerDay: number;
  activeUsersToday: number;
  activeUsers7d: number;
  activeUsers30d: number;
  dailyGeminiLimit: number;
  todayRequestsCount: number;
  dailyLimitHits: number; // Always 0 for now as requested
  dailyChart: DailyChartPoint[];
}

let lnfColumnsEnsured = false;
async function ensureLnfColumns(db: D1Database): Promise<void> {
  if (lnfColumnsEnsured) return;
  try { await db.prepare('ALTER TABLE requests ADD COLUMN lnf_matched INTEGER DEFAULT 0').run(); } catch {}
  try { await db.prepare('ALTER TABLE requests ADD COLUMN lnf_corrected INTEGER DEFAULT 0').run(); } catch {}
  try { await db.prepare('ALTER TABLE requests ADD COLUMN lnf_not_found INTEGER DEFAULT 0').run(); } catch {}
  try { await db.prepare("ALTER TABLE requests ADD COLUMN error_code TEXT DEFAULT ''").run(); } catch {}
  try { await db.prepare('ALTER TABLE requests ADD COLUMN is_deep INTEGER DEFAULT 0').run(); } catch {}
  try { await db.prepare('ALTER TABLE requests ADD COLUMN is_hard INTEGER DEFAULT 0').run(); } catch {}
  lnfColumnsEnsured = true;
}

export async function recordRequest(
  db: D1Database | undefined,
  data: {
    deviceId: string;
    type: 'box' | 'prescription' | 'details';
    status: 'success' | 'failure';
    responseTimeMs: number;
    isGemini429: boolean;
    medicinesCount?: number;
    unclearCount?: number;
    retryNeeded?: boolean;
    retryImproved?: boolean;
    lnfMatched?: number;
    lnfCorrected?: number;
    lnfNotFound?: number;
    errorCode?: string;
    isDeep?: boolean;
    isHard?: boolean;
  }
): Promise<void> {
  if (!db) return;
  try {
    await ensureLnfColumns(db);
    await db
      .prepare(
        `INSERT INTO requests (device_id, type, status, response_time_ms, is_gemini_429, medicines_count, unclear_count, retry_needed, retry_improved, lnf_matched, lnf_corrected, lnf_not_found, error_code, is_deep, is_hard)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        data.deviceId || 'anonymous',
        data.type,
        data.status,
        Math.max(0, Math.round(data.responseTimeMs)),
        data.isGemini429 ? 1 : 0,
        data.medicinesCount || 0,
        data.unclearCount || 0,
        data.retryNeeded ? 1 : 0,
        data.retryImproved ? 1 : 0,
        data.lnfMatched || 0,
        data.lnfCorrected || 0,
        data.lnfNotFound || 0,
        data.errorCode || '',
        data.isDeep ? 1 : 0,
        data.isHard ? 1 : 0
      )
      .run();
  } catch (err) {
    console.error('[D1] Failed to record request:', err);
  }
}

export async function recordFeedback(
  db: D1Database | undefined,
  data: {
    deviceId: string;
    type: string;
    rating: 'correct' | 'wrong';
  }
): Promise<boolean> {
  if (!db) return false;
  try {
    await db
      .prepare(
        `INSERT INTO feedback (device_id, type, rating)
         VALUES (?, ?, ?)`
      )
      .bind(
        data.deviceId || 'anonymous',
        data.type,
        data.rating
      )
      .run();
    return true;
  } catch (err) {
    console.error('[D1] Failed to record feedback:', err);
    return false;
  }
}

async function queryPeriodStats(
  db: D1Database,
  whereClause: string
): Promise<PeriodStats> {
  await ensureLnfColumns(db);
  const filterClause = whereClause
    ? `(${whereClause}) AND (device_id NOT LIKE 'test_%' AND device_id NOT LIKE 'bench_%')`
    : `(device_id NOT LIKE 'test_%' AND device_id NOT LIKE 'bench_%')`;

  const reqQuery = `
    SELECT
      COUNT(*) AS total_requests,
      SUM(CASE WHEN type = 'box' THEN 1 ELSE 0 END) AS box_count,
      SUM(CASE WHEN type = 'prescription' THEN 1 ELSE 0 END) AS prescription_count,
      SUM(CASE WHEN type = 'details' THEN 1 ELSE 0 END) AS details_count,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
      SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) AS failure_count,
      AVG(response_time_ms) AS avg_response_time,
      SUM(CASE WHEN is_gemini_429 = 1 THEN 1 ELSE 0 END) AS gemini_429_count,
      SUM(COALESCE(medicines_count, 0)) AS total_medicines_read,
      SUM(COALESCE(unclear_count, 0)) AS total_unclear_medicines,
      SUM(CASE WHEN type = 'prescription' AND retry_needed = 1 THEN 1 ELSE 0 END) AS prescription_retry_needed,
      SUM(CASE WHEN type = 'prescription' AND retry_improved = 1 THEN 1 ELSE 0 END) AS prescription_retry_improved,
      SUM(COALESCE(lnf_matched, 0)) AS lnf_matched_count,
      SUM(COALESCE(lnf_corrected, 0)) AS lnf_corrected_count,
      SUM(COALESCE(lnf_not_found, 0)) AS lnf_not_found_count,
      SUM(CASE WHEN is_hard = 1 THEN 1 ELSE 0 END) AS hard_count,
      SUM(CASE WHEN is_deep = 1 AND retry_improved = 1 THEN 1 ELSE 0 END) AS deep_improved_count,
      AVG(CASE WHEN is_deep = 1 THEN response_time_ms ELSE NULL END) AS deep_avg_time,
      COUNT(DISTINCT device_id) AS active_users
    FROM requests
    WHERE ${filterClause}
  `;

  const failureTypesQuery = `
    SELECT COALESCE(NULLIF(error_code, ''), 'UNKNOWN') AS error_type, COUNT(*) AS count
    FROM requests
    WHERE status = 'failure' AND ${filterClause}
    GROUP BY error_type
    ORDER BY count DESC
  `;

  const feedbackQuery = `
    SELECT
      COUNT(*) AS feedback_total,
      SUM(CASE WHEN rating = 'correct' THEN 1 ELSE 0 END) AS feedback_correct,
      SUM(CASE WHEN rating = 'wrong' THEN 1 ELSE 0 END) AS feedback_wrong
    FROM feedback
    WHERE ${filterClause}
  `;

  const [reqRes, feedRes, failRes] = await Promise.all([
    db.prepare(reqQuery).first<any>(),
    db.prepare(feedbackQuery).first<any>(),
    db.prepare(failureTypesQuery).all<any>()
  ]);

  const failuresByType: Record<string, number> = {};
  if (Array.isArray(failRes?.results)) {
    for (const r of failRes.results) {
      failuresByType[r.error_type] = Number(r.count || 0);
    }
  }

  const total = Number(reqRes?.total_requests || 0);
  const successCount = Number(reqRes?.success_count || 0);
  const failureCount = Number(reqRes?.failure_count || 0);
  const successRate = total > 0 ? Math.round((successCount / total) * 1000) / 10 : 0;
  const failureRate = total > 0 ? Math.round((failureCount / total) * 1000) / 10 : 0;

  const feedbackTotal = Number(feedRes?.feedback_total || 0);
  const feedbackCorrect = Number(feedRes?.feedback_correct || 0);
  const feedbackWrong = Number(feedRes?.feedback_wrong || 0);
  const feedbackCorrectRate = feedbackTotal > 0 ? Math.round((feedbackCorrect / feedbackTotal) * 1000) / 10 : 0;
  const feedbackWrongRate = feedbackTotal > 0 ? Math.round((feedbackWrong / feedbackTotal) * 1000) / 10 : 0;

  return {
    totalRequests: total,
    boxCount: Number(reqRes?.box_count || 0),
    prescriptionCount: Number(reqRes?.prescription_count || 0),
    detailsCount: Number(reqRes?.details_count || 0),
    successCount,
    failureCount,
    successRate,
    failureRate,
    avgResponseTimeMs: Math.round(Number(reqRes?.avg_response_time || 0)),
    gemini429Count: Number(reqRes?.gemini_429_count || 0),
    totalMedicinesRead: Number(reqRes?.total_medicines_read || 0),
    totalUnclearMedicines: Number(reqRes?.total_unclear_medicines || 0),
    prescriptionRetryNeededCount: Number(reqRes?.prescription_retry_needed || 0),
    prescriptionRetryImprovedCount: Number(reqRes?.prescription_retry_improved || 0),
    lnfMatchedCount: Number(reqRes?.lnf_matched_count || 0),
    lnfCorrectedCount: Number(reqRes?.lnf_corrected_count || 0),
    lnfNotFoundCount: Number(reqRes?.lnf_not_found_count || 0),
    hardCount: Number(reqRes?.hard_count || 0),
    deepImprovedCount: Number(reqRes?.deep_improved_count || 0),
    deepAvgTimeMs: Math.round(Number(reqRes?.deep_avg_time || 0)),
    failuresByType,
    activeUsers: Number(reqRes?.active_users || 0),
    feedbackTotal,
    feedbackCorrect,
    feedbackWrong,
    feedbackCorrectRate,
    feedbackWrongRate
  };
}

export async function fetchDashboardData(db: D1Database): Promise<DashboardData> {
  const [
    today,
    sevenDays,
    thirtyDays,
    allTime,
    totalUsersRes,
    newUsersTodayRes,
    newUsers7dRes,
    chartRes
  ] = await Promise.all([
    queryPeriodStats(db, `created_at >= date('now')`),
    queryPeriodStats(db, `created_at >= date('now', '-7 days')`),
    queryPeriodStats(db, `created_at >= date('now', '-30 days')`),
    queryPeriodStats(db, `1=1`),
    db.prepare(`SELECT COUNT(DISTINCT device_id) AS total_users FROM requests WHERE (device_id NOT LIKE 'test_%' AND device_id NOT LIKE 'bench_%')`).first<any>(),
    db.prepare(`
      WITH first_seen AS (
        SELECT device_id, MIN(date(created_at)) AS fd
        FROM requests
        WHERE (device_id NOT LIKE 'test_%' AND device_id NOT LIKE 'bench_%')
        GROUP BY device_id
      )
      SELECT COUNT(*) AS new_users_today FROM first_seen WHERE fd = date('now')
    `).first<any>(),
    db.prepare(`
      WITH first_seen AS (
        SELECT device_id, MIN(date(created_at)) AS fd
        FROM requests
        WHERE (device_id NOT LIKE 'test_%' AND device_id NOT LIKE 'bench_%')
        GROUP BY device_id
      )
      SELECT COUNT(*) AS new_users_7d FROM first_seen WHERE fd >= date('now', '-7 days')
    `).first<any>(),
    db.prepare(`
      SELECT
        date(created_at) AS day,
        COUNT(*) AS total,
        SUM(CASE WHEN type = 'box' THEN 1 ELSE 0 END) AS box,
        SUM(CASE WHEN type = 'prescription' THEN 1 ELSE 0 END) AS prescription
      FROM requests
      WHERE created_at >= date('now', '-14 days') AND (device_id NOT LIKE 'test_%' AND device_id NOT LIKE 'bench_%')
      GROUP BY date(created_at)
      ORDER BY day ASC
    `).all<any>()
  ]);

  const totalUsersAllTime = Number(totalUsersRes?.total_users || 0);
  const newUsersToday = Number(newUsersTodayRes?.new_users_today || 0);
  const newUsers7d = Number(newUsers7dRes?.new_users_7d || 0);
  const newUsersAvgPerDay = Math.round((newUsers7d / 7) * 10) / 10;

  const dailyChart: DailyChartPoint[] = (chartRes.results || []).map((row: any) => ({
    day: String(row.day || ''),
    total: Number(row.total || 0),
    box: Number(row.box || 0),
    prescription: Number(row.prescription || 0)
  }));

  return {
    today,
    sevenDays,
    thirtyDays,
    allTime,
    totalUsersAllTime,
    newUsersToday,
    newUsersAvgPerDay,
    activeUsersToday: today.activeUsers,
    activeUsers7d: sevenDays.activeUsers,
    activeUsers30d: thirtyDays.activeUsers,
    dailyGeminiLimit: 500,
    todayRequestsCount: today.totalRequests,
    dailyLimitHits: 0, // Feature to be implemented later
    dailyChart
  };
}

export async function fetchApiStats(db: D1Database) {
  const [todayReq, allTimeReq, todayFeed, allTimeFeed] = await Promise.all([
    db.prepare(`
      SELECT
        COUNT(*) AS total_today,
        SUM(CASE WHEN type = 'box' THEN 1 ELSE 0 END) AS box_today,
        SUM(CASE WHEN type = 'prescription' THEN 1 ELSE 0 END) AS prescription_today
      FROM requests
      WHERE created_at >= date('now') AND (device_id NOT LIKE 'test_%' AND device_id NOT LIKE 'bench_%')
    `).first<any>(),
    db.prepare(`
      SELECT
        type,
        COUNT(*) AS count,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
        SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) AS failure_count,
        SUM(CASE WHEN is_gemini_429 = 1 THEN 1 ELSE 0 END) AS gemini_429_count,
        SUM(COALESCE(medicines_count, 0)) AS medicines_count,
        SUM(COALESCE(unclear_count, 0)) AS unclear_count,
        SUM(CASE WHEN retry_needed = 1 THEN 1 ELSE 0 END) AS retries_count,
        SUM(CASE WHEN retry_improved = 1 THEN 1 ELSE 0 END) AS improved_count
      FROM requests
      WHERE (device_id NOT LIKE 'test_%' AND device_id NOT LIKE 'bench_%')
      GROUP BY type
    `).all<any>(),
    db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN rating = 'correct' THEN 1 ELSE 0 END) AS correct_count,
        SUM(CASE WHEN rating = 'wrong' THEN 1 ELSE 0 END) AS wrong_count
      FROM feedback
      WHERE (device_id NOT LIKE 'test_%' AND device_id NOT LIKE 'bench_%')
    `).first<any>(),
    db.prepare(`SELECT COUNT(DISTINCT device_id) AS total_users FROM requests WHERE (device_id NOT LIKE 'test_%' AND device_id NOT LIKE 'bench_%')`).first<any>()
  ]);

  let totalImages = 0;
  let boxStats = { total: 0, today: Number(todayReq?.box_today || 0), success_count: 0, failure_count: 0, success_rate: 0, failure_rate: 0 };
  let prescriptionStats = {
    total: 0,
    today: Number(todayReq?.prescription_today || 0),
    success_count: 0,
    failure_count: 0,
    success_rate: 0,
    failure_rate: 0,
    medicines_read: 0,
    unclear_medicines: 0,
    retries_count: 0,
    improved_count: 0
  };
  let gemini429Total = 0;

  for (const row of allTimeReq.results || []) {
    const count = Number(row.count || 0);
    const succ = Number(row.success_count || 0);
    const fail = Number(row.failure_count || 0);
    const succRate = count > 0 ? Math.round((succ / count) * 1000) / 10 : 0;
    const failRate = count > 0 ? Math.round((fail / count) * 1000) / 10 : 0;
    gemini429Total += Number(row.gemini_429_count || 0);
    totalImages += count;

    if (row.type === 'box') {
      boxStats.total = count;
      boxStats.success_count = succ;
      boxStats.failure_count = fail;
      boxStats.success_rate = succRate;
      boxStats.failure_rate = failRate;
    } else if (row.type === 'prescription') {
      prescriptionStats.total = count;
      prescriptionStats.success_count = succ;
      prescriptionStats.failure_count = fail;
      prescriptionStats.success_rate = succRate;
      prescriptionStats.failure_rate = failRate;
      prescriptionStats.medicines_read = Number(row.medicines_count || 0);
      prescriptionStats.unclear_medicines = Number(row.unclear_count || 0);
      prescriptionStats.retries_count = Number(row.retries_count || 0);
      prescriptionStats.improved_count = Number(row.improved_count || 0);
    }
  }

  const fbTotal = Number(todayFeed?.total || 0);
  const fbCorrect = Number(todayFeed?.correct_count || 0);
  const fbWrong = Number(todayFeed?.wrong_count || 0);

  return {
    total_images: totalImages,
    today_images: Number(todayReq?.total_today || 0),
    gemini_429_count: gemini429Total,
    total_users: Number(allTimeFeed?.total_users || 0),
    box: boxStats,
    prescription: prescriptionStats,
    feedback: {
      total: fbTotal,
      correct_count: fbCorrect,
      wrong_count: fbWrong,
      correct_rate: fbTotal > 0 ? Math.round((fbCorrect / fbTotal) * 1000) / 10 : 0,
      wrong_rate: fbTotal > 0 ? Math.round((fbWrong / fbTotal) * 1000) / 10 : 0
    }
  };
}
