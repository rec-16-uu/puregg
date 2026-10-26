package com.purpleegg.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/** 开机 / 覆盖安装后重排所有提醒 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        try {
            ReminderScheduler.resync(c);
        } catch (Exception e) {
            Log.w("PurpleEgg", "开机重排失败: " + e);
        }
    }
}
