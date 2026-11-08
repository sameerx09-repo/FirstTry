package app.firsttry.host

import java.net.URI
import java.security.MessageDigest

object RuntimePolicy {
    fun permits(url: String, origin: String): Boolean =
        try {
            val target = URI(url)
            val expected = URI(origin)
            target.scheme == "https" &&
                target.host == expected.host &&
                target.port == expected.port &&
                target.rawUserInfo == null &&
                target.rawPath.split('/').none { it == ".." || it.contains("%", true) } &&
                target.rawQuery == null
        } catch (_: Exception) {
            false
        }

    fun hash(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

    fun safePath(path: String): Boolean =
        path.matches(Regex("[a-zA-Z0-9][a-zA-Z0-9._/-]*")) &&
            !path.contains("..") &&
            !path.contains('\\') &&
            path.split('/').size <= 5
}
