package app.firsttry.host

import android.annotation.SuppressLint
import android.net.Uri
import android.util.Base64
import android.webkit.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import java.io.ByteArrayInputStream
import java.util.UUID
import java.util.zip.ZipInputStream
import kotlinx.coroutines.*
import org.bouncycastle.crypto.params.Ed25519PublicKeyParameters
import org.bouncycastle.crypto.signers.Ed25519Signer
import org.json.JSONObject

data class LoadedMini(
    val grant: JSONObject,
    val files: Map<String, ByteArray>,
    var token: String,
    val key: ByteArray,
)

suspend fun loadMini(api: Api, appId: String, versionId: String? = null): LoadedMini =
    withContext(Dispatchers.IO) {
        check(BuildConfig.DEBUG || BuildConfig.RUNTIME_PUBLIC_KEY.isNotEmpty()) {
            "Release runtime requires a pinned signing key and production API configuration."
        }
        val body = JSONObject().put("appId", appId).put("preview", versionId != null)
        if (versionId != null) body.put("versionId", versionId)
        val response = JSONObject(api.request("/sessions", "POST", body))
        val encoded = response.getString("payload")
        val signature =
            Base64.decode(
                response.getString("signature"),
                Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING,
            )
        val key =
            Base64.decode(
                if (BuildConfig.DEBUG) response.getString("publicKey")
                else BuildConfig.RUNTIME_PUBLIC_KEY,
                Base64.DEFAULT,
            )
        val verifier = Ed25519Signer()
        verifier.init(false, Ed25519PublicKeyParameters(key, key.size - 32))
        val payloadBytes = encoded.toByteArray()
        verifier.update(payloadBytes, 0, payloadBytes.size)
        check(verifier.verifySignature(signature)) { "Invalid launch signature" }
        val grant =
            JSONObject(
                String(
                    Base64.decode(encoded, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
                )
            )
        check(
            grant.getString("appId") == appId &&
                grant.getLong("expiresAt") > System.currentTimeMillis() / 1000
        ) {
            "Invalid or expired grant"
        }
        check(grant.getString("origin") == "https://app-$appId.mini.firsttry.invalid") {
            "Untrusted app origin"
        }
        val token = encoded + "." + response.getString("signature")
        val zip = api.binary(response.getString("bundlePath"), token)
        check(RuntimePolicy.hash(zip) == grant.getString("bundleHash")) { "Bundle hash mismatch" }
        val files = mutableMapOf<String, ByteArray>()
        var total = 0
        ZipInputStream(ByteArrayInputStream(zip)).use { input ->
            while (true) {
                val entry = input.nextEntry ?: break
                check(
                    RuntimePolicy.safePath(entry.name) &&
                        !files.containsKey(entry.name) &&
                        files.size < 64
                ) {
                    "Unsafe archive path"
                }
                val out = java.io.ByteArrayOutputStream()
                val b = ByteArray(8192)
                while (true) {
                    val count = input.read(b)
                    if (count < 0) break
                    total += count
                    check(total <= 6 * 1024 * 1024 && out.size() + count <= 2 * 1024 * 1024) {
                        "Bundle expansion limit"
                    }
                    out.write(b, 0, count)
                }
                val bytes = out.toByteArray()
                check(
                    RuntimePolicy.hash(bytes) ==
                        grant.getJSONObject("files").getJSONObject(entry.name).getString("hash")
                ) {
                    "Asset hash mismatch"
                }
                files[entry.name] = bytes
            }
        }
        check(
            files.keys == grant.getJSONObject("files").keys().asSequence().toSet() &&
                files.containsKey("index.html")
        ) {
            "Incomplete asset inventory"
        }
        LoadedMini(grant, files, token, key)
    }

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun MiniRuntime(
    loaded: LoadedMini,
    api: Api,
    modifier: Modifier = Modifier,
    onClose: () -> Unit,
    onFeedback: () -> Unit,
    onError: (String) -> Unit,
) {
    val scope = rememberCoroutineScope()
    val currentClose by rememberUpdatedState(onClose)
    val currentFeedback by rememberUpdatedState(onFeedback)
    val currentError by rememberUpdatedState(onError)
    var view by remember { mutableStateOf<WebView?>(null) }
    val nonce = remember(loaded) { UUID.randomUUID().toString() }
    val origin = loaded.grant.getString("origin")
    val disposed = remember(loaded) { java.util.concurrent.atomic.AtomicBoolean(false) }
    LaunchedEffect(loaded) {
        while (isActive) {
            delay(15000)
            try {
                val renewed =
                    JSONObject(
                        api.request(
                            "/sessions/${loaded.grant.getString("sessionId")}/renew",
                            "POST",
                            JSONObject(),
                            loaded.token,
                        )
                    )
                val encoded = renewed.getString("payload")
                val verifier = Ed25519Signer()
                verifier.init(false, Ed25519PublicKeyParameters(loaded.key, loaded.key.size - 32))
                val signed = encoded.toByteArray()
                verifier.update(signed, 0, signed.size)
                check(
                    verifier.verifySignature(
                        Base64.decode(
                            renewed.getString("signature"),
                            Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING,
                        )
                    )
                ) {
                    "Invalid renewal signature"
                }
                val grant =
                    JSONObject(
                        String(
                            Base64.decode(
                                encoded,
                                Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING,
                            )
                        )
                    )
                check(
                    grant.getString("sessionId") == loaded.grant.getString("sessionId") &&
                        grant.getString("versionId") == loaded.grant.getString("versionId") &&
                        grant.getLong("expiresAt") > System.currentTimeMillis() / 1000
                ) {
                    "Invalid renewed grant"
                }
                loaded.token = encoded + "." + renewed.getString("signature")
            } catch (e: Exception) {
                if (e is CancellationException) throw e
                android.os.Handler(android.os.Looper.getMainLooper()).post {
                    if (!disposed.get()) {
                        view?.stopLoading()
                        view?.loadUrl("about:blank")
                        currentError(e.message ?: "Session ended")
                    }
                }
                break
            }
        }
    }

    DisposableEffect(loaded) {
        onDispose {
            disposed.set(true)
            view?.apply {
                stopLoading()
                loadUrl("about:blank")
                clearHistory()
                clearCache(true)
                removeAllViews()
                destroy()
            }
            view = null
        }
    }
    AndroidView(
        modifier = modifier,
        factory = { context ->
            WebView(context).apply {
                view = this
                setBackgroundColor(android.graphics.Color.WHITE)
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = false
                    allowFileAccess = false
                    allowContentAccess = false
                    javaScriptCanOpenWindowsAutomatically = false
                    setSupportMultipleWindows(false)
                    mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                    setGeolocationEnabled(false)
                    mediaPlaybackRequiresUserGesture = true
                    cacheMode = WebSettings.LOAD_NO_CACHE
                    saveFormData = false
                }
                CookieManager.getInstance().setAcceptCookie(false)
                CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
                setDownloadListener { _, _, _, _, _ -> currentError("Downloads are not allowed") }
                webChromeClient =
                    object : WebChromeClient() {
                        override fun onPermissionRequest(request: PermissionRequest) {
                            request.deny()
                        }

                        override fun onShowFileChooser(
                            webView: WebView?,
                            filePathCallback: ValueCallback<Array<Uri>>?,
                            fileChooserParams: FileChooserParams?,
                        ): Boolean {
                            filePathCallback?.onReceiveValue(null)
                            return true
                        }
                    }
                webViewClient =
                    object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(
                            view: WebView?,
                            request: WebResourceRequest,
                        ): Boolean = !RuntimePolicy.permits(request.url.toString(), origin)

                        override fun shouldInterceptRequest(
                            view: WebView?,
                            request: WebResourceRequest,
                        ): WebResourceResponse {
                            if (!RuntimePolicy.permits(request.url.toString(), origin))
                                return WebResourceResponse(
                                    "text/plain",
                                    "UTF-8",
                                    403,
                                    "Blocked",
                                    mapOf("Cache-Control" to "no-store"),
                                    ByteArrayInputStream(ByteArray(0)),
                                )
                            val path = request.url.path!!.trimStart('/')
                            val bytes =
                                loaded.files[path]
                                    ?: return WebResourceResponse(
                                        "text/plain",
                                        "UTF-8",
                                        404,
                                        "Missing",
                                        emptyMap(),
                                        ByteArrayInputStream(ByteArray(0)),
                                    )
                            val mime =
                                when (path.substringAfterLast('.')) {
                                    "js" -> "text/javascript"
                                    "css" -> "text/css"
                                    "html" -> "text/html"
                                    "png" -> "image/png"
                                    "webp" -> "image/webp"
                                    "svg" -> "image/svg+xml"
                                    else -> "application/octet-stream"
                                }
                            return WebResourceResponse(
                                mime,
                                "UTF-8",
                                200,
                                "OK",
                                mapOf(
                                    "Content-Security-Policy" to
                                        "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; worker-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'",
                                    "X-Content-Type-Options" to "nosniff",
                                    "Cache-Control" to "no-store",
                                ),
                                ByteArrayInputStream(bytes),
                            )
                        }

                        override fun onRenderProcessGone(
                            view: WebView?,
                            detail: RenderProcessGoneDetail?,
                        ): Boolean {
                            if (!disposed.get())
                                currentError("Mini-app renderer stopped. Close and retry.")
                            return true
                        }

                        override fun onReceivedSslError(
                            view: WebView?,
                            handler: SslErrorHandler,
                            error: android.net.http.SslError?,
                        ) {
                            handler.cancel()
                            currentError("Secure connection failed")
                        }
                    }
                if (
                    WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) &&
                        WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
                ) {
                    var calls = 0
                    WebViewCompat.addWebMessageListener(this, "firsttryNative", setOf(origin)) {
                        _,
                        message,
                        source,
                        isMainFrame,
                        _ ->
                        if (
                            isMainFrame &&
                                source.toString() == origin &&
                                message.data != null &&
                                message.data!!.length <= 2048 &&
                                ++calls <= 100
                        ) {
                            runCatching {
                                val m = JSONObject(message.data!!)
                                check(m.getString("nonce") == nonce)
                                val required =
                                    when (m.getString("method")) {
                                        "analytics.track" -> "host.analytics"
                                        "feedback.prompt" -> "host.feedback"
                                        "ui.close" -> "host.close"
                                        else -> "unsupported"
                                    }
                                check(
                                    loaded.grant.getJSONArray("capabilities").let { arr ->
                                        (0 until arr.length())
                                            .map { arr.getString(it) }
                                            .contains(required)
                                    }
                                )
                                when (m.getString("method")) {
                                    "ui.close" -> currentClose()
                                    "feedback.prompt" -> currentFeedback()
                                    "analytics.track" -> {
                                        val event =
                                            JSONObject()
                                                .put("id", m.getString("id"))
                                                .put("name", m.getString("name"))
                                                .put(
                                                    "props",
                                                    m.optJSONObject("props") ?: JSONObject(),
                                                )
                                        scope.launch {
                                            runCatching {
                                                api.request(
                                                    "/events/batch",
                                                    "POST",
                                                    JSONObject()
                                                        .put(
                                                            "events",
                                                            org.json.JSONArray().put(event),
                                                        ),
                                                    loaded.token,
                                                )
                                            }
                                        }
                                    }
                                    else -> Unit
                                }
                            }
                        }
                    }
                    val config =
                        JSONObject()
                            .put("appId", loaded.grant.getString("appId"))
                            .put("versionId", loaded.grant.getString("versionId"))
                            .put("nonce", nonce)
                            .put("theme", "light")
                            .put("locale", "en")
                    WebViewCompat.addDocumentStartJavaScript(
                        this,
                        "globalThis.firsttryContext=$config;",
                        setOf(origin),
                    )
                }
                loadUrl("$origin/index.html")
            }
        },
    )
}
