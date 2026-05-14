package com.papacromos.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applyFixedWebViewScale();
    }

    @Override
    public void onResume() {
        super.onResume();
        applyFixedWebViewScale();
    }

    private void applyFixedWebViewScale() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        getBridge().getWebView().getSettings().setTextZoom(100);
        getBridge().getWebView().getSettings().setSupportZoom(false);
        getBridge().getWebView().getSettings().setBuiltInZoomControls(false);
        getBridge().getWebView().getSettings().setDisplayZoomControls(false);
    }
}
