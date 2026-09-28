package com.oranjepeople.colaborador;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        /* Los plugins locales se registran ANTES de super: ahí se arma el bridge. */
        registerPlugin(OranjePermissionsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
