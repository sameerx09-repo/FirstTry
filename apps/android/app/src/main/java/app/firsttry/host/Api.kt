package app.firsttry.host

import android.content.Context
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

class Api(context: Context) {
    private val prefs = context.getSharedPreferences("firsttry-host", Context.MODE_PRIVATE)
    private var cookies = prefs.getString("cookies", "")!!

    suspend fun request(
        path: String,
        method: String = "GET",
        body: JSONObject? = null,
        grant: String? = null,
    ): String =
        withContext(Dispatchers.IO) {
            val connection = URL(BuildConfig.API_URL + path).openConnection() as HttpURLConnection
            connection.connectTimeout = 10000
            connection.readTimeout = 15000
            connection.requestMethod = method
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("x-firsttry-request", "1")
            if (grant != null) connection.setRequestProperty("Authorization", "Bearer $grant")
            else connection.setRequestProperty("Cookie", cookies)
            if (body != null) {
                connection.doOutput = true
                connection.outputStream.use { it.write(body.toString().toByteArray()) }
            }
            try {
                val incoming =
                    connection.headerFields
                        .filterKeys { it?.equals("Set-Cookie", true) == true }
                        .values
                        .flatten()
                        .map { it.substringBefore(';') }
                if (incoming.isNotEmpty()) {
                    val map =
                        cookies
                            .split("; ")
                            .filter { it.contains('=') }
                            .associate { it.substringBefore('=') to it }
                            .toMutableMap()
                    incoming.forEach { map[it.substringBefore('=')] = it }
                    cookies = map.values.joinToString("; ")
                    prefs.edit().putString("cookies", cookies).apply()
                }
                val ok = connection.responseCode in 200..299
                val text =
                    (if (ok) connection.inputStream else connection.errorStream)
                        ?.bufferedReader()
                        ?.use { it.readText() } ?: ""
                if (!ok)
                    throw IllegalStateException(
                        runCatching { JSONObject(text).getString("error") }
                            .getOrDefault("Connection failed (${connection.responseCode})")
                    )
                text
            } finally {
                connection.disconnect()
            }
        }

    suspend fun binary(path: String, grant: String): ByteArray =
        withContext(Dispatchers.IO) {
            val c =
                URL(BuildConfig.API_URL + path.removePrefix("/api/v1")).openConnection()
                    as HttpURLConnection
            c.setRequestProperty("Authorization", "Bearer $grant")
            c.connectTimeout = 10000
            c.readTimeout = 15000
            try {
                check(c.responseCode == 200) { "Bundle unavailable" }
                c.inputStream.use { stream ->
                    val output = java.io.ByteArrayOutputStream()
                    val buffer = ByteArray(8192)
                    while (true) {
                        val n = stream.read(buffer)
                        if (n < 0) break
                        check(output.size() + n <= 2 * 1024 * 1024) { "Bundle too large" }
                        output.write(buffer, 0, n)
                    }
                    output.toByteArray()
                }
            } finally {
                c.disconnect()
            }
        }

    fun clearCookies() {
        cookies = ""
        prefs.edit().clear().apply()
    }
}
