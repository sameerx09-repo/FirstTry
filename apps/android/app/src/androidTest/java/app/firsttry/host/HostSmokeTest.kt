package app.firsttry.host

import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class HostSmokeTest {
    @get:Rule val rule = createAndroidComposeRule<MainActivity>()

    private fun enter() {
        if (rule.onAllNodesWithText("I'm 18+ · Start exploring").fetchSemanticsNodes().isNotEmpty())
            rule.onNodeWithText("I'm 18+ · Start exploring").performClick()
        rule.waitUntil(30000) {
            rule
                .onAllNodesWithText("Color Clash", useUnmergedTree = true)
                .fetchSemanticsNodes()
                .isNotEmpty()
        }
    }

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

    private fun waitForWeb(text: String) {
        rule.waitUntil(30000) { evaluate("document.body.textContent").contains(text) }
    }

    @Test
    fun nativeNavigationAndProfile() {
        enter()
        rule.onNodeWithText("Saved", useUnmergedTree = true).performClick()
        rule.onNodeWithText("Your saved mini-apps").assertExists()
        rule.onNodeWithText("Profile", useUnmergedTree = true).performClick()
        rule.onNodeWithText("Privacy & data").assertExists()
    }

    @Test
    fun colorClashRunsInsideTrustedNativeHost() {
        enter()
        rule.onNodeWithText("Color Clash", useUnmergedTree = true).performScrollTo().performClick()
        rule.onNodeWithText("Try now").performClick()
        waitForWeb("Match the COLOR")
        rule.onNodeWithContentDescription("Close mini-app").assertExists()
        assertTrue(evaluate("location.origin").contains("mini.firsttry.invalid"))
        evaluate("document.cookie=\"shared=blocked;domain=mini.firsttry.invalid;path=/\"")
        assertEquals("\"\"", evaluate("document.cookie"))
        assertEquals(
            "false",
            evaluate("Boolean(globalThis.firsttryContext && globalThis.firsttryContext.token)"),
        )
        evaluate("document.querySelector('#choices button').click()")
        assertTrue(evaluate("document.getElementById('score').textContent").contains("Score"))
        rule.onNodeWithContentDescription("Close mini-app").performClick()
        rule.onNodeWithText("Skip").performClick()
        rule.onNode(hasScrollToIndexAction()).performScrollToNode(hasText("Fresh drops"))
        rule.onNodeWithText("Fresh drops").assertIsDisplayed()
    }

    @Test
    fun quizCompletionTravelsThroughRestrictedSdkToRealAnalytics() {
        enter()
        val testApi = Api(rule.activity)
        var appId = ""
        var before = 0
        fun completed(): Int = runBlocking {
            val versions =
                JSONObject(testApi.request("/developer/apps/$appId/analytics"))
                    .getJSONArray("versions")
            (0 until versions.length()).sumOf { versions.getJSONObject(it).getInt("completions") }
        }
        runBlocking {
            testApi.request(
                "/auth/login",
                "POST",
                JSONObject()
                    .put("email", "developer@firsttry.local")
                    .put("password", "FirstTry-local-2026!"),
            )
            appId = JSONObject(testApi.request("/catalog/tiny-quiz")).getString("id")
        }
        before = completed()
        rule.onNode(hasSetTextAction()).performTextInput("Tiny Quiz")
        rule
            .onNode(hasText("Tiny Quiz") and !hasSetTextAction(), useUnmergedTree = true)
            .performClick()
        rule.onNodeWithText("Try now").performClick()
        waitForWeb("QUESTION 1 OF 4")
        for (answer in listOf("Mars", "Page structure", "Dolphin", "Six")) evaluate(
            "Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='${answer}').click()"
        )
        waitForWeb("Curiosity rewarded")
        assertTrue(evaluate("document.querySelector('.large').textContent").contains("4"))
        assertTrue(evaluate("typeof globalThis.firsttryNative").contains("object"))
        rule.waitUntil(10000) { completed() > before }
        rule.onNodeWithContentDescription("Close mini-app").performClick()
        rule.onNodeWithText("Skip").performClick()
    }

    @Test
    fun uploadedBundleReviewPublishAndroidPlayFeedbackAndTakedown() {
        enter()
        val testApi = Api(rule.activity)
        val slug = "native-" + System.currentTimeMillis()
        var appId = ""
        var versionId = ""
        fun signIn(email: String) = runBlocking {
            testApi.request(
                "/auth/login",
                "POST",
                JSONObject().put("email", email).put("password", "FirstTry-local-2026!"),
            )
        }
        signIn("developer@firsttry.local")
        runBlocking {
            appId =
                JSONObject(
                        testApi.request(
                            "/developer/apps",
                            "POST",
                            JSONObject()
                                .put("slug", slug)
                                .put("title", "Native Rehearsal")
                                .put("summary", "Uploaded, reviewed and played on Android")
                                .put("category", "utility"),
                        )
                    )
                    .getString("id")
            val manifest =
                JSONObject()
                    .put("id", slug)
                    .put("name", "Native Rehearsal")
                    .put("description", "A complete native publishing rehearsal")
                    .put("version", "1.0.0")
                    .put("runtime", "webview-v1")
                    .put("entry", "index.html")
                    .put("category", "utility")
                    .put("estimatedDurationSeconds", 30)
                    .put("ageRating", "general")
                    .put("capabilities", org.json.JSONArray().put("host.analytics"))
                    .put("network", JSONObject().put("allowedDomains", org.json.JSONArray()))
                    .put("assets", JSONObject())
            val html =
                "<!doctype html><title>Native Rehearsal</title><h1>Uploaded native rehearsal</h1><button id=\"complete\">Finish task</button><script src=\"app.js\"></script>"
            val js =
                "document.getElementById('complete').addEventListener('click',()=>{document.body.dataset.complete='yes';firsttryNative.postMessage(JSON.stringify({method:'analytics.track',nonce:firsttryContext.nonce,id:crypto.randomUUID(),name:'task_completed',props:{completed:true}}));});"
            val out = java.io.ByteArrayOutputStream()
            java.util.zip.ZipOutputStream(out).use { zip ->
                for ((name, value) in
                    mapOf(
                        "manifest.json" to manifest.toString(),
                        "index.html" to html,
                        "app.js" to js,
                    )) {
                    zip.putNextEntry(java.util.zip.ZipEntry(name))
                    zip.write(value.toByteArray())
                    zip.closeEntry()
                }
            }
            versionId =
                JSONObject(
                        testApi.request(
                            "/developer/apps/$appId/upload",
                            "POST",
                            JSONObject()
                                .put(
                                    "zipBase64",
                                    android.util.Base64.encodeToString(
                                        out.toByteArray(),
                                        android.util.Base64.NO_WRAP,
                                    ),
                                ),
                        )
                    )
                    .getString("id")
            assertTrue(
                runCatching {
                        testApi.request(
                            "/developer/apps/$appId/release",
                            "POST",
                            JSONObject().put("versionId", versionId),
                        )
                    }
                    .isFailure
            )
            testApi.request(
                "/developer/apps/$appId/versions/$versionId/submit-review",
                "POST",
                JSONObject(),
            )
        }
        signIn("admin@firsttry.local")
        runBlocking {
            testApi.request(
                "/admin/reviews/$versionId/decision",
                "POST",
                JSONObject()
                    .put("decision", "approved")
                    .put("reason", "Native automated rehearsal fixture reviewed"),
            )
        }
        signIn("developer@firsttry.local")
        runBlocking {
            testApi.request(
                "/developer/apps/$appId/release",
                "POST",
                JSONObject().put("versionId", versionId),
            )
        }
        rule.runOnUiThread {
            rule.activity.startActivity(
                android.content
                    .Intent(
                        android.content.Intent.ACTION_VIEW,
                        android.net.Uri.parse("firsttry://mini/$slug"),
                        rule.activity,
                        MainActivity::class.java,
                    )
                    .addFlags(android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP)
            )
        }
        waitForWeb("Uploaded native rehearsal")
        evaluate("document.getElementById('complete').click()")
        rule.waitUntil(10000) {
            runBlocking {
                JSONObject(testApi.request("/developer/apps/$appId/analytics"))
                    .getJSONArray("versions")
                    .getJSONObject(0)
                    .getInt("completions") == 1
            }
        }
        rule.onNodeWithContentDescription("Close mini-app").performClick()
        rule.onNodeWithText("Anything to share?").performTextInput("Useful uploaded mini-app")
        rule.onNodeWithText("Send", useUnmergedTree = true).performClick()
        rule.waitUntil(10000) {
            runBlocking {
                org.json.JSONArray(testApi.request("/developer/apps/$appId/feedback")).length() == 1
            }
        }
        rule.runOnUiThread {
            rule.activity.startActivity(
                android.content
                    .Intent(
                        android.content.Intent.ACTION_VIEW,
                        android.net.Uri.parse("firsttry://mini/$slug"),
                        rule.activity,
                        MainActivity::class.java,
                    )
                    .addFlags(android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP)
            )
        }
        waitForWeb("Uploaded native rehearsal")
        signIn("admin@firsttry.local")
        runBlocking {
            testApi.request(
                "/admin/apps/$appId/suspend",
                "POST",
                JSONObject().put("reason", "Native rehearsal cleanup and takedown"),
            )
        }
        assertTrue(runBlocking { runCatching { testApi.request("/catalog/$slug") }.isFailure })
        // LaunchedEffect polling uses the Compose-controlled test dispatcher.
        rule.mainClock.advanceTimeBy(16000)
        rule.waitUntil(30000) {
            rule.onAllNodesWithContentDescription("Close mini-app").fetchSemanticsNodes().isEmpty()
        }
    }
}
