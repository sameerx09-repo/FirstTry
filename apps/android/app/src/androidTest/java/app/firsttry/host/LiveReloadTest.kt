package app.firsttry.host

import android.content.Intent
import android.net.Uri
import android.util.Base64
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

/** A saved file in `firsttry dev` becomes a new dev build; an open host swaps to it by itself. */
class LiveReloadTest {
    @get:Rule val rule = createAndroidComposeRule<MainActivity>()

    private fun findWeb(view: View): WebView? {
        if (view is WebView) return view
        if (view is ViewGroup)
            for (i in 0 until view.childCount) {
                val found = findWeb(view.getChildAt(i))
                if (found != null) return found
            }
        return null
    }

    private fun evaluate(script: String): String {
        val value = AtomicReference<String>("")
        val latch = CountDownLatch(1)
        rule.runOnUiThread {
            val web = findWeb(rule.activity.window.decorView)
            if (web == null) latch.countDown()
            else
                web.evaluateJavascript(script) {
                    value.set(it)
                    latch.countDown()
                }
        }
        latch.await(5, TimeUnit.SECONDS)
        return value.get()
    }

    private fun bundle(slug: String, text: String): String {
        val manifest =
            JSONObject()
                .put("id", slug)
                .put("name", "Live Reload")
                .put("description", "Reloads when a dev build is uploaded")
                .put("version", "1.0.0")
                .put("runtime", "webview-v1")
                .put("entry", "index.html")
                .put("category", "utility")
                .put("estimatedDurationSeconds", 30)
                .put("ageRating", "general")
                .put("capabilities", JSONArray())
                .put("network", JSONObject().put("allowedDomains", JSONArray()))
                .put("assets", JSONObject())
        val out = java.io.ByteArrayOutputStream()
        java.util.zip.ZipOutputStream(out).use { zip ->
            for ((name, value) in
                mapOf(
                    "manifest.json" to manifest.toString(),
                    "index.html" to
                        "<!doctype html><title>Live</title><h1 id=\"t\"></h1><script src=\"app.js\"></script>",
                    "app.js" to "document.getElementById('t').textContent='$text';",
                )) {
                zip.putNextEntry(java.util.zip.ZipEntry(name))
                zip.write(value.toByteArray())
                zip.closeEntry()
            }
        }
        return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    }

    @Test
    fun openHostReloadsWhenANewDevBuildIsUploaded() {
        if (rule.onAllNodesWithText("I'm 18+ · Start exploring").fetchSemanticsNodes().isNotEmpty())
            rule.onNodeWithText("I'm 18+ · Start exploring").performClick()
        // The search field is always composed; catalog tiles can sit below the fold.
        rule.waitUntil(30000) { rule.onAllNodes(hasSetTextAction()).fetchSemanticsNodes().isNotEmpty() }
        // Private previews need the *host's* own session, so sign in through its UI.
        rule.onNodeWithText("Profile", useUnmergedTree = true).performClick()
        rule.onNodeWithText("Sign in").performClick()
        rule.onNode(hasText("Email") and hasSetTextAction()).performTextInput("developer@firsttry.local")
        rule.onNode(hasText("Password") and hasSetTextAction()).performTextInput("FirstTry-local-2026!")
        rule.onAllNodes(hasText("Sign in") and hasClickAction()).onLast().performClick()
        rule.waitUntil(15000) {
            rule.onAllNodesWithText("FirstTry Studio", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
        }
        val api = Api(rule.activity)
        val slug = "reload-" + System.currentTimeMillis()
        lateinit var appId: String
        fun upload(text: String) = runBlocking {
            JSONObject(
                    api.request(
                        "/developer/apps/$appId/upload",
                        "POST",
                        JSONObject().put("zipBase64", bundle(slug, text)).put("dev", true),
                    )
                )
                .getString("id")
        }
        runBlocking {
            api.request(
                "/auth/login",
                "POST",
                JSONObject()
                    .put("email", "developer@firsttry.local")
                    .put("password", "FirstTry-local-2026!"),
            )
            appId =
                JSONObject(
                        api.request(
                            "/developer/apps",
                            "POST",
                            JSONObject()
                                .put("slug", slug)
                                .put("title", "Live Reload")
                                .put("summary", "Reloads when a dev build is uploaded")
                                .put("category", "utility"),
                        )
                    )
                    .getString("id")
        }
        upload("build one")
        rule.runOnUiThread {
            rule.activity.startActivity(
                Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse("firsttry://preview/$appId?dev=1"),
                        rule.activity,
                        MainActivity::class.java,
                    )
                    .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            )
        }
        rule.waitUntil(30000) { evaluate("document.body.textContent").contains("build one") }
        val first = evaluate("globalThis.firsttryContext.versionId")
        assertTrue(first.length > 10)

        // The developer saves a file: `firsttry dev` uploads a new dev build.
        upload("build two")
        rule.waitUntil(30000) { evaluate("document.body.textContent").contains("build two") }
        val second = evaluate("globalThis.firsttryContext.versionId")
        assertNotEquals(first, second)

        // And again, with no interaction from the user.
        upload("build three")
        rule.waitUntil(30000) { evaluate("document.body.textContent").contains("build three") }
        rule.onNodeWithContentDescription("Close mini-app").assertExists()
    }
}
