package com.skr.match;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Capacitor plugin that bridges the Solana Mobile Wallet Adapter (MWA) protocol
 * to the WebView layer. This enables Seeker Wallet and other MWA-compatible wallets
 * to connect with the app running as a standalone Capacitor APK.
 *
 * Uses the MWA Client Library for protocol handling.
 */
@CapacitorPlugin(name = "MwaBridge")
public class MwaBridgePlugin extends Plugin {

    private static final String TAG = "MwaBridge";

    // MWA protocol constants
    private static final String MWA_SCHEME = "solana-wallet";
    private static final String CLUSTER = "mainnet-beta";

    // App identity for MWA association
    private static final String APP_NAME = "SKR Match";
    private static final String APP_URI = "https://skr-match.app";



    // Stored state for MWA sessions
    private String authToken;
    private String walletPublicKey;
    private String walletUri;

    // Thread pool for background operations
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    /**
     * Check if MWA is available on this device.
     * Returns true if there is at least one app that handles solana-wallet:// intents.
     */
    @PluginMethod
    public void isAvailable(PluginCall call) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setData(Uri.parse(MWA_SCHEME + "://"));
            boolean available = intent.resolveActivity(getContext().getPackageManager()) != null;
            JSObject result = new JSObject();
            result.put("available", available);
            call.resolve(result);
        } catch (Exception e) {
            JSObject result = new JSObject();
            result.put("available", false);
            call.resolve(result);
        }
    }

    /**
     * Authorize with an MWA-compatible wallet.
     * Opens the wallet selector and requests authorization.
     */
    @PluginMethod
    public void authorize(PluginCall call) {
        try {
            // Build MWA authorize URL
            // MWA 1.0 format: solana-wallet://?<params>
            // The authorize request is a JSON-RPC-like message
            String identity = buildIdentityJson();
            String authFeature = buildAuthorizeFeature();
            String message = buildMwaMessage("authorize", identity, CLUSTER, authFeature);

            String url = MWA_SCHEME + "://v1/associate/local?" + "message=" + Uri.encode(message);

            Log.d(TAG, "Starting MWA authorize: " + url);

            // Store the pending call
            saveCall(call);

            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            try {
                startActivityForResult(call, intent, "handleAuthorizeResult");
            } catch (ActivityNotFoundException e) {
                // No wallet app installed
                call.reject("No Solana wallet app found. Please install Seeker Wallet or another MWA-compatible wallet.");
            }
        } catch (Exception e) {
            Log.e(TAG, "Authorize failed", e);
            call.reject("MWA authorize failed: " + e.getMessage(), e);
        }
    }

    /**
     * Handle the authorization result from the wallet app.
     */
    protected void handleAuthorizeResult(PluginCall call, int resultCode, Intent data) {
        if (resultCode == Activity.RESULT_OK && data != null) {
            try {
                // The wallet returns the result as extras or as a URI
                Uri resultUri = data.getData();
                if (resultUri != null) {
                    parseAuthResult(resultUri);
                }

                // Try getting from extras
                if (data.hasExtra("result")) {
                    byte[] resultBytes = data.getByteArrayExtra("result");
                    if (resultBytes != null) {
                        parseAuthResultBytes(resultBytes);
                    }
                }

                // Fallback: check all extras
                if (walletPublicKey == null) {
                    parseAuthResultFromExtras(data);
                }

                if (walletPublicKey != null) {
                    JSObject result = new JSObject();
                    result.put("publicKey", walletPublicKey);
                    result.put("authToken", authToken != null ? authToken : "");
                    result.put("walletUri", walletUri != null ? walletUri : "");
                    call.resolve(result);
                } else {
                    call.reject("Authorization succeeded but no public key was returned");
                }
            } catch (Exception e) {
                Log.e(TAG, "Parse auth result failed", e);
                call.reject("Failed to parse wallet authorization result: " + e.getMessage());
            }
        } else if (resultCode == Activity.RESULT_CANCELED) {
            call.reject("Wallet authorization was cancelled");
        } else {
            call.reject("Wallet authorization failed with result code: " + resultCode);
        }
    }

    /**
     * Sign a transaction using MWA.
     * Takes a base64-encoded serialized transaction and returns the signed version.
     */
    @PluginMethod
    public void signTransaction(PluginCall call) {
        String transactionBase64 = call.getString("transaction");
        if (transactionBase64 == null || transactionBase64.isEmpty()) {
            call.reject("Missing transaction parameter");
            return;
        }

        if (authToken == null || walletPublicKey == null) {
            call.reject("Not authorized. Call authorize() first.");
            return;
        }

        try {
            String message = buildSignTransactionsMessage(transactionBase64);
            String url = MWA_SCHEME + "://v1/sign/transactions?" + "message=" + Uri.encode(message);

            saveCall(call);

            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            startActivityForResult(call, intent, "handleSignTransactionResult");
        } catch (Exception e) {
            Log.e(TAG, "signTransaction failed", e);
            call.reject("MWA signTransaction failed: " + e.getMessage());
        }
    }

    /**
     * Handle the sign transaction result from the wallet app.
     */
    protected void handleSignTransactionResult(PluginCall call, int resultCode, Intent data) {
        if (resultCode == Activity.RESULT_OK && data != null) {
            try {
                byte[] resultBytes = null;

                if (data.hasExtra("result")) {
                    resultBytes = data.getByteArrayExtra("result");
                }

                if (resultBytes == null && data.getData() != null) {
                    // Try parsing from URI
                    String encoded = data.getData().getQueryParameter("result");
                    if (encoded != null) {
                        resultBytes = Base64.decode(encoded, Base64.DEFAULT);
                    }
                }

                if (resultBytes != null) {
                    // MWA response: [signed_transactions_base64]
                    String resultStr = new String(resultBytes, StandardCharsets.UTF_8);
                    // Parse the signed transaction from the response
                    String signedTx = parseSignedTransaction(resultStr);

                    JSObject result = new JSObject();
                    result.put("signedTransaction", signedTx);
                    call.resolve(result);
                } else {
                    call.reject("No signed transaction returned by wallet");
                }
            } catch (Exception e) {
                Log.e(TAG, "Parse sign result failed", e);
                call.reject("Failed to parse signed transaction: " + e.getMessage());
            }
        } else if (resultCode == Activity.RESULT_CANCELED) {
            call.reject("Transaction signing was cancelled");
        } else {
            call.reject("Transaction signing failed");
        }
    }

    /**
     * Sign a message using MWA.
     */
    @PluginMethod
    public void signMessage(PluginCall call) {
        String messageBase64 = call.getString("message");
        if (messageBase64 == null || messageBase64.isEmpty()) {
            call.reject("Missing message parameter");
            return;
        }

        if (authToken == null || walletPublicKey == null) {
            call.reject("Not authorized. Call authorize() first.");
            return;
        }

        try {
            String message = buildSignMessagesMessage(messageBase64);
            String url = MWA_SCHEME + "://v1/sign/messages?" + "message=" + Uri.encode(message);

            saveCall(call);

            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            startActivityForResult(call, intent, "handleSignMessageResult");
        } catch (Exception e) {
            Log.e(TAG, "signMessage failed", e);
            call.reject("MWA signMessage failed: " + e.getMessage());
        }
    }

    /**
     * Handle the sign message result from the wallet app.
     */
    protected void handleSignMessageResult(PluginCall call, int resultCode, Intent data) {
        if (resultCode == Activity.RESULT_OK && data != null) {
            try {
                byte[] resultBytes = null;

                if (data.hasExtra("result")) {
                    resultBytes = data.getByteArrayExtra("result");
                }

                if (resultBytes != null) {
                    String resultStr = new String(resultBytes, StandardCharsets.UTF_8);
                    String signedMessage = parseSignedMessage(resultStr);

                    JSObject result = new JSObject();
                    result.put("signedMessage", signedMessage);
                    call.resolve(result);
                } else {
                    call.reject("No signed message returned by wallet");
                }
            } catch (Exception e) {
                Log.e(TAG, "Parse sign message result failed", e);
                call.reject("Failed to parse signed message: " + e.getMessage());
            }
        } else if (resultCode == Activity.RESULT_CANCELED) {
            call.reject("Message signing was cancelled");
        } else {
            call.reject("Message signing failed");
        }
    }

    /**
     * Deauthorize the current session.
     */
    @PluginMethod
    public void deauthorize(PluginCall call) {
        authToken = null;
        walletPublicKey = null;
        walletUri = null;
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }

    // MWA Message Builders

    private String buildIdentityJson() {
        return "{\"name\":\"" + APP_NAME + "\",\"uri\":\"" + APP_URI + "\"}";
    }

    private String buildAuthorizeFeature() {
        return "{\"features\":[\"solana:signAndSendTransaction\",\"solana:signTransaction\",\"solana:signMessage\"]}";
    }

    private String buildMwaMessage(String method, String... params) {
        StringBuilder sb = new StringBuilder("[\"").append(method).append("\"");
        for (String param : params) {
            sb.append(",").append(param);
        }
        sb.append("]");
        return sb.toString();
    }

    private String buildSignTransactionsMessage(String txBase64) {
        return "[\"sign_transactions\"" +
               ",{\"payloads\":[\"" + txBase64 + "\"]}" +
               "]";
    }

    private String buildSignMessagesMessage(String msgBase64) {
        return "[\"sign_messages\"" +
               ",{\"payloads\":[\"" + msgBase64 + "\"]}" +
               "]";
    }

    // Result Parsers

    private void parseAuthResult(Uri uri) {
        // MWA 1.0: solana-wallet://result?public_key=<base58>&auth_token=<token>
        String publicKeyParam = uri.getQueryParameter("public_key");
        if (publicKeyParam != null) {
            walletPublicKey = publicKeyParam;
        }
        authToken = uri.getQueryParameter("auth_token");
        walletUri = uri.getQueryParameter("wallet_uri");
    }

    private void parseAuthResultBytes(byte[] bytes) {
        try {
            String jsonStr = new String(bytes, StandardCharsets.UTF_8);
            JSONArray array = new JSONArray(jsonStr);
            if (array.length() >= 2) {
                JSONObject obj = array.getJSONObject(1);
                if (obj.has("public_key")) {
                    walletPublicKey = obj.getString("public_key");
                }
                if (obj.has("auth_token")) {
                    authToken = obj.getString("auth_token");
                }
                if (obj.has("wallet_uri")) {
                    walletUri = obj.getString("wallet_uri");
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to parse auth result bytes", e);
        }
    }

    private void parseAuthResultFromExtras(Intent data) {
        // Try to extract from intent extras
        if (data.hasExtra("public_key")) {
            walletPublicKey = data.getStringExtra("public_key");
        }
        if (data.hasExtra("publicKey")) {
            walletPublicKey = data.getStringExtra("publicKey");
        }
        if (data.hasExtra("auth_token")) {
            authToken = data.getStringExtra("auth_token");
        }
        if (data.hasExtra("authToken")) {
            authToken = data.getStringExtra("authToken");
        }
    }

    private String parseSignedTransaction(String resultJson) {
        try {
            JSONArray array = new JSONArray(resultJson);
            if (array.length() >= 2) {
                JSONObject obj = array.getJSONObject(1);
                if (obj.has("signed_payloads")) {
                    JSONArray payloads = obj.getJSONArray("signed_payloads");
                    if (payloads.length() > 0) {
                        return payloads.getString(0);
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to parse signed transaction", e);
        }
        return resultJson;
    }

    private String parseSignedMessage(String resultJson) {
        return parseSignedTransaction(resultJson); // Same format
    }
}
