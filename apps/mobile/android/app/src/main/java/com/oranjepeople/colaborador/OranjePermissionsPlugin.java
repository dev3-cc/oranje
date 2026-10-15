package com.oranjepeople.colaborador;

import android.content.Intent;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * El puente entre la pantalla nativa de Permisos y el worker (WebView).
 *
 *   check()           → { location, camera, gps, ready }   (ver PermissionsStatus)
 *   open({ firstName, locale, profile })
 *                     → profile "worker" (por defecto: ubicación, GPS, cámara
 *                       y «Ponchar») u "hotel" (notificaciones y «Continuar»)
 *                     → abre la pantalla y resuelve al cerrarla con
 *                       { action: "punch" | "home" | "back", ...estado }
 *   evento "permissionsChanged"
 *                     → cada vez que la app vuelve al frente (p. ej. de
 *                       Configuración), con el estado nuevo.
 *
 * Plugin local: se registra en `MainActivity`, sin paquete npm. Del lado web
 * lo llama `features/worker/lib/nativePermissions.ts`.
 */
@CapacitorPlugin(name = "OranjePermissions")
public class OranjePermissionsPlugin extends Plugin {

    @PluginMethod
    public void check(PluginCall call) {
        call.resolve(PermissionsStatus.toJs(getActivity()));
    }

    @PluginMethod
    public void open(PluginCall call) {
        String locale = call.getString("locale");
        if (locale != null) {
            PermissionsStatus.prefs(getContext()).edit().putString(PermissionsStatus.PREF_LOCALE, locale).apply();
        }
        Intent intent = new Intent(getContext(), PermissionsActivity.class);
        intent.putExtra(PermissionsActivity.EXTRA_FIRST_NAME, call.getString("firstName"));
        intent.putExtra(PermissionsActivity.EXTRA_PROFILE, call.getString("profile", PermissionsActivity.PROFILE_WORKER));
        startActivityForResult(call, intent, "onScreenClosed");
    }

    @ActivityCallback
    private void onScreenClosed(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        String action = data == null ? null : data.getStringExtra(PermissionsActivity.RESULT_ACTION);
        JSObject response = PermissionsStatus.toJs(getActivity());
        response.put("action", action == null ? PermissionsActivity.ACTION_BACK : action);
        call.resolve(response);
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        notifyListeners("permissionsChanged", PermissionsStatus.toJs(getActivity()));
    }
}
