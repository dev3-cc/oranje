package com.oranjepeople.colaborador;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.os.Build;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.core.location.LocationManagerCompat;

import com.getcapacitor.JSObject;

/**
 * El estado de lo que el ponche necesita, leído del sistema operativo —no del
 * WebView—: la pantalla nativa lo pinta y el plugin se lo manda al worker.
 *
 * Cada permiso queda en uno de estos estados:
 *   granted      concedido.
 *   prompt       falta, y el sistema todavía deja preguntar.
 *   denied       falta y ya no se puede preguntar: solo desde Configuración.
 *   approximate  (solo ubicación) Android 12+ con «ubicación aproximada»:
 *                hay permiso, pero la geocerca del hotel puede fallar.
 */
final class PermissionsStatus {

    static final String GRANTED = "granted";
    static final String PROMPT = "prompt";
    static final String DENIED = "denied";
    static final String APPROXIMATE = "approximate";

    static final String PREFS = "oranje_permissions";
    static final String PREF_LOCALE = "locale";
    private static final String PREF_ASKED = "asked_";

    private PermissionsStatus() {}

    /*
     * Android no dice si un permiso está «bloqueado». Lo que da es
     * `shouldShowRequestPermissionRationale`, que vale false en DOS casos
     * opuestos: nunca se ha preguntado, o se negó para siempre. Por eso se
     * recuerda aquí si ya se preguntó alguna vez.
     */
    static void markAsked(Context context, String... permissions) {
        SharedPreferences.Editor editor = prefs(context).edit();
        for (String permission : permissions) editor.putBoolean(PREF_ASKED + permission, true);
        editor.apply();
    }

    static String camera(Activity activity) {
        return state(activity, Manifest.permission.CAMERA);
    }

    static String location(Activity activity) {
        if (isGranted(activity, Manifest.permission.ACCESS_FINE_LOCATION)) return GRANTED;
        if (isGranted(activity, Manifest.permission.ACCESS_COARSE_LOCATION)) return APPROXIMATE;
        return state(activity, Manifest.permission.ACCESS_FINE_LOCATION);
    }

    /** Si la ubicación precisa todavía se puede pedir con el diálogo del sistema. */
    static boolean canAskPreciseLocation(Activity activity) {
        return !DENIED.equals(state(activity, Manifest.permission.ACCESS_FINE_LOCATION));
    }

    /**
     * Las notificaciones de la app (perfil de hotel). En Android 13+ son un
     * permiso que se pide; antes de 13 vienen encendidas y solo se apagan desde
     * Configuración. En los dos casos, si la persona las apagó en Configuración
     * cuentan como bloqueadas aunque el permiso siga concedido.
     */
    static String notifications(Activity activity) {
        boolean enabled = NotificationManagerCompat.from(activity).areNotificationsEnabled();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return enabled ? GRANTED : DENIED;
        String state = state(activity, Manifest.permission.POST_NOTIFICATIONS);
        return GRANTED.equals(state) && !enabled ? DENIED : state;
    }

    /** El interruptor de «Ubicación» del teléfono, independiente del permiso de la app. */
    static boolean isGpsOn(Context context) {
        LocationManager manager = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
        return manager != null && LocationManagerCompat.isLocationEnabled(manager);
    }

    static boolean isReady(Activity activity) {
        return GRANTED.equals(location(activity)) && GRANTED.equals(camera(activity)) && isGpsOn(activity);
    }

    /** Lo que recibe el WebView: `{ location, camera, gps, ready, notifications }`. */
    static JSObject toJs(Activity activity) {
        JSObject result = new JSObject();
        result.put("notifications", notifications(activity));
        result.put("location", location(activity));
        result.put("camera", camera(activity));
        result.put("gps", isGpsOn(activity));
        result.put("ready", isReady(activity));
        return result;
    }

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static String state(Activity activity, String permission) {
        if (isGranted(activity, permission)) return GRANTED;
        if (!prefs(activity).getBoolean(PREF_ASKED + permission, false)) return PROMPT;
        return ActivityCompat.shouldShowRequestPermissionRationale(activity, permission) ? PROMPT : DENIED;
    }

    private static boolean isGranted(Context context, String permission) {
        return ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED;
    }
}
