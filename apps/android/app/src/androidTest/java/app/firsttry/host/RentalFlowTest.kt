package app.firsttry.host

import android.content.Intent
import android.net.Uri
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
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/** Tests the published RentalFlow bundle in the actual signed Android runtime. */
class RentalFlowTest {
    @get:Rule val rule = createAndroidComposeRule<MainActivity>()
    private fun web(view: View): WebView? {
        if (view is WebView) return view
        if (view is ViewGroup) for (i in 0 until view.childCount) web(view.getChildAt(i))?.let { return it }
        return null
    }
    private fun evaluate(script: String): String {
        val result = AtomicReference("")
        val done = CountDownLatch(1)
        rule.runOnUiThread {
            val target = web(rule.activity.window.decorView)
            if (target == null) done.countDown()
            else target.evaluateJavascript(script) { result.set(it); done.countDown() }
        }
        assertTrue("WebView evaluation timed out", done.await(5, TimeUnit.SECONDS))
        return result.get()
    }
    private fun checkJs(expression: String) { assertEquals(expression, "true", evaluate("Boolean($expression)")) }
    private fun click(selector: String) {
        checkJs("(()=>{const e=document.querySelector(${JSONObject.quote(selector)});if(!e)return false;e.click();return true})()")
    }
    private fun fill(selector: String, value: String, event: String = "") {
        checkJs("(()=>{const e=document.querySelector(${JSONObject.quote(selector)});if(!e)return false;e.value=${JSONObject.quote(value)};${if (event.isEmpty()) "" else "e.dispatchEvent(new Event('$event',{bubbles:true}));"}return true})()")
    }
    private fun submit(selector: String) {
        checkJs("(()=>{const e=document.querySelector(${JSONObject.quote(selector)});if(!e)return false;e.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));return true})()")
    }
    private fun waitFor(text: String) { rule.waitUntil(30000) { evaluate("document.body.innerText").contains(text) } }
    private fun openRentalFlow() {
        rule.runOnUiThread {
            rule.activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("firsttry://mini/rentalflow"), rule.activity, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP))
        }
        waitFor("A good day to make moves.")
    }
    @Before fun startPublishedDemo() {
        if (rule.onAllNodesWithText("I'm 18+ · Start exploring").fetchSemanticsNodes().isNotEmpty())
            rule.onNodeWithText("I'm 18+ · Start exploring").performClick()
        rule.waitUntil(30000) { rule.onAllNodesWithText("Search mini-apps").fetchSemanticsNodes().isNotEmpty() }
        val available = runBlocking { runCatching { Api(rule.activity).request("/catalog/rentalflow") }.isSuccess }
        assumeTrue("RentalFlow must be published on the configured local API", available)
        openRentalFlow()
        evaluate("window.__rentalErrors=[];window.addEventListener('error',e=>window.__rentalErrors.push(e.message));")
        checkJs("location.origin.endsWith('.mini.firsttry.invalid')")
        checkJs("!!globalThis.firsttryNative && !!globalThis.firsttryContext")
    }
    @Test fun searchFiltersAndHistoricalCommuteRoutes() {
        click("[data-action='tenant']")
        checkJs("document.querySelectorAll('#home-list .property').length===17")
        fill("#search", "Kondapur", "input")
        checkJs("document.querySelectorAll('#home-list .property').length>0 && [...document.querySelectorAll('#home-list .locality')].every(e=>e.textContent.toLowerCase()==='kondapur')")
        fill("#search", "no-such-home-xyz", "input")
        waitFor("No homes match those filters.")
        fill("#search", "", "input")
        fill("#rent-filter", "50000", "change")
        fill("#bhk-filter", "2", "change")
        checkJs("document.querySelectorAll('#home-list .property').length===2 && [...document.querySelectorAll('#home-list .property')].every(e=>e.querySelector('.property-art span').textContent.startsWith('2 BHK') && Number(e.querySelector('.price').firstChild.textContent.replace(/[^0-9]/g,''))<=50000)")
        fill("#rent-filter", "0", "change"); fill("#bhk-filter", "0", "change")
        click("[data-action='route']")
        checkJs("!!document.querySelector('[role=dialog] .route-line')")
        waitFor("not live traffic")
        click("[data-action='direction'][data-dir='evening']")
        checkJs("document.querySelector('[data-dir=evening]').classList.contains('active')")
        click("[data-action='direction'][data-dir='morning']")
        checkJs("document.querySelector('[data-dir=morning]').classList.contains('active')")
        click("[data-action='dismiss']")
        checkJs("!document.querySelector('[role=dialog]') && !document.querySelector('#app').inert && window.__rentalErrors.length===0")
    }
    @Test fun shortlistFeedbackPreferencesAndReset() {
        click("[data-screen='homes']"); click("[data-action='publish']")
        waitFor("Select one to three different homes.")
        click("[data-action='agent']"); click("[data-action='build']")
        checkJs("document.querySelectorAll('.pick.selected').length===3")
        click(".pick:not(.selected)")
        waitFor("Select no more than three homes.")
        checkJs("document.querySelectorAll('.pick.selected').length===3")
        click("[data-action='publish']")
        checkJs("document.querySelectorAll('.property').length===3")
        click("[data-action='draft']")
        checkJs("document.querySelector('#draft').value.includes('Availability needs confirmation')")
        waitFor("no WhatsApp message is sent")
        click("[data-action='dismiss']"); click("[data-action='tenant']")
        click("[data-action='interest']")
        checkJs("document.querySelectorAll('.liked').length===1")
        click("[data-action='pass']")
        checkJs("document.querySelectorAll('.liked').length===0 && document.querySelectorAll('.passed').length===1")
        click("[data-action='agent']"); click("[data-screen='more']"); click("[data-action='preferences']")
        fill("[name='budget']", "999"); submit("#preferences-form")
        waitFor("Check the budget, BHK, and commute limit.")
        fill("[name='budget']", "50000"); fill("[name='bhk']", "2"); fill("[name='max']", "25"); submit("#preferences-form")
        checkJs("!document.querySelector('[role=dialog]')")
        click("[data-screen='shortlist']")
        checkJs("!!document.querySelector('.review')")
        click("[data-screen='more']"); click("[data-action='reset']"); click("[data-action='reset-confirm']")
        waitFor("Build a shortlist from 17 imported homes.")
        click("[data-screen='shortlist']")
        checkJs("document.querySelectorAll('.property').length===0 && window.__rentalErrors.length===0")
    }
    @Test fun futureVisitsDuplicatesAcknowledgementAndConflictChecks() {
        click("[data-action='build']"); click("[data-action='publish']"); click("[data-action='tenant']")
        click("[data-action='request']")
        fill("[name='date']", "2000-01-01"); submit("#visit-form")
        waitFor("Choose a future date and time in IST.")
        val future = JSONObject("{\"date\":" + evaluate("RentalFlowModel.day(new Date(Date.now()+2*86400000))") + "}").getString("date")
        fill("[name='date']", future); fill("[name='time']", "17:00"); submit("#visit-form")
        checkJs("!document.querySelector('[role=dialog]')")
        click("[data-action='request']")
        fill("[name='date']", future); fill("[name='time']", "17:00"); submit("#visit-form")
        waitFor("This visit has already been requested.")
        click("[data-action='dismiss']")
        click(".property:nth-of-type(2) [data-action='request']")
        fill("[name='date']", future); fill("[name='time']", "17:10"); submit("#visit-form")
        click("[data-action='agent']"); click("[data-screen='visits']")
        checkJs("document.querySelectorAll('.visit').length===2")
        click("[data-action='confirm']")
        waitFor("Acknowledge the simulated availability check first.")
        click("[data-ack]"); click("[data-action='confirm']")
        checkJs("document.querySelectorAll('.confirmed').length===1")
        click("[data-ack]"); click("[data-action='confirm']")
        waitFor("A confirmed visit is within 30 minutes.")
        checkJs("document.querySelectorAll('.confirmed').length===1")
        click("[data-action='tenant']"); click("[data-screen='visits']")
        waitFor("Confirmed in demo")
        checkJs("window.__rentalErrors.length===0")
    }
    @Test fun sdkCloseAndReopenStartsFreshSession() {
        click("[data-action='build']"); click("[data-action='publish']")
        click("[data-screen='more']"); click("[data-action='close']")
        rule.waitUntil(10000) { rule.onAllNodesWithContentDescription("Close mini-app").fetchSemanticsNodes().isEmpty() }
        rule.onNodeWithText("Skip").performClick()
        openRentalFlow()
        click("[data-screen='shortlist']")
        checkJs("document.querySelectorAll('.property').length===0")
        click("[data-screen='visits']")
        checkJs("document.querySelectorAll('.visit').length===0")
        rule.onNodeWithContentDescription("Close mini-app").assertExists()
    }
}
