package app.firsttry.host

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

private val green = Color(0xFF078B4E)

data class Mini(
    val id: String,
    val slug: String,
    val title: String,
    val summary: String,
    val category: String,
    val icon: String,
    val color: Color,
    val creator: String,
    val developer: String,
    val version: String,
    val seconds: Int,
)

private fun JSONObject.mini() =
    Mini(
        getString("id"),
        getString("slug"),
        getString("title"),
        optString("summary"),
        optString("category"),
        optString("icon", "◈"),
        runCatching { Color(android.graphics.Color.parseColor(optString("color", "#078b4e"))) }
            .getOrDefault(green),
        optString("creator", "Creator"),
        optString("developer_id"),
        optString("semver"),
        optJSONObject("manifest")?.optInt("estimatedDurationSeconds", 30) ?: 30,
    )

private fun JSONArray.objects() = (0 until length()).map { getJSONObject(it) }

class MainActivity : ComponentActivity() {
    private var link by mutableStateOf<Uri?>(null)
    private var linkSequence by mutableIntStateOf(0)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        link = intent.data
        linkSequence++
        setContent {
            MaterialTheme(
                colorScheme =
                    lightColorScheme(
                        primary = green,
                        background = Color(0xFFEDEDED),
                        surface = Color.White,
                    )
            ) {
                FirstTry(link, linkSequence)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        link = intent.data
        linkSequence++
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FirstTry(link: Uri?, linkSequence: Int = 0) {
    val context = LocalContext.current
    val api = remember { Api(context) }
    val scope = rememberCoroutineScope()
    val prefs = remember {
        context.getSharedPreferences("firsttry-preferences", Context.MODE_PRIVATE)
    }
    var handledLink by remember { mutableStateOf("") }
    var onboarded by remember { mutableStateOf(prefs.getBoolean("onboarded", false)) }
    var tab by remember { mutableStateOf("Discover") }
    var apps by remember { mutableStateOf<List<Mini>>(emptyList()) }
    var saved by remember { mutableStateOf<List<Mini>>(emptyList()) }
    var recent by remember { mutableStateOf<List<String>>(emptyList()) }
    var selected by remember { mutableStateOf<Mini?>(null) }
    var active by remember { mutableStateOf<LoadedMini?>(null) }
    var activeApp by remember { mutableStateOf<Mini?>(null) }
    var error by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var query by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("") }
    var menu by remember { mutableStateOf(false) }
    var feedback by remember { mutableStateOf<Mini?>(null) }
    var feedbackBody by remember { mutableStateOf("") }
    var feedbackRating by remember { mutableStateOf("up") }
    var report by remember { mutableStateOf<Mini?>(null) }
    var reportCategory by remember { mutableStateOf("other") }
    var reportBody by remember { mutableStateOf("") }
    var login by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var userName by remember { mutableStateOf("Guest explorer") }
    var panel by remember { mutableStateOf("") }
    var rows by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
    suspend fun refresh() {
        apps = JSONObject(api.request("/catalog")).getJSONArray("items").objects().map { it.mini() }
        saved = JSONArray(api.request("/saved")).objects().map { it.mini() }
        recent = JSONArray(api.request("/history")).objects().map { it.getString("id") }
    }
    fun action(block: suspend () -> Unit) {
        scope.launch {
            try {
                error = ""
                block()
            } catch (e: Exception) {
                error = e.message ?: "Something went wrong"
            }
        }
    }
    fun launchApp(a: Mini, version: String? = null) {
        action {
            busy = true
            try {
                active = loadMini(api, a.id, version)
                activeApp = a
                selected = null
                refresh()
            } finally {
                busy = false
            }
        }
    }
    fun closeApp() {
        val loaded = active
        feedback = activeApp
        feedbackBody = ""
        active = null
        activeApp = null
        menu = false
        if (loaded != null)
            action {
                runCatching {
                    api.request(
                        "/sessions/${loaded.grant.getString("sessionId")}/end",
                        "POST",
                        JSONObject(),
                        loaded.token,
                    )
                }
                refresh()
            }
    }
    fun saveApp(a: Mini) {
        action {
            api.request(
                "/apps/${a.id}/save",
                if (saved.any { it.id == a.id }) "DELETE" else "POST",
                JSONObject(),
            )
            refresh()
        }
    }
    fun share(a: Mini) {
        context.startActivity(
            Intent.createChooser(
                Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, "firsttry://mini/${a.slug}")
                },
                "Share mini-app",
            )
        )
    }
    LaunchedEffect(Unit) {
        busy = true
        try {
            api.request("/auth/guest", "POST", JSONObject())
            refresh()
            runCatching { userName = JSONObject(api.request("/me")).getString("name") }
        } catch (e: Exception) {
            error = e.message ?: "Unable to connect"
        } finally {
            busy = false
        }
    }
    LaunchedEffect(link, apps, userName, linkSequence) {
        if (
            link != null &&
                (link.toString() + ":" + linkSequence) != handledLink &&
                apps.isNotEmpty() &&
                active == null
        ) {
            handledLink = link.toString() + ":" + linkSequence
            if (link.scheme == "firsttry" && link.host == "mini") {
                action {
                    val slug =
                        link.lastPathSegment
                            ?: throw IllegalArgumentException("Missing mini-app slug")
                    val listing = JSONObject(api.request("/catalog/" + Uri.encode(slug))).mini()
                    launchApp(listing)
                }
            } else if (link.scheme == "firsttry" && link.host == "preview") {
                val id = link.lastPathSegment
                // ?dev=1 opens the newest live-reload build of the app.
                val version =
                    link.getQueryParameter("version")
                        ?: if (link.getQueryParameter("dev") == "1") "dev" else null
                if (id != null && version != null) {
                    val a =
                        apps.find { it.id == id }
                            ?: Mini(
                                id,
                                "",
                                "Private preview",
                                "",
                                "",
                                "◈",
                                green,
                                "Developer",
                                "",
                                "",
                                30,
                            )
                    launchApp(a, version)
                }
            }
        }
    }
    // Live reload (debug host only): while a dev build is open, long-poll for a newer
    // build and swap to a fresh session when one is uploaded by `firsttry dev`.
    LaunchedEffect(active?.grant?.optString("sessionId")) {
        val current = active
        if (!BuildConfig.DEBUG || current == null || !current.grant.optBoolean("dev")) {
            return@LaunchedEffect
        }
        val appId = current.grant.getString("appId")
        var after = current.grant.getString("versionId")
        while (isActive) {
            try {
                val latest =
                    JSONObject(
                        api.request("/developer/apps/$appId/dev/latest?after=$after&wait=10")
                    )
                if (!latest.isNull("versionId")) {
                    val next = loadMini(api, appId, "dev")
                    val previous = active
                    active = next
                    after = next.grant.getString("versionId")
                    if (previous != null)
                        runCatching {
                            api.request(
                                "/sessions/${previous.grant.getString("sessionId")}/end",
                                "POST",
                                JSONObject(),
                                previous.token,
                            )
                        }
                }
            } catch (e: Exception) {
                if (e is CancellationException) throw e
                delay(3000)
            }
        }
    }
    BackHandler(enabled = active != null || selected != null) {
        if (active != null) closeApp() else selected = null
    }
    if (!onboarded) {
        Column(
            Modifier.fillMaxSize().background(Color(0xFFF3F6F0)).padding(28.dp),
            verticalArrangement = Arrangement.Center,
        ) {
            Text("✳ FirstTry", fontSize = 28.sp, color = green, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(40.dp))
            Text("A little curious?", fontSize = 36.sp, fontWeight = FontWeight.Bold)
            Text(
                "Quick games. Useful tools. New things to try.",
                modifier = Modifier.padding(vertical = 20.dp),
            )
            Text(
                "One host app, no individual mini-app installs. No camera, contacts or location access. This beta is for adults 18+."
            )
            Spacer(Modifier.height(28.dp))
            Button(
                onClick = {
                    onboarded = true
                    prefs.edit().putBoolean("onboarded", true).apply()
                },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("I'm 18+ · Start exploring")
            }
            TextButton(onClick = { panel = "Privacy & data" }) { Text("Privacy information") }
        }
    } else
        Scaffold(
            containerColor = Color(0xFFEDEDED),
            topBar = {
                if (active != null) {
                    TopAppBar(
                        title = {
                            Column {
                                Text(activeApp?.title ?: "Mini-app", fontSize = 17.sp)
                                Text(
                                    "by ${activeApp?.creator?:"Creator"}",
                                    fontSize = 11.sp,
                                    color = Color.Gray,
                                )
                            }
                        },
                        actions = {
                            Row(Modifier.background(Color(0xFFF0F1EF), RoundedCornerShape(30.dp))) {
                                IconButton(onClick = { menu = true }) {
                                    Icon(Icons.Outlined.MoreVert, "Mini-app menu")
                                }
                                IconButton(onClick = { closeApp() }) {
                                    Icon(Icons.Outlined.Close, "Close mini-app")
                                }
                            }
                        },
                    )
                } else if (selected != null)
                    TopAppBar(
                        title = { Text("Mini-app") },
                        navigationIcon = {
                            IconButton(onClick = { selected = null }) {
                                Icon(Icons.Outlined.ArrowBack, "Back")
                            }
                        },
                        actions = {
                            IconButton(onClick = { share(selected!!) }) {
                                Icon(Icons.Outlined.Share, "Share")
                            }
                        },
                    )
                else
                    TopAppBar(
                        title = {
                            Text(
                                if (tab == "Discover") "FirstTry" else tab,
                                fontWeight = FontWeight.Bold,
                            )
                        },
                        actions = {
                            Text(
                                "✳",
                                color = green,
                                fontSize = 25.sp,
                                modifier = Modifier.padding(20.dp),
                            )
                        },
                    )
            },
            bottomBar = {
                if (active == null && selected == null)
                    NavigationBar(containerColor = Color(0xFFFAFBF9)) {
                        listOf(
                                "Discover" to Icons.Outlined.Home,
                                "Trending" to Icons.Outlined.Star,
                                "Saved" to Icons.Outlined.FavoriteBorder,
                                "Profile" to Icons.Outlined.Person,
                            )
                            .forEach { (name, icon) ->
                                NavigationBarItem(
                                    selected = tab == name,
                                    onClick = {
                                        tab = name
                                        category = ""
                                        query = ""
                                    },
                                    icon = { Icon(icon, name) },
                                    label = { Text(name) },
                                )
                            }
                    }
            },
        ) { padding ->
            Column(Modifier.fillMaxSize().padding(padding)) {
                if (error.isNotBlank())
                    Row(
                        Modifier.fillMaxWidth().background(Color(0xFFFFEEE7)).padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(error, Modifier.weight(1f), fontSize = 12.sp)
                        TextButton(
                            onClick = {
                                action {
                                    refresh()
                                    error = ""
                                }
                            }
                        ) {
                            Text("Retry")
                        }
                    }
                if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                if (active != null) {
                    // Keyed by session so a live-reload swap rebuilds the WebView.
                    key(active!!.grant.getString("sessionId")) {
                        MiniRuntime(
                            active!!,
                            api,
                            Modifier.fillMaxSize(),
                            onClose = { closeApp() },
                            onFeedback = { feedback = activeApp },
                            onError = { message ->
                                active = null
                                activeApp = null
                                error = message
                            },
                        )
                    }
                } else if (selected != null) {
                    val a = selected!!
                    Column(
                        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        AppIcon(a, 80)
                        Text(
                            a.title,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(top = 22.dp),
                        )
                        Text(a.summary, modifier = Modifier.padding(12.dp))
                        Text("by ${a.creator}", color = Color.Gray)
                        Text(
                            "${a.category} · ${a.seconds} sec · General audience",
                            fontSize = 12.sp,
                            modifier = Modifier.padding(24.dp),
                        )
                        Button(onClick = { launchApp(a) }, modifier = Modifier.fillMaxWidth()) {
                            Text("Try now")
                        }
                        OutlinedButton(
                            onClick = { saveApp(a) },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(if (saved.any { it.id == a.id }) "Saved ✓" else "Save for later")
                        }
                        Card(Modifier.padding(top = 24.dp)) {
                            Text(
                                "Reviewed web experience. No sensitive device permissions. Trusted host controls stay available.",
                                Modifier.padding(20.dp),
                                fontSize = 13.sp,
                            )
                        }
                        TextButton(onClick = { report = a }) { Text("Report this mini-app") }
                    }
                } else if (tab == "Profile") {
                    Column(Modifier.padding(16.dp).verticalScroll(rememberScrollState())) {
                        Card {
                            Row(
                                Modifier.fillMaxWidth().padding(24.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(
                                    Icons.Outlined.AccountCircle,
                                    "",
                                    Modifier.size(56.dp),
                                    tint = Color.Gray,
                                )
                                Column(Modifier.padding(start = 15.dp)) {
                                    Text(userName, fontWeight = FontWeight.Bold)
                                    TextButton(onClick = { login = true }) {
                                        Text("Sign in", fontSize = 12.sp)
                                    }
                                }
                            }
                        }
                        Spacer(Modifier.height(22.dp))
                        listOf(
                                "Privacy & data",
                                "Blocked creators",
                                "My reports",
                                "Help & support",
                                "About FirstTry",
                            )
                            .forEach { name ->
                                ListItem(
                                    headlineContent = { Text(name) },
                                    trailingContent = {
                                        Icon(Icons.Outlined.KeyboardArrowRight, "")
                                    },
                                    modifier =
                                        Modifier.clickable {
                                            action {
                                                panel = name
                                                rows =
                                                    when (name) {
                                                        "Blocked creators" ->
                                                            JSONArray(api.request("/blocks"))
                                                                .objects()
                                                        "My reports" ->
                                                            JSONArray(api.request("/my-reports"))
                                                                .objects()
                                                        else -> emptyList()
                                                    }
                                            }
                                        },
                                )
                            }
                    }
                } else {
                    val visible =
                        (if (tab == "Saved") saved else apps).filter {
                            (category.isBlank() || it.category == category) &&
                                (query.isBlank() || (it.title + it.summary).contains(query, true))
                        }
                    LazyColumn(
                        Modifier.fillMaxSize().padding(horizontal = 15.dp),
                        verticalArrangement = Arrangement.spacedBy(1.dp),
                    ) {
                        item {
                            OutlinedTextField(
                                query,
                                { query = it },
                                label = { Text("Search mini-apps") },
                                leadingIcon = { Icon(Icons.Outlined.Search, "") },
                                modifier = Modifier.fillMaxWidth().padding(bottom = 14.dp),
                                singleLine = true,
                            )
                        }
                        if (tab == "Discover" && query.isBlank()) {
                            if (recent.isNotEmpty())
                                item {
                                    Text(
                                        "Recently used",
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(vertical = 12.dp),
                                    )
                                    Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                                        recent
                                            .take(4)
                                            .mapNotNull { id -> apps.find { it.id == id } }
                                            .forEach { a ->
                                                Column(
                                                    Modifier.width(70.dp).clickable {
                                                        launchApp(a)
                                                    },
                                                    horizontalAlignment =
                                                        Alignment.CenterHorizontally,
                                                ) {
                                                    AppIcon(a, 58)
                                                    Text(
                                                        a.title,
                                                        fontSize = 10.sp,
                                                        maxLines = 1,
                                                        modifier = Modifier.padding(top = 8.dp),
                                                    )
                                                }
                                            }
                                    }
                                }
                            item {
                                Row(
                                    Modifier.fillMaxWidth().padding(vertical = 16.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                ) {
                                    listOf(
                                            "games" to "Games",
                                            "fun" to "Fun",
                                            "creative" to "Creative",
                                            "utility" to "Utility",
                                        )
                                        .forEach { (key, title) ->
                                            FilterChip(
                                                selected = category == key,
                                                onClick = {
                                                    category = if (category == key) "" else key
                                                },
                                                label = { Text(title, fontSize = 11.sp) },
                                            )
                                        }
                                }
                            }
                            if (category.isBlank())
                                item {
                                    Card(
                                        colors =
                                            CardDefaults.cardColors(
                                                containerColor = Color(0xFFDEF0DE)
                                            ),
                                        modifier = Modifier.fillMaxWidth(),
                                    ) {
                                        Column(Modifier.padding(20.dp)) {
                                            Text(
                                                "YOUR DAILY LITTLE CHALLENGE",
                                                fontSize = 9.sp,
                                                color = green,
                                            )
                                            Text(
                                                "Thirty seconds.\nHow many colors?",
                                                fontSize = 25.sp,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(vertical = 12.dp),
                                            )
                                            Button(
                                                onClick = {
                                                    apps
                                                        .find { it.slug == "color-clash" }
                                                        ?.let { launchApp(it) }
                                                }
                                            ) {
                                                Text("Try Color Clash")
                                            }
                                        }
                                    }
                                }
                        }
                        item {
                            Text(
                                if (tab == "Trending") "Editor's picks"
                                else if (tab == "Saved") "Your saved mini-apps" else "Fresh drops",
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(vertical = 18.dp),
                            )
                            if (tab == "Trending")
                                Text(
                                    "Curated while real engagement signals grow.",
                                    fontSize = 12.sp,
                                    color = Color.Gray,
                                )
                        }
                        if (visible.isEmpty())
                            item {
                                Text(
                                    "Nothing here yet. Try another category or save a mini-app.",
                                    Modifier.padding(24.dp),
                                    color = Color.Gray,
                                )
                            }
                        visible.forEach { a ->
                            item(key = a.id) {
                                Row(
                                    Modifier.fillMaxWidth().background(Color.White).padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Row(
                                        Modifier.weight(1f).clickable { selected = a },
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        AppIcon(a, 48)
                                        Column(Modifier.padding(start = 12.dp)) {
                                            Text(
                                                a.title,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 14.sp,
                                            )
                                            Text(
                                                a.summary,
                                                fontSize = 11.sp,
                                                color = Color.Gray,
                                                maxLines = 1,
                                            )
                                            Text(
                                                "${a.category} · ${a.seconds} sec",
                                                fontSize = 10.sp,
                                                color = Color.Gray,
                                            )
                                        }
                                    }
                                    TextButton(onClick = { launchApp(a) }) { Text("Try") }
                                }
                            }
                        }
                        item {
                            Text(
                                "Small experiences. No individual app installs.",
                                Modifier.padding(vertical = 25.dp),
                                fontSize = 10.sp,
                                color = Color.Gray,
                            )
                        }
                    }
                }
            }
        }
    if (menu)
        ModalBottomSheet(onDismissRequest = { menu = false }) {
            val a = activeApp
            listOf(
                    "Save / unsave",
                    "Share",
                    "Feedback",
                    "Report",
                    "Block creator",
                    "Clear app data",
                )
                .forEach { name ->
                    ListItem(
                        headlineContent = { Text(name) },
                        modifier =
                            Modifier.clickable {
                                menu = false
                                if (a != null)
                                    when (name) {
                                        "Save / unsave" -> saveApp(a)
                                        "Share" -> share(a)
                                        "Feedback" -> feedback = a
                                        "Report" -> report = a
                                        "Block creator" ->
                                            action {
                                                api.request(
                                                    "/developers/${a.developer}/block",
                                                    "POST",
                                                    JSONObject(),
                                                )
                                                active = null
                                                activeApp = null
                                                refresh()
                                            }
                                        "Clear app data" ->
                                            action {
                                                api.request(
                                                    "/me/app-data/${a.id}",
                                                    "DELETE",
                                                    JSONObject(),
                                                )
                                                active = null
                                                activeApp = null
                                                refresh()
                                            }
                                    }
                            },
                    )
                }
        }
    if (feedback != null)
        AlertDialog(
            onDismissRequest = { feedback = null },
            title = { Text("Worth a little break?") },
            text = {
                Column {
                    Text("Optional feedback for ${feedback!!.title}")
                    Row {
                        FilterChip(
                            selected = feedbackRating == "up",
                            onClick = { feedbackRating = "up" },
                            label = { Text("Enjoyed it") },
                        )
                        FilterChip(
                            selected = feedbackRating == "down",
                            onClick = { feedbackRating = "down" },
                            label = { Text("Could be better") },
                        )
                    }
                    OutlinedTextField(
                        feedbackBody,
                        { if (it.length <= 140) feedbackBody = it },
                        label = { Text("Anything to share?") },
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val a = feedback!!
                        action {
                            api.request(
                                "/apps/${a.id}/feedback",
                                "POST",
                                JSONObject().put("rating", feedbackRating).put("body", feedbackBody),
                            )
                            feedback = null
                        }
                    }
                ) {
                    Text("Send")
                }
            },
            dismissButton = { TextButton(onClick = { feedback = null }) { Text("Skip") } },
        )
    if (report != null)
        AlertDialog(
            onDismissRequest = { report = null },
            title = { Text("Report mini-app") },
            text = {
                Column {
                    listOf("harmful", "scam", "privacy", "ip", "other").forEach { c ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(
                                selected = reportCategory == c,
                                onClick = { reportCategory = c },
                            )
                            Text(c)
                        }
                    }
                    OutlinedTextField(
                        reportBody,
                        { if (it.length <= 500) reportBody = it },
                        label = { Text("Details") },
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val a = report!!
                        action {
                            api.request(
                                "/apps/${a.id}/report",
                                "POST",
                                JSONObject()
                                    .put("category", reportCategory)
                                    .put("detail", reportBody),
                            )
                            report = null
                        }
                    }
                ) {
                    Text("Send report")
                }
            },
            dismissButton = { TextButton(onClick = { report = null }) { Text("Cancel") } },
        )
    if (login)
        AlertDialog(
            onDismissRequest = { login = false },
            title = { Text("Sign in") },
            text = {
                Column {
                    OutlinedTextField(email, { email = it }, label = { Text("Email") })
                    OutlinedTextField(
                        password,
                        { password = it },
                        label = { Text("Password") },
                        visualTransformation =
                            androidx.compose.ui.text.input.PasswordVisualTransformation(),
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        action {
                            val u =
                                JSONObject(
                                    api.request(
                                        "/auth/login",
                                        "POST",
                                        JSONObject().put("email", email).put("password", password),
                                    )
                                )
                            userName = u.getString("name")
                            handledLink = ""
                            password = ""
                            login = false
                            refresh()
                        }
                    }
                ) {
                    Text("Sign in")
                }
            },
            dismissButton = { TextButton(onClick = { login = false }) { Text("Cancel") } },
        )
    if (panel.isNotBlank())
        AlertDialog(
            onDismissRequest = { panel = "" },
            title = { Text(panel) },
            text = {
                Column {
                    if (panel == "Blocked creators" || panel == "My reports") {
                        if (rows.isEmpty()) Text("No items yet.")
                        rows.forEach { r ->
                            Row {
                                Text(
                                    r.optString("name", r.optString("title")) +
                                        " " +
                                        r.optString("status"),
                                    Modifier.weight(1f),
                                )
                                if (panel == "Blocked creators")
                                    TextButton(
                                        onClick = {
                                            action {
                                                api.request(
                                                    "/developers/${r.getString("id")}/block",
                                                    "DELETE",
                                                    JSONObject(),
                                                )
                                                rows = JSONArray(api.request("/blocks")).objects()
                                                refresh()
                                            }
                                        }
                                    ) {
                                        Text("Unblock")
                                    }
                            }
                        }
                    } else {
                        Text(
                            if (panel == "Privacy & data")
                                "The host uses a random guest identifier. Mini-apps receive no login credentials. Reporting and feedback are optional. Clear individual app data from its menu."
                            else
                                "FirstTry local development edition. Discover reviewed mini-apps and use host controls to report problems."
                        )
                        if (panel == "Privacy & data")
                            TextButton(
                                onClick = {
                                    action {
                                        api.request("/me", "DELETE", JSONObject())
                                        api.clearCookies()
                                        api.request("/auth/guest", "POST", JSONObject())
                                        userName = "Guest explorer"
                                        panel = ""
                                        refresh()
                                    }
                                }
                            ) {
                                Text("Delete my account / guest data")
                            }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { panel = "" }) { Text("Close") } },
        )
}

@Composable
private fun AppIcon(a: Mini, size: Int) {
    Box(
        Modifier.size(size.dp).background(a.color, RoundedCornerShape((size / 4).dp)),
        contentAlignment = Alignment.Center,
    ) {
        Text(a.icon, color = Color.White, fontSize = (size * .55).sp, fontWeight = FontWeight.Bold)
    }
}
