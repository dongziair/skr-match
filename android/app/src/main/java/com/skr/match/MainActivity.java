package com.skr.match;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 等 Bridge 初始化完成后注入自定义 WebViewClient
        getBridge().getWebView().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String scheme = url.getScheme();

                // 拦截 intent:// — MWA SDK 用这个唤起钱包 app
                if ("intent".equals(scheme)) {
                    try {
                        Intent intent = Intent.parseUri(url.toString(), Intent.URI_INTENT_SCHEME);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        return true;
                    } catch (Exception ignored) {}
                }

                // 拦截 solana-wallet:// — MWA 协议的 association scheme
                if ("solana-wallet".equals(scheme)) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, url);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        return true;
                    } catch (Exception ignored) {}
                }

                return super.shouldOverrideUrlLoading(view, request);
            }
        });
    }
}
