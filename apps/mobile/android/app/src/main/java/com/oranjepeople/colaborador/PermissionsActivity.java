package com.oranjepeople.colaborador;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.DrawableRes;
import androidx.annotation.Nullable;
import androidx.annotation.StringRes;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import java.util.Locale;

/**
 * La pantalla de Permisos, nativa. Se abre después del login y desde
 * «Permisos» en el menú del avatar (ver `OranjePermissionsPlugin`).
 *
 * Muestra si hay permiso de ubicación, si el GPS está encendido y si hay
 * permiso de cámara; para lo que falta, un botón que lo pide o que abre la
 * configuración del teléfono. «Ponchar» solo se habilita con todo en verde.
 *
 * Al cerrarse devuelve `action`: "punch" (ir a Ponchar), "home" (a Inicio) o
 * "back" (el botón Atrás del sistema: solo cerrar, quedarse donde se estaba).
 */
public class PermissionsActivity extends AppCompatActivity {

    static final String EXTRA_FIRST_NAME = "firstName";
    static final String RESULT_ACTION = "action";
    static final String ACTION_PUNCH = "punch";
    static final String ACTION_HOME = "home";
    static final String ACTION_BACK = "back";

    private static final String[] LOCATION_PERMISSIONS = {
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION,
    };

    private final ActivityResultLauncher<String[]> requestPermissions =
        registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), result -> render());

    private View locationCard;
    private View gpsCard;
    private View cameraCard;
    private TextView summary;
    private TextView punchLocked;
    private Button punch;

    /*
     * El idioma es el del worker (el que eligió la persona, D-36), no el del
     * teléfono: el plugin lo deja en las preferencias antes de abrir. Se aplica
     * aquí porque el Intent todavía no existe en `attachBaseContext`.
     */
    @Override
    protected void attachBaseContext(Context base) {
        String tag = PermissionsStatus.prefs(base).getString(PermissionsStatus.PREF_LOCALE, null);
        if (tag != null) {
            Configuration config = new Configuration(base.getResources().getConfiguration());
            config.setLocale(Locale.forLanguageTag(tag));
            base = base.createConfigurationContext(config);
        }
        super.attachBaseContext(base);
    }

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_permissions);

        /* Android 15 dibuja de borde a borde: los márgenes de las barras los pone la raíz. */
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(true);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightNavigationBars(true);
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.perm_root), (view, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        String firstName = getIntent().getStringExtra(EXTRA_FIRST_NAME);
        TextView greeting = findViewById(R.id.perm_greeting);
        greeting.setText(firstName == null || firstName.trim().isEmpty()
            ? getString(R.string.perm_greeting_anonymous)
            : getString(R.string.perm_greeting, firstName.trim()));

        summary = findViewById(R.id.perm_summary);
        punchLocked = findViewById(R.id.perm_punch_locked);
        punch = findViewById(R.id.perm_punch);
        locationCard = findViewById(R.id.perm_card_location);
        gpsCard = findViewById(R.id.perm_card_gps);
        cameraCard = findViewById(R.id.perm_card_camera);

        setupCard(locationCard, R.drawable.ic_perm_location, R.string.perm_location_title, R.string.perm_location_body);
        setupCard(gpsCard, R.drawable.ic_perm_gps, R.string.perm_gps_title, R.string.perm_gps_body);
        setupCard(cameraCard, R.drawable.ic_perm_camera, R.string.perm_camera_title, R.string.perm_camera_body);

        punch.setOnClickListener(view -> {
            /* Doble candado: el botón ya está deshabilitado, pero se verifica al tocar. */
            if (PermissionsStatus.isReady(this)) finishWith(ACTION_PUNCH);
        });
        findViewById(R.id.perm_go_home).setOnClickListener(view -> finishWith(ACTION_HOME));
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                finishWith(ACTION_BACK);
            }
        });
    }

    /** Al volver de Configuración (o del diálogo del sistema) el estado puede haber cambiado. */
    @Override
    protected void onResume() {
        super.onResume();
        render();
    }

    private void render() {
        renderLocation();
        renderGps();
        renderCamera();

        boolean ready = PermissionsStatus.isReady(this);
        summary.setText(ready ? R.string.perm_summary_ready : R.string.perm_summary_missing);
        punchLocked.setVisibility(ready ? View.GONE : View.VISIBLE);
        punch.setEnabled(ready);
        punch.setAlpha(ready ? 1f : 0.5f);
    }

    private void renderLocation() {
        switch (PermissionsStatus.location(this)) {
            case PermissionsStatus.GRANTED:
                bind(locationCard, Tone.OK, R.string.perm_state_granted, 0, 0, null);
                break;
            case PermissionsStatus.APPROXIMATE:
                if (PermissionsStatus.canAskPreciseLocation(this)) {
                    bind(locationCard, Tone.WARN, R.string.perm_state_approximate, R.string.perm_hint_approximate,
                        R.string.perm_action_precise, this::askLocation);
                } else {
                    bind(locationCard, Tone.WARN, R.string.perm_state_approximate, R.string.perm_hint_approximate,
                        R.string.perm_action_settings, this::openAppSettings);
                }
                break;
            case PermissionsStatus.PROMPT:
                bind(locationCard, Tone.WARN, R.string.perm_state_missing, 0, R.string.perm_action_grant, this::askLocation);
                break;
            default:
                bind(locationCard, Tone.ERROR, R.string.perm_state_blocked, R.string.perm_hint_blocked,
                    R.string.perm_action_settings, this::openAppSettings);
        }
    }

    private void renderGps() {
        if (PermissionsStatus.isGpsOn(this)) {
            bind(gpsCard, Tone.OK, R.string.perm_state_on, 0, 0, null);
        } else {
            bind(gpsCard, Tone.ERROR, R.string.perm_state_off, 0, R.string.perm_action_gps,
                () -> startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)));
        }
    }

    private void renderCamera() {
        switch (PermissionsStatus.camera(this)) {
            case PermissionsStatus.GRANTED:
                bind(cameraCard, Tone.OK, R.string.perm_state_granted, 0, 0, null);
                break;
            case PermissionsStatus.PROMPT:
                bind(cameraCard, Tone.WARN, R.string.perm_state_missing, 0, R.string.perm_action_grant, this::askCamera);
                break;
            default:
                bind(cameraCard, Tone.ERROR, R.string.perm_state_blocked, R.string.perm_hint_blocked,
                    R.string.perm_action_settings, this::openAppSettings);
        }
    }

    private void askLocation() {
        PermissionsStatus.markAsked(this, LOCATION_PERMISSIONS);
        requestPermissions.launch(LOCATION_PERMISSIONS);
    }

    private void askCamera() {
        PermissionsStatus.markAsked(this, Manifest.permission.CAMERA);
        requestPermissions.launch(new String[] {Manifest.permission.CAMERA});
    }

    /** La ficha de la app en Configuración, donde están sus permisos. */
    private void openAppSettings() {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getPackageName(), null));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);
    }

    private void finishWith(String action) {
        setResult(RESULT_OK, new Intent().putExtra(RESULT_ACTION, action));
        finish();
    }

    private enum Tone { OK, WARN, ERROR }

    private void setupCard(View card, @DrawableRes int icon, @StringRes int title, @StringRes int body) {
        ((ImageView) card.findViewById(R.id.perm_icon)).setImageResource(icon);
        ((TextView) card.findViewById(R.id.perm_title)).setText(title);
        ((TextView) card.findViewById(R.id.perm_body)).setText(body);
    }

    /** Pinta el chip de estado y, si hace falta, la pista y el botón de la tarjeta. `0` = sin pista / sin botón. */
    private void bind(View card, Tone tone, @StringRes int chipText, @StringRes int hint, @StringRes int actionText,
                      @Nullable Runnable action) {
        TextView chip = card.findViewById(R.id.perm_chip);
        chip.setText(chipText);
        int background;
        int icon;
        int iconTint;
        switch (tone) {
            case OK:
                background = R.drawable.bg_perm_chip_ok;
                icon = R.drawable.ic_perm_ok;
                iconTint = R.color.green;
                break;
            case WARN:
                background = R.drawable.bg_perm_chip_warn;
                icon = R.drawable.ic_perm_warn;
                iconTint = R.color.o_700;
                break;
            default:
                background = R.drawable.bg_perm_chip_error;
                icon = R.drawable.ic_perm_blocked;
                iconTint = R.color.red;
        }
        chip.setBackgroundResource(background);
        chip.setCompoundDrawablesRelativeWithIntrinsicBounds(icon, 0, 0, 0);
        int size = Math.round(16 * getResources().getDisplayMetrics().density);
        android.graphics.drawable.Drawable drawable = chip.getCompoundDrawablesRelative()[0].mutate();
        drawable.setBounds(0, 0, size, size);
        drawable.setTint(getColor(iconTint));
        chip.setCompoundDrawablesRelative(drawable, null, null, null);

        TextView hintView = card.findViewById(R.id.perm_hint);
        hintView.setVisibility(hint == 0 ? View.GONE : View.VISIBLE);
        if (hint != 0) hintView.setText(hint);

        Button button = card.findViewById(R.id.perm_action);
        button.setVisibility(action == null ? View.GONE : View.VISIBLE);
        if (action != null) {
            button.setText(actionText);
            button.setOnClickListener(view -> action.run());
        }
    }
}
