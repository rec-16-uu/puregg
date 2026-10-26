package com.purpleegg.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

/** 闹钟登记 / 取消 / 开机重排 */
public class ReminderScheduler {
    private static final String TAG = "PurpleEgg";
    private static final String PREFS = "purpleegg_reminders";
    private static final String RAW = "__raw";
    public static final String CHANNEL = "purpleegg-reminders";

    public static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(CHANNEL) == null) {
                NotificationChannel ch = new NotificationChannel(CHANNEL, "紫色的蛋 · 行程提醒", NotificationManager.IMPORTANCE_HIGH);
                ch.setDescription("任务开始时提醒");
                ch.enableVibration(true);
                nm.createNotificationChannel(ch);
            }
        }
    }

    /** 全量重排：先取消旧的，再按最新的列表登记，幂等 */
    public static void sync(Context c, String json) {
        SharedPreferences sp = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        for (String key : sp.getAll().keySet()) {
            if (key.startsWith("__")) continue;
            cancel(c, key);
        }
        sp.edit().clear().putString(RAW, json == null ? "" : json).apply();
        if (json == null || json.trim().isEmpty()) return;

        long now = System.currentTimeMillis();
        int count = 0;
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                String id = o.optString("id", "");
                long at = o.optLong("at", 0L);
                if (id.isEmpty() || at <= now) continue;
                schedule(c, id, at, o.optString("title", "任务"), o.optString("text", ""));
                sp.edit().putLong(id, at).apply();
                count++;
            }
        } catch (Exception e) {
            Log.w(TAG, "syncReminders 解析失败: " + e);
        }
        Log.i(TAG, "已登记 " + count + " 个提醒");
    }

    public static void resync(Context c) {
        String raw = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(RAW, "");
        if (raw != null && !raw.trim().isEmpty()) sync(c, raw);
    }

    private static void schedule(Context c, String id, long at, String title, String text) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = pending(c, id, title, text);
        try {
            if (Build.VERSION.SDK_INT >= 31) {
                if (am.canScheduleExactAlarms()) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                } else {
                    am.setWindow(AlarmManager.RTC_WAKEUP, at, 10 * 60 * 1000L, pi);
                }
            } else if (Build.VERSION.SDK_INT >= 23) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, at, pi);
            }
        } catch (SecurityException se) {
            am.set(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    private static void cancel(Context c, String id) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = PendingIntent.getBroadcast(c, id.hashCode(), new Intent(c, AlarmReceiver.class)
                .setAction("com.purpleegg.app.REMIND." + id), pendingFlags());
        am.cancel(pi);
        pi.cancel();
    }

    private static PendingIntent pending(Context c, String id, String title, String text) {
        Intent i = new Intent(c, AlarmReceiver.class);
        i.setAction("com.purpleegg.app.REMIND." + id);
        i.putExtra("id", id);
        i.putExtra("title", title);
        i.putExtra("text", text);
        return PendingIntent.getBroadcast(c, id.hashCode(), i, pendingFlags());
    }

    private static int pendingFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
        return flags;
    }
}
