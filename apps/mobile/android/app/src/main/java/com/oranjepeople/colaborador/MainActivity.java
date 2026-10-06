package com.oranjepeople.colaborador;

import android.os.Bundle;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        /* Los plugins locales se registran ANTES de super: ahí se arma el bridge. */
        registerPlugin(OranjePermissionsPlugin.class);
        super.onCreate(savedInstanceState);
        useDarkSystemBarIcons();
    }

    /*
     * Al volver de otra Activity (Permisos, Configuración) el sistema puede
     * restaurar la apariencia de las barras: se reafirma.
     */
    @Override
    public void onResume() {
        super.onResume();
        useDarkSystemBarIcons();
    }

    /**
     * La app es de tema claro siempre (fondos `surface`/`bg`): la hora, la
     * batería y la barra de gestos van en oscuro. Con la apariencia de fábrica
     * salían blancas sobre blanco, casi invisibles. Mismo criterio que
     * `PermissionsActivity`.
     */
    private void useDarkSystemBarIcons() {
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        bars.setAppearanceLightStatusBars(true);
        bars.setAppearanceLightNavigationBars(true);
    }
}
