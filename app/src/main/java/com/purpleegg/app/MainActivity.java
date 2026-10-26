package com.purpleegg.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/** 紫色的蛋：WebView 外壳 + JS 桥（数据存储 / 提醒调度 / 分享备份） */
public class MainActivity extends Activity {
    private static final String TAG = "PurpleEgg";
    private static final String PREFS = "purpleegg";
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDefaultTextEncodingName("utf-8");

        web.setBackgroundColor(0xFFF7F1FF);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage cm) {
                Log.i(TAG, "js: " + cm.message() + " @" + cm.lineNumber());
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "ZC");
        web.loadUrl("file:///android_asset/index.html");

        ReminderScheduler.ensureChannel(this);
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript(
                "(function(){var s=document.querySelectorAll('.sheet.show');if(s.length){var m=document.getElementById('mask');if(m){m.click();}return 'handled';}return 'exit';})()",
                value -> {
                    if (value == null || value.indexOf("exit") >= 0) {
                        MainActivity.super.onBackPressed();
                    }
                });
    }

    void askNotify() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1001);
        }
        if (Build.VERSION.SDK_INT >= 31) {
            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (am != null && !am.canScheduleExactAlarms()) {
                try {
                    Intent i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                    i.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(i);
                } catch (Exception e) {
                    Log.w(TAG, "exact alarm settings unavailable: " + e);
                }
            }
        }
    }

    void share(String title, String text) {
        try {
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("text/plain");
            i.putExtra(Intent.EXTRA_SUBJECT, title == null ? "紫色的蛋备份" : title);
            i.putExtra(Intent.EXTRA_TEXT, text == null ? "" : text);
            startActivity(Intent.createChooser(i, "导出备份到"));
        } catch (Exception e) {
            Toast.makeText(this, "分享失败：" + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    class Bridge {
        @JavascriptInterface
        public String loadData() {
            return getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("events", "");
        }

        @JavascriptInterface
        public void saveData(String json) {
            SharedPreferences.Editor ed = getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
            ed.putString("events", json == null ? "[]" : json);
            ed.apply();
        }

        @JavascriptInterface
        public void syncReminders(String json) {
            ReminderScheduler.sync(MainActivity.this, json);
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            runOnUiThread(() -> askNotify());
        }

        @JavascriptInterface
        public void shareText(String title, String text) {
            runOnUiThread(() -> share(title, text));
        }

        @JavascriptInterface
        public void toast(String msg) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, msg == null ? "" : msg, Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public String version() {
            return "1.0.0";
        }

        @JavascriptInterface
        public String platform() {
            return "android-" + Build.VERSION.SDK_INT;
        }
    }
}
